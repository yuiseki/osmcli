# osmcli

Agent-first OSM CLI for geocoding, AOI, POI, and routing.

## Development

- Requires Node.js 22+ (ADR-0001)
- Run: `npm ci`
- First time: `cp .env.example .env`
- Dev: `npm run dev -- --help`

### Install for development environment

- `npm run build`
- `npm link`
- `which osmcli`
- `osmcli --help`

## CLI

- geocoding
  - `osmcli geocode`
  - `osmcli reverse`
- tags
  - `osmcli tag search`
  - `osmcli tag info`
- AOI
  - `osmcli aoi resolve`
- POI
  - `osmcli poi count`
  - `osmcli poi fetch`
- routing
  - `osmcli route`
  - `osmcli isochrone`
- others
  - `doctor`

### Output format

Default output format is `text`. Text output is concise and keeps context minimal.
Unless there is a specific reason, we recommend using `text` format (default).
Use `--format json` when you need details that are not available in text output or when you want to extract specific fields with tools like `jq`.

## Examples

- Geocode:
  - `osmcli geocode "東京都台東区"`
  - `osmcli geocode "東京都台東区" --format json`
- Reverse geocode:
  - `osmcli reverse --lat 35.7125805 --lon 139.7800712`
  - `osmcli reverse --lat 35.7125805 --lon 139.7800712 --format json`
- Tag search:
  - `osmcli tag search "cafe"`
  - `osmcli tag search "amenity" --limit 20`
  - `osmcli tag search "ramen" --key cuisine`
- Tag info:
  - `osmcli tag info "amenity=cafe"`
  - `osmcli tag info "shop=convenience" --lang ja`
- AOI resolve:
  - `osmcli aoi resolve "東京都台東区"`
  - `osmcli aoi resolve "東京都台東区" --format geojson`
- POI count:
  - `osmcli poi count --tag amenity=cafe --within "東京都台東区"`
  - `osmcli poi count --tag amenity=cafe --within @aoi.geojson --format json`
- POI fetch:
  - `osmcli poi fetch --tag amenity=cafe --within "東京都台東区"`
  - `osmcli poi fetch --tag amenity=cafe --within "東京都台東区" --format geojson`
- Route:
  - `osmcli route --from "東京駅" --to "浅草寺"`
  - `osmcli route --from "東京駅" --to "浅草寺" --mode bicycle --format json`
- Isochrone:
  - `osmcli isochrone --from "東京駅" --minutes 10,20`
  - `osmcli isochrone --from "東京駅" --minutes 10,20 --format geojson`
- Doctor:
  - `osmcli doctor`
