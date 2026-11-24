// YouTube publisher (YouTube Data API v3, OAuth 2.0 "Desktop app" client, owner-granted refresh token).
// Modes (owner decision 2026-11-24: the channel publishes autonomously, no per-video approval):
//   DRAFT_ONLY      never upload (default when nothing is configured)
//   PRIVATE_UPLOAD  upload as private only
//   AUTONOMOUS      upload and publish: with publishAt the video is private until that time, then YouTube makes
//                   it public by itself; without publishAt it is public immediately
// Pause: HIDAYAH_PAUSED=1 or a registry/PAUSE file stops every upload at once.
// Every upload needs a code-issued release approval (src/agents/release.ts) that matches the exact video,
// metadata, channel, visibility and publish time; anything else is HOLD. There is no per-video human approval.
// Never upload the same Short twice (local ledger + a hidden tag checked on the channel before every upload).
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { checkRelease, plannedVisibility, releaseKey, type ReleaseApproval } from "./release.ts";

const OAUTH = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/youtube/v3";
const UPLOAD = "https://www.googleapis.com/upload/youtube/v3/videos";
const LEDGER = "registry/published.json";

export interface YouTubeCreds { clientId: string; clientSecret: string; refreshToken: string }

export type PublishMode = "DRAFT_ONLY" | "PRIVATE_UPLOAD" | "AUTONOMOUS";

/** From HIDAYAH_PUBLISH_MODE; anything unrecognised is DRAFT_ONLY. */
export function publishMode(): PublishMode {
  const m = process.env.HIDAYAH_PUBLISH_MODE;
  return m === "AUTONOMOUS" || m === "PRIVATE_UPLOAD" ? m : "DRAFT_ONLY";
}

/** Owner's emergency stop: HIDAYAH_PAUSED=1, or a registry/PAUSE file (create it to pause, delete it to resume). */
export function paused(): boolean {
  return process.env.HIDAYAH_PAUSED === "1" || existsSync(process.env.HIDAYAH_PAUSE_FILE ?? "registry/PAUSE");
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

/** The signed-in channel, and whether a Short with this hidden tag is already on it (50 most recent uploads). */
async function channelState(token: string, tag: string): Promise<{ channelId: string | null; existing: string | null }> {
  const H = { Authorization: `Bearer ${token}` };
  const ch: any = await (await fetch(`${API}/channels?part=id,contentDetails&mine=true`, { headers: H })).json();
  const channelId: string | null = ch.items?.[0]?.id ?? null;
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return { channelId, existing: null };
  const pl: any = await (await fetch(`${API}/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}`, { headers: H })).json();
  const ids = (pl.items ?? []).map((i: any) => i.contentDetails.videoId).join(",");
  if (!ids) return { channelId, existing: null };
  const vs: any = await (await fetch(`${API}/videos?part=snippet&id=${ids}`, { headers: H })).json();
  return { channelId, existing: (vs.items ?? []).find((v: any) => (v.snippet.tags ?? []).includes(tag))?.id ?? null };
}

export async function publish(shortId: string, file: string, metadata: any, opts: { publishAt?: string; release?: ReleaseApproval | null } = {}) {
  const mode = publishMode();
  if (mode === "DRAFT_ONLY") return { status: "DRAFT_ONLY" as const, detail: "upload disabled (HIDAYAH_PUBLISH_MODE is DRAFT_ONLY)" };
  if (paused()) return { status: "PAUSED" as const, detail: "publishing is paused (HIDAYAH_PAUSED or registry/PAUSE)" };
  if (metadata?.hidayah?.releaseGate !== "READY_TO_PUBLISH") {
    return { status: "HOLD" as const, detail: `release gate is ${metadata?.hidayah?.releaseGate ?? "missing"}, not READY_TO_PUBLISH` };
  }
  if (!opts.release) return { status: "HOLD" as const, detail: "no release approval for this Short" };
  if (!releaseKey()) return { status: "HOLD" as const, detail: "HIDAYAH_RELEASE_KEY is not configured" };
  const creds = credsFromEnv();
  if (!creds) return { status: "NOT_CONNECTED" as const, detail: "no YouTube credentials (run scripts/youtube-auth.mjs)" };
  const done = ledger()[shortId];
  if (done) return { status: "ALREADY_UPLOADED" as const, videoId: done.videoId };
  const token = await accessToken(creds);
  const tag = `hidayah-${shortId}`;
  const { channelId, existing } = await channelState(token, tag);
  if (existing) { recordUpload(shortId, existing); return { status: "ALREADY_UPLOADED" as const, videoId: existing }; }

  // AUTONOMOUS: scheduled → private with publishAt (YouTube publishes it then); unscheduled → public now.
  // PRIVATE_UPLOAD: always private; a publishAt is dropped so nothing becomes public by itself.
  const scheduled = mode === "AUTONOMOUS" && opts.publishAt ? opts.publishAt : undefined;
  const privacyStatus = mode === "AUTONOMOUS" && !scheduled ? "public" : "private";
  // The release must match exactly what is about to go out.
  const mismatch = checkRelease(opts.release, {
    shortId, videoFile: file, metadata, channelId, visibility: plannedVisibility(mode, scheduled), publishAt: scheduled ?? null,
  });
  if (mismatch) return { status: "HOLD" as const, detail: `release approval does not match: ${mismatch}` };
  const body = {
    snippet: { ...metadata.snippet, tags: [...(metadata.snippet.tags ?? []), tag] },
    status: { ...metadata.status, privacyStatus, ...(scheduled ? { publishAt: scheduled } : {}) },
    paidProductPlacementDetails: { hasPaidProductPlacement: false },
  };
  if (mode === "PRIVATE_UPLOAD" && (body.status.privacyStatus !== "private" || "publishAt" in body.status)) {
    throw new Error("PRIVATE_UPLOAD never publishes: refusing a public or scheduled upload");
  }
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
  const status = privacyStatus === "public" ? ("PUBLISHED" as const) : scheduled ? ("SCHEDULED" as const) : ("UPLOADED_PRIVATE" as const);
  return { status, videoId: v.id, publishAt: scheduled ?? null };
}

/** Kept for older callers: same as publish(). */
export const publishPrivate = publish;

function recordUpload(shortId: string, videoId: string) {
  const l = ledger(); l[shortId] = { videoId, uploadedAt: new Date().toISOString() };
  writeFileSync(LEDGER, JSON.stringify(l, null, 2) + "\n");
}
