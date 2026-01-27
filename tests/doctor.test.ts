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

import { runDoctor } from "../src/commands/doctor.js";

const server = setupServer(
	http.get("https://nominatim.test/search.php", () =>
		HttpResponse.json([{ place_id: 1 }]),
	),
	http.post("https://overpass.test/api/interpreter", () =>
		HttpResponse.json({ elements: [] }),
	),
	http.get("https://valhalla.test/route", () =>
		HttpResponse.json({ trip: { summary: { length: 0.1, time: 10 } } }),
	),
);

afterAll(() => server.close());

beforeAll(() => server.listen());

afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});

describe("runDoctor", () => {
	it("prints status for upstream services", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		process.env.OSMABLE_OVERPASS_HOST = "https://overpass.test";
		process.env.OSMABLE_VALHALLA_HOST = "https://valhalla.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runDoctor();

		const payload = stdout.mock.calls[0]?.[0] ?? "";
		const data = JSON.parse(payload);
		expect(data.nominatim.ok).toBe(true);
		expect(data.overpass.ok).toBe(true);
		expect(data.valhalla.ok).toBe(true);
	});
});
