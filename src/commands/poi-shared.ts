import fs from "node:fs";

import { OsmableError } from "../domain/errors.js";

export type Bbox = {
	south: number;
	west: number;
	north: number;
	east: number;
};

type GeoJsonGeometry = {
	type: string;
	coordinates: unknown;
};

type GeoJsonFeature = {
	type: "Feature";
	geometry: GeoJsonGeometry | null;
	properties?: Record<string, unknown>;
};

type GeoJsonFeatureCollection = {
	type: "FeatureCollection";
	features: GeoJsonFeature[];
};

type GeoJsonLike = GeoJsonGeometry | GeoJsonFeature | GeoJsonFeatureCollection;

type NominatimSearchResult = {
	boundingbox?: [string, string, string, string];
	[address: string]: unknown;
};

const DEFAULT_NOMINATIM_HOST = "https://nominatim.yuiseki.net";
const DEFAULT_OVERPASS_HOST = "https://overpass.yuiseki.net";

const PRESET_TAGS: Record<string, string> = {
	cafe: "amenity=cafe",
	convenience: "shop=convenience",
	station: "railway=station",
};

const parseTag = (tag: string): { key: string; value: string; raw: string } => {
	const [key, value] = tag.split("=");
	if (!key || value === undefined || value.length === 0) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "tag must be in key=value format",
		});
	}
	return { key, value, raw: tag };
};

export const resolveTag = (params: {
	tag?: string;
	preset?: string;
}): { key: string; value: string; raw: string } => {
	if (params.tag && params.preset) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "use either --tag or --preset, not both",
		});
	}
	if (params.tag) return parseTag(params.tag);
	if (params.preset) {
		const preset = params.preset.toLowerCase();
		const tag = PRESET_TAGS[preset];
		if (!tag) {
			throw new OsmableError({
				code: "INVALID_INPUT",
				message: `unknown preset: ${params.preset}`,
			});
		}
		return parseTag(tag);
	}
	throw new OsmableError({
		code: "INVALID_INPUT",
		message: "--tag or --preset is required",
	});
};

const getNominatimHost = (): string =>
	process.env.OSMABLE_NOMINATIM_HOST ?? DEFAULT_NOMINATIM_HOST;

const getOverpassHost = (): string =>
	process.env.OSMABLE_OVERPASS_HOST ?? DEFAULT_OVERPASS_HOST;

const readStdin = async (): Promise<string> => {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
};

const parseGeoJson = (value: string): GeoJsonLike => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(value);
	} catch (error) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "invalid GeoJSON input",
		});
	}
	if (!parsed || typeof parsed !== "object") {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "invalid GeoJSON input",
		});
	}
	return parsed as GeoJsonLike;
};

const updateBounds = (
	coords: unknown,
	bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number },
): void => {
	if (!Array.isArray(coords)) return;
	if (
		coords.length === 2 &&
		coords.every((value) => typeof value === "number")
	) {
		const [lon, lat] = coords as [number, number];
		bounds.minLat = Math.min(bounds.minLat, lat);
		bounds.maxLat = Math.max(bounds.maxLat, lat);
		bounds.minLon = Math.min(bounds.minLon, lon);
		bounds.maxLon = Math.max(bounds.maxLon, lon);
		return;
	}
	for (const entry of coords) {
		updateBounds(entry, bounds);
	}
};

const geoJsonToBbox = (input: GeoJsonLike): Bbox => {
	const bounds = {
		minLat: Number.POSITIVE_INFINITY,
		maxLat: Number.NEGATIVE_INFINITY,
		minLon: Number.POSITIVE_INFINITY,
		maxLon: Number.NEGATIVE_INFINITY,
	};

	const applyGeometry = (
		geometry: GeoJsonGeometry | null | undefined,
	): void => {
		if (!geometry) return;
		updateBounds(geometry.coordinates, bounds);
	};

	if (input.type === "FeatureCollection") {
		for (const feature of input.features) {
			applyGeometry(feature.geometry ?? null);
		}
	} else if (input.type === "Feature") {
		applyGeometry(input.geometry ?? null);
	} else if (input.type) {
		applyGeometry(input as GeoJsonGeometry);
	}

	if (!Number.isFinite(bounds.minLat) || !Number.isFinite(bounds.minLon)) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "GeoJSON does not contain coordinates",
		});
	}

	return {
		south: bounds.minLat,
		west: bounds.minLon,
		north: bounds.maxLat,
		east: bounds.maxLon,
	};
};

const fetchNominatimBbox = async (query: string): Promise<Bbox> => {
	let host: URL;
	try {
		host = new URL(getNominatimHost());
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
			"User-Agent": "osmcli/0.1.0 (cli)",
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
	const result = data[0] as NominatimSearchResult;
	if (!result.boundingbox) {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Nominatim response missing boundingbox",
		});
	}
	const [south, north, west, east] = result.boundingbox;
	return {
		south: Number.parseFloat(south),
		north: Number.parseFloat(north),
		west: Number.parseFloat(west),
		east: Number.parseFloat(east),
	};
};

export const resolveWithinBbox = async (within: string): Promise<Bbox> => {
	if (within === "-") {
		const input = await readStdin();
		return geoJsonToBbox(parseGeoJson(input));
	}

	const path = within.startsWith("@") ? within.slice(1) : within;
	if (path && fs.existsSync(path) && fs.statSync(path).isFile()) {
		const contents = fs.readFileSync(path, "utf8");
		return geoJsonToBbox(parseGeoJson(contents));
	}

	return fetchNominatimBbox(within);
};

export const buildOverpassQuery = (params: {
	tag: { key: string; value: string };
	bbox: Bbox;
	output: "geom" | "count";
}): string => {
	const { tag, bbox, output } = params;
	const bboxString = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
	const selector = `["${tag.key}"="${tag.value}"]`;
	const out = output === "count" ? "out count;" : "out geom;";
	return [
		"[out:json][timeout:25];",
		"(",
		`  node${selector}(${bboxString});`,
		`  way${selector}(${bboxString});`,
		`  relation${selector}(${bboxString});`,
		");",
		out,
	].join("\n");
};

export const fetchOverpass = async (query: string): Promise<unknown> => {
	let host: URL;
	try {
		host = new URL(getOverpassHost());
	} catch (error) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "OSMABLE_OVERPASS_HOST must be a valid URL",
		});
	}

	const url = new URL("/api/interpreter", host);
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
			"User-Agent": "osmcli/0.1.0 (cli)",
		},
		body: new URLSearchParams({ data: query }),
	});
	if (!response.ok) {
		throw new OsmableError({
			code:
				response.status >= 500 ? "UPSTREAM_TEMPORARY" : "UPSTREAM_PERMANENT",
			message: `Overpass error: ${response.status} ${response.statusText}`,
		});
	}
	const contentType = response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		const body = await response.text();
		const snippet = body.trim().slice(0, 200);
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Overpass error: non-JSON response",
			hints: {
				note: "Upstream returned an HTML/XML error page; check server configuration. Retrying likely won't help.",
			},
			candidates: snippet ? [{ snippet }] : undefined,
		});
	}

	try {
		return await response.json();
	} catch (error) {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Overpass error: invalid JSON response",
			hints: {
				note: "Upstream returned invalid JSON. This usually indicates a server-side error; retrying is unlikely to help.",
			},
		});
	}
};
