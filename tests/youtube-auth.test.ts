// End-to-end test of scripts/youtube-auth.mjs against MOCK Google endpoints on 127.0.0.1.
// No real Google/YouTube call is made; nothing is uploaded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SECRET = "FAKE-client-secret-for-tests", REFRESH = "1//refresh-DO-NOT-PRINT", CODE = "4/code-DO-NOT-PRINT";

async function mockGoogle() {
  const seen: any = {};
  const srv = createServer(async (req, res) => {
    let body = ""; for await (const c of req) body += c;
    if (req.url === "/token") {
      const p = new URLSearchParams(body); seen.token = Object.fromEntries(p);
      const ok = p.get("code") === CODE && p.get("client_secret") === SECRET && (p.get("code_verifier") ?? "").length >= 43;
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

test("publisher stays in DRAFT_ONLY by default and does not upload", async () => {
  delete process.env.HIDAYAH_PUBLISH_MODE;
  const { publishPrivate, publishMode } = await import("../src/agents/publisher.ts");
  assert.equal(publishMode(), "DRAFT_ONLY");
  const r = await publishPrivate("x", "/nonexistent.mp4", { snippet: {}, status: {} });
  assert.equal(r.status, "DRAFT_ONLY");
});
