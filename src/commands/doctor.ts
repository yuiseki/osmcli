import { writeJson, writeText } from "../io/output.js";

type ProbeResult = {
	ok: boolean;
	status?: number;
	ms?: number;
	error?: string;
};

const DEFAULT_NOMINATIM_HOST = "https://nominatim.yuiseki.net";
const DEFAULT_OVERPASS_HOST = "https://overpass.yuiseki.net";
const DEFAULT_VALHALLA_HOST = "https://valhalla.yuiseki.net";
const DEFAULT_TAGINFO_HOST = "https://taginfo.yuiseki.net";

const getHost = (envKey: string, fallback: string): string =>
	process.env[envKey] ?? fallback;

const withTimeout = async (url: URL, init: RequestInit): Promise<Response> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 8000);
	try {
		return await fetch(url, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timer);
	}
};

const probe = async (
	name: string,
	buildUrl: () => URL,
	init: RequestInit,
): Promise<ProbeResult> => {
	const start = Date.now();
	try {
		const url = buildUrl();
		const response = await withTimeout(url, init);
		return {
			ok: response.ok,
			status: response.status,
			ms: Date.now() - start,
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : `${name} error`,
			ms: Date.now() - start,
		};
	}
};

export const runDoctor = async (options?: {
	format?: string;
}): Promise<void> => {
	const nominatimHost = getHost(
		"OSMABLE_NOMINATIM_HOST",
		DEFAULT_NOMINATIM_HOST,
	);
	const overpassHost = getHost("OSMABLE_OVERPASS_HOST", DEFAULT_OVERPASS_HOST);
	const valhallaHost = getHost("OSMABLE_VALHALLA_HOST", DEFAULT_VALHALLA_HOST);
	const taginfoHost = getHost("OSMABLE_TAGINFO_HOST", DEFAULT_TAGINFO_HOST);

	const [nominatim, overpass, valhalla, taginfo] = await Promise.all([
		probe(
			"nominatim",
			() => {
				const url = new URL("/search.php", nominatimHost);
				url.searchParams.set("q", "tokyo");
				url.searchParams.set("format", "jsonv2");
				url.searchParams.set("limit", "1");
				return url;
			},
			{
				method: "GET",
				headers: { "User-Agent": "osmable/0.1.0 (cli)" },
			},
		),
		probe("overpass", () => new URL("/api/interpreter", overpassHost), {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
				"User-Agent": "osmable/0.1.0 (cli)",
			},
			body: new URLSearchParams({ data: "[out:json];node(0);out;" }),
		}),
		probe(
			"valhalla",
			() => {
				const url = new URL("/route", valhallaHost);
				url.searchParams.set(
					"json",
					JSON.stringify({
						locations: [
							{ lat: 35.0, lon: 139.0 },
							{ lat: 35.0001, lon: 139.0001 },
						],
						costing: "pedestrian",
						units: "kilometers",
					}),
				);
				return url;
			},
			{
				method: "GET",
				headers: { "User-Agent": "osmable/0.1.0 (cli)" },
			},
		),
		probe("taginfo", () => new URL("/api/4/site/info", taginfoHost), {
			method: "GET",
			headers: { "User-Agent": "osmable/0.1.0 (cli)" },
		}),
	]);

	const format = options?.format ?? "text";

	if (format === "text") {
		writeText(
			`nominatim ok=${nominatim.ok} status=${nominatim.status ?? "-"} ms=${
				nominatim.ms ?? "-"
			}`,
		);
		writeText(
			`overpass ok=${overpass.ok} status=${overpass.status ?? "-"} ms=${
				overpass.ms ?? "-"
			}`,
		);
		writeText(
			`valhalla ok=${valhalla.ok} status=${valhalla.status ?? "-"} ms=${
				valhalla.ms ?? "-"
			}`,
		);
		writeText(
			`taginfo ok=${taginfo.ok} status=${taginfo.status ?? "-"} ms=${
				taginfo.ms ?? "-"
			}`,
		);
		return;
	}

	writeJson({ nominatim, overpass, valhalla, taginfo });
};
