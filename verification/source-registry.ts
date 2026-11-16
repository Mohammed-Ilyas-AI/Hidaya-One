/**
 * Versioned trusted-source registry (Milestone 2).
 *
 * Being on this list is NOT evidence that a quotation is correct. It only
 * means evidence from the host is allowed to be compared by the gate; an
 * unregistered host, or a host used outside its registered role, sends the
 * record to human review.
 *
 * To change the list: edit this file, bump `version`, update the pinning test
 * in `gate.test.ts`, and record it in CHANGELOG.md. There is deliberately no
 * environment variable or runtime call that adds hosts.
 */

export const SOURCE_ROLES = [
  /** Arabic text of the Quran. */
  "QURAN_TEXT",
  /** Arabic text of a Hadith collection. */
  "HADITH_TEXT",
  /** Hadith authenticity grades attributed to a named scholar. */
  "GRADING_EVIDENCE",
  /** Secondary material. Never sufficient for wording or grading. */
  "SECONDARY_SUPPORT",
] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

export interface RegisteredSource {
  host: string;
  roles: readonly SourceRole[];
}

export interface SourceRegistry {
  version: string;
  sources: readonly RegisteredSource[];
}

export const DEFAULT_SOURCE_REGISTRY: SourceRegistry = Object.freeze({
  version: "2026-11-16.1",
  sources: Object.freeze([
    Object.freeze({ host: "quran.com", roles: Object.freeze(["QURAN_TEXT"] as const) }),
    Object.freeze({ host: "tanzil.net", roles: Object.freeze(["QURAN_TEXT"] as const) }),
    Object.freeze({ host: "sunnah.com", roles: Object.freeze(["HADITH_TEXT", "GRADING_EVIDENCE"] as const) }),
    Object.freeze({ host: "dorar.net", roles: Object.freeze(["HADITH_TEXT", "GRADING_EVIDENCE"] as const) }),
  ]),
});

export type SourceCheck =
  | { result: "OK"; host: string }
  | { result: "INVALID_URL" }
  | { result: "UNREGISTERED_HOST"; host: string }
  | { result: "WRONG_ROLE"; host: string };

/** Classifies a source URL against the registry for one required role. */
export function checkSource(rawUrl: string, role: SourceRole, registry: SourceRegistry): SourceCheck {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { result: "INVALID_URL" };
  }
  if (url.protocol !== "https:" || url.username || url.password) return { result: "INVALID_URL" };
  const host = url.hostname.toLowerCase();
  const entry = registry.sources.find((s) => {
    const base = s.host.toLowerCase();
    return host === base || host.endsWith(`.${base}`);
  });
  if (!entry) return { result: "UNREGISTERED_HOST", host };
  return entry.roles.includes(role) ? { result: "OK", host } : { result: "WRONG_ROLE", host };
}
