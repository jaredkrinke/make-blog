#-----------------------------------------------------------
# Configuration

# Default to "build" target
.DEFAULT_GOAL := build-clean

#-----------------------------------------------------------
# File enumeration

# Use "find" to enumerate all directories and files under "content/" (excluding "content/" itself)
INPUT_FILES := $(shell find content -type f)
INPUT_DIRECTORIES := $(filter-out content,$(shell find content -type d))

# Replace "content/" with "out/"
OUTPUT_FILES := $(patsubst content/%,out/%,$(INPUT_FILES))
OUTPUT_DIRECTORIES := $(patsubst content/%,out/%,$(INPUT_DIRECTORIES))

# Extraneous files already present in "out/"
EXTRANEOUS_OUTPUT_FILES := $(filter-out $(OUTPUT_FILES),$(shell find out -type f))

#-----------------------------------------------------------
# Build rules

# Rule to recreate "content/" directory structure under "out/"
$(OUTPUT_DIRECTORIES):
	mkdir -p $@

# Copy all files verbatim (and use order-only prerequisites to ensure directories exist first)
out/%: content/% | $(OUTPUT_DIRECTORIES)
	cp -f $< $@

#-----------------------------------------------------------
# Build "commands" (phony targets)

# Build
.PHONY: build
build: $(OUTPUT_FILES) $(OUTPUT_DIRECTORIES)

# Remove extraneous files from "out/"
.PHONY: tidy
tidy:
ifneq ($(strip $(EXTRANEOUS_OUTPUT_FILES)),)
	rm $(EXTRANEOUS_OUTPUT_FILES)
endif

# Build and remove extraneous files
.PHONY: build-clean
build-clean: tidy build

# Delete everything in "out/" (note: leave "out/" itself, in case there's source control such as "out/.git/" present)
.PHONY: clean
clean:
	cd out && rm -rf *

