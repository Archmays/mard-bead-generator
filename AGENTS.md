# MARD Bead Generator project instructions

This is a local-first static MARD bead-pattern generator, not a per-cell editor.

## Product and data boundaries

- Keep image processing in the browser. Do not add a backend, accounts, analytics, image upload, cloud persistence, or API keys.
- Do not add paint/erase/fill/layers/undo-redo or other per-cell editing tools unless the user explicitly changes the product boundary.
- `src/data/mard-221.json` and `src/data/mard-291.json` must remain traceable to the fixed approved source. Never invent or silently merge codes/HEX values.
- Update `THIRD_PARTY_NOTICES.md` when the underlying palette source changes.
- Preserve the documented clean-room boundary from AGPL sources in `docs/research-and-attribution.md`.
- Final algorithm output must use only codes from the selected MARD palette and remain deterministic for identical inputs/settings.

## Validation

For a small localized change, run the narrow relevant test plus typecheck when TypeScript behavior is touched.

Use the full relevant release gate when shared algorithms, palette data, export, Worker behavior, build/deployment, or release behavior changes. The canonical commands remain:

```text
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Do not run the full list for a documentation-only or truly isolated change unless the affected contract requires it.

This is a personal project: stay on `main`, make the smallest complete change, review the final diff, and normally commit/push once after validation.
