// End-to-end test of scripts/youtube-auth.mjs against MOCK Google endpoints on 127.0.0.1.
// No real Google/YouTube call is made; nothing is uploaded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SECRET = "FAKE-client-secret-for-tests", REFRESH = "1//refresh-DO-NOT-PRINT", CODE = "4/code-DO-NOT-PRINT";

async function mockGoogle() {
  const seen: any = {};
  const srv = createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    if (req.url === "/token") {
      const p = new URLSearchParams(body); seen.token = Object.fromEntries(p);
      const ok = p.get("grant_type") === "refresh_token"
        ? p.get("refresh_token") === REFRESH && p.get("client_secret") === SECRET
        : p.get("code") === CODE && p.get("client_secret") === SECRET && (p.get("code_verifier") ?? "").length >= 43;
      res.writeHead(ok ? 200 : 400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(ok ? { access_token: "FAKE-access-token-for-tests", refresh_token: REFRESH, expires_in: 3599,
        scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly", token_type: "Bearer" } : { error: "invalid_grant" }));
    }
    if (req.url?.startsWith("/yt/channels")) { seen.channels = req.headers.authorization; res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify({ items: [{ id: "UCtest", snippet: { title: "Hidayah Test" } }] })); }
    if (req.url?.startsWith("/yt/")) { seen.unexpected = req.url; }   // any other YouTube call (e.g. upload) is a failure
    res.writeHead(404); res.end();
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  return { srv, seen, base: `http://127.0.0.1:${(srv.address() as any).port}` };
}

function runAuth(home: string, clientFile: string, base: string) {
  const child = spawn(process.execPath, ["scripts/youtube-auth.mjs", "--client", clientFile, "--no-browser", "--allow-remote"], {
    env: { ...process.env, HIDAYAH_HOME: home, HIDAYAH_OAUTH_TOKEN_URL: `${base}/token`, HIDAYAH_YOUTUBE_API: `${base}/yt`, HIDAYAH_OAUTH_TIMEOUT_MS: "20000" } });
  let out = "";
  child.stdout.on("data", (d) => (out += d)); child.stderr.on("data", (d) => (out += d));
  let t: NodeJS.Timeout;
  const link = new Promise<URL>((resolve) => { t = setInterval(() => { const m = out.match(/https:\/\/accounts\.google\.com\S+/); if (m) { clearInterval(t); resolve(new URL(m[0])); } }, 50); t.unref(); });
  const done = new Promise<number>((r) => child.on("exit", (c) => { clearInterval(t); r(c ?? -1); }));
  return { link, done, output: () => out };
}

function fixture() {
  const home = mkdtempSync(path.join(tmpdir(), "hidayah-auth-"));
  const clientFile = path.join(home, "client_secret_test.json");
  writeFileSync(clientFile, JSON.stringify({ installed: { client_id: "123.apps.googleusercontent.com", project_id: "test", client_secret: SECRET, redirect_uris: ["http://localhost"] } }));
  return { home, clientFile };
}

test("full loopback flow: listener first, state + PKCE, read-only verify, token saved, no secrets printed", async () => {
  const g = await mockGoogle(); const { home, clientFile } = fixture();
  const run = runAuth(home, clientFile, g.base);
  const url = await run.link;
  const redirect = url.searchParams.get("redirect_uri")!, state = url.searchParams.get("state")!;
  assert.match(redirect, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
  assert.ok(run.output().indexOf("listener ready") < run.output().indexOf("accounts.google.com"), "listener verified before link shown");

  const bad = await fetch(`${redirect}/?state=forged&code=${CODE}`);          // forged state is rejected, flow keeps waiting
  assert.equal(bad.status, 400);
  const good = await fetch(`${redirect}/?state=${encodeURIComponent(state)}&code=${encodeURIComponent(CODE)}`);
  assert.equal(good.status, 200);
  assert.equal(await run.done, 0, run.output());

  const tok = JSON.parse(readFileSync(path.join(home, "youtube-token.json"), "utf8"));
  assert.equal(tok.refresh_token, REFRESH); assert.equal(tok.publish_mode, "DRAFT_ONLY"); assert.equal(tok.channel_title, "Hidayah Test");
  assert.equal(tok.client_secret, undefined, "client secret is not copied into the token file");
  if (process.platform !== "win32") assert.equal(statSync(path.join(home, "youtube-token.json")).mode & 0o777, 0o600);
  for (const s of [SECRET, REFRESH, CODE, "FAKE-access-token"]) assert.ok(!run.output().includes(s), `output must not contain ${s}`);
  assert.equal(g.seen.unexpected, undefined, "no YouTube call other than the read-only channel check");
  assert.ok(!existsSync(path.join(home, "youtube-auth.lock")), "lock released");
  g.srv.closeAllConnections(); g.srv.close();
});

test("--verify in a fresh process refreshes the saved token and re-checks the channel read-only", async () => {
  const g = await mockGoogle(); const { home, clientFile } = fixture();
  const run = runAuth(home, clientFile, g.base); const url = await run.link;
  await fetch(`${url.searchParams.get("redirect_uri")}/?state=${encodeURIComponent(url.searchParams.get("state")!)}&code=${encodeURIComponent(CODE)}`);
  assert.equal(await run.done, 0);
  // simulate a restart: a brand-new process that only has the saved file
  const v = spawn(process.execPath, ["scripts/youtube-auth.mjs", "--verify"], { env: { ...process.env, HIDAYAH_HOME: home, HIDAYAH_OAUTH_TOKEN_URL: `${g.base}/token`, HIDAYAH_YOUTUBE_API: `${g.base}/yt` } });
  let out = ""; v.stdout.on("data", (d) => (out += d)); v.stderr.on("data", (d) => (out += d));
  assert.equal(await new Promise((r) => v.on("exit", r)), 0, out);
  assert.match(out, /verified: token works after restart/);
  assert.equal(g.seen.token.grant_type, "refresh_token");
  for (const s of [SECRET, REFRESH, "FAKE-access-token"]) assert.ok(!out.includes(s));
  g.srv.closeAllConnections(); g.srv.close();
});

test("an existing token file is never overwritten", async () => {
  const g = await mockGoogle(); const { home, clientFile } = fixture();
  writeFileSync(path.join(home, "youtube-token.json"), "{\"keep\":true}\n");
  const run = runAuth(home, clientFile, g.base);
  const url = await run.link;
  await fetch(`${url.searchParams.get("redirect_uri")}/?state=${encodeURIComponent(url.searchParams.get("state")!)}&code=${encodeURIComponent(CODE)}`);
  assert.equal(await run.done, 0, run.output());
  assert.equal(readFileSync(path.join(home, "youtube-token.json"), "utf8"), "{\"keep\":true}\n");
  assert.equal(readdirSync(home).filter((f) => /^youtube-token\..+\.json$/.test(f)).length, 1);
  g.srv.closeAllConnections(); g.srv.close();
});

test("a second sign-in is refused while one is running", async () => {
  const g = await mockGoogle(); const { home, clientFile } = fixture();
  const first = runAuth(home, clientFile, g.base); const url = await first.link;
  const second = runAuth(home, clientFile, g.base);
  assert.equal(await second.done, 1); assert.match(second.output(), /another sign-in is already running/);
  await fetch(`${url.searchParams.get("redirect_uri")}/?state=${encodeURIComponent(url.searchParams.get("state")!)}&code=${encodeURIComponent(CODE)}`);
  assert.equal(await first.done, 0);
  g.srv.closeAllConnections(); g.srv.close();
});

test("consent denied ends cleanly with a clear error", async () => {
  const g = await mockGoogle(); const { home, clientFile } = fixture();
  const run = runAuth(home, clientFile, g.base); const url = await run.link;
  await fetch(`${url.searchParams.get("redirect_uri")}/?state=${encodeURIComponent(url.searchParams.get("state")!)}&error=access_denied`);
  assert.equal(await run.done, 1); assert.match(run.output(), /access_denied/);
  assert.ok(!existsSync(path.join(home, "youtube-auth.lock")));
  g.srv.closeAllConnections(); g.srv.close();
});

test("publisher modes: AUTONOMOUS publishes (scheduled or now), PRIVATE_UPLOAD never does, pause and HOLD stop all", async () => {
  const { publish } = await import("../src/agents/publisher.ts");
  const dir = mkdtempSync(path.join(tmpdir(), "hidayah-pub-"));
  const video = path.join(dir, "v.mp4"); writeFileSync(video, "FAKE-VIDEO");
  const cwd = process.cwd(); process.chdir(dir); mkdirSync("registry");
  const sent: any[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: any, init: any = {}) => {
    const u = String(url);
    const json = (b: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(b), { status: 200, headers });
    if (u.includes("/token")) return json({ access_token: "FAKE-at" });
    if (u.includes("/channels")) return json({ items: [] });
    if (u.includes("uploadType=resumable")) { sent.push(JSON.parse(init.body)); return json({}, { location: "https://upload.example/put" }); }
    if (u.startsWith("https://upload.example")) return json({ id: `vid${sent.length}` });
    throw new Error(`unexpected ${u}`);
  }) as any;
  Object.assign(process.env, { YOUTUBE_CLIENT_ID: "id", YOUTUBE_CLIENT_SECRET: "TEST-PLACEHOLDER", YOUTUBE_REFRESH_TOKEN: "TEST-RT", HIDAYAH_PAUSE_FILE: "registry/PAUSE" });
  const md = { snippet: { tags: [] }, status: {}, hidayah: { releaseGate: "READY_TO_PUBLISH" } };
  try {
    process.env.HIDAYAH_PUBLISH_MODE = "AUTONOMOUS";
    const at = "2030-01-01T01:30:00.000Z";
    const s = await publish("a", video, md, { publishAt: at });
    assert.equal(s.status, "SCHEDULED"); assert.deepEqual([sent[0].status.privacyStatus, sent[0].status.publishAt], ["private", at]);
    const p = await publish("b", video, md);
    assert.equal(p.status, "PUBLISHED"); assert.equal(sent[1].status.privacyStatus, "public");
    assert.equal((await publish("a", video, md)).status, "ALREADY_UPLOADED", "never twice");
    assert.equal((await publish("c", video, { ...md, hidayah: { releaseGate: "HOLD" } })).status, "HOLD");
    writeFileSync("registry/PAUSE", "");
    assert.equal((await publish("d", video, md)).status, "PAUSED");
    rmSync("registry/PAUSE");
    process.env.HIDAYAH_PUBLISH_MODE = "PRIVATE_UPLOAD";
    const q = await publish("e", video, md, { publishAt: at });
    assert.equal(q.status, "UPLOADED_PRIVATE"); assert.equal(sent.at(-1).status.privacyStatus, "private"); assert.equal(sent.at(-1).status.publishAt, undefined);
    assert.equal(sent.length, 3, "no upload for HOLD, PAUSED or a repeat");
  } finally {
    globalThis.fetch = realFetch; process.chdir(cwd);
    for (const k of ["HIDAYAH_PUBLISH_MODE", "YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN", "HIDAYAH_PAUSE_FILE"]) delete process.env[k];
    rmSync(dir, { recursive: true, force: true });
  }
});

test("daily slots: only today's IST slots at least 30 minutes away", async () => {
  const { remainingSlotsToday } = await import("../src/lib/slots.ts");
  const t = Date.parse("2030-01-01T06:00:00+05:30");
  assert.deepEqual(remainingSlotsToday(t), ["2030-01-01T01:30:00.000Z", "2030-01-01T07:30:00.000Z", "2030-01-01T14:00:00.000Z"]);
  assert.deepEqual(remainingSlotsToday(Date.parse("2030-01-01T12:45:00+05:30")), ["2030-01-01T14:00:00.000Z"]);
  assert.deepEqual(remainingSlotsToday(Date.parse("2030-01-01T20:00:00+05:30")), []);
});

test("publisher stays in DRAFT_ONLY by default and does not upload", async () => {
  delete process.env.HIDAYAH_PUBLISH_MODE;
  const { publishPrivate, publishMode } = await import("../src/agents/publisher.ts");
  assert.equal(publishMode(), "DRAFT_ONLY");
  const r = await publishPrivate("x", "/nonexistent.mp4", { snippet: {}, status: {} });
  assert.equal(r.status, "DRAFT_ONLY");
});
