import { describe, expect, it } from "vitest";

import { ExitCode } from "../src/domain/exit-codes.js";

describe("smoke", () => {
	it("exports exit codes", () => {
		expect(ExitCode.success).toBe(0);
	});
});
