export function join(...paths: string[]): string {
	return paths.join("/");
}

export function writeTextFileAsync(path: string, contents: string): Promise<void> {
	console.log(`Generating: "${path}"...`);
	return Deno.writeTextFile(path, contents);
}

