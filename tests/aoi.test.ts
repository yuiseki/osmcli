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

import { runAoiResolve } from "../src/commands/aoi.js";

const server = setupServer(
	http.get("https://nominatim.test/search.php", ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.get("q") === "東京都台東区") {
			return HttpResponse.json([
				{
					place_id: 1,
					osm_type: "relation",
					osm_id: 2,
					display_name: "台東区, 東京都, 日本",
					boundingbox: ["35.6", "35.8", "139.7", "139.8"],
					geojson: {
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
			]);
		}
		return HttpResponse.json([]);
	}),
);

afterAll(() => server.close());

beforeAll(() => server.listen());

afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});

describe("runAoiResolve", () => {
	it("prints text output by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runAoiResolve("東京都台東区", {});

		expect(stdout).toHaveBeenCalledWith(
			"address: 台東区, 東京都, 日本\nbbox: 35.6,139.7,35.8,139.8\n",
		);
	});

	it("prints geojson when format is geojson", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runAoiResolve("東京都台東区", { format: "geojson" });

		expect(stdout).toHaveBeenCalledWith(
			'{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[139.7,35.6],[139.8,35.6],[139.8,35.8],[139.7,35.8],[139.7,35.6]]]},"properties":{"name":"台東区, 東京都, 日本","source":"nominatim","place_id":1,"osm_type":"relation","osm_id":2,"boundingbox":["35.6","35.8","139.7","139.8"]}}\n',
		);
	});
});
