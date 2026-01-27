# osmable

Agent-first OSM CLI for geocoding, AOI, POI, and routing.

Status: scaffolded per PRD/ADR. Commands are stubbed and return "not implemented" errors.

## Development

- Requires Node.js 22+ (ADR-0001)
- Run: `npm install`
- First time: `cp .env.example .env`
- Dev: `npm run dev -- --help`

## CLI (planned)

- `geocode`, `reverse`
- `aoi resolve`
- `poi count`, `poi fetch`
- `route`, `isochrone`
- `doctor`

See `docs/PRD.md` and `docs/ADR/001.md` for requirements.
