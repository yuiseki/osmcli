#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { runAoiResolve } from "./commands/aoi.js";
import { runDoctor } from "./commands/doctor.js";
import { runGeocode } from "./commands/geocode.js";
import { runIsochrone } from "./commands/isochrone.js";
import { runPoiCount } from "./commands/poi-count.js";
import { runPoiFetch } from "./commands/poi-fetch.js";
import { runReverse } from "./commands/reverse.js";
import { runRoute } from "./commands/route.js";
import { runTagInfo } from "./commands/tag-info.js";
import { runTagSearch } from "./commands/tag-search.js";
import { OsmableError } from "./domain/errors.js";
import { type OutputFormat, handleError, writeErrorLog } from "./io/output.js";

const program = new Command();

program
	.name("osmable")
	.description("Agent-first OSM CLI for geocoding, AOI, POI, and routing")
	.showHelpAfterError(true)
	.option("--quiet", "suppress non-error logs")
	.option("--verbose", "enable verbose logs");

const withFormat = (cmd: Command, defaultFormat: OutputFormat) =>
	cmd.option(
		"--format <format>",
		"output format (default: text). text is concise; use json for details or jq",
		defaultFormat,
	);

const notImplemented = (commandName: string): never => {
	throw new OsmableError({
		code: "INTERNAL_ERROR",
		message: `${commandName} is not implemented yet`,
		hints: {
			note: "Scaffold only. Implement usecases per PRD/ADR.",
		},
	});
};

withFormat(
	program
		.command("geocode")
		.argument("<query>", "place name")
		.option("--limit <number>", "maximum results", "1")
		.option("--lang <lang>", "language")
		.option("--country <code>", "country code")
		.option("--all", "return all candidates")
		.action(async (query, options) => {
			await runGeocode(query, options);
		}),
	"text",
);

withFormat(
	program
		.command("reverse")
		.requiredOption("--lat <number>", "latitude")
		.requiredOption("--lon <number>", "longitude")
		.option("--lang <lang>", "language")
		.option("--zoom <number>", "zoom level")
		.action(async (options) => {
			await runReverse(options);
		}),
	"text",
);

const tag = program.command("tag").description("TagInfo operations");
const aoi = program.command("aoi").description("AOI operations");
withFormat(
	tag
		.command("search")
		.argument("<query>", "keyword")
		.option("--limit <number>", "results per page", "10")
		.option("--page <number>", "page number", "1")
		.option("--key <key>", "OSM key for key/values lookup")
		.action(async (query, options) => {
			await runTagSearch(query, options);
		}),
	"text",
);

withFormat(
	tag
		.command("info")
		.argument("<tag>", "OSM tag (key=value)")
		.option("--lang <lang>", "preferred language for descriptions")
		.option("--linked-all", "show all linked items")
		.action(async (tagValue, options) => {
			await runTagInfo(tagValue, options);
		}),
	"text",
);

withFormat(
	aoi
		.command("resolve")
		.argument("<query>", "place name")
		.action(async (query, options) => {
			await runAoiResolve(query, options);
		}),
	"text",
);

const poi = program.command("poi").description("POI operations");
withFormat(
	poi
		.command("count")
		.requiredOption("--within <within>", "place name, @file, or -")
		.option("--tag <tag>", "OSM tag (key=value)")
		.option("--preset <name>", "preset name")
		.action(async (options) => {
			await runPoiCount(options);
		}),
	"text",
);

withFormat(
	poi
		.command("fetch")
		.requiredOption("--within <within>", "place name, @file, or -")
		.option("--tag <tag>", "OSM tag (key=value)")
		.option("--preset <name>", "preset name")
		.option("--limit <number>", "maximum results")
		.option("--sort <field>", "name | id")
		.action(async (options) => {
			await runPoiFetch(options);
		}),
	"text",
);

withFormat(
	program
		.command("route")
		.requiredOption("--from <place>", "origin place name or lat,lon")
		.requiredOption("--to <place>", "destination place name or lat,lon")
		.option("--mode <mode>", "pedestrian | bicycle | car", "pedestrian")
		.option("--with-steps", "include route steps in text output")
		.action(async (options) => {
			await runRoute(options);
		}),
	"text",
);

withFormat(
	program
		.command("isochrone")
		.requiredOption("--from <place>", "origin place name or lat,lon")
		.requiredOption("--minutes <list>", "comma-separated minutes")
		.option("--mode <mode>", "pedestrian | bicycle | car", "pedestrian")
		.action(async (options) => {
			await runIsochrone(options);
		}),
	"text",
);

withFormat(
	program
		.command("doctor")
		.description("check upstream endpoints")
		.action(async (options) => {
			await runDoctor(options);
		}),
	"text",
);

program.on("option:verbose", () => {
	writeErrorLog("verbose logging enabled");
});

try {
	await program.parseAsync();
} catch (error) {
	const options = program.opts() as { format?: OutputFormat };
	handleError(error, options.format);
}
