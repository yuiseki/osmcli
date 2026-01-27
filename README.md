# osmable

Agent-first OSM CLI for geocoding, AOI, POI, and routing.

## Development

- Requires Node.js 22+ (ADR-0001)
- Run: `npm install`
- First time: `cp .env.example .env`
- Dev: `npm run dev -- --help`

## CLI

- `geocode`, `reverse`
- `aoi resolve`
- `poi count`, `poi fetch`
- `route`, `isochrone`
- `doctor`

## Examples

- Geocode:
  - `osmable geocode "東京都台東区"`
  - `osmable geocode "東京都台東区" --format json`
- Reverse geocode:
  - `osmable reverse --lat 35.7125805 --lon 139.7800712`
  - `osmable reverse --lat 35.7125805 --lon 139.7800712 --format json`
- AOI resolve:
  - `osmable aoi resolve "東京都台東区"`
  - `osmable aoi resolve "東京都台東区" --format geojson`
- POI count:
  - `osmable poi count --tag amenity=cafe --within "東京都台東区"`
  - `osmable poi count --tag amenity=cafe --within @aoi.geojson --format json`
- POI fetch:
  - `osmable poi fetch --tag amenity=cafe --within "東京都台東区"`
  - `osmable poi fetch --tag amenity=cafe --within "東京都台東区" --format geojson`
- Route:
  - `osmable route --from "東京駅" --to "浅草寺"`
  - `osmable route --from "東京駅" --to "浅草寺" --mode bicycle --format json`
- Isochrone:
  - `osmable isochrone --from "東京駅" --minutes 10,20`
  - `osmable isochrone --from "東京駅" --minutes 10,20 --format geojson`
- Doctor:
  - `osmable doctor`

See `docs/PRD.md` and `docs/ADR/001.md` for requirements.
