// TODO: Performance: split into separate modules or use a persistent server process, if needed

import { generateCSS, templates } from "./md2blog/templates.ts";
import { goldsmithFeed } from "./goldsmith/plugins/feed/mod.ts";
import { join, writeTextFileAsync } from "./shared.ts";

const processors: { [command: string]: (paths: string[]) => Promise<void> } = {
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

	"template-feed": async (paths) => {
		const [pathCache, pathSiteJson, pathIndex, pathOutput] = paths;
		const site = JSON.parse(await Deno.readTextFile(pathSiteJson));
		const posts = JSON.parse(await Deno.readTextFile(pathIndex)).map(p => ({
			...p,
			date: new Date(p["date"]),
		})).slice(0, 5);

		// Map to Goldsmith data model
		const textEncoder = new TextEncoder();
		const textDecoder = new TextDecoder();
		const fileContents = await Promise.all(posts.map(p => Deno.readTextFile(join(pathCache, p.pathFromRoot.replace(/.html$/, ".content.html")))));
		const files = Object.fromEntries(posts.map((p, index) => [ p.pathFromRoot,
			{
				...p,
				data: textEncoder.encode(fileContents[index]),
			},
		]));

		const metadata = {
			site,
			posts: Object.values(files),
		};

		const goldsmith = {
			metadata: () => metadata,
			encodeUTF8: str => textEncoder.encode(str),
			decodeUTF8: bin => textDecoder.decode(bin),
		};

		await (goldsmithFeed({
			path: "feed.xml",
			getCollection: (metadata) => metadata["posts"],
		})(files, goldsmith));

		await writeTextFileAsync(pathOutput, textDecoder.decode(files["feed.xml"].data));
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

