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

import { runReverse } from "../src/commands/reverse.js";

const server = setupServer(
	http.get("https://nominatim.test/reverse", ({ request }) => {
		const url = new URL(request.url);
		if (url.searchParams.get("lat") === "35.7125805") {
			return HttpResponse.json({
				place_id: 1,
				lat: "35.7125805",
				lon: "139.7800712",
				display_name: "台東区, 東京都, 日本",
			});
		}
		return HttpResponse.json({
			lat: "0",
			lon: "0",
			display_name: "",
		});
	}),
);

afterAll(() => server.close());

beforeAll(() => server.listen());

afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});

describe("runReverse", () => {
	it("prints text output by default", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runReverse({ lat: "35.7125805", lon: "139.7800712" });

		expect(stdout).toHaveBeenCalledWith(
			"address: 台東区, 東京都, 日本\n35.7125805,139.7800712\n",
		);
	});

	it("prints json output when format is json", async () => {
		process.env.OSMABLE_NOMINATIM_HOST = "https://nominatim.test";
		const stdout = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);

		await runReverse({
			lat: "35.7125805",
			lon: "139.7800712",
			format: "json",
		});

		expect(stdout).toHaveBeenCalledWith(
			'{"place_id":1,"lat":"35.7125805","lon":"139.7800712","display_name":"台東区, 東京都, 日本"}\n',
		);
	});
});
