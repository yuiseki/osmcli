import area from "@turf/area";
import bbox from "@turf/bbox";

import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import { resolveLocation } from "./location.js";

export type IsochroneOptions = {
	from: string;
	minutes: string;
	mode: string;
	format?: string;
};

type IsochroneFeatureCollection = {
	type: "FeatureCollection";
	features?: Array<{
		type?: "Feature";
		geometry?: {
			type: string;
			coordinates: unknown;
		} | null;
		properties?: { time?: number; contour?: number; metric?: string };
	}>;
};

const DEFAULT_HOST = "https://valhalla.yuiseki.net";

const getHost = (): string => process.env.OSMABLE_VALHALLA_HOST ?? DEFAULT_HOST;

const resolveCosting = (mode: string): string => {
	switch (mode) {
		case "pedestrian":
			return "pedestrian";
		case "bicycle":
			return "bicycle";
		case "car":
			return "auto";
		default:
			throw new OsmableError({
				code: "INVALID_INPUT",
				message: `unknown mode: ${mode}`,
			});
	}
};

const parseMinutes = (value: string): number[] => {
	const minutes = value
		.split(",")
		.map((entry) => Number.parseFloat(entry.trim()))
		.filter((entry) => Number.isFinite(entry) && entry > 0);
	if (minutes.length === 0) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "minutes must be a comma-separated list of positive numbers",
		});
	}
	return minutes;
};

export const runIsochrone = async (
	options: IsochroneOptions,
): Promise<void> => {
	const origin = await resolveLocation(options.from);

	let host: URL;
	try {
		host = new URL(getHost());
	} catch (error) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "OSMABLE_VALHALLA_HOST must be a valid URL",
		});
	}

	const payload = {
		locations: [{ lat: origin.lat, lon: origin.lon }],
		costing: resolveCosting(options.mode),
		contours: parseMinutes(options.minutes).map((time) => ({ time })),
		polygons: true,
	};

	const url = new URL("/isochrone", host);
	url.searchParams.set("json", JSON.stringify(payload));

	const response = await fetch(url, {
		headers: {
			"User-Agent": "osmcli/0.1.0 (cli)",
		},
	});
	if (!response.ok) {
		throw new OsmableError({
			code:
				response.status >= 500 ? "UPSTREAM_TEMPORARY" : "UPSTREAM_PERMANENT",
			message: `Valhalla error: ${response.status} ${response.statusText}`,
		});
	}

	const data = (await response.json()) as unknown;
	const format = options.format ?? "text";

	if (format === "text") {
		const collection = data as IsochroneFeatureCollection;
		if (collection.type === "FeatureCollection" && collection.features) {
			const minutes = parseMinutes(options.minutes).join(",");
			const fromLabel = origin.displayName ?? options.from;
			writeText(`from: ${fromLabel}`);
			writeText(`  minutes: ${minutes}`);
			const sorted = [...collection.features].sort((a, b) => {
				const left = a.properties?.contour ?? a.properties?.time ?? 0;
				const right = b.properties?.contour ?? b.properties?.time ?? 0;
				return left - right;
			});
			for (const feature of sorted) {
				const contour = feature.properties?.contour ?? feature.properties?.time;
				if (typeof contour !== "number") continue;
				const unit =
					feature.properties?.metric === "distance" ? "distance" : "time";
				writeText(`  ${unit}: ${contour}`);
				if (feature.type === "Feature") {
					const typedFeature = feature as unknown as object;
					const featureBbox = bbox(typedFeature);
					const km2 = area(typedFeature) / 1_000_000;
					writeText(
						`    bbox: ${featureBbox[1]},${featureBbox[0]},${featureBbox[3]},${featureBbox[2]}`,
					);
					writeText(`    area_km2: ${km2.toFixed(3)}`);
				}
			}
			return;
		}
		writeText(JSON.stringify(data));
		return;
	}

	writeJson(data);
};
