import { parse } from "https://deno.land/std@0.178.0/encoding/yaml.ts";
import { writeTextFileAsync } from "./shared.ts";

const frontMatterPattern = /^---\r?\n(.*?)\r?\n---(\r?\n|$)/ms;
const [pathInput, pathFromRoot, pathOutputMetadata, pathOutputContent] = Deno.args;
const text = await Deno.readTextFile(pathInput);
const matches = frontMatterPattern.exec(text);
const hasFrontMatter = !!matches;
const metadata = (hasFrontMatter ? parse(matches[1]) : {}) as Record<string, any>;
const content = hasFrontMatter ? text.slice(matches[0].length) : text;

// Add post category as an implicit tag
const pathComponents = pathInput.split("/");
if (pathComponents.length >= 3 && pathComponents[pathComponents.length - 3] === "posts") {
	metadata.tags = [pathComponents[pathComponents.length - 2]].concat((metadata?.keywords ?? []));
}

metadata.pathFromRoot = pathFromRoot;

await writeTextFileAsync(pathOutputMetadata, JSON.stringify(metadata));
await writeTextFileAsync(pathOutputContent, content);

