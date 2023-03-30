import { parse } from "https://deno.land/std@0.178.0/encoding/yaml.ts";

const processors: { [command: string]: (paths: string[]) => Promise<void> } = {
	// Separate and parse YAML front matter
	frontmatter: async (paths) => {
		const frontMatterPattern = /^---\r?\n(.*?)\r?\n---(\r?\n|$)/ms;
		const [pathInput, pathOutputMetadata, pathOutputContent] = paths;
		const text = await Deno.readTextFile(pathInput);
		const matches = frontMatterPattern.exec(text);
		const hasFrontMatter = !!matches;
		const metadata = hasFrontMatter ? parse(matches[1]) : {};
		const content = hasFrontMatter ? text.slice(matches[0].length) : text;

		await Deno.writeTextFile(pathOutputMetadata, JSON.stringify(metadata));
		await Deno.writeTextFile(pathOutputContent, content);
	},
} as const;

await processors[Deno.args[0]](Deno.args.slice(1));

