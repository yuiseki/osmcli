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

import { runIsochrone } from "../src/commands/isochrone.js";

const server = setupServer(
	http.get("https://nominatim.test/search.php", () =>
		HttpResponse.json([{ lat: "35.681236", lon: "139.767125" }]),
	),
	http.get("https://valhalla.test/isochrone", () =>
		HttpResponse.json({
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					properties: { contour: 10, metric: "time" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[139.7, 35.6],
								[139.8, 35.6],
								[139.8, 35.8],
								[139.7, 35.8],
								[139.7, 35.6],
							],
						],
					},
				},
			],
		}),
	),
);

afterAll(() => server.close());

beforeAll(() => server.listen());

afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});

describe("runIsochrone", () => {
	it("prints text output by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_VALHALLA_HOST = "https://valhalla.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runIsochrone({
			from: "東京駅",
			minutes: "10,20",
			mode: "pedestrian",
		});

		expect(stdout).toHaveBeenCalledWith("from: 東京駅\n");
		expect(stdout).toHaveBeenCalledWith("  minutes: 10,20\n");
		expect(stdout).toHaveBeenCalledWith("  time: 10\n");
		expect(stdout).toHaveBeenCalledWith("    bbox: 35.6,139.7,35.8,139.8\n");
		const areaLine = stdout.mock.calls
			.map((call) => call[0])
			.find((line) => line.startsWith("    area_km2: "));
		expect(areaLine).toBeTruthy();
	});
});
