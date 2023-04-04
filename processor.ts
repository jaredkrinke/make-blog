import { handleJobsAsync } from "./worker.ts";

await handleJobsAsync({
	hostname: "localhost",
	port: 4444,
	handlers: {
		stat: () => Promise.resolve(),
		exit: () => Deno.exit(0),
	},
});

