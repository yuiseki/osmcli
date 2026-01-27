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
			trip: { summary: { length: 5.2, time: 900 } },
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
	it("prints json output by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_VALHALLA_HOST = "https://valhalla.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runRoute({ from: "東京駅", to: "浅草寺", mode: "pedestrian" });

		expect(stdout).toHaveBeenCalledWith(
			'{"trip":{"summary":{"length":5.2,"time":900}}}\n',
		);
	});
});
