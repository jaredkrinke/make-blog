import { templates } from "./md2blog/templates.ts";
import { writeTextFileAsync } from "./shared.ts";

const [pathSiteJson, pathOutput] = Deno.args;
const siteMetadata = JSON.parse(await Deno.readTextFile(pathSiteJson));

const metadata = {
	site: siteMetadata,
	pathToRoot: "",
};

await writeTextFileAsync(pathOutput, templates["404"]("", metadata));

