import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import { buildTagInfoUrl, fetchTagInfo } from "./tag-shared.js";

export type TagInfoOptions = {
	lang?: string;
	linkedAll?: boolean;
	combinationAll?: boolean;
	descAll?: boolean;
	format?: string;
};

type TagInfoOverviewDescription = {
	text?: string;
};

type TagInfoOverviewData = {
	key?: string;
	value?: string;
	description?: Record<string, TagInfoOverviewDescription>;
};

type TagInfoOverviewResponse = {
	data?: TagInfoOverviewData;
};

type TagInfoWikiPage = {
	lang?: string;
	title?: string;
	description?: string;
	tags_implies?: string[];
	tags_combination?: string[];
	tags_linked?: string[];
};

type TagInfoWikiPagesResponse = {
	data?: TagInfoWikiPage[];
};

type TagInfoStatsEntry = {
	type?: string;
	count?: number;
};

type TagInfoStatsResponse = {
	data?: TagInfoStatsEntry[];
};

const parseTag = (tag: string): { key: string; value: string } => {
	const [key, value] = tag.split("=");
	if (!key || value === undefined || value.length === 0) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "tag must be in key=value format",
		});
	}
	return { key, value };
};

const buildText = (params: {
	tag: string;
	descriptions: Array<{ lang: string; text: string }>;
	relations: { implies: string[]; combination: string[]; linked: string[] };
	usage: Array<{ type: string; count: number }>;
	showAllLinked: boolean;
	showAllCombination: boolean;
}): string => {
	const lines: string[] = [];
	const pushSection = (title: string, body: () => void) => {
		if (lines.length > 0) lines.push("");
		lines.push(`## ${title}`);
		body();
	};

	lines.push(`# ${params.tag}`);

	pushSection("Description", () => {
		if (params.descriptions.length === 0) {
			lines.push("- (none)");
		} else {
			for (const entry of params.descriptions) {
				lines.push(`- ${entry.lang}: ${entry.text}`);
			}
		}
	});

	const { implies, combination, linked } = params.relations;
	const renderRelationGroup = (label: string, values: string[]) => {
		lines.push("");
		lines.push(`### ${label}`);
		if (values.length === 0) {
			lines.push("- (none)");
			return;
		}
		for (const value of values) {
			lines.push(`- ${value}`);
		}
	};
	pushSection("Relations", () => {
		renderRelationGroup("Implies", implies);
		if (params.showAllCombination || combination.length <= 5) {
			renderRelationGroup("Combination", combination);
		} else {
			const truncated = combination.slice(0, 5);
			renderRelationGroup("Combination", truncated);
			lines.push(`- ... (total ${combination.length} items)`);
			lines.push(
				"- Tips: use --combination-all option to see all combination items",
			);
		}
		if (params.showAllLinked || linked.length <= 5) {
			renderRelationGroup("Linked", linked);
		} else {
			const truncated = linked.slice(0, 5);
			renderRelationGroup("Linked", truncated);
			lines.push(`- ... (total ${linked.length} items)`);
			lines.push("- Tips: use --linked-all option to see all linked items");
		}
	});

	pushSection("Usage", () => {
		if (params.usage.length === 0) {
			lines.push("- (none)");
		} else {
			for (const entry of params.usage) {
				lines.push(`- ${entry.type}: ${entry.count}`);
			}
		}
	});

	return lines.join("\n");
};

const normalizeDescriptions = (
	description?: Record<string, TagInfoOverviewDescription>,
): Array<{ lang: string; text: string }> => {
	if (!description || typeof description !== "object") return [];
	return Object.entries(description)
		.map(([lang, value]) => {
			const text = value?.text?.trim();
			if (!text) return null;
			return { lang, text };
		})
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
};

const collectRelations = (pages?: TagInfoWikiPage[]) => {
	const implies = new Set<string>();
	const combination = new Set<string>();
	const linked = new Set<string>();

	if (Array.isArray(pages)) {
		for (const page of pages) {
			for (const value of page.tags_implies ?? []) implies.add(value);
			for (const value of page.tags_combination ?? []) combination.add(value);
			for (const value of page.tags_linked ?? []) linked.add(value);
		}
	}

	return {
		implies: Array.from(implies),
		combination: Array.from(combination),
		linked: Array.from(linked),
	};
};

const normalizeUsage = (stats?: TagInfoStatsEntry[]) => {
	if (!Array.isArray(stats)) return [];
	return stats
		.map((entry) => {
			const type = entry.type?.trim();
			const count = entry.count;
			if (!type || !Number.isFinite(count)) return null;
			return { type, count: Number(count) };
		})
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
};

const orderByPreferredLang = <T extends { lang: string }>(
	items: T[],
	preferred: string[],
): T[] => {
	if (items.length <= 1) return items;
	const order = new Map(preferred.map((lang, index) => [lang, index]));
	return [...items].sort((a, b) => {
		const left = order.get(a.lang) ?? Number.MAX_SAFE_INTEGER;
		const right = order.get(b.lang) ?? Number.MAX_SAFE_INTEGER;
		if (left !== right) return left - right;
		return a.lang.localeCompare(b.lang);
	});
};

export const runTagInfo = async (
	tag: string,
	options: TagInfoOptions,
): Promise<void> => {
	const parsed = parseTag(tag);
	const overviewUrl = buildTagInfoUrl("/api/4/tag/overview", parsed);
	const wikiUrl = buildTagInfoUrl("/api/4/tag/wiki_pages", parsed);
	const statsUrl = buildTagInfoUrl("/api/4/tag/stats", parsed);

	const [overviewRaw, wikiRaw, statsRaw] = await Promise.all([
		fetchTagInfo(overviewUrl),
		fetchTagInfo(wikiUrl),
		fetchTagInfo(statsUrl),
	]);

	const overview = overviewRaw as TagInfoOverviewResponse;
	const wikiPages = wikiRaw as TagInfoWikiPagesResponse;
	const stats = statsRaw as TagInfoStatsResponse;

	const descriptions = normalizeDescriptions(overview.data?.description);
	const relations = collectRelations(wikiPages.data);
	const usage = normalizeUsage(stats.data);

	const langOrder = options.lang ? [options.lang, "en", "ja"] : ["en", "ja"];
	const langFilter = options.descAll ? null : new Set(["ja", "en"]);
	const visibleDescriptions = langFilter
		? descriptions.filter((entry) => langFilter.has(entry.lang))
		: descriptions;
	const orderedDescriptions = orderByPreferredLang(
		visibleDescriptions,
		langOrder,
	);

	const format = options.format ?? "text";
	if (format === "text") {
		writeText(
			buildText({
				tag: `${parsed.key}=${parsed.value}`,
				descriptions: orderedDescriptions,
				relations,
				usage,
				showAllLinked: Boolean(options.linkedAll),
				showAllCombination: Boolean(options.combinationAll),
			}),
		);
		return;
	}

	writeJson({
		tag: parsed,
		descriptions: orderedDescriptions,
		relations,
		usage,
	});
};
