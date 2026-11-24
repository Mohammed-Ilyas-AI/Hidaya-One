#!/usr/bin/env node
// Hidaya One — YouTube sign-in (Google OAuth 2.0 installed-app / "Desktop app" loopback flow).
//
// RUN THIS ON THE SAME COMPUTER AS YOUR BROWSER (e.g. Windows PowerShell). Google redirects your browser to
// http://127.0.0.1:<port>; that address only reaches a listener running on that same computer — not Cloud Shell,
// not a remote/SSH terminal, not a cloud container.
//
//   node scripts/youtube-auth.mjs --client "C:\path\to\client_secret_XXXX.json"
//
// What it does: starts a loopback listener on 127.0.0.1 (OS-chosen free port) → confirms it is listening →
// opens Google sign-in (state + PKCE S256) → receives exactly one callback → exchanges the code → verifies
// access READ-ONLY (channel name) → saves the refresh token to a NEW file (never overwrites, never printed).
// It never uploads or publishes anything. Requires Node.js 18+; no npm packages.
import { createServer } from "node:http";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, chmodSync, openSync, closeSync } from "node:fs";
import { spawn } from "node:child_process";
import { homedir, platform } from "node:os";
import path from "node:path";

const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"];
const AUTH_URL = process.env.HIDAYAH_OAUTH_AUTH_URL ?? "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = process.env.HIDAYAH_OAUTH_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const YT_API = process.env.HIDAYAH_YOUTUBE_API ?? "https://www.googleapis.com/youtube/v3";
const STORE_DIR = process.env.HIDAYAH_HOME ?? path.join(homedir(), ".hidayah");
const LOCK = path.join(STORE_DIR, "youtube-auth.lock");
const TIMEOUT_MS = Number(process.env.HIDAYAH_OAUTH_TIMEOUT_MS ?? 5 * 60 * 1000);

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const flag = (k) => process.argv.includes(`--${k}`);
const log = (msg) => console.log(`[hidayah-auth] ${msg}`);
const fail = (msg) => { console.error(`[hidayah-auth] ERROR: ${msg}`); cleanup(); process.exit(1); };
const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

let server = null, timer = null, lockHeld = false;
function cleanup() {
  if (timer) clearTimeout(timer);
  if (server) { server.closeAllConnections?.(); server.close(); server = null; }
  if (lockHeld) { try { unlinkSync(LOCK); } catch {} lockHeld = false; }
}
process.on("SIGINT", () => { log("cancelled"); cleanup(); process.exit(130); });

// ---------- 0. environment sanity: the browser must be on this machine ----------
function remoteWarning() {
  const why = [];
  if (process.env.CLOUD_SHELL || process.env.DEVSHELL_PROJECT_ID) why.push("Google Cloud Shell");
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT) why.push("an SSH session");
  if (process.env.CODESPACES || process.env.GITPOD_WORKSPACE_ID) why.push("a cloud dev environment");
  if (existsSync("/.dockerenv")) why.push("a container");
  return why;
}

// ---------- 1. single-instance lock ----------
function acquireLock() {
  mkdirSync(STORE_DIR, { recursive: true });
  if (existsSync(LOCK)) {
    const pid = Number(readFileSync(LOCK, "utf8"));
    let alive = false; try { process.kill(pid, 0); alive = true; } catch {}
    if (alive && pid !== process.pid) fail(`another sign-in is already running (pid ${pid}). Finish or close it first.`);
    unlinkSync(LOCK);                                   // stale lock from a crashed run
  }
  const fd = openSync(LOCK, "wx"); writeFileSync(fd, String(process.pid)); closeSync(fd);
  lockHeld = true;
}

// ---------- 2. loopback listener (start + verify BEFORE the browser opens) ----------
function startListener(expectedState, onCode) {
  return new Promise((resolve, reject) => {
    let handled = false;
    server = createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      if (u.pathname === "/__health") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("ok"); }
      if (req.method !== "GET" || u.pathname !== "/") { res.writeHead(404); return res.end(); }
      if (handled) { res.writeHead(409, { "Content-Type": "text/plain" }); return res.end("Already handled. You can close this tab."); }
      const page = (title, body) => `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font-family:system-ui;padding:40px"><h2>${title}</h2><p>${body}</p></body>`;
      const state = u.searchParams.get("state") ?? "";
      const okState = state.length === expectedState.length && timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
      if (!okState) {
        log("callback rejected: state did not match (ignored; still waiting)");
        res.writeHead(400, { "Content-Type": "text/html" }); return res.end(page("Sign-in rejected", "This request did not come from the Hidaya One sign-in you started."));
      }
      handled = true;
      const err = u.searchParams.get("error");
      if (err) {
        res.writeHead(200, { "Content-Type": "text/html" }); res.end(page("Sign-in cancelled", `Google returned: ${err.replace(/[^\w.-]/g, "")}. You can close this tab.`));
        return onCode(null, new Error(`Google returned "${err}" (consent denied or app not allowed)`));
      }
      const code = u.searchParams.get("code");
      if (!code) { res.writeHead(400); res.end(); return onCode(null, new Error("callback had no authorization code")); }
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(page("Hidaya One is signed in ✔", "You can close this tab and return to the terminal."));
      log("callback received (authorization code captured, not shown)");
      onCode(code, null);
    });
    server.on("error", (e) => reject(new Error(`listener failed to start: ${e.code ?? e.message}`)));
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));   // port 0 → OS picks a free port
  });
}

async function verifyListening(port) {
  const r = await fetch(`http://127.0.0.1:${port}/__health`).catch((e) => ({ ok: false, statusText: e.message }));
  if (!r.ok) throw new Error(`listener is not reachable on 127.0.0.1:${port} (${r.statusText})`);
}

// ---------- 3. browser ----------
function openBrowser(url) {
  const p = platform();
  const [cmd, args] = p === "win32" ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
    : p === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try { const c = spawn(cmd, args, { stdio: "ignore", detached: true }); c.on("error", () => {}); c.unref(); return true; } catch { return false; }
}

// ---------- main ----------
async function main() {
  const clientPath = arg("client") ?? process.env.HIDAYAH_YOUTUBE_CLIENT_FILE;
  if (!clientPath) fail('pass your OAuth client file: --client "C:\\path\\to\\client_secret_XXXX.json"');
  if (!existsSync(clientPath)) fail(`client file not found: ${clientPath}`);
  let client;
  try { client = JSON.parse(readFileSync(clientPath, "utf8")).installed; } catch { fail("client file is not valid JSON"); }
  if (!client?.client_id || !client?.client_secret) fail('client file is not a "Desktop app" OAuth client (missing "installed" section)');
  log(`OAuth client loaded (Desktop app, project ${client.project_id ?? "?"}); secret not shown`);

  const remote = remoteWarning();
  if (remote.length && !flag("allow-remote")) fail(`this looks like ${remote.join(" / ")}. The browser's 127.0.0.1 is your own computer, so run this on the computer where the browser is (e.g. Windows PowerShell). Override with --allow-remote only if the browser really runs here.`);
  if (process.env.WSL_DISTRO_NAME) log("WSL detected: Windows browsers reach 127.0.0.1 in WSL2 only with localhost forwarding (default on). If the browser cannot connect, run this in Windows PowerShell instead.");

  acquireLock();
  const state = b64url(randomBytes(32));
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash("sha256").update(verifier).digest());

  let resolveCode, rejectCode;
  const codePromise = new Promise((res, rej) => { resolveCode = res; rejectCode = rej; });
  const port = await startListener(state, (code, err) => (err ? rejectCode(err) : resolveCode(code)));
  await verifyListening(port);
  const redirectUri = `http://127.0.0.1:${port}`;
  log(`callback listener ready on ${redirectUri} (verified)`);

  const url = `${AUTH_URL}?` + new URLSearchParams({
    client_id: client.client_id, redirect_uri: redirectUri, response_type: "code", scope: SCOPES.join(" "),
    access_type: "offline", prompt: "consent", state, code_challenge: challenge, code_challenge_method: "S256",
  });
  timer = setTimeout(() => rejectCode(new Error(`no callback within ${Math.round(TIMEOUT_MS / 1000)} s — run the command again`)), TIMEOUT_MS);
  if (flag("no-browser")) log("--no-browser: open the sign-in link below yourself");
  else log(openBrowser(url) ? "browser opened — sign in as the YouTube CHANNEL OWNER and choose the Hidayah channel" : "could not open a browser automatically");
  console.log(`\nIf the browser did not open, copy this link into a browser ON THIS COMPUTER:\n${url}\n`);

  const code = await codePromise.catch((e) => fail(e.message));
  clearTimeout(timer); timer = null;
  server.close(); server = null;
  log("listener closed");

  log("exchanging authorization code for tokens …");
  const tr = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: client.client_id, client_secret: client.client_secret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }) });
  const tok = await tr.json().catch(() => ({}));
  if (!tr.ok) fail(`token exchange failed: HTTP ${tr.status} ${tok.error ?? ""} ${tok.error_description ?? ""}`.trim());
  if (!tok.refresh_token) fail("Google returned no refresh token. Remove 'Hidaya One' at https://myaccount.google.com/permissions and run again.");
  const granted = String(tok.scope ?? "").split(" ");
  const missing = SCOPES.filter((s) => !granted.includes(s));
  if (missing.length) fail(`consent did not grant: ${missing.join(", ")} — tick every box on the consent screen and run again`);
  log("token exchange succeeded (tokens not shown)");

  // READ-ONLY verification — no upload, no publish.
  const ch = await fetch(`${YT_API}/channels?part=snippet&mine=true`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const cj = await ch.json().catch(() => ({}));
  if (!ch.ok) fail(`read-only channel check failed: HTTP ${ch.status} ${cj.error?.message ?? ""} (is the YouTube Data API v3 enabled in project ${client.project_id}?)`);
  const channel = cj.items?.[0];
  if (!channel) fail("this Google account has no YouTube channel — sign in with the account (or brand account) that owns Hidayah");
  log(`verified read-only access to channel: "${channel.snippet.title}" (${channel.id})`);

  // Persist — never overwrite an existing token file.
  const base = path.join(STORE_DIR, "youtube-token.json");
  const dest = existsSync(base) ? path.join(STORE_DIR, `youtube-token.${new Date().toISOString().replace(/[:.]/g, "-")}.json`) : base;
  const record = { client_id: client.client_id, client_secret_file: path.resolve(clientPath), refresh_token: tok.refresh_token,
    scopes: granted, channel_id: channel.id, channel_title: channel.snippet.title, created_at: new Date().toISOString(), publish_mode: "DRAFT_ONLY" };
  writeFileSync(dest, JSON.stringify(record, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  try { chmodSync(dest, 0o600); } catch {}
  log(`refresh token saved (not shown) → ${dest}${dest !== base ? "  [existing youtube-token.json left untouched]" : ""}`);
  log("publish mode: DRAFT_ONLY — nothing will be uploaded until you change it.");
  cleanup();
}

main().catch((e) => fail(e.message));
