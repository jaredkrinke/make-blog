import { serve } from "https://deno.land/std@0.182.0/http/server.ts";

export type JobHandler = (params: Record<string, string>) => Promise<void>;

export interface HandleJobsOptions {
	hostname?: string;
	port: number;
	handlers: Record<string, JobHandler>;
}

export async function handleJobsAsync(options: HandleJobsOptions): Promise<void> {
	const { hostname, port, handlers } = options;

	await serve((request: Request) => {
		const params = Object.fromEntries(new URLSearchParams((new URL(request.url)).search));
		const { command } = params;
	
		console.log(`Received command: ${command}`);
		const handler = handlers[command];
		if (handler) {
			handler(params);
		} else {
			console.log("Unknown command!");
		}
	
		return new Response("", { status: 200 });
	}, { hostname, port });
}

