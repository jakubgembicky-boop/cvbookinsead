# Antigravity to Claude Handover & Status

This document outlines the recent and ongoing changes made by the Antigravity agent across the `insead-cvbook` and `insead-cvbook-web` repositories. Please review this to avoid conflicts.

There are currently **NO** python scripts running in the background. Both background tasks have successfully completed:
1. `categorize_skills.py` successfully finished categorizing all unstructured skills into a structured format with levels, fully updating `skills_categorized.json`.
2. `generate_market_skills_matrix.py` successfully finished generating the 17x13 matrix in `market_skills.json`.

## 2. Completed Changes in `insead-cvbook-web`

I have completed the following modifications to the Next.js frontend to support the new "Market Pulse V2" feature:

### `src/components/app/SwitchClient.tsx`
- **Decoupled from Cohorts**: The Market Pulse (Skill Gap Analysis) UI now renders *even if* `result.movers.length === 0`. The "Cohort Movers" column will display "No clear pattern" if no cohort precedents exist, while the live job market pulse will still accurately display.
- **Alphabetical Sorting**: Function and Industry dropdown menus are now sorted alphabetically for easier UX.
- **Nested Data Parsing**: The component now expects the `marketSkills` prop to be a deeply nested dictionary (`[industry][function]`). It looks up the user's selected Industry (fallback to `'All'`) and Function to display the Live Market Pulse.

### `src/lib/switch-model.ts` & `src/lib/enriched-data.ts`
- **Timeline-Aware Skill Extraction**: Modified the career step aggregation logic. The system now accurately calculates "Mover Skills" by *only* aggregating the skills a person held *prior* to their career switch (so it shows what skills they had to *get* the job, rather than the skills they *developed in* the new job).

### `src/lib/taxonomy2.ts`
- **Centralized Mapping**: Consolidated skill and taxonomy mappings here. Ensure any new skill synonym logic continues to utilize this single source of truth.

## 3. Next Steps / Active Tasks
- Both background data generations have completely finished.
- The UI in `insead-cvbook-web` is fully functional and safely pulls the complete generated data from `market_skills.json` and `skills_categorized.json`.

Please proceed with your tasks and let me know if any of these changes interfere with your ongoing work!

## 4. CV Quality Pass & Skills Re-evaluation (Recent Run)
I have completed a pass over the data pipeline to normalize dates, improve company mapping, and re-evaluate skills based on temporal awareness.

### `insead-cvbook/normalize_dates.py` (New)
- Parses `cvdata.json` experience roles' years and produces `dates_normalized.json`.
- Handled all 224 unique formats. 1727 entries parsed successfully with 0 errors.

### `insead-cvbook/build_canon.py` (Modified)
- Improved fuzzy matching (prefix matches, suffix stripping) for company tagging.
- Current coverage on experience entries:
  - Total experience entries: 3946
  - Matched to KB: 1282 (32.5%)
  - Matched via canon alias: 434 (11.0%)
  - Unmatched (new): 2230 (56.5%)
- Unmatched high-frequency companies exported to `company_kb_gaps.json` (45 entities) for human review. (Max achievable coverage based on current KB size).

### `insead-cvbook/skills_reevaluate.py` (New)
- Re-evaluated skills into strong/normal/beginner based on duration, recency, repetition, and core relevance to function.
- Successfully evaluated 413 people, ensuring everyone has 5-25 skills.
- Distribution: {'strong': 1327, 'beginner': 6711, 'normal': 699} (Avg skills per person: 21.2)
