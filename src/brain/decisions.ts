// Decision ledger: every agent step writes one typed record (who, what, outcome, evidence, model, cost, time).
// Agents never talk to each other in free text; the Orchestrator reads these records to move a job forward.
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export type DecisionOutcome =
  | "ACCEPTED"        // the agent's output passed its contract and policies
  | "FALLBACK"        // the model output failed a contract/policy, or the model was down: the code fallback was used
  | "BLOCKED"         // a gate refused the item (it will not be published)
  | "SKIPPED"         // the Orchestrator did not run the step (guard false)
  | "FAILED";         // an error stopped the step

export interface Decision {
  runId: string;
  agent: string;
  outcome: DecisionOutcome;
  summary: string;
  /** SHA-256 of the canonical input, so a decision can be tied to exactly what the agent saw. */
  inputHash: string | null;
  /** Small structured result or evidence (never secrets, never full prompts). */
  evidence: unknown;
  model: string | null;
  ms: number;
  at: string;
}

export const hashOf = (v: unknown) => createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex");

export class DecisionLedger {
  readonly decisions: Decision[] = [];
  readonly runId: string;
  private readonly file: string | null;
  constructor(runId: string, file: string | null) {
    this.runId = runId;
    this.file = file;
    if (file) mkdirSync(path.dirname(file), { recursive: true });
  }

  record(d: Omit<Decision, "runId" | "at"> & { at?: string }): Decision {
    const full: Decision = { runId: this.runId, at: d.at ?? new Date().toISOString(), ...d };
    this.decisions.push(full);
    if (this.file) appendFileSync(this.file, JSON.stringify(full) + "\n");
    return full;
  }
}
