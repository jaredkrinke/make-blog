import { templates } from "./md2blog/templates.ts";
import { join, writeTextFileAsync } from "./shared.ts";

const [pathSiteJson, pathIndex, pathRoot] = Deno.args;
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

