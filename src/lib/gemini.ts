// Live Gemini API client (OpenAI-compatible endpoint, key injected by the network proxy in dev;
// in Cloud Run use ADK + Agent Platform with the service identity instead).
// Every call is bounded, logged and never trusted as a source of religious text.

export class GeminiUnavailable extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const KEY = process.env.GEMINI_API_KEY ?? "proxy-injected";

export interface ChatResult { text: string; model: string; usage?: unknown }

export async function chat(model: string, system: string, user: string, timeoutMs = 60000): Promise<ChatResult> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, temperature: 0.3, messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  if (!res.ok) throw new GeminiUnavailable(res.status, extractMessage(body));
  const d = JSON.parse(body);
  return { text: d.choices?.[0]?.message?.content ?? "", model, usage: d.usage };
}

/** Gemini TTS → WAV bytes. */
export async function speak(model: string, voice: string, text: string, timeoutMs = 120000): Promise<Buffer> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, modalities: ["audio"], audio: { voice, format: "wav" }, messages: [{ role: "user", content: text }] }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const body = await res.text();
  if (!res.ok) throw new GeminiUnavailable(res.status, extractMessage(body));
  const data = JSON.parse(body).choices?.[0]?.message?.audio?.data;
  if (!data) throw new GeminiUnavailable(500, "no audio in response");
  return Buffer.from(data, "base64");
}

function extractMessage(body: string): string {
  try { const j = JSON.parse(body); const e = Array.isArray(j) ? j[0]?.error : j.error; return `${e?.code ?? ""} ${e?.message ?? body}`.trim(); }
  catch { return body.slice(0, 300); }
}
