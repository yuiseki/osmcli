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

import { runGeocode } from "../src/commands/geocode.js";

const server = setupServer(
	http.get("https://nominatim.test/search.php", ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.get("q") === "東京都台東区") {
			return HttpResponse.json([
				{
					place_id: 1,
					lat: "35.7125805",
					lon: "139.7800712",
					display_name: "台東区, 東京都, 日本",
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

describe("runGeocode", () => {
	it("prints text output by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runGeocode("東京都台東区", { limit: "1" });

		expect(stdout).toHaveBeenCalledWith(
			"address: 台東区, 東京都, 日本\n35.7125805,139.7800712\n",
		);
	});

	it("prints json output when format is json", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runGeocode("東京都台東区", { limit: "1", format: "json" });

		expect(stdout).toHaveBeenCalledWith(
			'{"place_id":1,"lat":"35.7125805","lon":"139.7800712","display_name":"台東区, 東京都, 日本"}\n',
		);
	});
});
