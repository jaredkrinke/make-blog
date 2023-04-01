#-----------------------------------------------------------
# Configuration

# Default to "build" target
.DEFAULT_GOAL := build

#-----------------------------------------------------------
# File enumeration

# Use "find" to enumerate all directories and files under "content/" (excluding "content/" itself)
INPUT_FILES := $(shell find content -type f)
INPUT_DIRECTORIES := $(filter-out content,$(shell find content -type d))

# Separate input files for processing
INPUT_FILES_SITE_JSON := $(filter content/site.json,$(INPUT_FILES))
INPUT_FILES_POSTS := $(filter content/posts/%.md,$(INPUT_FILES))
INPUT_FILES_VERBATIM := $(filter-out $(INPUT_FILES_SITE_JSON) $(INPUT_FILES_POSTS),$(INPUT_FILES))

# Intermediate results (under "cache/")
INTERMEDIATE_DIRECTORIES := $(patsubst content/%,cache/%,$(INPUT_DIRECTORIES))

INTERMEDIATE_FILES_POST_METADATA := $(patsubst content/posts/%.md,cache/posts/%.metadata.json,$(INPUT_FILES_POSTS))
INTERMEDIATE_FILES_POST_CONTENT := $(patsubst content/posts/%.md,cache/posts/%.content.md,$(INPUT_FILES_POSTS))
INTERMEDIATE_FILES_POST_HTML := $(patsubst content/posts/%.md,cache/posts/%.content.html,$(INPUT_FILES_POSTS))

INTERMEDIATE_FILES := $(INTERMEDIATE_FILES_POST_METADATA) $(INTERMEDIATE_FILES_POST_CONTENT) $(INTERMEDIATE_FILES_POST_HTML)
INTERMEDIATE_FILES_EXTRANEOUS := $(filter-out $(INTERMEDIATE_FILES),$(shell mkdir -p cache && find cache -type f))

# Output (under "out/")
OUTPUT_DIRECTORIES := $(patsubst content/%,out/%,$(INPUT_DIRECTORIES))

OUTPUT_FILES_POSTS := $(addsuffix .html,$(basename $(patsubst content/%,out/%,$(INPUT_FILES_POSTS))))
OUTPUT_FILES_VERBATIM := $(patsubst content/%,out/%,$(INPUT_FILES_VERBATIM))

OUTPUT_FILES := $(OUTPUT_FILES_POSTS) $(OUTPUT_FILES_VERBATIM)
OUTPUT_FILES_EXTRANEOUS := $(filter-out $(OUTPUT_FILES),$(shell mkdir -p out && find out -type f))

# Tidy up "cache/" and "out/" before building anything (note the shell hacks above create those directories, and this next one to delete unexpected files)
TIDY_RESULT := $(shell rm -f $(OUTPUT_FILES_EXTRANEOUS) $(INTERMEDIATE_FILES_EXTRANEOUS))

#-----------------------------------------------------------
# Build rules

# Rules to recreate "content/" directory structure under "cache/" and "out/"
$(OUTPUT_DIRECTORIES):
	mkdir -p $@

$(INTERMEDIATE_DIRECTORIES):
	mkdir -p $@

# Parse and process posts
cache/posts/%.metadata.json cache/posts/%.content.md &: content/posts/%.md | $(INTERMEDIATE_DIRECTORIES)
	deno run --allow-read=content --allow-write=cache process.ts frontmatter $< posts/$*.html cache/posts/$*.metadata.json cache/posts/$*.content.md

$(INTERMEDIATE_FILES_POST_HTML): cache/posts/%.content.html: cache/posts/%.content.md
	deno run --allow-read=cache --allow-write=cache process.ts markdown $< $@

$(OUTPUT_FILES_POSTS): out/posts/%.html: cache/posts/%.metadata.json cache/posts/%.content.html content/site.json | $(OUTPUT_DIRECTORIES)
	deno run --allow-read=content,cache --allow-write=out process.ts template-post content/site.json cache/posts/$*.metadata.json cache/posts/$*.content.html $@

# Copy verbatim (and use order-only prerequisites to ensure directories exist first)
$(OUTPUT_FILES_VERBATIM): out/%: content/% | $(OUTPUT_DIRECTORIES)
	cp -f $< $@

#-----------------------------------------------------------
# Build "commands" (phony targets)

# Build
.PHONY: build
build: $(OUTPUT_FILES)

# Delete "cache/" and "out/"
.PHONY: clean
clean:
	rm -rf cache out

