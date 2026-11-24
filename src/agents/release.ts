// Release approval (founder decision 2026-11-24: code approves, no per-video human approval).
//
// Code issues one release record per Short, only when every gate passed (verification VERIFIED, no QC FAIL,
// release gate READY_TO_PUBLISH). The record is bound to the exact content: script hash, render (MP4) hash,
// metadata hash, channel, platform, visibility and publish time, and signed with HMAC-SHA256
// (HIDAYAH_RELEASE_KEY, from Secret Manager in production). The publisher re-hashes everything and refuses to
// upload if anything differs, so a changed script, video, title or schedule can never reuse an old release, and
// no model can mint one (models never see the key and never call this module).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const RELEASE_VERSION = "1";
export type Visibility = "SCHEDULED_PUBLIC" | "PUBLIC" | "PRIVATE";

export interface ReleaseApproval {
  version: string;
  issuer: "CODE_GATES";
  shortId: string;
  platform: "youtube";
  channelId: string;
  visibility: Visibility;
  publishAt: string | null;
  scriptHash: string;
  renderHash: string;
  metadataHash: string;
  gates: { verification: string; qcFails: number; releaseGate: string };
  issuedAt: string;
  signature: string;
}

const sha256 = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");

/** Stable JSON (sorted keys) so the same metadata always hashes the same. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export const fileHash = (file: string) => sha256(readFileSync(file));
/** What is uploaded: snippet, status and paid-placement details (not the internal hidayah block). */
export const metadataHash = (md: any) => sha256(canonical({ snippet: md?.snippet, status: md?.status, paid: md?.paidProductPlacementDetails ?? null }));
export const scriptHash = (script: unknown) => sha256(canonical(script));

/** HIDAYAH_RELEASE_KEY (Secret Manager in production), else the local key file (never printed). */
export function releaseKey(): string | null {
  let k = process.env.HIDAYAH_RELEASE_KEY;
  if (!k) {
    const file = process.env.HIDAYAH_RELEASE_KEY_FILE ?? path.join(process.env.HIDAYAH_HOME ?? path.join(homedir(), ".hidayah"), "release-key");
    if (existsSync(file)) k = readFileSync(file, "utf8").trim();
  }
  return k && k.length >= 32 ? k : null;
}

const payload = (r: Omit<ReleaseApproval, "signature">) => canonical(r);
const sign = (r: Omit<ReleaseApproval, "signature">, key: string) => createHmac("sha256", key).update(payload(r)).digest("hex");

/** The visibility the publisher will use in a mode, for a slot. */
export function plannedVisibility(mode: string, publishAt?: string): Visibility {
  if (mode !== "AUTONOMOUS") return "PRIVATE";
  return publishAt ? "SCHEDULED_PUBLIC" : "PUBLIC";
}

/** Issues a release only when every gate passed. Returns the reason otherwise. */
export function issueRelease(input: {
  shortId: string;
  script: unknown;
  videoFile: string;
  metadata: any;
  verification: { verdict: string };
  qc: Array<{ status: string }>;
  channelId: string | undefined;
  mode: string;
  publishAt?: string;
  now?: Date;
}): { release: ReleaseApproval } | { refused: string } {
  const key = releaseKey();
  if (!key) return { refused: "HIDAYAH_RELEASE_KEY (32+ characters) is not configured" };
  if (!input.channelId) return { refused: "HIDAYAH_YOUTUBE_CHANNEL_ID is not configured" };
  const qcFails = input.qc.filter((c) => c.status === "FAIL").length;
  const releaseGate = input.metadata?.hidayah?.releaseGate ?? "missing";
  if (input.verification.verdict !== "VERIFIED") return { refused: `verification is ${input.verification.verdict}` };
  if (qcFails > 0) return { refused: `${qcFails} QC check(s) failed` };
  if (releaseGate !== "READY_TO_PUBLISH") return { refused: `release gate is ${releaseGate}` };
  const visibility = plannedVisibility(input.mode, input.publishAt);
  const unsigned: Omit<ReleaseApproval, "signature"> = {
    version: RELEASE_VERSION,
    issuer: "CODE_GATES",
    shortId: input.shortId,
    platform: "youtube",
    channelId: input.channelId,
    visibility,
    publishAt: visibility === "SCHEDULED_PUBLIC" ? input.publishAt! : null,
    scriptHash: scriptHash(input.script),
    renderHash: fileHash(input.videoFile),
    metadataHash: metadataHash(input.metadata),
    gates: { verification: input.verification.verdict, qcFails, releaseGate },
    issuedAt: (input.now ?? new Date()).toISOString(),
  };
  return { release: { ...unsigned, signature: sign(unsigned, key) } };
}

/** Checks a release against what is about to be uploaded. Returns the first mismatch, or null when it matches. */
export function checkRelease(
  r: ReleaseApproval | undefined | null,
  actual: { shortId: string; videoFile: string; metadata: any; channelId: string | null; visibility: Visibility; publishAt: string | null },
): string | null {
  if (!r) return "no release approval for this Short";
  const key = releaseKey();
  if (!key) return "HIDAYAH_RELEASE_KEY is not configured";
  const { signature, ...unsigned } = r;
  const expected = sign(unsigned, key);
  if (typeof signature !== "string" || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return "release signature is invalid";
  }
  if (r.version !== RELEASE_VERSION || r.issuer !== "CODE_GATES") return "unknown release version or issuer";
  if (r.shortId !== actual.shortId) return "release is for another Short";
  if (r.renderHash !== fileHash(actual.videoFile)) return "the video file changed after release";
  if (r.metadataHash !== metadataHash(actual.metadata)) return "the metadata changed after release";
  if (actual.channelId === null || r.channelId !== actual.channelId) return "release is for another channel";
  if (r.visibility !== actual.visibility || r.publishAt !== actual.publishAt) return "release was for a different visibility or publish time";
  return null;
}
