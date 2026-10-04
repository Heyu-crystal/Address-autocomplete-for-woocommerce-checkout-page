#!/usr/bin/env bash
# Build the installable plugin zip: build/address-autocomplete-for-woocommerce.zip
# The zip contains one folder named after the plugin slug, without development files
# (see .distignore).
set -euo pipefail

SLUG="address-autocomplete-for-woocommerce"
ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
BUILD="$ROOT/build"
STAGE="$BUILD/$SLUG"

rm -rf "$BUILD"
mkdir -p "$STAGE"

# Copy everything except the paths listed in .distignore.
EXCLUDES=()
while IFS= read -r line || [ -n "$line" ]; do
	line="${line%%#*}"
	line="$( echo "$line" | xargs )"
	[ -z "$line" ] && continue
	EXCLUDES+=( "--exclude=./${line#/}" )
done < "$ROOT/.distignore"

tar -C "$ROOT" "${EXCLUDES[@]}" -cf - . | tar -C "$STAGE" -xf -

( cd "$BUILD" && zip -qr "$SLUG.zip" "$SLUG" )
rm -rf "$STAGE"
echo "Built $BUILD/$SLUG.zip"
