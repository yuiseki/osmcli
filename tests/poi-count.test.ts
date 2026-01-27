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

import { runPoiCount } from "../src/commands/poi-count.js";

const server = setupServer(
	http.get("https://nominatim.test/search.php", () =>
		HttpResponse.json([
			{
				boundingbox: ["35.6", "35.8", "139.7", "139.8"],
			},
		]),
	),
	http.post("https://overpass.test/api/interpreter", async ({ request }) => {
		const body = await request.text();
		const params = new URLSearchParams(body);
		const data = params.get("data") ?? "";
		if (data.includes("amenity") && data.includes("cafe")) {
			return HttpResponse.json({
				elements: [{ tags: { total: "3" } }],
			});
		}
		return HttpResponse.json({ elements: [{ tags: { total: "0" } }] });
	}),
);

afterAll(() => server.close());

beforeAll(() => server.listen());

afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});

describe("runPoiCount", () => {
	it("prints text count by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_OVERPASS_HOST = "https://overpass.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runPoiCount({ within: "東京都台東区", preset: "cafe" });

		expect(stdout).toHaveBeenCalledWith("3\n");
	});
});
