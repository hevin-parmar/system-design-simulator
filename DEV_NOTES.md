# Developer Notes

## Design reset + designId architecture

- **Designs are in-memory only**: Server never persists designs to disk. On restart, all designs are empty. No stale state.
- **designId**: Every design session has a unique `designId`. The UI stores `designId` in React state only (no localStorage).
- **Endpoints**:
  - `POST /api/design/new` → returns `{ designId, state }` (fresh empty state)
  - `POST /api/design/from-pack` → `{ packId }` creates new designId, seeds from pack, returns `{ designId, state, pack }`
  - `GET /api/design/:designId` or `GET /api/design/:designId/state` → full state (Cache-Control: no-store)
  - `POST /api/design/:designId/state` → patch state (nodes, edges, packId, requirements, interview)
  - `POST /api/design/:designId/reset` → reset that design to empty
- **Flow**: "New Design" calls `POST /api/design/new`, then synchronously clears nodes/edges/UI state before setting `designId`, so the save effect never persists stale data.
- **Remount**: `FlowCanvas` and `RightPanel` use `key={designId}` so they fully remount on design change.
- **Interview**: Sessions are keyed by `designId` when provided (`interview-${designId}`). All interview API calls pass `designId` when available.

### Sanity check (manual test)

1. Start app: `npm run dev` and `npm run server`
2. Select Q1 from Question Bank → diagram A loads
3. Select Q2 from Question Bank → diagram B loads (must be different from A)
4. Click "New Design" → blank canvas
5. Refresh page → must NOT restore old diagram; fresh empty or first question loads from server
6. Restart server → UI must start fresh (designs are in-memory only)
7. Port in use: if `EADDRINUSE:3000`, run `lsof -i :3000` then `kill -9 <pid>`

## New Design Reset

- **Button**: "New Design" in the header triggers a full reset.
- **Flow**: Calls `POST /api/design/new` → receives a new `designId` → resets all UI state (nodes, edges, requirements, interview, selected question).
- **Server**: Creates empty design state `{ nodes: [], edges: [], requirements: {}, interview: {}, packId: null }` keyed by `designId`.
- **UI**: Passes `key={designId}` to `FlowCanvas` and `RightPanel` so they remount on reset.
- **Session**: Interview sessions are keyed by `designId` when available.

## Admin Unlock

- **Entry**: "Unlock Admin" button in the header; click to open the passcode modal.
- **Passcode**: Stored in `.env` as `ADMIN_PASSCODE`; fallback is `admin123` (local only).
- **Storage**: After successful verification, state is stored in `localStorage` (1h expiry) and `sessionStorage` (for API headers).
- **API**: Admin endpoints (`/api/admin/upload`, `/api/admin/transcribe`, etc.) require `X-Admin-Passcode` header matching `ADMIN_PASSCODE`.
- **Training**: Upload video/file, Transcribe, and Build memory are only shown after unlock.

## Adding Components to components.json

1. Edit `server/ai/knowledge/components.json`.
2. Add a new object to the `components` array with: `id`, `name`, `category`, `purpose`, optional `inputs`, `outputs`, `knobs`, `commonFailureModes`, `interviewHooks`, `synonyms`.
3. `id` must be unique and kebab-case (e.g. `message-store`).
4. `synonyms` maps vendor names (e.g. "Kafka") to this canonical id via `normalizeVendorTerms`.
5. Restart the server to pick up changes (components are loaded at module init).

## Pack versioning & regeneration

- **PACK_VERSION**: In `server/storage/index.js`; bump when pack format changes. Packs with `packVersion < PACK_VERSION` are considered stale.
- **Storage**: Packs in `server/data/packs/*.json` (individual files) take precedence over `packs.json`. Regeneration writes to `packs/<id>.json`.
- **Regeneration**: `node server/ai/tools/regeneratePacks.js` or `POST /api/admin/regenerate-packs` (admin-protected). Uses CreatorAgent/synthesize to produce richer diagrams (edge/app/data/async/observability/security layers), canonical component IDs, and node notes (what, why, defaults, risks).
- **Auto-refresh**: On server start, if any pack is stale, all stale packs are regenerated automatically.
- **Admin**: Admin → Training tab → "Regenerate Packs" to trigger on demand. Question Bank refetches after regeneration.

## Quality Gate (Missing / Unnecessary)

- **Missing Critical**: `designValidator` checks required layers: edge, app, data, async, observability, security. If a layer has no components, it's added to `qualityReport.missingCritical`.
- **Minimal Design**: For topics like "chat", "newsfeed", "upload", "messaging", "Twitter", designs with fewer than 4 nodes are flagged as too minimal.
- **Unnecessary**: Nodes with `status: 'unjustified'` (no requirement/NFR match) are added to `qualityReport.unnecessary` with a reason.
- **Rules**: WAF without threat model, API gateway without multi-service routing, etc. are marked unnecessary when there is no justifying requirement.
- **Enrichment**: If validation fails, an enrichment pass can add missing components based on topic (e.g. Chat System gets realtime-gateway, presence-service, etc.).
