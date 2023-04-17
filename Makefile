#-----------------------------------------------------------
# Configuration

# Default to "build" target
.DEFAULT_GOAL := build

#-----------------------------------------------------------
# File enumeration

# Use "find" to enumerate all directories and files under "content/" (excluding "content/" itself)
INPUT_FILES := $(shell find content -follow -type f -not -name '.*')
INPUT_DIRECTORIES := $(filter-out content,$(shell find content -follow -type d))

# Separate input files for processing
INPUT_FILES_SITE_JSON := $(filter content/site.json,$(INPUT_FILES))
INPUT_FILES_POSTS := $(filter content/posts/%.md,$(INPUT_FILES))
INPUT_FILES_VERBATIM := $(filter-out $(INPUT_FILES_SITE_JSON) $(INPUT_FILES_POSTS),$(INPUT_FILES))

INPUT_DIRECTORIES_POSTS := $(sort $(dir $(INPUT_FILES_POSTS)))

# Intermediate results (under "cache/")
INTERMEDIATE_DIRECTORIES := $(patsubst content/%,cache/%,$(INPUT_DIRECTORIES))

INTERMEDIATE_FILES_SITE_JSON := cache/site.json
INTERMEDIATE_FILES_POST_METADATA := $(patsubst content/posts/%.md,cache/posts/%.metadata.json,$(INPUT_FILES_POSTS))
INTERMEDIATE_FILES_POST_CONTENT := $(patsubst content/posts/%.md,cache/posts/%.content.md,$(INPUT_FILES_POSTS))
INTERMEDIATE_FILES_POST_HTML := $(patsubst content/posts/%.md,cache/posts/%.content.html,$(INPUT_FILES_POSTS))
INTERMEDIATE_FILES_INDEX := cache/posts/index.json

INTERMEDIATE_FILES := $(INTERMEDIATE_FILES_SITE_JSON) $(INTERMEDIATE_FILES_POST_METADATA) $(INTERMEDIATE_FILES_POST_CONTENT) $(INTERMEDIATE_FILES_POST_HTML) $(INTERMEDIATE_FILES_INDEX)
INTERMEDIATE_FILES_EXTRANEOUS := $(filter-out $(INTERMEDIATE_FILES),$(shell mkdir -p cache && find cache -type f))

# Output (under "out/")
OUTPUT_DIRECTORIES := out/css $(patsubst content/%,out/%,$(INPUT_DIRECTORIES))
OUTPUT_DIRECTORIES_POSTS := $(patsubst content/%,out/%,$(INPUT_DIRECTORIES_POSTS))

OUTPUT_FILES_POSTS := $(addsuffix .html,$(basename $(patsubst content/%,out/%,$(INPUT_FILES_POSTS))))
OUTPUT_FILES_VERBATIM := $(patsubst content/%,out/%,$(INPUT_FILES_VERBATIM))
OUTPUT_FILES_TAG_INDEXES := $(addsuffix index.html,$(OUTPUT_DIRECTORIES_POSTS))
OUTPUT_FILES_FIXED := out/posts/index.html out/index.html out/404.html out/css/style.css out/feed.xml

OUTPUT_FILES := $(OUTPUT_FILES_POSTS) $(OUTPUT_FILES_VERBATIM) $(OUTPUT_FILES_FIXED) $(OUTPUT_FILES_TAG_INDEXES)

# Note the following flawed hack: tag index pages might be added by a keyword that doesn't map to a category directory,
# so leave tag index pages alone here. This will fail if a tag is removed, along with an associated post because the
# tag index page will be left in place, but the post will no longer exist.
#
# Potential solution: have the indexing script clean up those files.

OUTPUT_FILES_EXTRANEOUS := $(filter-out $(OUTPUT_FILES) out/posts/%/index.html,$(shell mkdir -p out && find out -type f))

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
cache/site.json: content/site.json | $(INTERMEDIATE_DIRECTORIES)
	deno run --allow-read=content --allow-write=cache site-metadata.ts $< $@

cache/posts/%.metadata.json cache/posts/%.content.md &: content/posts/%.md | $(INTERMEDIATE_DIRECTORIES)
	../leano/leano front-matter.js $< posts/$*.html cache/posts/$*.metadata.json cache/posts/$*.content.md

$(INTERMEDIATE_FILES_POST_HTML): cache/posts/%.content.html: cache/posts/%.content.md
	deno run --allow-read=cache --allow-write=cache markdown.ts $< $@

$(OUTPUT_FILES_POSTS): out/posts/%.html: cache/posts/%.metadata.json cache/posts/%.content.html cache/site.json | $(OUTPUT_DIRECTORIES)
	../leano/leano template-post.js cache/site.json cache/posts/$*.metadata.json cache/posts/$*.content.html $@

cache/posts/index.json: $(INTERMEDIATE_FILES_POST_METADATA) | $(INTERMEDIATE_DIRECTORIES)
	../leano/leano index.js cache/posts $@

# Generate home page, indexes, archive (note: this also generates indexes for keywords that don't exist as a separate category directory)
out/posts/index.html out/index.html $(OUTPUT_FILES_TAG_INDEXES) &: $(INTERMEDIATE_FILES_INDEX) cache/site.json
	../leano/leano template-indexes.js cache/site.json $(INTERMEDIATE_FILES_INDEX) out

out/feed.xml: cache/site.json cache/posts/index.json $(INTERMEDIATE_FILES_POST_HTML)
	../leano/leano template-feed.js cache cache/site.json cache/posts/index.json $@

out/404.html: cache/site.json | $(OUTPUT_DIRECTORIES)
	deno run --allow-read=cache --allow-write=out template-404.ts cache/site.json $@

out/css/style.css: cache/site.json | $(OUTPUT_DIRECTORIES)
	deno run --allow-read=cache --allow-write=out template-css.ts cache/site.json $@

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

