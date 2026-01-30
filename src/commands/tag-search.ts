import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import { buildTagInfoUrl, fetchTagInfo } from "./tag-shared.js";

export type TagSearchOptions = {
	limit?: string;
	page?: string;
	key?: string;
	format?: string;
};

type TagInfoSearchResult = {
	key?: string;
	value?: string | null;
	count_all?: number;
	count_all_fraction?: number;
};

type TagInfoSearchResponse = {
	data?: TagInfoSearchResult[];
};

type TagInfoKeyValuesEntry = {
	value?: string;
	count?: number;
	fraction?: number;
};

type TagInfoKeyValuesResponse = {
	data?: TagInfoKeyValuesEntry[];
};

const parsePositiveInt = (
	value: string | undefined,
	fallback: number,
): number => {
	if (value === undefined) return fallback;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "limit and page must be positive integers",
		});
	}
	return parsed;
};

const normalizeKey = (value: string | undefined): string | null => {
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

const formatTag = (result: TagInfoSearchResult): string | null => {
	const key = result.key?.trim();
	if (!key) return null;
	const value = result.value?.trim();
	return value ? `${key}=${value}` : key;
};

export const runTagSearch = async (
	query: string,
	options: TagSearchOptions,
): Promise<void> => {
	const limit = parsePositiveInt(options.limit, 10);
	const page = parsePositiveInt(options.page, 1);
	const key = normalizeKey(options.key);

	if (key) {
		const url = buildTagInfoUrl("/api/4/key/values", {
			key,
			query,
			rp: String(limit),
			page: String(page),
		});
		const data = (await fetchTagInfo(url)) as TagInfoKeyValuesResponse;
		const results = data.data ?? [];
		if (results.length === 0) {
			throw new OsmableError({
				code: "NOT_FOUND",
				message: "No results from TagInfo. Try to search in English.",
			});
		}

		const mapped = results
			.map((result) => {
				const value = result.value?.trim();
				if (!value) return null;
				return {
					key,
					value,
					count_all: result.count ?? null,
					count_all_fraction: result.fraction ?? null,
				};
			})
			.filter((result): result is NonNullable<typeof result> =>
				Boolean(result),
			);

		const format = options.format ?? "text";
		if (format === "text") {
			for (const result of mapped) {
				writeText(`${result.key}=${result.value}`);
			}
			return;
		}

		if (format === "jsonl" || format === "ndjson") {
			for (const result of mapped) {
				writeJson(result);
			}
			return;
		}

		writeJson(mapped);
		return;
	}

	const valueUrl = buildTagInfoUrl("/api/4/search/by_value", {
		query,
		rp: String(limit),
		page: String(page),
	});
	const keywordUrl = buildTagInfoUrl("/api/4/search/by_keyword", {
		query,
		rp: String(limit),
		page: String(page),
	});

	const [valueData, keywordData] = await Promise.all([
		fetchTagInfo(valueUrl),
		fetchTagInfo(keywordUrl),
	]);

	const valueResults = (valueData as TagInfoSearchResponse).data ?? [];
	const keywordResults = (keywordData as TagInfoSearchResponse).data ?? [];
	const seen = new Set<string>();
	const merged: TagInfoSearchResult[] = [];

	const pushUnique = (result: TagInfoSearchResult) => {
		const key = result.key?.trim();
		if (!key) return;
		const value = result.value?.trim() ?? "";
		const id = value ? `${key}=${value}` : key;
		if (seen.has(id)) return;
		seen.add(id);
		merged.push(result);
	};

	for (const result of valueResults) {
		pushUnique(result);
	}
	for (const result of keywordResults) {
		pushUnique(result);
	}

	const results = merged.slice(0, limit);
	if (results.length === 0) {
		throw new OsmableError({
			code: "NOT_FOUND",
			message: "No results from TagInfo. Try to search in English.",
		});
	}

	const format = options.format ?? "text";
	if (format === "text") {
		for (const result of results) {
			const line = formatTag(result);
			if (line) writeText(line);
		}
		return;
	}

	const mapped = results
		.map((result) => {
			const key = result.key?.trim();
			if (!key) return null;
			const value = result.value?.trim() ?? null;
			return {
				key,
				value,
				count_all: result.count_all ?? null,
				count_all_fraction: result.count_all_fraction ?? null,
			};
		})
		.filter((result): result is NonNullable<typeof result> => Boolean(result));

	if (format === "jsonl" || format === "ndjson") {
		for (const result of mapped) {
			writeJson(result);
		}
		return;
	}

	writeJson(mapped);
};
