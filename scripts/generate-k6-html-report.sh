#!/bin/bash
# Generate a responsive HTML report from K6 JSON output using k6-reporter
# Usage: ./scripts/generate-k6-html-report.sh <json-file> <output-html>

set -e

INPUT_JSON="$1"
OUTPUT_HTML="$2"

if [ -z "$INPUT_JSON" ] || [ -z "$OUTPUT_HTML" ]; then
  echo "Usage: $0 <k6-result.json> <output.html>"
  exit 1
fi

docker run --rm -v "$PWD":/work -w /work mencik/k6-reporter "$INPUT_JSON" -o "$OUTPUT_HTML"

echo "HTML report generated at $OUTPUT_HTML"
