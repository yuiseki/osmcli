import osm2geojson from "osm2geojson-lite";

import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import {
	buildOverpassQuery,
	fetchOverpass,
	resolveTag,
	resolveWithinBbox,
} from "./poi-shared.js";

export type PoiFetchOptions = {
	within: string;
	tag?: string;
	preset?: string;
	limit?: string;
	sort?: string;
	format?: string;
};

type GeoJsonFeatureCollection = {
	type: "FeatureCollection";
	features: Array<Record<string, unknown>>;
};

const formatFeatureText = (feature: Record<string, unknown>): string => {
	const name =
		typeof feature.properties === "object" &&
		feature.properties &&
		"name" in feature.properties
			? String((feature.properties as Record<string, unknown>).name ?? "")
			: "";
	const id = typeof feature.id === "string" ? feature.id : "";
	const label = name || id || "unknown";
	const geometry =
		typeof feature.geometry === "object" && feature.geometry
			? (feature.geometry as { type?: string; coordinates?: unknown })
			: undefined;
	if (
		geometry?.type === "Point" &&
		Array.isArray(geometry.coordinates) &&
		geometry.coordinates.length >= 2
	) {
		const [lon, lat] = geometry.coordinates as [number, number];
		if (Number.isFinite(lat) && Number.isFinite(lon)) {
			return `${label}\t${lat},${lon}`;
		}
	}
	return label;
};

const parseLimit = (value: string | undefined): number | null => {
	if (value === undefined) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "limit must be a positive integer",
		});
	}
	return parsed;
};

const normalizeSort = (value: string | undefined): "name" | "id" | null => {
	if (!value) return null;
	const normalized = value.toLowerCase();
	if (normalized === "name" || normalized === "id") return normalized;
	throw new OsmableError({
		code: "INVALID_INPUT",
		message: "sort must be name or id",
	});
};

const extractSortKey = (
	feature: Record<string, unknown>,
	field: "name" | "id",
) => {
	if (field === "id" && typeof feature.id === "string") {
		return feature.id;
	}
	if (field === "name") {
		const props = feature.properties;
		if (props && typeof props === "object" && "name" in props) {
			return String((props as Record<string, unknown>).name ?? "");
		}
	}
	return "";
};

export const runPoiFetch = async (options: PoiFetchOptions): Promise<void> => {
	const tag = resolveTag({ tag: options.tag, preset: options.preset });
	const bbox = await resolveWithinBbox(options.within);
	const query = buildOverpassQuery({ tag, bbox, output: "geom" });
	const data = await fetchOverpass(query);
	const geojson = osm2geojson(data) as GeoJsonFeatureCollection;

	if (!geojson || geojson.type !== "FeatureCollection") {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Unexpected Overpass response for GeoJSON conversion",
		});
	}

	const sort = normalizeSort(options.sort);
	const limit = parseLimit(options.limit);
	let features = geojson.features;
	if (sort) {
		features = [...features].sort((a, b) => {
			const left = extractSortKey(a, sort);
			const right = extractSortKey(b, sort);
			return left.localeCompare(right);
		});
	}
	if (limit) {
		features = features.slice(0, limit);
	}

	const format = options.format ?? "text";

	if (format === "geojson" || format === "json") {
		writeJson({ ...geojson, features });
		return;
	}

	if (format === "text") {
		for (const feature of features) {
			writeText(formatFeatureText(feature));
		}
		return;
	}

	if (format === "jsonl" || format === "ndjson") {
		for (const feature of features) {
			writeJson(feature);
		}
		return;
	}

	writeJson({ ...geojson, features });
};
