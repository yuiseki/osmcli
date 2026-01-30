import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
	afterAll,
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi,
} from "vitest";

import { runRoute } from "../src/commands/route.js";

const server = setupServer(
	http.get("https://nominatim.test/search.php", ({ request }) => {
		const url = new URL(request.url);
		const query = url.searchParams.get("q");
		if (query === "東京駅") {
			return HttpResponse.json([{ lat: "35.681236", lon: "139.767125" }]);
		}
		if (query === "浅草寺") {
			return HttpResponse.json([{ lat: "35.714765", lon: "139.796655" }]);
		}
		return HttpResponse.json([]);
	}),
	http.get("https://valhalla.test/route", () =>
		HttpResponse.json({
			trip: {
				summary: { length: 5.2, time: 900 },
				legs: [
					{
						maneuvers: [
							{
								instruction: "Head north on Main St.",
								verbal_post_transition_instruction: "Continue for 200 meters.",
								length: 0.2,
								time: 60,
							},
							{
								instruction: "Turn right onto 2nd Ave.",
								verbal_post_transition_instruction: "Continue for 300 meters.",
								length: 0.3,
								time: 120,
							},
						],
					},
				],
			},
		}),
	),
);

afterAll(() => server.close());

beforeAll(() => server.listen());

afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});

describe("runRoute", () => {
	it("prints text output by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_VALHALLA_HOST = "https://valhalla.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runRoute({ from: "東京駅", to: "浅草寺", mode: "pedestrian" });

		expect(stdout).toHaveBeenCalledWith("from: 東京駅\n");
		expect(stdout).toHaveBeenCalledWith("to: 浅草寺\n");
		expect(stdout).toHaveBeenCalledWith("distance_km: 5.2\n");
		expect(stdout).toHaveBeenCalledWith("time_min: 15\n");
		expect(stdout).not.toHaveBeenCalledWith("steps:\n");
		expect(stdout).not.toHaveBeenCalledWith(
			"- Head north on Main St. (0.2 km) (1 min)\n",
		);
		expect(stdout).not.toHaveBeenCalledWith("  Continue for 200 meters.\n");
		expect(stdout).not.toHaveBeenCalledWith(
			"- Turn right onto 2nd Ave. (0.3 km) (2 min)\n",
		);
		expect(stdout).not.toHaveBeenCalledWith("  Continue for 300 meters.\n");
	});

	it("falls back to /search when /search.php is unavailable", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_VALHALLA_HOST = "https://valhalla.test";
		server.use(
			http.get("https://nominatim.test/search.php", () =>
				HttpResponse.text("Not found", { status: 404 }),
			),
			http.get("https://nominatim.test/search", ({ request }) => {
				const url = new URL(request.url);
				const query = url.searchParams.get("q");
				if (query === "上野駅") {
					return HttpResponse.json([{ lat: "35.713768", lon: "139.777254" }]);
				}
				if (query === "秋葉原駅") {
					return HttpResponse.json([{ lat: "35.698355", lon: "139.773114" }]);
				}
				return HttpResponse.json([]);
			}),
		);
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runRoute({ from: "上野駅", to: "秋葉原駅", mode: "pedestrian" });

		expect(stdout).toHaveBeenCalledWith("from: 上野駅\n");
		expect(stdout).toHaveBeenCalledWith("to: 秋葉原駅\n");
		expect(stdout).toHaveBeenCalledWith("distance_km: 5.2\n");
		expect(stdout).toHaveBeenCalledWith("time_min: 15\n");
	});

	it("prints steps when withSteps is true", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_VALHALLA_HOST = "https://valhalla.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runRoute({
			from: "東京駅",
			to: "浅草寺",
			mode: "pedestrian",
			withSteps: true,
		});

		expect(stdout).toHaveBeenCalledWith("steps:\n");
		expect(stdout).toHaveBeenCalledWith(
			"- Head north on Main St. (0.2 km) (1 min)\n",
		);
		expect(stdout).toHaveBeenCalledWith("  Continue for 200 meters.\n");
		expect(stdout).toHaveBeenCalledWith(
			"- Turn right onto 2nd Ave. (0.3 km) (2 min)\n",
		);
		expect(stdout).toHaveBeenCalledWith("  Continue for 300 meters.\n");
	});
});
