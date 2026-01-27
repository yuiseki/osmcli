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

	const format = options.format ?? "jsonl";

	if (format === "geojson" || format === "json") {
		writeJson(geojson);
		return;
	}

	if (format === "text") {
		writeText(JSON.stringify(geojson));
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
