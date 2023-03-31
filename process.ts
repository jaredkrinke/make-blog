// TODO: Performance: split into separate modules or use a persistent server process, if needed

import { parse } from "https://deno.land/std@0.178.0/encoding/yaml.ts";
import { marked, Renderer } from "./goldsmith/plugins/markdown/deps/marked.esm.js";
import { templates } from "./md2blog/templates.ts";

function replaceLink(link: string) {
    return link.replace(/^([^/][^:]*)\.md(#[^#]+)?$/, "$1.html$2")
}

const processors: { [command: string]: (paths: string[]) => Promise<void> } = {
	// Separate and parse YAML front matter
	frontmatter: async (paths) => {
		const frontMatterPattern = /^---\r?\n(.*?)\r?\n---(\r?\n|$)/ms;
		const [pathInput, pathFromRoot, pathOutputMetadata, pathOutputContent] = paths;
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

	"template-post": async (paths) => {
		const [pathSiteJson, pathPostMetadata, pathPostHtml, pathOutput] = paths;
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
		await Deno.writeTextFile(pathOutput, output);
	},
} as const;

await processors[Deno.args[0]](Deno.args.slice(1));

