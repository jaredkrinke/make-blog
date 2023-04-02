import { join, writeTextFileAsync } from "./shared.ts";
 
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

const [pathCache, pathOutput] = Deno.args;
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

