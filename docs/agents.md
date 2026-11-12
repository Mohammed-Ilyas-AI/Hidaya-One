# HIDAYA ONE — 13 Agent Roster & Deterministic Gates

Hidaya One maintains exactly 13 specialized agent instances, preserving domain-specific safeguards and religious content guardrails.

## Specialist Hierarchy

```
                          ┌─────────────────────────────┐
                          │    hidaya_ai_orchestrator   │
                          └──────────────┬──────────────┘
                                         │
     ┌──────────────────┬────────────────┼─────────────────┬──────────────────┐
     ▼                  ▼                ▼                 ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  ┌──────────────────┐
│ islamic_     │ │ verification_│ │ tamil_       │ │ creative_    │  │ hidaya_veo_video_│
│ research_    │ │ agent        │ │ script_      │ │ producer     │  │ generator        │
│ agent        │ └──────┬───────┘ │ agent        │ └──────────────┘  └──────────────────┘
└──────┬───────┘        │         └──────────────┘
       │                │
 ┌─────┴─────┐    ┌─────┴─────┐
 ▼           ▼    ▼           ▼
┌─────┐ ┌─────┐  ┌─────┐ ┌─────┐
│SRCH │ │ URL │  │SRCH │ │ URL │
└─────┘ └─────┘  └─────┘ └─────┘
(Research)       (Verification)
```

## Detailed Agent Roster

### 1. `hidaya_ai_orchestrator` (Root Orchestrator)
- **Role**: Master production coordinator.
- **Rules**: Enforces business sequencing (Research → Verification Gate → Script → Creative → Veo → Editor → QC → Release). Never allows unverified evidence to proceed.

### 2. `islamic_research_agent`
- **Role**: Identifies 3 candidate educational topics daily from primary Quran and Hadith sources.
- **Sub-agents**: `research_google_search_agent`, `research_url_context_agent`.
- **Constraint**: Cannot mark candidate items as VERIFIED. Does not invent references or texts.

### 3. `research_google_search_agent` & `research_url_context_agent`
- **Role**: Helper agents executing `GOOGLE_SEARCH` and `URL_CONTEXT` tools to locate primary texts, verify chapter/verse numbers, and inspect web page content.

### 4. `verification_agent`
- **Role**: Independent, adversarial religious verification specialist.
- **Sub-agents**: `verification_google_search_agent`, `verification_url_context_agent`.
- **Output**: Typed `EvidenceRecord` assigning strictly defined statuses (`VERIFIED`, `NEEDS_HUMAN_REVIEW`, `SOURCE_NOT_FOUND`, `ARABIC_MISMATCH`, `REFERENCE_MISMATCH`, `AUTHENTICITY_UNCONFIRMED`, `REJECTED`).

### 5. `verification_google_search_agent` & `verification_url_context_agent`
- **Role**: Independent search and retrieval helpers ensuring verification is corroborated on distinct primary sources without relying solely on research snippets.

### 6. `tamil_script_agent`
- **Role**: Authors 30–45s vertical Shorts scripts in natural spoken Tamil with exact Arabic quotations.
- **Gate**: Accepts only evidence records carrying `gatePassed: true` and `ALL_EVIDENCE_GATE_PASSED` attestation.

### 7. `creative_producer`
- **Role**: Authors 9:16 scene storyboards, timing, prompts, visual cues, and YouTube/Instagram metadata.
- **Guardrail**: Strictly prohibits depicting Prophets or placing holy texts inside AI image prompts.

### 8. `hidaya_veo_video_generator`
- **Role**: Formulates Veo generation clip prompts and technical parameters.
- **Status**: Returns `VIDEO_GENERATION_TOOL_NOT_CONNECTED` until an official Veo execution adapter is provisioned.

### 9. `hidaya_video_editor`
- **Role**: Specifies timeline assembly instructions, subtitle synchronization, and rendering briefs.
- **Status**: Returns `RENDERER_NOT_CONNECTED` when offline.

### 10. `quality_control_agent`
- **Role**: Performs 6-dimensional quality audit: Religious fidelity, Arabic text accuracy, Tamil language naturalness, 9:16 video pacing, copyright safety, metadata originality.

### 11. `hidaya_channel_manager`
- **Role**: Manages release manifests across YouTube Shorts and Instagram Reels.
- **Policy**: Requires human sign-off; strictly prohibits auto-publishing in Production.
