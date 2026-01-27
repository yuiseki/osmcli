import { ErrorCodeToExitCode, OsmableError } from "../domain/errors.js";

export type OutputFormat = "json" | "geojson" | "jsonl" | "ndjson" | "text";

export const writeJson = (value: unknown): void => {
	process.stdout.write(`${JSON.stringify(value)}\n`);
};

export const writeText = (value: string): void => {
	process.stdout.write(`${value}\n`);
};

export const writeErrorLog = (value: string): void => {
	process.stderr.write(`${value}\n`);
};

export const handleError = (
	error: unknown,
	format: OutputFormat | undefined,
): never => {
	if (error instanceof OsmableError) {
		if (format === "json") {
			writeJson({ error: error.payload });
		} else {
			writeErrorLog(error.message);
		}
		process.exit(ErrorCodeToExitCode[error.payload.code]);
	}

	const message = error instanceof Error ? error.message : "unknown error";
	if (format === "json") {
		writeJson({
			error: {
				code: "INTERNAL_ERROR",
				message,
			},
		});
	} else {
		writeErrorLog(message);
	}

	process.exit(ErrorCodeToExitCode.INTERNAL_ERROR);
};
