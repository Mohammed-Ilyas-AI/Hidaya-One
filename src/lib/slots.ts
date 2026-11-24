/** Publishing slots, Asia/Kolkata (3 Shorts/day). */
export const SLOTS_IST = ["07:00", "13:00", "19:30"];

/** Today's IST slots that are still at least `leadMin` minutes away, as ISO UTC timestamps. */
export function remainingSlotsToday(nowMs = Date.now(), leadMin = 30): string[] {
  const day = new Date(nowMs + 5.5 * 3_600_000).toISOString().slice(0, 10);
  return SLOTS_IST.map((t) => new Date(`${day}T${t}:00+05:30`).toISOString()).filter((iso) => Date.parse(iso) - nowMs >= leadMin * 60_000);
}
