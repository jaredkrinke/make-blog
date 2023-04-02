import { generateCSS, templates } from "./md2blog/templates.ts";
import { writeTextFileAsync } from "./shared.ts";

const [pathSiteJson, pathOutput] = Deno.args;
const siteMetadata = JSON.parse(await Deno.readTextFile(pathSiteJson));
await writeTextFileAsync(pathOutput, generateCSS(siteMetadata?.colors ?? {}));

