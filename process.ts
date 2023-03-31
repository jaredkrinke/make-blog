// TODO: Performance: split into separate modules or use a persistent server process, if needed

import { parse } from "https://deno.land/std@0.178.0/encoding/yaml.ts";
import { marked, Renderer } from "./deps/marked.esm.js";

function replaceLink(link: string) {
    return link.replace(/^([^/][^:]*)\.md(#[^#]+)?$/, "$1.html$2")
}

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

		// Add post category as an implicit tag
		const pathComponents = pathInput.split("/");
		if (pathComponents.length >= 3 && pathComponents[pathComponents.length - 3] === "posts") {
			metadata.tags = [pathComponents[pathComponents.length - 2]].concat((metadata?.keywords ?? []));
		}

		await Deno.writeTextFile(pathOutputMetadata, JSON.stringify(metadata));
		await Deno.writeTextFile(pathOutputContent, content);
	},

	markdown: async (paths) => {
		const [pathInput, pathOutput] = paths;
		const input = await Deno.readTextFile(pathInput);

		// Replace *.md links with *.html
		const renderer = new Renderer();
		const baseLink = renderer.link;
		renderer.link = function (href: string, title: string, text: string) {
			return baseLink.call(this, replaceLink(href), title, text);
		};
		marked.use({ renderer });


		// TODO: Syntax highlighting for code blocks

		// Transform Markdown to HTML
		const output = marked(input);
		await Deno.writeTextFile(pathOutput, output);
	},
} as const;

await processors[Deno.args[0]](Deno.args.slice(1));

