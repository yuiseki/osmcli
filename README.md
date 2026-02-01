# osmable

Agent-first OSM CLI for geocoding, AOI, POI, and routing.

## Development

- Requires Node.js 22+ (ADR-0001)
- Run: `npm ci`
- First time: `cp .env.example .env`
- Dev: `npm run dev -- --help`

### Install for development environment

- `npm run build`
- `npm link`
- `which osmable`
- `osmable --help`

## CLI

- geocoding
  - `osmable geocode`
  - `osmable reverse`
- tags
  - `osmable tag search`
  - `osmable tag info`
- AOI
  - `osmable aoi resolve`
- POI
  - `osmable poi count`
  - `osmable poi fetch`
- routing
  - `osmable route`
  - `osmable isochrone`
- others
  - `doctor`

### Output format

Default output format is `text`. Text output is concise and keeps context minimal.
Unless there is a specific reason, we recommend using `text` format (default).
Use `--format json` when you need details that are not available in text output or when you want to extract specific fields with tools like `jq`.

## Examples

- Geocode:
  - `osmable geocode "東京都台東区"`
  - `osmable geocode "東京都台東区" --format json`
- Reverse geocode:
  - `osmable reverse --lat 35.7125805 --lon 139.7800712`
  - `osmable reverse --lat 35.7125805 --lon 139.7800712 --format json`
- Tag search:
  - `osmable tag search "cafe"`
  - `osmable tag search "amenity" --limit 20`
  - `osmable tag search "ramen" --key cuisine`
- Tag info:
  - `osmable tag info "amenity=cafe"`
  - `osmable tag info "shop=convenience" --lang ja`
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
