## Vercel AI SDK — Project Integration Research

This document captures how we will use the AI SDK in PR QUEST. It includes packages, environment, core APIs, structured outputs, tool calling, server routes, testing/mocking, caching, and feature flags aligned with our ROADMAP and PRD.

---

### Packages and Installation
- **Core**: `ai`
- **OpenAI provider**: `@ai-sdk/openai`
- **React helpers (optional UI hooks)**: `@ai-sdk/react`
- **Schema validation**: `zod`

```bash
pnpm add ai @ai-sdk/openai @ai-sdk/react zod
```

Notes:
- Providers are modular. If we later add others (e.g., `@ai-sdk/google`, `@ai-sdk/groq`), the call sites stay the same.
- We do not expose provider API keys in the client. All model calls run on the server (Next.js API route or server action).

---

### Environment Configuration
- **Server-only**: `OPENAI_API_KEY`
- **Feature flag**: `FEATURE_USE_LLM=true|false` (server)
- **Client**: `NEXT_PUBLIC_APP_NAME=PR QUEST`

Server usage example (Next.js App Router):
```ts
// app/api/group/route.ts (server)
import { NextResponse } from 'next/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const StepSchema = z.object({
  title: z.string(),
  description: z.string(),
  objective: z.string(),
  diff_refs: z.array(
    z.object({
      file_id: z.string(),
      hunk_ids: z.array(z.string()),
    })
  ),
});

const GroupingSchema = z.object({
  steps: z.array(StepSchema).min(2).max(6),
});

export async function POST(req: Request) {
  const body = await req.json();
  const { diffIndex, metadata } = body ?? {};

  if (!diffIndex) {
    return NextResponse.json({ error: 'Missing diffIndex' }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: openai('gpt-4.1'),
      schema: GroupingSchema,
      prompt:
        'Group these diff hunks into 2–6 coherent review steps. ' +
        'Respond ONLY in JSON conforming to the provided schema.\n' +
        `Diff Index (JSON): ${JSON.stringify({ diffIndex, metadata })}`,
    });

    return NextResponse.json(object);
  } catch (err) {
    return NextResponse.json({ error: 'Grouping failed' }, { status: 500 });
  }
}
```

---

### Core APIs We Will Use
- **Text generation**: `generateText`
- **Structured generation**: `generateObject`
- **Streaming text**: `streamText`
- **Streaming structured arrays**: `streamObject` with `output: 'array'`

Basic text:
```ts
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const { text } = await generateText({
  model: openai('gpt-4.1'),
  prompt: 'Summarize the purpose of this pull request in 1 sentence.',
});
```

Structured object (preferred for PR grouping):
```ts
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';

const StepSchema = z.object({
  title: z.string(),
  description: z.string(),
  objective: z.string(),
  diff_refs: z.array(
    z.object({ file_id: z.string(), hunk_ids: z.array(z.string()) })
  ),
});

const GroupingSchema = z.object({ steps: z.array(StepSchema).min(2).max(6) });

const { object } = await generateObject({
  model: openai('gpt-4.1'),
  schema: GroupingSchema,
  prompt: 'Produce grouped steps for the provided diff index.',
});
```

Streaming text (for long responses / UI streaming):
```ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

const result = streamText({
  model: openai('gpt-4.1'),
  prompt: 'Live-think through a review summary...',
});

for await (const part of result.fullStream) {
  if (part.type === 'text-delta') process.stdout.write(part.textDelta);
}
```

Streaming structured arrays (useful later for progressive step generation):
```ts
import { openai } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { z } from 'zod';

const { elementStream } = streamObject({
  model: openai('gpt-4.1'),
  output: 'array',
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
  prompt: 'Generate 3 short review steps for this diff.',
});

for await (const step of elementStream) {
  console.log(step);
}
```

---

### Structured Outputs — Options We Care About
- **Preferred**: `generateObject` + Zod schema (strong typing, strict JSON)
- **Alternative**: `generateText` with `experimental_output: Output.object({ schema })` when we need text + structured data; requires care with step counting when combining with tools
- **Streaming structured arrays**: `streamObject({ output: 'array' })`
- **Provider options**: some providers allow toggling structured outputs; for OpenAI we typically rely on `generateObject`. For certain providers (e.g., Google, Groq) we can disable structured outputs if schema features cause issues.

Example with `experimental_output` (optional path):
```ts
import { Output, generateText } from 'ai';
import { z } from 'zod';

const { experimental_output } = await generateText({
  model: openai('gpt-4.1'),
  prompt: 'Return a single step object.',
  experimental_output: Output.object({
    schema: z.object({ title: z.string(), description: z.string() }),
  }),
});
```

---

### Tool Calling and Multi‑Step Control
We may use tool calling for lightweight metadata collection or repository lookups in future phases.

```ts
import { generateText, tool, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const result = await generateText({
  model: openai('gpt-4.1'),
  prompt: 'Analyze file ownership for the changed paths.',
  tools: {
    getOwners: tool({
      description: 'Return code owners for a path',
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => ({ owners: ['@team/frontend'] }),
    }),
  },
  stopWhen: stepCountIs(3),
});
```

Notes:
- When combining tools with structured outputs via `generateText + experimental_output`, budget an extra step (`stopWhen`) for the structured output phase.
- For our MVP, grouping does not require tools; we keep this optional.

---

### Next.js Server Route Patterns
- Keep all AI calls server-side.
- Enforce size/time/resource limits to maintain responsiveness.
- Validate inputs/outputs with Zod; return standard error envelopes.

Pattern (POST `/api/group`):
```ts
export async function POST(req: Request) {
  const body = await req.json();
  const parse = GroupingInputSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: 'Bad input' }, { status: 400 });

  try {
    // generateObject as shown above
  } catch (e) {
    return NextResponse.json({ error: 'LLM error' }, { status: 502 });
  }
}
```

Client usage (no keys exposed):
```ts
const res = await fetch('/api/group', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ diffIndex, metadata }),
});
const data = await res.json();
```

---

### Error Handling and Retries
- Validate outputs with Zod; on failure, retry with a stricter/clearer system prompt.
- Use a small retry wrapper with exponential backoff for transient provider errors.
- For schema mismatch, log the bad JSON and the Zod error for debugging; never return partial objects.

Simple retry wrapper:
```ts
async function withRetry<T>(fn: () => Promise<T>, attempts = 2) {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 300 * (i + 1))); }
  }
  throw lastErr;
}
```

---

### Testing and Mocking
- **Unit**: Validate schemas with fixtures using Zod; assert deterministic grouping on known diffs.
- **Integration**: Use MSW to mock `/api/group`; serve golden JSON fixtures.
- **Component**: Render step UI with fixture data; assert titles/objectives and linked hunks.

MSW example:
```ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/group', async () => {
    return HttpResponse.json({ steps: [ { title: 'Setup', description: '...', objective: '...', diff_refs: [] } ] });
  }),
];
```

---

### Caching and Limits
- **In-memory TTL** cache: key by normalized PR URL; short TTL (e.g., 5–15 min) for demo.
- **Size caps**: Reject `.diff` inputs above a hard cap (to keep response <3s locally).
- **Rate limits**: Optional simple token bucket per session or rely on demo constraints.

---

### Observability and Metadata
- Access `providerMetadata` (when available) to inspect model id, usage, or provider-specific fields.
- Add lightweight logging around cache hits/misses and retry counts.

---

### Feature Flags
- `FEATURE_USE_LLM` toggles heuristic-only vs LLM grouping.
- Guard server routes with this flag to short-circuit to heuristic grouping when disabled.

```ts
if (process.env.FEATURE_USE_LLM !== 'true') {
  // return heuristic grouping result
}
```

---

### Fit with ROADMAP
- Phase 4 uses heuristic grouping only (no model calls).
- Phase 5 swaps in `generateObject` with OpenAI via `@ai-sdk/openai`.
- Later phases can adopt streaming (`streamObject`) for progressive UI without changing the schema.

---

### AI SDK 5 Highlights (Relevant to PR QUEST)

Source: [AI SDK 5 announcement](https://vercel.com/blog/ai-sdk-5)

- **Agentic loop control**: Built-in control over multi-step interactions and tools (e.g., `stopWhen`, `maxSteps`), aligns with our optional tool-calling and step-by-step flows.
- **Global provider**: Optionally set a single default provider so model IDs can be plain strings. Useful if we later route via AI Gateway or switch providers centrally.

```ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

// Set once during startup (e.g., server init)
globalThis.AI_SDK_DEFAULT_PROVIDER = openai;

// Later: no need to import the provider at call site
const result = await streamText({ model: 'gpt-4o', prompt: 'Hello' });
```

- **Access raw responses/chunks**: Helpful to debug schema mismatches or provider quirks during `generateObject` development.

```ts
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

const result = streamText({
  model: openai('gpt-4o-mini'),
  prompt: 'Explain the diff grouping in one paragraph.',
  includeRawChunks: true,
});

for await (const part of result.fullStream) {
  if (part.type === 'raw') console.log('Raw chunk:', part.rawValue);
}
```

- **Redesigned chat (typed UIMessage/ModelMessage)**: If we add an interactive “coach” later, the typed chat pipeline will simplify persistence and streaming custom data parts. Not needed for MVP read-only steps.
- **V2 specifications**: Updated provider spec improves extensibility; good future-proofing if we integrate non-OpenAI providers.
- **Zod 4 support**: Works with Zod 3 or 4; we can standardize on Zod 4 for new schemas. No immediate code change required.
- **Speech generation/transcription**: Out of scope for MVP.

Recommended stance for PR QUEST (now):
- Keep explicit `openai` provider usage; consider the global provider once stable.
- Continue using `generateObject` + Zod for grouping; use raw chunks only for debugging.
- Stick to MVP scope; revisit Chat UI and data parts after core flows (Phases 6–8).


