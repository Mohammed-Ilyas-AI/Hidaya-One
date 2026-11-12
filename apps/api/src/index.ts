/**
 * HIDAYA ONE — Node.js BFF API
 * Express 5 + Zod + Google Cloud Auth
 * All secrets from environment — never hardcoded.
 */
import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { GoogleAuth } from "google-auth-library";
import path from "node:path";
import fs from "node:fs";

// ─── Environment ─────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const ADK_SERVICE_URL = process.env.ADK_SERVICE_URL ?? "";
const NODE_ENV = process.env.NODE_ENV ?? "development";

if (!ADK_SERVICE_URL && NODE_ENV === "production") {
  throw new Error("ADK_SERVICE_URL is required in production.");
}

// ─── Integration Status ───────────────────────────────────────────────────────

type IntegrationStatus = "CONNECTED" | "NOT_CONFIGURED" | "DISABLED" | "DEGRADED" | "FAILED";

interface Integration {
  name: string;
  status: IntegrationStatus;
  reason: string;
}

function resolveIntegrations(): Integration[] {
  return [
    {
      name: "gemini",
      status: process.env.GOOGLE_GENAI_API_KEY ? "CONNECTED" : "NOT_CONFIGURED",
      reason: process.env.GOOGLE_GENAI_API_KEY
        ? "GOOGLE_GENAI_API_KEY present"
        : "GOOGLE_GENAI_API_KEY not set",
    },
    {
      name: "adk_agent_service",
      status: ADK_SERVICE_URL ? "CONNECTED" : "NOT_CONFIGURED",
      reason: ADK_SERVICE_URL ? `Pointing to ${ADK_SERVICE_URL}` : "ADK_SERVICE_URL not set",
    },
    {
      name: "google_search",
      status: "CONNECTED",
      reason: "Built into ADK agent via GOOGLE_SEARCH tool",
    },
    {
      name: "url_context",
      status: "CONNECTED",
      reason: "Built into ADK agent via URL_CONTEXT tool",
    },
    {
      name: "cloud_storage",
      status: process.env.GOOGLE_CLOUD_PROJECT ? "NOT_CONFIGURED" : "NOT_CONFIGURED",
      reason: "GCS bucket not yet provisioned",
    },
    {
      name: "text_to_speech",
      status: "NOT_CONFIGURED",
      reason: "Google Cloud TTS not yet connected",
    },
    {
      name: "veo_video_generation",
      status: "NOT_CONFIGURED",
      reason: "Veo API not yet connected — VIDEO_GENERATION_TOOL_NOT_CONNECTED",
    },
    {
      name: "youtube_data_api",
      status: process.env.YOUTUBE_API_KEY ? "CONNECTED" : "NOT_CONFIGURED",
      reason: process.env.YOUTUBE_API_KEY
        ? "API key present — read-only public data only"
        : "YOUTUBE_API_KEY not set",
    },
    {
      name: "youtube_oauth",
      status: "NOT_CONFIGURED",
      reason: "OAuth 2.0 not yet configured — required for uploads",
    },
    {
      name: "instagram_graph_api",
      status: "NOT_CONFIGURED",
      reason: "Meta Graph API not yet configured",
    },
  ];
}

// ─── ADK Client ──────────────────────────────────────────────────────────────

const auth = new GoogleAuth();

async function callAdkService(
  path: string,
  method: "GET" | "POST",
  body?: unknown,
): Promise<unknown> {
  if (!ADK_SERVICE_URL) {
    throw new Error("ADK_SERVICE_URL not configured — cannot relay request to agent service.");
  }
  const client = await auth.getIdTokenClient(ADK_SERVICE_URL);
  const url = `${ADK_SERVICE_URL}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const authHeaders = await client.getRequestHeaders(url);
  Object.assign(headers, authHeaders);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ADK service error ${response.status}: ${text}`);
  }
  return response.json();
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Request logger (structured)
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
  }));
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/v1/health
app.get("/api/v1/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "hidaya-one-api",
    version: "0.1.0",
    env: NODE_ENV,
    ts: new Date().toISOString(),
  });
});

// GET /api/v1/integrations
app.get("/api/v1/integrations", (_req: Request, res: Response) => {
  res.json({ integrations: resolveIntegrations() });
});

// GET /api/v1/dashboard/overview
app.get("/api/v1/dashboard/overview", (_req: Request, res: Response) => {
  const integrations = resolveIntegrations();
  const connectedCount = integrations.filter((i) => i.status === "CONNECTED").length;
  res.json({
    dailyTarget: 3,
    // Real counts will come from Firestore in Phase 4
    activeJobs: "NOT_CONFIGURED — persistence not yet set up",
    pendingApprovals: "NOT_CONFIGURED — persistence not yet set up",
    integrationsSummary: {
      connected: connectedCount,
      total: integrations.length,
      details: integrations,
    },
    note: "Persistence layer (Firestore) not yet provisioned. Counts are NOT_CONFIGURED.",
  });
});

// GET /api/v1/jobs/:id — placeholder until persistence is added
app.get("/api/v1/jobs/:id", (req: Request, res: Response) => {
  res.status(503).json({
    error: "NOT_CONFIGURED",
    message: "Job persistence (Firestore) not yet provisioned.",
    jobId: req.params.id,
  });
});

// POST /api/v1/research/runs — relay to ADK agent service
const researchRunSchema = z.object({
  query: z.string().min(3).max(500),
  userId: z.string().min(1).default("default-user"),
  sessionId: z.string().optional(),
});

app.post("/api/v1/research/runs", async (req: Request, res: Response) => {
  const parse = researchRunSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "VALIDATION_ERROR", issues: parse.error.issues });
    return;
  }

  if (!ADK_SERVICE_URL) {
    res.status(503).json({
      error: "NOT_CONFIGURED",
      message: "ADK_SERVICE_URL not set — cannot reach agent service.",
    });
    return;
  }

  try {
    const { query, userId, sessionId } = parse.data;
    const sid = sessionId ?? `session-${Date.now()}`;

    // Create session on ADK service
    await callAdkService(
      `/apps/hidaya_ai_orchestrator/users/${userId}/sessions/${sid}`,
      "POST",
      { state: {} },
    );

    // Start run
    const runResult = await callAdkService("/run", "POST", {
      app_name: "hidaya_ai_orchestrator",
      user_id: userId,
      session_id: sid,
      new_message: { role: "user", parts: [{ text: query }] },
    });

    res.status(202).json({
      sessionId: sid,
      userId,
      status: "RUNNING",
      result: runResult,
    });
  } catch (err: any) {
    res.status(502).json({ error: "ADK_RELAY_ERROR", message: err.message });
  }
});

// POST /api/v1/topics/:id/verify — placeholder
app.post("/api/v1/topics/:id/verify", (req: Request, res: Response) => {
  res.status(503).json({
    error: "NOT_CONFIGURED",
    message: "Topic persistence (Firestore) not yet provisioned.",
    topicId: req.params.id,
  });
});

// POST /api/v1/topics/:id/approve-script — placeholder
app.post("/api/v1/topics/:id/approve-script", (req: Request, res: Response) => {
  res.status(503).json({
    error: "NOT_CONFIGURED",
    message: "Script approval requires persistence layer.",
    topicId: req.params.id,
  });
});

// POST /api/v1/videos/:id/approve — gate: human must explicitly approve
app.post("/api/v1/videos/:id/approve", (req: Request, res: Response) => {
  res.status(503).json({
    error: "NOT_CONFIGURED",
    message: "Video approval requires persistence layer. Never auto-approved.",
    videoId: req.params.id,
  });
});

// POST /api/v1/publishing/:id/approve — gate: explicit owner approval only
app.post("/api/v1/publishing/:id/approve", (req: Request, res: Response) => {
  res.status(503).json({
    error: "NOT_CONFIGURED",
    message: "Publishing approval requires persistence + YouTube OAuth. Never auto-published.",
    publishingId: req.params.id,
  });
});

// ─── Static Angular Frontend Serving ─────────────────────────────────────────

const webDistPaths = [
  path.resolve(process.cwd(), "../web/dist/hidaya-one-web/browser"),
  path.resolve(process.cwd(), "public"),
  path.resolve(process.cwd(), "dist/web"),
];

const webDistPath = webDistPaths.find((p) => fs.existsSync(p));

if (webDistPath) {
  console.log(`[BFF] Serving static Angular dashboard from: ${webDistPath}`);
  app.use(express.static(webDistPath));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

// ─── Error handler ───────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), error: err.message }));
  res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    event: "server_started",
    port: PORT,
    env: NODE_ENV,
    adkServiceUrl: ADK_SERVICE_URL || "NOT_CONFIGURED",
  }));
});

export default app;

