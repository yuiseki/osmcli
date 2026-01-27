import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import { resolveLocation } from "./location.js";

export type IsochroneOptions = {
	from: string;
	minutes: string;
	mode: string;
	format?: string;
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
			"User-Agent": "osmable/0.1.0 (cli)",
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
	const format = options.format ?? "geojson";

	if (format === "text") {
		writeText(JSON.stringify(data));
		return;
	}

	writeJson(data);
};
