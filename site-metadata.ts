import { writeTextFileAsync } from "./shared.ts";

// Set header defaults
const [pathInput, pathOutput] = Deno.args;
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

