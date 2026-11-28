---
name: compare
description: "Compare 2-4 options side by side. Use for compare, X vs Y, which is better, pick between phones, plans, places, cars or stocks; also best way to and how should I questions. Show tradeoffs before the verdict; use tabs for optional details."
version: 0.1.0
platforms: [linux, macos, windows]
---
# Compare

Use this for explicit comparisons ("X vs Y") and recommendation questions ("what is the best way to...",
"how should I...", "which approach fits?") when materially different approaches serve the goal. Respect the
requested workflow: if proposing an alternative, identify how it differs before recommending it.
For one stock in depth, use `stock-dashboard`; for 5 or more options, a ranked `list` or a single `table` is clearer.

## Steps

1. **Get the facts.** Reuse available evidence; research missing facts. For stocks, call `market_history`
   with up to 3 comma-separated symbols ("TCS, INFY") and keep its board id. Cite numbers; never guess.
2. **Pick 2-5 deciding criteria** and apply them consistently to every option. Do not invent numeric KPIs.
3. **Make the comparison visible immediately.** Use one `show_blocks` call with a heading, the appropriate layout,
   a concise recommendation with its key caveat, and sources for outside facts.
   - For ordinary specs, prices and features, use a `table`; for qualitative tradeoffs, use concise text cards in `columns`.
   - When two systems differ materially in architecture, data movement or processing stages, use a top-level
     `columns` block with two static `flow` children, `direction: "down"`, and comparable stages. Columns stack on
     narrow screens. Limit labels to 40 characters and omit icons.
     Use notes for caveats; never imply optional stages are mandatory.
     Use concise text for a few remaining tradeoffs, or a small table for several deciding criteria.
     Avoid repeating what the flows show. Do not add flows for specs alone.
   - For stocks, include `{"type": "include", "id": "<market_history id>"}`; do not duplicate its price cards or chart.
   - Tabs are optional deep dives for substantial unique detail, never a home for essential tradeoffs.
   - Use sourced `kpis` only when useful, and charts only for real comparable trends that matter.
   - State the verdict once, after tradeoffs. Reserve callouts for material risks. Avoid repeating the board in prose.
   - Use concise text or a numbered checklist for short next steps, not decorative cards or a second large board.
4. **Reply** with one sentence, then the tag on its own line.

## Recommended default (two approaches to a workflow)

```json
[
  {"type": "heading", "text": "Choose how to organize existing photos"},
  {"type": "table", "columns": ["Approach", "Keeps original folders", "Album sharing"],
   "rows": [["Upload copies", "Originals remain; Immich stores copies", "Normal Immich albums"],
            ["External library", "Immich indexes folders in place", "Albums require additional organization"]]},
  {"type": "text", "text": "**Recommendation:** Upload copies if the priority is ordinary Immich-managed albums; use an external library if keeping files in place is the priority."}
]
```

## Architecture comparison

Illustrative local vs hosted processing. Use static flows unless the user requests a walkthrough.

```json
[
  {"type": "heading", "text": "Local vs hosted document processing"},
  {"type": "columns", "children": [
    {"type": "flow", "title": "Local processing", "direction": "down", "nodes": [
      {"id": "local-input", "label": "Document"},
      {"id": "local-engine", "label": "Local processing engine"},
      {"id": "local-output", "label": "Result on device"}
    ]},
    {"type": "flow", "title": "Hosted processing", "direction": "down", "nodes": [
      {"id": "hosted-input", "label": "Document"},
      {"id": "hosted-engine", "label": "Remote processing service"},
      {"id": "hosted-output", "label": "Result returned to device"}
    ]}
  ]},
  {"type": "text", "text": "Prefer local for sensitive documents if the device has enough compute and memory; hosted may suit limited devices when network dependence and remote document handling are acceptable."}
]
```

## Optional deeper-dive layout

Illustrative specs and trends, not current product data. Use charts only for sourced trends; tabs hold unique details.

```json
[
  {"type": "heading", "text": "Choose between two phones"},
  {"type": "table", "columns": ["Phone", "Price", "Battery", "Updates"],
   "rows": [["Phone A", "$499", "5,100 mAh", "7 years"],
            ["Phone B", "$399", "5,000 mAh", "5 years"]]},
  {"type": "chart", "kind": "line", "title": "Illustrative price change (%)", "unit": "%", "figure": false,
   "x": ["Jul", "Aug", "Sep", "Oct"],
   "series": [{"name": "Phone A", "data": [0, -2.1, -4.2, -6.3]},
              {"name": "Phone B", "data": [0, -4.4, -6.7, -11.1]}]},
  {"type": "text", "text": "Phone A if longer support matters; Phone B if minimizing purchase cost matters."},
  {"type": "tabs", "tabs": [
    {"label": "Phone A", "children": [{"type": "text", "text": "Check compatibility with existing accessories."}]},
    {"label": "Phone B", "children": [{"type": "text", "text": "Check regional warranty coverage."}]}
  ]},
  {"type": "source", "text": "Illustrative specifications and trends, not current product data"}
]
```

## Rules

- Blocks only: never write HTML or use `::preview` for a comparison.
- Numbers and photo URLs only from tools, search or the user. Stock prices only through `market_history`'s board.
- Tabs, when used for optional detail: 2-6, top level only, labels up to 30 characters. Keep each one short.
  `kpis` take up to 4 items; `columns` 2-3 children.
- Highlight one winner only when the facts make it clear; otherwise leave `highlight` out and say "it depends".
- No buy or sell advice for stocks.
- Keep words short around the tag; optional tabs must not hide deciding criteria.
