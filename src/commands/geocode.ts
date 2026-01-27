import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";

export type GeocodeOptions = {
	limit: string;
	lang?: string;
	country?: string;
	all?: boolean;
	format?: string;
};

type NominatimResult = {
	place_id?: number;
	lat: string;
	lon: string;
	display_name?: string;
	type?: string;
	class?: string;
	importance?: number;
	geojson?: unknown;
	[address: string]: unknown;
};

const DEFAULT_HOST = "https://nominatim.yuiseki.net";

const getHost = (): string =>
	process.env.OSMABLE_NOMINATIM_HOST ?? DEFAULT_HOST;

const parseLimit = (value: string): number => {
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "limit must be a positive integer",
		});
	}
	return parsed;
};

const buildSearchUrl = (query: string, options: GeocodeOptions): URL => {
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
	url.searchParams.set("addressdetails", "1");
	url.searchParams.set("limit", String(parseLimit(options.limit)));
	if (options.lang) {
		url.searchParams.set("accept-language", options.lang);
	}
	if (options.country) {
		url.searchParams.set("countrycodes", options.country.toLowerCase());
	}
	return url;
};

const fetchResults = async (url: URL): Promise<NominatimResult[]> => {
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
	if (!Array.isArray(data)) {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Unexpected Nominatim response",
		});
	}
	return data as NominatimResult[];
};

const formatText = (result: NominatimResult): string => {
	const name = result.display_name ?? "";
	if (!name) return `${result.lat},${result.lon}`;
	return `address: ${name}\n${result.lat},${result.lon}`;
};

export const runGeocode = async (
	query: string,
	options: GeocodeOptions,
): Promise<void> => {
	const url = buildSearchUrl(query, options);
	const results = await fetchResults(url);
	if (results.length === 0) {
		throw new OsmableError({
			code: "NOT_FOUND",
			message: "No results from Nominatim",
		});
	}

	const wantsAll = Boolean(options.all);
	const format = options.format ?? "text";

	if (wantsAll) {
		if (format === "text") {
			for (const result of results) {
				writeText(formatText(result));
			}
			return;
		}
		if (format === "jsonl" || format === "ndjson") {
			for (const result of results) {
				writeJson(result);
			}
			return;
		}
		writeJson(results);
		return;
	}

	const [first] = results;
	if (format === "text") {
		writeText(formatText(first));
		return;
	}
	writeJson(first);
};
