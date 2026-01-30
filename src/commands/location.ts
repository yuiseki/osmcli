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

	const searchPaths = ["/search.php", "/search"];
	for (const [index, path] of searchPaths.entries()) {
		const url = new URL(path, host);
		url.searchParams.set("q", query);
		url.searchParams.set("format", "jsonv2");
		url.searchParams.set("limit", "1");

		const response = await fetch(url, {
			headers: {
				"User-Agent": "osmable/0.1.0 (cli)",
			},
		});
		if (!response.ok) {
			if (
				(response.status === 404 || response.status === 405) &&
				index < searchPaths.length - 1
			) {
				continue;
			}
			throw new OsmableError({
				code:
					response.status >= 500 ? "UPSTREAM_TEMPORARY" : "UPSTREAM_PERMANENT",
				message: `Nominatim error: ${response.status} ${response.statusText}`,
			});
		}

		let data: unknown;
		try {
			data = (await response.json()) as unknown;
		} catch (error) {
			if (index < searchPaths.length - 1) {
				continue;
			}
			throw new OsmableError({
				code: "UPSTREAM_PERMANENT",
				message: "Unexpected Nominatim response",
			});
		}
		if (!Array.isArray(data)) {
			if (index < searchPaths.length - 1) {
				continue;
			}
			throw new OsmableError({
				code: "UPSTREAM_PERMANENT",
				message: "Unexpected Nominatim response",
			});
		}
		if (data.length === 0) {
			throw new OsmableError({
				code: "NOT_FOUND",
				message: "No results from Nominatim",
			});
		}
		return data[0] as NominatimSearchResult;
	}

	throw new OsmableError({
		code: "UPSTREAM_PERMANENT",
		message: "Unexpected Nominatim response",
	});
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
