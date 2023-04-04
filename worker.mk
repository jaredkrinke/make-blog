PORT := 4444

test:
	curl -X POST http://localhost:$(PORT)/ --url-query 'command=stat'
	touch test

.PHONY: clean
clean:
	rm -f test

