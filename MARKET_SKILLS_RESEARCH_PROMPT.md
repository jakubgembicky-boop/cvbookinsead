# Task for Sonnet 4.6 (high) — Regenerate the Market Pulse skill matrix (2026)

You are working **only** inside `insead-cvbook-web/`. This is a single, self-contained job: regenerate the "Market Pulse" job-market skill-demand matrix so its skill labels align with the app's CV skill taxonomy, refreshed with 2026 hiring-market reality.

## Context
The app has a Career Switch tool with a "Market Pulse" column showing, for a given **industry × function**, the skills the job market currently demands (as a 0–100 demand score). It reads `data/market_skills.json`.

**The problem:** the current `data/market_skills.json` uses ad-hoc skill labels ("Business Strategy", "Strategic Thinking", "Mergers & Acquisitions (M&A)", "AI transformation", …) that do **not** match the app's canonical CV skill taxonomy ("Strategy", "M&A", "AI", …). Because the labels don't match, the UI can't highlight which demanded skills a user already has. Your job fixes this.

## The canonical vocabulary (PRIMARY)
Read `data/skill_taxonomy.json`. It contains **115 canonical skills** (each with `canonical`, `type`, `learning_curve`). This is the **primary vocabulary** you must use for skill labels in your output. Whenever a market-demanded skill corresponds to one of these canonical skills, **use the exact canonical label**.

Examples of mapping market concepts → canonical:
- "Business Strategy" / "Corporate Strategy" / "Strategic Thinking" → **Strategy**
- "Mergers & Acquisitions (M&A)" / "Deal Execution" → **M&A**
- "Financial Modeling (DCF/LBO)" → **Financial Modeling**
- "Data Analytics" / "Business Analytics" / "Data Science" → **Data Analysis** (or **Analytics**)
- "Artificial Intelligence (AI)" / "AI transformation" → **AI**
- "Supply Chain Management" → **Supply Chain**
- "Regulatory Compliance" / "Regulatory Affairs" → **Regulatory & Compliance**

## 2026 market research (SECONDARY)
Use web search to ground demand in **2026** hiring reality for MBA-calibre roles (consulting, finance/PE/VC, tech/product, industry, public sector, etc.). You MAY introduce a **small number** of genuinely new, forward-looking skills that have no canonical equivalent yet but are clearly in demand in 2026 (e.g. "GenAI Strategy", "AI Agents", "Climate Risk"). Keep these to **at most ~3 per function** and only when real — the bulk of every list must be canonical taxonomy labels.

## Output format — IMPORTANT
Overwrite `data/market_skills.json` with the **exact same nested structure** as the current file so the UI keeps working:

```json
{
  "All": {
    "Strategy": { "Strategy": 96, "Problem Solving": 92, "Financial Modeling": 88, ... },
    "Finance & Accounting": { ... },
    ...
  },
  "Consulting": { "Strategy": { ... }, ... },
  "Finance": { ... },
  ...
}
```

- **Top-level keys (industries)** and **second-level keys (functions)** MUST stay identical to the current `data/market_skills.json` (read it first and reuse its exact key set — `All`, `Consulting`, `Finance`, `Technology`, … and the 13 functions). Do not rename or drop any industry/function.
- **Third level**: skill label → demand score (integer 0–100). 8–12 skills per function, sorted highest-demand first. Scores should be realistic and varied (not all 90+).
- Skill labels: **canonical taxonomy labels wherever possible**; a few researched 2026 additions allowed per the rule above.
- Keep the `All` industry as the cross-industry baseline for each function.

## Steps
1. Read `data/market_skills.json` (current structure + exact industry/function keys) and `data/skill_taxonomy.json` (canonical vocabulary).
2. For each industry × function, research 2026 demand and produce 8–12 skills, labelled canonically, with realistic scores.
3. Write the result back to `data/market_skills.json` (same structure). Validate it parses as JSON.
4. Print a short summary: how many industries × functions, total distinct skill labels used, and what fraction are canonical-taxonomy vs new-2026 additions.

## Constraints
- Work only in `insead-cvbook-web/`. Do NOT modify any `.py` files, `skill_taxonomy.json`, `skills_ranked.json`, or anything under `src/`.
- Do not touch `generate_market_skills_matrix.py` (it lives in the sibling repo; ignore it).
- This is the whole job — when `data/market_skills.json` is regenerated and valid, you are done.
