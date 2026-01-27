import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";

export type ReverseOptions = {
	lat: string;
	lon: string;
	format?: string;
	lang?: string;
	zoom?: string;
};

type NominatimReverseResult = {
	place_id?: number;
	lat: string;
	lon: string;
	display_name?: string;
	address?: Record<string, unknown>;
	[address: string]: unknown;
};

const DEFAULT_HOST = "https://nominatim.yuiseki.net";

const getHost = (): string =>
	process.env.OSMABLE_NOMINATIM_HOST ?? DEFAULT_HOST;

const parseNumber = (value: string, name: string): number => {
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: `${name} must be a number`,
		});
	}
	return parsed;
};

const buildReverseUrl = (options: ReverseOptions): URL => {
	let host: URL;
	try {
		host = new URL(getHost());
	} catch (error) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "OSMABLE_NOMINATIM_HOST must be a valid URL",
		});
	}

	const url = new URL("/reverse", host);
	url.searchParams.set("format", "jsonv2");
	url.searchParams.set("lat", String(parseNumber(options.lat, "lat")));
	url.searchParams.set("lon", String(parseNumber(options.lon, "lon")));
	if (options.lang) {
		url.searchParams.set("accept-language", options.lang);
	}
	if (options.zoom) {
		url.searchParams.set("zoom", options.zoom);
	}
	return url;
};

const fetchResult = async (url: URL): Promise<NominatimReverseResult> => {
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
	if (!data || typeof data !== "object") {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Unexpected Nominatim response",
		});
	}
	return data as NominatimReverseResult;
};

const formatText = (result: NominatimReverseResult): string => {
	const name = result.display_name ?? "";
	if (!name) return `${result.lat},${result.lon}`;
	return `address: ${name}\n${result.lat},${result.lon}`;
};

export const runReverse = async (options: ReverseOptions): Promise<void> => {
	const url = buildReverseUrl(options);
	const result = await fetchResult(url);
	const format = options.format ?? "text";

	if (format === "text") {
		writeText(formatText(result));
		return;
	}

	writeJson(result);
};
