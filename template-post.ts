import { templates } from "./md2blog/templates.ts";
import { writeTextFileAsync } from "./shared.ts";

const [pathSiteJson, pathPostMetadata, pathPostHtml, pathOutput] = Deno.args;
const siteMetadata = JSON.parse(await Deno.readTextFile(pathSiteJson));
const postMetadata = JSON.parse(await Deno.readTextFile(pathPostMetadata));
const postHtml = await Deno.readTextFile(pathPostHtml);

const metadata = {
	...postMetadata,
	date: new Date(postMetadata["date"]),
	site: siteMetadata,
	isRoot: false,
	pathToRoot: "../../",
};

const template = templates["post"];
const output = template(postHtml, metadata);
await writeTextFileAsync(pathOutput, output);

