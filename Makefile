# Default to "build" target
.DEFAULT_GOAL := build

# Use "find" to enumerate all directories and files under "content/" (excluding "content/" itself)
INPUT_FILES := $(shell find content -type f)
INPUT_DIRECTORIES := $(filter-out content,$(shell find content -type d))

# Replace "content/" with "out/"
OUTPUT_FILES := $(patsubst content/%,out/%,$(INPUT_FILES))
OUTPUT_DIRECTORIES := $(patsubst content/%,out/%,$(INPUT_DIRECTORIES))

# Rule to recreate "content/" directory structure under "out/"
$(OUTPUT_DIRECTORIES):
	mkdir -p $@

# Copy all files verbatim (and use order-only prerequisites to ensure directories exist first)
out/%: content/% | $(OUTPUT_DIRECTORIES)
	cp -f $< $@

# Default targets
.PHONY: build
build: $(OUTPUT_FILES) $(OUTPUT_DIRECTORIES)

