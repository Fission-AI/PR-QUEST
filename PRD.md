Right — here’s the **clean, copy-ready Markdown version** of the PRD with all code blocks properly formatted and no unnecessary escaping.
You can drop this straight into GitHub, Notion, or your hackathon repo README.

---

# PRD — PR QUEST (Hackathon MVP)

## 1. Problem

PR reviews are mentally heavy. Traditional diff views dump everything at once. Reviewers lack progressive context, so they procrastinate and quality suffers.
Teams shipping fast across roles (dev, design, PM) have outgrown static diff tools. Review fatigue slows feedback loops, merges, and quality assurance.

---

## 2. Goal (MVP)

Deliver a working demo where a user pastes a **public GitHub PR URL** and experiences an **interactive, progressive walkthrough** of the changes — organized semantically, explained in steps, and wrapped in a fun, retro, game-like interface.

**Focus:**

* Semantic grouping + progressive disclosure
* Playful 90s aesthetic
* Real working AI grouping (no fakes)

---

## 3. Success Criteria

* Paste PR URL → see **2–6 coherent steps** in <10s for a typical public PR
* Review feels “lighter” and more intuitive
* Demo-ready for hackathon judging — visually distinct, interactive, and real

---

## 4. Users

* **Primary:** Software engineers reviewing PRs
* **Secondary:** Designers or PMs wanting to understand changes

---

## 5. Core Flow

1. User pastes a **public GitHub PR URL**
2. Backend fetches raw `.diff` via `.../pull/<id>.diff`
3. AI + heuristics group changes into 2–6 “steps”
4. UI displays one step at a time (summary + diff view)
5. User clicks **Next** to progress, earning XP and badges
6. Optional: take notes per step → export at end

---

## 6. Scope (In)

* Public PRs only
* Raw `.diff` ingestion and parsing
* Heuristic + LLM grouping into review steps
* Retro UI with progress/XP gamification
* Step-by-step navigation
* Per-step notes and export

---

## 7. Out of Scope

* Private repos / OAuth integration
* Inline GitHub commenting
* Persistent user accounts
* AST-level refactor detection
* Mobile optimization

---

## 8. Tech Stack

* **Frontend:** Next.js + Tailwind
* **Backend:** Next.js API routes (Node)
* **Diff rendering:** `diff2html` or `react-diff-view`
* **LLM:** Vercel AI SDK (`@vercel/ai`) with OpenAI provider (structured JSON output)
* **State:** In-memory/session
* **Caching:** PR URL → grouped result
* **No database** (stateless hackathon build)

---

## 9. AI Responsibilities

* Parse PR title/description and `.diff` index
* Generate 2–6 coherent **review steps**
* Each step includes title, description, objective, and linked diffs
* Provide optional reviewer hints and badges
* Never output raw code — only reference `file_id` and `hunk_id`

---

## 10. AI Output Contract (v1)

### Diff Index

Generated locally before calling the LLM:

```json
{
  "diff_index_version": 1,
  "files": [
    {
      "file_id": "src/app/api/users.ts",
      "status": "modified",
      "language": "ts",
      "hunks": [
        {
          "hunk_id": "src/app/api/users.ts#h0",
          "old_start": 12,
          "new_start": 12,
          "header": "@@ -12,8 +12,11 @@"
        }
      ]
    }
  ]
}
```

### LLM Output Schema

```json
{
  "version": 1,
  "pr_overview": {
    "title": "Short PR title",
    "summary": "2–4 sentence summary."
  },
  "steps": [
    {
      "step_id": "step-1",
      "title": "Implement new user validation",
      "description": "Explains purpose and what was changed.",
      "objective": "What the reviewer should verify.",
      "priority": "high",
      "diff_refs": [
        {
          "file_id": "src/app/api/users.ts",
          "hunk_ids": ["src/app/api/users.ts#h0"]
        }
      ],
      "notes_suggested": [
        "Does the new validator handle malformed input?"
      ],
      "badges": ["Core Change"]
    }
  ],
  "end_state": {
    "acceptance_checks": [
      "All tests pass",
      "API returns correct error for invalid input"
    ],
    "risk_calls": [
      "Potential backward incompatibility for existing consumers"
    ]
  }
}
```

### Rules

* 2–6 steps total
* Use **only** provided `file_id` and `hunk_id`
* `priority`: `"high" | "medium" | "low"`
* No fabricated identifiers
* JSON-only output, no prose

---

## 11. LLM Prompt Skeleton

Implementation: Use Vercel AI SDK (`@vercel/ai`) with the OpenAI provider and request structured JSON output.

```
You are organizing a GitHub Pull Request into 2–6 review steps.
Use only the provided file_ids and hunk_ids.
Do not include code; output strict JSON matching schema.

Each step = clear purpose, description, and what to review.
Group related hunks together. Merge trivial ones.

Context:
PR title: "<title>"
PR description: "<description>"

Heuristic clusters: <summary>
Files & hunks: <list>
```

Validate via Zod → retry on schema mismatch or missing IDs.

---

## 12. Rendering Plan

**Layout**

* **Left rail:** Step list, progress bar, XP counter
* **Main panel:**

  * Step title, description, objective
  * Render code diffs using `react-diff-view` filtered by `hunk_ids`
  * Notes input box
  * “Next” and “Previous” navigation buttons
* **Completion screen:** “Quest Complete!” with badge + copyable notes summary

---

## 13. Gamification (MVP)

* +10 XP per completed step
* Pixel-style progress bar
* “Quest Complete” screen
* Optional achievements (e.g. *Reviewed All Files*, *Speed Runner*)

---

## 14. Visual Aesthetic

### Theme

* 90s Apple-inspired retro computing design
* Beige/cream color palette as primary base
* Minimal accent colors: muted **sage green** (success), **soft blue** (interactive), **warm coral/orange** (highlights)
* Chunky pixel borders (4–8px) with subtle shadows
* Dotted grid background for nostalgic texture

### Typography

* **Primary:** “Press Start 2P” for headings, buttons, and pixel UI elements
* **Secondary:** System font stack for body text and code
* Text size: 12–14px (compact terminal feel)
* Code: monospace with syntax highlighting

### UI Elements

* Retro-style buttons with thick pixel borders
* Floating pixel decorations animating across the screen
* Chunky pixel progress bar
* Badges and XP displayed in pixel font
* Blinking cursor animation for loading (“Analyzing…”)
* Card layouts with beige backgrounds + darker borders

### Code Display

* Syntax-highlighted code blocks with line numbers
* Beige/cream background for code areas
* Colors: keywords = green, strings = orange, comments = muted gray
* Filename headers in pixel font style

### Gamification

* XP rewards for progress through steps
* Visible progress tracker with completion state
* Achievement badges at end of review
* Step-by-step “quest” navigation (Next / Previous)
* Note-taking feature per step + exportable summary

### Overall Vibe

Playful, nostalgic, early computing aesthetic — like reviewing code inside a **retro Macintosh meets pixel RPG**.
Feels fun, lighthearted, and adventure-like, yet practical and productivity-focused.

---

## 15. Risks

* LLM misgrouping → confusing UX
* Slow response on large PRs
* Diff viewer performance issues

---

## 16. Open Decisions

* Add global notes summary beyond per-step notes?
* Show full PR summary upfront or keep mystery (“Quest Intro”)?
* Lazy-load diffs vs. all-at-once for speed?

---


