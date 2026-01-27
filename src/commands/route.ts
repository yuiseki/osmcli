import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import { resolveLocation } from "./location.js";

export type RouteOptions = {
	from: string;
	to: string;
	mode: string;
	format?: string;
};

type ValhallaRouteResponse = {
	trip?: {
		summary?: {
			length?: number;
			time?: number;
		};
		legs?: Array<{
			maneuvers?: Array<{
				instruction?: string;
				verbal_pre_transition_instruction?: string;
				verbal_post_transition_instruction?: string;
				length?: number;
				time?: number;
			}>;
		}>;
	};
	[address: string]: unknown;
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

export const runRoute = async (options: RouteOptions): Promise<void> => {
	const [from, to] = await Promise.all([
		resolveLocation(options.from),
		resolveLocation(options.to),
	]);

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
		locations: [
			{ lat: from.lat, lon: from.lon },
			{ lat: to.lat, lon: to.lon },
		],
		costing: resolveCosting(options.mode),
		units: "kilometers",
	};

	const url = new URL("/route", host);
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

	const data = (await response.json()) as ValhallaRouteResponse;
	const format = options.format ?? "text";

	if (format === "text") {
		const length = data.trip?.summary?.length;
		const time = data.trip?.summary?.time;
		if (!Number.isFinite(length) || !Number.isFinite(time)) {
			throw new OsmableError({
				code: "UPSTREAM_PERMANENT",
				message: "Valhalla response missing summary",
			});
		}
		const fromLabel = from.displayName ?? options.from;
		const toLabel = to.displayName ?? options.to;
		const minutes = Math.round(time / 60);
		writeText(`from: ${fromLabel}`);
		writeText(`to: ${toLabel}`);
		writeText(`distance_km: ${length}`);
		writeText(`time_min: ${minutes}`);
		const maneuvers =
			data.trip?.legs?.flatMap((leg) => leg.maneuvers ?? []) ?? [];
		if (maneuvers.length > 0) {
			writeText("steps:");
			for (const maneuver of maneuvers) {
				const primary =
					maneuver.instruction ??
					maneuver.verbal_pre_transition_instruction ??
					"";
				const post = maneuver.verbal_post_transition_instruction ?? "";
				const distance =
					typeof maneuver.length === "number" ? ` (${maneuver.length} km)` : "";
				const duration =
					typeof maneuver.time === "number"
						? ` (${Math.round(maneuver.time / 60)} min)`
						: "";
				if (primary) {
					writeText(
						`- ${primary}${distance || duration ? `${distance}${duration}` : ""}`,
					);
				}
				if (post) {
					writeText(`  ${post}`);
				}
			}
		}
		return;
	}

	writeJson(data);
};
