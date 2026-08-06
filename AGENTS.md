# MARD Bead Generator maintenance

This is a local-first, static MARD bead pattern generator. It is not a per-cell editor.

## Boundaries

- Keep image processing in the browser. Do not add a backend, accounts, analytics, image upload, cloud persistence or API keys.
- Do not add paint, erase, fill, layers, undo/redo or other per-cell editing tools.
- `src/data/mard-221.json` and `src/data/mard-291.json` must remain traceable to the fixed permissive source. Never invent or silently merge codes/HEX values. Update `THIRD_PARTY_NOTICES.md` when the source changes.
- Final algorithm output must contain only codes from the selected MARD palette and remain deterministic for identical inputs/settings.
- Preserve the clean-room boundary from AGPL sources documented in `docs/research-and-attribution.md`.

## Commands

```text
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

For a small change, run the narrow relevant test plus typecheck. Run the full list when shared algorithms, data, export, Worker, deployment or release behavior changes.

This is a personal project: stay on `main`, make the smallest complete change, and commit/push once after validation unless the user asks otherwise.
