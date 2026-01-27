export const ExitCode = {
	success: 0,
	invalid_input: 2,
	not_found: 3,
	ambiguous: 4,
	upstream_temporary: 5,
	upstream_permanent: 6,
	internal_error: 7,
} as const;

export type ExitCodeKey = keyof typeof ExitCode;
