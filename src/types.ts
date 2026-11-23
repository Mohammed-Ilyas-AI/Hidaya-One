// Shared contracts for the Hidayah production graph (TypeScript, strict).

export type Lang = "ar" | "ta" | "en";
export type Script = "ARABIC" | "TAMIL" | "LATIN";

/** One canonical text pulled from a named, versioned source — never from a model. */
export interface SourceText {
  editionId: string;       // e.g. "quran-uthmani", "ta.tamil", "en.sahih"
  editionName: string;
  provider: string;        // e.g. "api.alquran.cloud"
  lang: Lang;
  text: string;            // exact bytes as delivered
  sha256: string;
  fetchedAt: string;
}

export interface AyahRecord {
  sourceId: string;        // "quran:2:153"
  surahNumber: number;
  ayahNumber: number;
  surahNameEn: string;
  arabic: SourceText;
  arabicCrossCheck: SourceText;   // independent second source
  translations: SourceText[];
  recitation?: { reciter: string; url: string; localPath: string; durationSec: number; sha256: string };
  license: string[];
}

export type CheckStatus = "PASS" | "FAIL" | "WARN" | "SKIPPED";
export interface Check { id: string; status: CheckStatus; detail: string }

export interface VerificationReport {
  sourceId: string;
  checks: Check[];
  aiReview: { status: "APPROVED" | "CONCERNS" | "UNAVAILABLE"; model?: string; notes: string };
  verdict: "VERIFIED" | "BLOCKED";
}

/** A line that appears on screen. `origin` says where every word came from. */
export interface TextSegment {
  id: string;
  role: "title" | "hook" | "hook2" | "verse" | "ref" | "credit" | "trans_ta" | "trans_en" | "take_ta" | "take_en" | "brand";
  lang: Lang;
  dir: "rtl" | "ltr";
  text: string;
  start: number;
  end: number;
  origin: { kind: "source"; editionId: string; exact: "full" | "substring" } | { kind: "editorial"; author: string };
}

export interface Storyboard {
  id: string;
  topic: string;
  width: number; height: number; fps: number; duration: number;
  style: string;           // FavStash film look adapted for Hidayah
  segments: TextSegment[];
  light: { t: number; night: number }[];  // darkness → light keyframes (Sabr: hardship → relief)
  recitationStart: number;
}

export interface AgentLog { agent: string; startedAt: string; ms: number; summary: string; llm?: string }
