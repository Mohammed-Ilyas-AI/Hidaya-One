/**
 * Provider adapters for media and publishing (blueprint §9).
 *
 * Nothing real is connected yet. The defaults below report NOT_CONFIGURED and
 * refuse to act, so the workflow records the truth instead of pretending a
 * file exists. A real adapter must set `simulated: false` only on assets a
 * provider actually returned.
 */

export type ConnectionStatus = "CONNECTED" | "NOT_CONFIGURED" | "DISABLED" | "DEGRADED" | "FAILED" | "BLOCKED";

export interface ProducedAsset {
  kind: "VIDEO_CLIP" | "NARRATION_AUDIO" | "RENDERED_VIDEO";
  /** Where the asset is stored. */
  uri: string;
  /** True for test doubles. A simulated asset can never be published. */
  simulated: boolean;
}

export type ProviderResult =
  | { status: "PRODUCED"; assets: ProducedAsset[] }
  | { status: "NOT_CONNECTED"; reason: string };

export interface MediaProvider {
  name: string;
  connectionStatus(): ConnectionStatus;
  /** `idempotencyKey` identifies the work; the caller guarantees one call per key. */
  produce(input: { idempotencyKey: string; brief: string }): Promise<ProviderResult>;
}

export type PublishResult =
  | { status: "PUBLISHED"; reference: string; simulated: boolean }
  | { status: "NOT_CONNECTED"; reason: string };

export interface Publisher {
  name: string;
  connectionStatus(): ConnectionStatus;
  publish(input: { idempotencyKey: string; video: ProducedAsset; manifest: string }): Promise<PublishResult>;
}

export interface Providers {
  video: MediaProvider;
  narration: MediaProvider;
  renderer: MediaProvider;
  publisher: Publisher;
}

function notConnected(name: string, reason: string): MediaProvider {
  return {
    name,
    connectionStatus: () => "NOT_CONFIGURED",
    produce: async () => ({ status: "NOT_CONNECTED", reason }),
  };
}

/** The production default: nothing is connected, and nothing claims to be. */
export const NOT_CONNECTED_PROVIDERS: Providers = {
  video: notConnected("video-generation", "VIDEO_GENERATION_TOOL_NOT_CONNECTED"),
  narration: notConnected("text-to-speech", "TTS_NOT_CONNECTED"),
  renderer: notConnected("video-renderer", "RENDERER_NOT_CONNECTED"),
  publisher: {
    name: "channel-publisher",
    connectionStatus: () => "NOT_CONFIGURED",
    publish: async () => ({ status: "NOT_CONNECTED", reason: "CHANNEL_API_NOT_CONNECTED" }),
  },
};
