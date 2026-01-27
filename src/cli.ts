#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { runGeocode } from "./commands/geocode.js";
import { runReverse } from "./commands/reverse.js";
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
		"json | geojson | jsonl | ndjson | text",
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
	"json",
);

const aoi = program.command("aoi").description("AOI operations");
withFormat(
	aoi
		.command("resolve")
		.argument("<query>", "place name")
		.action(() => {
			notImplemented("aoi resolve");
		}),
	"geojson",
);

const poi = program.command("poi").description("POI operations");
withFormat(
	poi
		.command("count")
		.requiredOption("--within <within>", "place name, @file, or -")
		.option("--tag <tag>", "OSM tag (key=value)")
		.option("--preset <name>", "preset name")
		.action(() => {
			notImplemented("poi count");
		}),
	"json",
);

withFormat(
	poi
		.command("fetch")
		.requiredOption("--within <within>", "place name, @file, or -")
		.option("--tag <tag>", "OSM tag (key=value)")
		.option("--preset <name>", "preset name")
		.action(() => {
			notImplemented("poi fetch");
		}),
	"jsonl",
);

withFormat(
	program
		.command("route")
		.requiredOption("--from <place>", "origin place name or lat,lon")
		.requiredOption("--to <place>", "destination place name or lat,lon")
		.option("--mode <mode>", "pedestrian | bicycle | car", "pedestrian")
		.action(() => {
			notImplemented("route");
		}),
	"json",
);

withFormat(
	program
		.command("isochrone")
		.requiredOption("--from <place>", "origin place name or lat,lon")
		.requiredOption("--minutes <list>", "comma-separated minutes")
		.option("--mode <mode>", "pedestrian | bicycle | car", "pedestrian")
		.action(() => {
			notImplemented("isochrone");
		}),
	"geojson",
);

withFormat(
	program
		.command("doctor")
		.description("check upstream endpoints")
		.action(() => {
			notImplemented("doctor");
		}),
	"json",
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
