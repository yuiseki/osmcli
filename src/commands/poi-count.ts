import { OsmableError } from "../domain/errors.js";
import { writeJson, writeText } from "../io/output.js";
import {
	buildOverpassQuery,
	fetchOverpass,
	resolveTag,
	resolveWithinBbox,
} from "./poi-shared.js";

export type PoiCountOptions = {
	within: string;
	tag?: string;
	preset?: string;
	format?: string;
};

type OverpassCountResponse = {
	elements?: Array<{ tags?: Record<string, string> }>;
};

const parseCount = (data: OverpassCountResponse): number => {
	const element = data.elements?.[0];
	const tags = element?.tags ?? {};
	const total = tags.total ?? tags.nodes ?? tags.ways ?? tags.relations;
	const count = total ? Number.parseInt(total, 10) : 0;
	if (!Number.isFinite(count)) {
		throw new OsmableError({
			code: "UPSTREAM_PERMANENT",
			message: "Unexpected Overpass count response",
		});
	}
	return count;
};

export const runPoiCount = async (options: PoiCountOptions): Promise<void> => {
	const tag = resolveTag({ tag: options.tag, preset: options.preset });
	const bbox = await resolveWithinBbox(options.within);
	const query = buildOverpassQuery({ tag, bbox, output: "count" });
	const data = (await fetchOverpass(query)) as OverpassCountResponse;
	const count = parseCount(data);
	const format = options.format ?? "json";

	if (format === "text") {
		writeText(String(count));
		return;
	}

	writeJson({ count });
};
