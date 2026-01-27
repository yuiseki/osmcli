import { OsmableError } from "../domain/errors.js";

export type ResolvedLocation = {
	lat: number;
	lon: number;
	displayName?: string;
};

type NominatimSearchResult = {
	lat?: string;
	lon?: string;
	display_name?: string;
};

const DEFAULT_HOST = "https://nominatim.yuiseki.net";

const getHost = (): string =>
	process.env.OSMABLE_NOMINATIM_HOST ?? DEFAULT_HOST;

const parseLatLon = (value: string): ResolvedLocation | null => {
	const match = value.match(
		/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/,
	);
	if (!match) return null;
	const lat = Number.parseFloat(match[1]);
	const lon = Number.parseFloat(match[2]);
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
	return { lat, lon };
};

const fetchNominatim = async (
	query: string,
): Promise<NominatimSearchResult> => {
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

export const resolveLocation = async (
	value: string,
): Promise<ResolvedLocation> => {
	const parsed = parseLatLon(value);
	if (parsed) return parsed;

	const result = await fetchNominatim(value);
	const lat = result.lat ? Number.parseFloat(result.lat) : Number.NaN;
	const lon = result.lon ? Number.parseFloat(result.lon) : Number.NaN;
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Nominatim response missing lat/lon",
		});
	}
	return { lat, lon, displayName: result.display_name };
};
