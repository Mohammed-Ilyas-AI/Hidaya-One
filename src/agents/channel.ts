// Agent 9 — Channel Manager: YouTube metadata package. Upload is NOT connected (no OAuth yet);
// when it is, the publisher must send privacyStatus "private" explicitly (API default is public since 2026-11-02).
import type { AyahRecord, Check, VerificationReport } from "../types.ts";
import type { Script } from "./script.ts";
import type { RunContext } from "./context.ts";

export function buildMetadata(rec: AyahRecord, sc: Script, ver: VerificationReport, qc: Check[]) {
  const ta = rec.translations.find((t) => t.lang === "ta")!, en = rec.translations.find((t) => t.lang === "en")!;
  const ref = `Al-Baqarah ${rec.surahNumber}:${rec.ayahNumber}`;
  const releasable = ver.verdict === "VERIFIED" && !qc.some((c) => c.status === "FAIL");
  return {
    snippet: {
      title: `Struggling? Seek help through patience and prayer | ${ref} #Shorts`,
      description: [
        `${sc.hookTa}`, "",
        rec.arabic.text, "",
        `${ta.text}`, `— ${ta.editionName}`, "",
        `${en.text}`, `— ${en.editionName}`, "",
        `Qur'an ${ref}. Recitation: ${rec.recitation?.reciter}.`,
        "Qur'an text: Tanzil Project (tanzil.net). Translations via alquran.cloud.",
        "#Sabr #Patience #Quran #பொறுமை #Hidayah",
      ].join("\n"),
      tags: ["sabr", "patience", "quran", "Al-Baqarah 2:153", "பொறுமை", "islamic reminder", "Hidayah"],
      categoryId: "27",
      defaultLanguage: "ta",
    },
    status: {
      privacyStatus: "private",                 // always explicit — never rely on the API default
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: false,            // painted motion graphics, no realistic AI people/places
    },
    paidProductPlacementDetails: { hasPaidProductPlacement: false },
    hidayah: {
      sourceId: rec.sourceId,
      releaseGate: releasable ? "READY_FOR_HUMAN_SIGNOFF" : "HOLD",
      uploadStatus: "NOT_UPLOADED (YouTube OAuth not connected)",
      openLicenseQuestions: rec.license.filter((l) => /NOT yet/.test(l)),
    },
  };
}

export async function channelManager(_ctx: RunContext, rec: AyahRecord, sc: Script, ver: VerificationReport, qc: Check[]) {
  const md = buildMetadata(rec, sc, ver, qc);
  return { value: md, summary: `metadata ready, privacy=private, gate=${md.hidayah.releaseGate}, upload not connected` };
}
