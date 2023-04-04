PORT := 4444

.PHONY: build
build:
	(deno run --allow-net=localhost:$(PORT) processor.ts &)
	curl -X POST http://localhost:$(PORT)/ --url-query 'command=stat' --retry 10 --retry-delay 1 --retry-all-errors
	make -f worker.mk
	curl -X POST http://localhost:$(PORT)/ --url-query 'command=exit'

