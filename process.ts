// TODO: Performance: split into separate modules or use a persistent server process, if needed

import { parse } from "https://deno.land/std@0.178.0/encoding/yaml.ts";
import highlightJS from "./md2blog/deps/highlightjs-11.3.1.js";
import { marked, Renderer } from "./goldsmith/plugins/markdown/deps/marked.esm.js";
import { generateCSS, templates } from "./md2blog/templates.ts";

function replaceLink(link: string): string {
	return link.replace(/^([^/][^:]*)\.md(#[^#]+)?$/, "$1.html$2")
}

function join(...paths: string[]): string {
	return paths.join("/");
}

function writeTextFileAsync(path: string, contents: string): Promise<void> {
	console.log(`Generating: "${path}"...`);
	return Deno.writeTextFile(path, contents);
}

async function enumerateFiles(directoryName: string, pattern: RegExp): Promise<string[]> {
	const filePaths: string[] = [];
	for await (const dirEntry of Deno.readDir(directoryName)) {
		const path = join(directoryName, dirEntry.name);
		if (dirEntry.isFile && pattern.test(path)) {
			filePaths.push(path);
		} else if (dirEntry.isDirectory) {
			filePaths.push(...(await enumerateFiles(path, pattern)));
		}
	}
	return filePaths;
}

const processors: { [command: string]: (paths: string[]) => Promise<void> } = {
	"site-metadata": async (paths) => {
		// Set header defaults
		const [pathInput, pathOutput] = paths;
		const site = JSON.parse(await Deno.readTextFile(pathInput));
		const text = site.header?.text ?? site.description;
		// let links = site.header?.links;
		// if (!links) {
		//	 links = {};
		//	 for (const file of metadata.collections!.nonPosts) {
		//		 const pathFromRoot = file.pathFromRoot!;
		//		 if (pathFromRoot !== "index.html") {
		//			 const name = capitalize(
		//				 pathFromRoot
		//					 .replace(/\.[^.]*$/, "")
		//					 .replace("-", " ")
		//			 );
		//			 links[name] = pathFromRoot;
		//		 }
		//	 }
		// }

		// for (const [name, link] of Object.entries(links)) {
		//	 links[name] = replaceLink(link);
		// }

		site.header = {
			text,
			// links,
		};

		writeTextFileAsync(pathOutput, JSON.stringify(site));
	},

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

		await writeTextFileAsync(pathOutputMetadata, JSON.stringify(metadata));
		await writeTextFileAsync(pathOutputContent, content);
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
	},

	index: async (paths) => {
		const [pathCache, pathOutput] = paths;
		const filePaths = await enumerateFiles(pathCache, /\.metadata.json$/);
		const fileContents = await Promise.all(filePaths.map(path => Deno.readTextFile(path)));

		const prefix = `${pathCache}/`;
		const index: any[] = [];
		for (let i = 0; i < filePaths.length; i++) {
			index.push(JSON.parse(fileContents[i]));
		}

		// Order by descending date
		index.sort((b, a) => (a.date < b.date) ? -1 : ((a.date > b.date) ? 1 : 0));

		await writeTextFileAsync(pathOutput, JSON.stringify(index));
	},

	"template-404": async (paths) => {
		const [pathSiteJson, pathOutput] = paths;
		const siteMetadata = JSON.parse(await Deno.readTextFile(pathSiteJson));

		const metadata = {
			site: siteMetadata,
			pathToRoot: "",
		};

		await writeTextFileAsync(pathOutput, templates["404"]("", metadata));
	},

	"template-css": async (paths) => {
		const [pathSiteJson, pathOutput] = paths;
		const siteMetadata = JSON.parse(await Deno.readTextFile(pathSiteJson));
		await writeTextFileAsync(pathOutput, generateCSS(siteMetadata?.colors ?? {}));
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
		await writeTextFileAsync(pathOutput, output);
	},

	"template-indexes": async (paths) => {
		const [pathSiteJson, pathIndex, pathRoot] = paths;
		// TODO: Could be read in parallel here, and elsewhere
		const siteMetadata = JSON.parse(await Deno.readTextFile(pathSiteJson));
		const index = JSON.parse(await Deno.readTextFile(pathIndex)).map(p => ({
			...p,
			date: new Date(p["date"]),
		}));

		const tagIndex = {};
		for (const post of index) {
			for (const tag of post.tags) {
				const list = tagIndex[tag] ?? [];
				tagIndex[tag] = [...list, post];
			}
		}

		const tagsAll = Object.keys(tagIndex).sort((a, b) => (a < b ? -1 : 1));
		const tagsTop = Object.keys(tagIndex).sort((a, b) => {
			const postsA = tagIndex[a];
			const postsB = tagIndex[b];
			return (postsB.length - postsA.length) || (postsB[0].date!.getDate() - postsA[0].date!.getDate());
		}).slice(0, 4);

		await Promise.all([
			// Post archive
			(async () => {
				const metadata = {
					site: siteMetadata,
					isRoot: false,
					pathToRoot: "../",
					collections: {
						posts: index,
					},
					tagsAll,
				};

				await writeTextFileAsync(join(pathRoot, "posts", "index.html"), templates["archive"]({}, metadata));
			})(),

			// Index/home page
			(async () => {
				const metadata = {
					site: siteMetadata,
					pathToRoot: "",
					collections: {
						postsRecent: index.slice(0, 5),
					},
					tagsAll,
					tagsTop,
				};

				await writeTextFileAsync(join(pathRoot, "index.html"), templates["index"]({}, metadata));
			})(),

			// Tag index pages
			...tagsAll.map(tag => (async () => {
				const metadata = {
					site: siteMetadata,
					pathToRoot: "../../",
					collections: {
						postsRecent: index.slice(0, 5),
					},
					tagsAll,
					tag,
					term: tag,
					postsWithTag: tagIndex[tag],
					isTagIndex: true,
				};

				const directoryPath = join(pathRoot, "posts", tag);
				await Deno.mkdir(directoryPath, { recursive: true });
				await writeTextFileAsync(join(directoryPath, "index.html"), templates["tagIndex"]({}, metadata));
			})()),
		]);
	},
} as const;

await processors[Deno.args[0]](Deno.args.slice(1));

