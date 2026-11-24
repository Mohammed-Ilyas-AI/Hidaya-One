// YouTube publisher (YouTube Data API v3, OAuth 2.0 "Desktop app" client, owner-granted refresh token).
// Rules: always privacyStatus "private" (API default is PUBLIC since 2026-11-02); optional publishAt schedule;
// never upload the same Short twice (local ledger + a hidden tag checked on the channel before every upload).
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const OAUTH = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const LEDGER = "registry/published.json";

export interface YouTubeCreds { clientId: string; clientSecret: string; refreshToken: string }

/** DRAFT_ONLY (default): never upload. PRIVATE_UPLOAD: upload as private (optionally scheduled). Nothing else exists. */
export function publishMode(): "DRAFT_ONLY" | "PRIVATE_UPLOAD" {
  return process.env.HIDAYAH_PUBLISH_MODE === "PRIVATE_UPLOAD" ? "PRIVATE_UPLOAD" : "DRAFT_ONLY";
}

/** Credentials from env vars, else from the token file written by scripts/youtube-auth.mjs (secret read from the client file). */
export function credsFromEnv(): YouTubeCreds | null {
  const { YOUTUBE_CLIENT_ID: clientId, YOUTUBE_CLIENT_SECRET: clientSecret, YOUTUBE_REFRESH_TOKEN: refreshToken } = process.env;
  if (clientId && clientSecret && refreshToken) return { clientId, clientSecret, refreshToken };
  const file = process.env.HIDAYAH_YOUTUBE_TOKEN_FILE ?? path.join(process.env.HIDAYAH_HOME ?? path.join(homedir(), ".hidayah"), "youtube-token.json");
  if (!existsSync(file)) return null;
  const t = JSON.parse(readFileSync(file, "utf8"));
  if (!t.refresh_token || !t.client_secret_file || !existsSync(t.client_secret_file)) return null;
  const c = JSON.parse(readFileSync(t.client_secret_file, "utf8")).installed;
  return c?.client_secret ? { clientId: t.client_id, clientSecret: c.client_secret, refreshToken: t.refresh_token } : null;
}

async function accessToken(c: YouTubeCreds): Promise<string> {
  const r = await fetch(OAUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken, grant_type: "refresh_token" }) });
  const j: any = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`OAuth refresh failed: ${j.error ?? r.status} ${j.error_description ?? ""}`);
  return j.access_token;
}

function ledger(): Record<string, { videoId: string; uploadedAt: string }> {
  return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : {};
}

/** Is a Short with this hidden tag already on the channel? (checks the 50 most recent uploads) */
async function alreadyOnChannel(token: string, tag: string): Promise<string | null> {
  const H = { Authorization: `Bearer ${token}` };
  const ch: any = await (await fetch(`${API}/channels?part=contentDetails&mine=true`, { headers: H })).json();
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return null;
  const pl: any = await (await fetch(`${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}`, { headers: H })).json();
  const ids = (pl.items ?? []).map((i: any) => i.contentDetails.videoId).join(",");
  if (!ids) return null;
  const vs: any = await (await fetch(`${API}/videos?part=snippet&id=${ids}`, { headers: H })).json();
  return (vs.items ?? []).find((v: any) => (v.snippet.tags ?? []).includes(tag))?.id ?? null;
}

export async function publishPrivate(shortId: string, file: string, metadata: any, opts: { publishAt?: string } = {}) {
  if (publishMode() === "DRAFT_ONLY") return { status: "DRAFT_ONLY" as const, detail: "upload disabled (HIDAYAH_PUBLISH_MODE is not PRIVATE_UPLOAD)" };
  const creds = credsFromEnv();
  if (!creds) return { status: "NOT_CONNECTED" as const, detail: "no YouTube credentials (run scripts/youtube-auth.mjs)" };
  const done = ledger()[shortId];
  if (done) return { status: "ALREADY_UPLOADED" as const, videoId: done.videoId };
  const token = await accessToken(creds);
  const tag = `hidayah-${shortId}`;
  const existing = await alreadyOnChannel(token, tag);
  if (existing) { recordUpload(shortId, existing); return { status: "ALREADY_UPLOADED" as const, videoId: existing }; }

  const body = {
    snippet: { ...metadata.snippet, tags: [...(metadata.snippet.tags ?? []), tag] },
    status: { ...metadata.status, privacyStatus: "private", ...(opts.publishAt ? { publishAt: opts.publishAt } : {}) },
    paidProductPlacementDetails: { hasPaidProductPlacement: false },
  };
  if (body.status.privacyStatus !== "private") throw new Error("refusing to upload a non-private video");
  const size = statSync(file).size;
  const init = await fetch(`${UPLOAD}?uploadType=resumable&part=snippet,status,paidProductPlacementDetails`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(size) },
    body: JSON.stringify(body),
  });
  const loc = init.headers.get("location");
  if (!init.ok || !loc) throw new Error(`upload init failed: ${init.status} ${await init.text()}`);
  const put = await fetch(loc, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(size) }, body: readFileSync(file) });
  const v: any = await put.json();
  if (!put.ok || !v.id) throw new Error(`upload failed: ${put.status} ${JSON.stringify(v).slice(0, 300)}`);
  recordUpload(shortId, v.id);
  return { status: "UPLOADED_PRIVATE" as const, videoId: v.id, publishAt: opts.publishAt ?? null };
}

function recordUpload(shortId: string, videoId: string) {
  const l = ledger(); l[shortId] = { videoId, uploadedAt: new Date().toISOString() };
  writeFileSync(LEDGER, JSON.stringify(l, null, 2) + "\n");
}
