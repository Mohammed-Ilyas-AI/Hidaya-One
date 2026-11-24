// The nine specialised agents. "owns" is decided by code; "llm" is the only bounded task a model does.
// Agents never message each other: each reads typed records, does its step, writes a typed result and a
// Decision, and the Orchestrator moves the job forward only when the guard for the next step holds.

export interface AgentRole {
  n: number;
  id: string;
  name: string;
  owns: string;
  llm: string | null;
  module: string;
}

export const ROSTER: readonly AgentRole[] = [
  { n: 1, id: "orchestrator", name: "Orchestrator / Channel Director", owns: "Daily plan, job state machine, guards, retries, pause switch, daily report", llm: null, module: "src/produce.ts" },
  { n: 2, id: "strategist", name: "Strategist", owns: "Topic rotation; only registry verses are eligible; slot plan", llm: null, module: "src/produce.ts#nextVerses" },
  { n: 3, id: "researcher", name: "Islamic Researcher", owns: "Canonical Arabic from two editions, translations, recitation, hashes", llm: "Suggests candidate verse references only (logged, never used as text)", module: "src/agents/research.ts" },
  { n: 4, id: "verifier", name: "Islamic Verifier", owns: "Byte comparison, script and hash checks, verdict", llm: "Context review: can only block", module: "src/agents/verification.ts" },
  { n: 5, id: "scriptwriter", name: "Scriptwriter", owns: "Length, script, no-quote and no-repeat policies; template fallback", llm: "Tamil and English hook (schema output)", module: "src/agents/script.ts" },
  { n: 6, id: "creative", name: "Creative Director", owns: "Phrase timing at waqf marks, footage plates by mood, HyperFrames project", llm: null, module: "src/hf/build.ts" },
  { n: 7, id: "producer", name: "Producer", owns: "HyperFrames check and render, loudness to -14 LUFS", llm: null, module: "src/produce.ts#render" },
  { n: 8, id: "qa", name: "QA Guardian", owns: "Source-exact text, glyphs, layout, loudness, duration, black frames", llm: null, module: "src/agents/qc.ts" },
  { n: 9, id: "distributor", name: "Distributor", owns: "Code-issued release, YouTube upload and schedule, no duplicates", llm: null, module: "src/agents/publisher.ts" },
];

export const AGENT_IDS = ROSTER.map((a) => a.id);
