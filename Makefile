#-----------------------------------------------------------
# Configuration

# Default to "build" target
.DEFAULT_GOAL := build-clean

#-----------------------------------------------------------
# File enumeration

# Use "find" to enumerate all directories and files under "content/" (excluding "content/" itself)
INPUT_FILES := $(shell find content -type f)
INPUT_DIRECTORIES := $(filter-out content,$(shell find content -type d))

# Separate input files for processing
INPUT_FILES_SITE_JSON := $(filter content/site.json,$(INPUT_FILES))
#INPUT_FILES_MARKDOWN := $(filter %.md,$(INPUT_FILES)) # TODO
INPUT_FILES_POSTS := $(filter content/posts/%.md,$(INPUT_FILES))
INPUT_FILES_VERBATIM := $(filter-out $(INPUT_FILES_SITE_JSON) $(INPUT_FILES_POSTS),$(INPUT_FILES))

# Intermediate results
#INTERMEDIATE_POST_METADATA := $(patsubst content/posts/%.md,cache/posts/%.metadata.json,$(INPUT_FILES_POSTS))
#INTERMEDIATE_POST_MARKDOWN := $(patsubst content/posts/%.md,cache/posts/%.content.md,$(INPUT_FILES_POSTS))
INTERMEDIATE_DIRECTORIES := $(patsubst content/%,cache/%,$(INPUT_DIRECTORIES))

# Replace "content/" with "out/"
OUTPUT_FILES_POSTS := $(patsubst content/%,out/%,$(INPUT_FILES_POSTS))
OUTPUT_FILES_VERBATIM := $(patsubst content/%,out/%,$(INPUT_FILES_VERBATIM))
# TODO: CSS, 404, index, archive, tag indexes
OUTPUT_FILES := $(OUTPUT_FILES_POSTS) $(OUTPUT_FILES_VERBATIM)
OUTPUT_DIRECTORIES := $(patsubst content/%,out/%,$(INPUT_DIRECTORIES))

# Extraneous files already present in "out/"
OUTPUT_FILES_EXTRANEOUS := $(filter-out $(OUTPUT_FILES),$(shell find out -type f))

#-----------------------------------------------------------
# Build rules

# Rules to recreate "content/" directory structure under "cache/" and "out/"
$(OUTPUT_DIRECTORIES): ; mkdir -p $@
$(INTERMEDIATE_DIRECTORIES): ; mkdir -p $@

# Parse and process posts
cache/posts/%.metadata.json: content/posts/%.md | $(INTERMEDIATE_DIRECTORIES)
	head $< > $@

cache/posts/%.content.md: content/posts/%.md | $(INTERMEDIATE_DIRECTORIES)
	tail $< > $@

$(OUTPUT_FILES_POSTS): out/posts/%.md: cache/posts/%.metadata.json cache/posts/%.content.md content/site.json | $(OUTPUT_DIRECTORIES)
	cat cache/posts/$*.metadata.json cache/posts/$*.content.md > $@

# Copy verbatim (and use order-only prerequisites to ensure directories exist first)
$(OUTPUT_FILES_VERBATIM): out/%: content/% | $(OUTPUT_DIRECTORIES)
	cp -f $< $@

#-----------------------------------------------------------
# Build "commands" (phony targets)

# Build
.PHONY: build
build: $(OUTPUT_FILES) $(OUTPUT_DIRECTORIES)

# Remove extraneous files from "out/"
# TODO: Consider tidying "cache/" as well
.PHONY: tidy
tidy:
ifneq ($(strip $(OUTPUT_FILES_EXTRANEOUS)),)
	rm $(OUTPUT_FILES_EXTRANEOUS)
endif

# Build and remove extraneous files
.PHONY: build-clean
build-clean: tidy build

# Delete "cache/" and "out/"
.PHONY: clean
clean:
	rm -rf cache out

