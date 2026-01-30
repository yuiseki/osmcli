import { OsmableError } from "../domain/errors.js";

const DEFAULT_TAGINFO_HOST = "https://taginfo.yuiseki.net";

const getTagInfoHost = (): string =>
	process.env.OSMABLE_TAGINFO_HOST ?? DEFAULT_TAGINFO_HOST;

export const buildTagInfoUrl = (
	path: string,
	params: Record<string, string>,
): URL => {
	let host: URL;
	try {
		host = new URL(getTagInfoHost());
	} catch (error) {
		throw new OsmableError({
			code: "INVALID_INPUT",
			message: "OSMABLE_TAGINFO_HOST must be a valid URL",
		});
	}
	const url = new URL(path, host);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	return url;
};

export const fetchTagInfo = async (url: URL): Promise<unknown> => {
	const response = await fetch(url, {
		headers: {
			"User-Agent": "osmable/0.1.0 (cli)",
		},
	});
	if (!response.ok) {
		throw new OsmableError({
			code:
				response.status >= 500 ? "UPSTREAM_TEMPORARY" : "UPSTREAM_PERMANENT",
			message: `TagInfo error: ${response.status} ${response.statusText}`,
		});
	}
	return response.json();
};
