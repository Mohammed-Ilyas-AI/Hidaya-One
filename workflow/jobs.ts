import { randomUUID } from "node:crypto";
import type { ProducedAsset } from "./providers.ts";

/**
 * Job tracking for production runs (blueprint §11).
 *
 * `InMemoryJobStore` keeps jobs for the life of the process only. It exists so
 * the control logic (states, idempotency, approval) can be built and tested
 * now; a durable store with the same interface belongs to the backend phase.
 */

export const JOB_STATUSES = [
  "CREATED",
  "RUNNING",
  "WAITING_FOR_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STAGES = [
  "TOPIC_DISCOVERY_AND_RESEARCH",
  "VERIFICATION",
  "VERIFICATION_GATE",
  "SCRIPT",
  "CREATIVE_PLANNING",
  "VIDEO_SPECIFICATION",
  "ASSET_GENERATION",
  "EDIT_PLANNING",
  "NARRATION",
  "VIDEO_ASSEMBLY",
  "QUALITY_CONTROL",
  "RELEASE_PREPARATION",
  "HUMAN_APPROVAL",
  "PUBLISHING",
  "ANALYTICS",
] as const;
export type Stage = (typeof STAGES)[number];

export type StageStatus =
  | "COMPLETED"
  | "PASSED"
  | "PARTIAL"
  | "BLOCKED"
  | "FAILED"
  | "SKIPPED"
  | "NOT_CONNECTED"
  | "SIMULATED"
  | "REQUESTED"
  | "DISABLED";

export interface StageRecord {
  stage: Stage;
  /** Agent or code node that performed the stage. */
  actor: string;
  status: StageStatus;
  startedAt: string;
  finishedAt: string;
  /** Short description of what the stage received. */
  input: string;
  /** Structured or text output; null when the stage produced none. */
  output: unknown;
  error: string | null;
}

export interface ApprovalRecord {
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
  requestedAt: string;
  /** True only when a real rendered video exists and QC passed. */
  publishReady: boolean;
  decidedAt?: string;
  decidedBy?: string;
  note?: string;
}

export interface Job {
  jobId: string;
  workflowId: string;
  /** Caller-supplied key; a second start with the same key returns this job. */
  requestKey: string | null;
  request: string;
  status: JobStatus;
  /** Why the job ended where it did, in one word. */
  outcome: string | null;
  currentStage: Stage | null;
  /** Completed stage count over total stage count, 0–1. */
  progress: number;
  startedAt: string;
  completedAt: string | null;
  error: string | null;
  retryCount: number;
  stages: StageRecord[];
  approval: ApprovalRecord | null;
  /** Evidence run ID from the verification pipeline. */
  evidenceRunId: string | null;
  publication: { status: string; reference: string | null } | null;
  /** SHA-256 of the attested script draft; the basis of idempotency keys. */
  scriptDigest: string | null;
  /** Assets providers actually returned. Empty while nothing is connected. */
  assets: ProducedAsset[];
  releaseManifest: string | null;
}

/**
 * Retry policy per stage. Nothing retries automatically: a failed stage ends
 * the job, so no model or provider call is repeated without a person asking.
 * SAFE_RERUN stages have no side effects and may be re-run by starting a new
 * job. ONCE_PER_KEY stages are deduplicated by idempotency key, so a re-run
 * reuses the stored result instead of generating or publishing again.
 */
export const STAGE_RETRY_POLICY: Record<Stage, "SAFE_RERUN" | "ONCE_PER_KEY" | "NEVER_AUTOMATIC"> = {
  TOPIC_DISCOVERY_AND_RESEARCH: "SAFE_RERUN",
  VERIFICATION: "SAFE_RERUN",
  VERIFICATION_GATE: "SAFE_RERUN",
  SCRIPT: "SAFE_RERUN",
  CREATIVE_PLANNING: "SAFE_RERUN",
  VIDEO_SPECIFICATION: "SAFE_RERUN",
  ASSET_GENERATION: "ONCE_PER_KEY",
  EDIT_PLANNING: "SAFE_RERUN",
  NARRATION: "ONCE_PER_KEY",
  VIDEO_ASSEMBLY: "ONCE_PER_KEY",
  QUALITY_CONTROL: "SAFE_RERUN",
  RELEASE_PREPARATION: "SAFE_RERUN",
  HUMAN_APPROVAL: "NEVER_AUTOMATIC",
  PUBLISHING: "ONCE_PER_KEY",
  ANALYTICS: "SAFE_RERUN",
};

export interface JobStore {
  create(input: { request: string; requestKey: string | null; workflowId: string; now: string }): Job;
  get(jobId: string): Job | undefined;
  findByRequestKey(requestKey: string): Job | undefined;
  save(job: Job): void;
  list(filter?: { status?: JobStatus }): Job[];
  /**
   * Runs `operation` at most once per key and returns the stored result on
   * every later call. Used to stop duplicate media generation and publishing.
   * A failed operation is not stored, so it can be attempted again.
   */
  once<T>(key: string, operation: () => Promise<T>): Promise<{ result: T; reused: boolean }>;
}

export class InMemoryJobStore implements JobStore {
  private readonly jobs = new Map<string, Job>();
  private readonly results = new Map<string, Promise<unknown>>();

  create(input: { request: string; requestKey: string | null; workflowId: string; now: string }): Job {
    const job: Job = {
      jobId: `job-${randomUUID()}`,
      workflowId: input.workflowId,
      requestKey: input.requestKey,
      request: input.request,
      status: "CREATED",
      outcome: null,
      currentStage: null,
      progress: 0,
      startedAt: input.now,
      completedAt: null,
      error: null,
      retryCount: 0,
      stages: [],
      approval: null,
      evidenceRunId: null,
      publication: null,
      scriptDigest: null,
      assets: [],
      releaseManifest: null,
    };
    this.jobs.set(job.jobId, job);
    return job;
  }

  get(jobId: string): Job | undefined {
    return this.jobs.get(jobId);
  }

  findByRequestKey(requestKey: string): Job | undefined {
    return [...this.jobs.values()].find((job) => job.requestKey === requestKey);
  }

  save(job: Job): void {
    this.jobs.set(job.jobId, job);
  }

  list(filter: { status?: JobStatus } = {}): Job[] {
    return [...this.jobs.values()].filter((job) => !filter.status || job.status === filter.status);
  }

  async once<T>(key: string, operation: () => Promise<T>): Promise<{ result: T; reused: boolean }> {
    const existing = this.results.get(key);
    if (existing) return { result: (await existing) as T, reused: true };
    const pending = operation();
    this.results.set(key, pending);
    try {
      return { result: await pending, reused: false };
    } catch (error) {
      this.results.delete(key);
      throw error;
    }
  }
}
