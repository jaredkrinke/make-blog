import { goldsmithFeed } from "./goldsmith/plugins/feed/mod.ts";
import { join, writeTextFileAsync } from "./shared.ts";

const [pathCache, pathSiteJson, pathIndex, pathOutput] = Deno.args;
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

