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

	const format = options.format ?? "text";

	if (format === "geojson" || format === "json") {
		writeJson(geojson);
		return;
	}

	if (format === "text") {
		for (const feature of geojson.features) {
			writeText(formatFeatureText(feature));
		}
		return;
	}

	if (format === "jsonl" || format === "ndjson") {
		for (const feature of geojson.features) {
			writeJson(feature);
		}
		return;
	}

	writeJson(geojson);
};
