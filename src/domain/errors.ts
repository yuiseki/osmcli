import { ExitCode } from "./exit-codes.js";

export type ErrorCode =
	| "INVALID_INPUT"
	| "NOT_FOUND"
	| "AMBIGUOUS"
	| "UPSTREAM_TEMPORARY"
	| "UPSTREAM_PERMANENT"
	| "INTERNAL_ERROR";

export const ErrorCodeToExitCode: Record<ErrorCode, number> = {
	INVALID_INPUT: ExitCode.invalid_input,
	NOT_FOUND: ExitCode.not_found,
	AMBIGUOUS: ExitCode.ambiguous,
	UPSTREAM_TEMPORARY: ExitCode.upstream_temporary,
	UPSTREAM_PERMANENT: ExitCode.upstream_permanent,
	INTERNAL_ERROR: ExitCode.internal_error,
};

export type OsmableErrorPayload = {
	code: ErrorCode;
	message: string;
	hints?: { use?: string[]; note?: string };
	candidates?: unknown[];
};

export class OsmableError extends Error {
	readonly payload: OsmableErrorPayload;

	constructor(payload: OsmableErrorPayload) {
		super(payload.message);
		this.payload = payload;
	}
}
