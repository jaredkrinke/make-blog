import highlightJS from "./md2blog/deps/highlightjs-11.3.1.js";
import { marked, Renderer } from "./goldsmith/plugins/markdown/deps/marked.esm.js";
import { writeTextFileAsync } from "./shared.ts";

function replaceLink(link: string): string {
	return link.replace(/^([^/][^:]*)\.md(#[^#]+)?$/, "$1.html$2")
}

const [pathInput, pathOutput] = Deno.args;
const input = await Deno.readTextFile(pathInput);

// Replace *.md links with *.html
const renderer = new Renderer();
const baseLink = renderer.link;
renderer.link = function (href: string, title: string, text: string) {
	return baseLink.call(this, replaceLink(href), title, text);
};
marked.use({ renderer });

// Syntax highlighting
marked.use({
	highlight: (code, language) => {
		if (language && highlightJS.getLanguage(language)) {
			return highlightJS.highlight(code, { language }).value;
		} else {
			return highlightJS.highlightAuto(code).value;
		}
	},
});


// TODO: Syntax highlighting for code blocks

// Transform Markdown to HTML
const output = marked(input);
await writeTextFileAsync(pathOutput, output);

