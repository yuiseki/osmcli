import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";

type NominatimSearchResult = {
	place_id?: number;
	osm_type?: string;
	osm_id?: number;
	lat?: string;
	lon?: string;
	display_name?: string;
	geojson?: unknown;
	boundingbox?: [string, string, string, string];
	[address: string]: unknown;
};

export type AoiResolveOptions = {
	format?: string;
};

const DEFAULT_HOST = "https://nominatim.yuiseki.net";

const getHost = (): string =>
	process.env.OSMABLE_NOMINATIM_HOST ?? DEFAULT_HOST;

const fetchAoi = async (query: string): Promise<NominatimSearchResult> => {
	let host: URL;
	try {
		host = new URL(getHost());
	} catch (error) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "OSMABLE_NOMINATIM_HOST must be a valid URL",
		});
	}

	const url = new URL("/search.php", host);
	url.searchParams.set("q", query);
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("polygon_geojson", "1");
	url.searchParams.set("limit", "1");

	const response = await fetch(url, {
		headers: {
			"User-Agent": "osmable/0.1.0 (cli)",
		},
	});
	if (!response.ok) {
		throw new OsmableError({
			code:
				response.status >= 500 ? "UPSTREAM_TEMPORARY" : "UPSTREAM_PERMANENT",
			message: `Nominatim error: ${response.status} ${response.statusText}`,
		});
	}
	const data = (await response.json()) as unknown;
	if (!Array.isArray(data) || data.length === 0) {
		throw new OsmableError({
			code: "NOT_FOUND",
			message: "No results from Nominatim",
		});
	}
	return data[0] as NominatimSearchResult;
};

export const runAoiResolve = async (
	query: string,
	options: AoiResolveOptions,
): Promise<void> => {
	const result = await fetchAoi(query);
	const format = options.format ?? "geojson";

	if (format === "text") {
		writeText(result.display_name ?? query);
		return;
	}

	if (format === "json") {
		writeJson(result);
		return;
	}

	if (!result.geojson) {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Nominatim response missing geojson",
		});
	}

	const feature = {
		type: "Feature",
		geometry: result.geojson,
		properties: {
			name: result.display_name ?? query,
			source: "nominatim",
			place_id: result.place_id,
			osm_type: result.osm_type,
			osm_id: result.osm_id,
			boundingbox: result.boundingbox,
		},
	};

	writeJson(feature);
};
