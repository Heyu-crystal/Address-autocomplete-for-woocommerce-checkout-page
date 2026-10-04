# Contributing

Thanks for helping! Bug reports, country fixes and pull requests are welcome. Please follow the [code of conduct](CODE_OF_CONDUCT.md).

By contributing, you agree that your contribution is licensed under this project's [licence](LICENSE) (MIT with the Commons Clause).

## Project layout

```
address-autocomplete-for-woocommerce.php   plugin header, bootstrap
includes/                                  PHP: settings, status panel, provider, proxy, "Test my key"
assets/js/address-parser.js                Google place -> WooCommerce fields (no DOM; unit-tested in Node)
assets/js/address-autocomplete.js          the plugin's own suggestion list and field filling
assets/js/wc-address-provider.js           provider for WooCommerce's built-in address autocomplete
assets/css/address-autocomplete.css        suggestion list styles (CSS variables)
languages/                                 translation template (.pot)
tests/unit/                                parser unit tests (node:test)
tests/fixtures/                            Places API (New) address fixtures, WooCommerce state codes
tests/e2e/                                 Playwright end-to-end tests
tools/                                     fixture capture against live Google data
```

## Setup

Requirements: Node.js 20+, PHP 7.4+ with Composer, and Docker (for `@wordpress/env`).

```bash
npm ci
composer install
```

## Checks

```bash
npm run lint        # ESLint (@wordpress/eslint-plugin) + PHPCS (WordPress Coding Standards, PHP 7.4 compatibility)
npm run test:unit   # address parser against tests/fixtures
```

`npx eslint --fix assets/js tests` and `vendor/bin/phpcbf` fix most formatting.

## End-to-end tests

The Playwright tests run against a real WordPress + WooCommerce site and simulate Google (no API key or Google account needed).

```bash
npm run env:start   # wp-env (Docker) on http://localhost:8889, then seeds the test shop
npx playwright install chromium
npm run test:e2e
npm run env:stop
```

Another WooCommerce or PHP version: create `.wp-env.override.json`, for example

```json
{ "phpVersion": "7.4", "plugins": [ "https://downloads.wordpress.org/plugin/woocommerce.10.9.4.zip" ] }
```

Any other local WordPress also works: install WooCommerce and this plugin, copy `tests/e2e/setup/mu-plugin.php` into `wp-content/mu-plugins/`, add `define( 'AAFWC_E2E', true );` to `wp-config.php`, run `wp eval-file tests/e2e/setup/seed.php`, and set `WP_BASE_URL`. **Never do this on a real shop:** the helper plugin adds an unauthenticated test API.

What the tests cover: see the file names in `tests/e2e/` (they follow the acceptance tests in the release checklist). A real screen reader pass (NVDA or VoiceOver) is still a manual check before a release.

## Address fixtures and country fixes

1. Add or change a fixture in `tests/fixtures/places.js` (the place details Google returns, and what each WooCommerce field should contain).
2. Adjust the rules in `assets/js/address-parser.js` (or a state alias) until `npm run test:unit` passes.
3. If you have a Google key, compare with live data: `GOOGLE_API_KEY=... node tools/capture-fixtures.mjs <fixture-id>` (see `tools/README.md`).

## Translations

All visible strings, including the JavaScript ones (passed in the page configuration), use the `address-autocomplete-for-woocommerce` text domain. After changing strings, regenerate the template with WP-CLI:

```bash
wp i18n make-pot . languages/address-autocomplete-for-woocommerce.pot --exclude=node_modules,vendor,tests,tools,build,test-results,playwright-report --slug=address-autocomplete-for-woocommerce --domain=address-autocomplete-for-woocommerce
```

## Releases

Versions follow [Semantic Versioning](https://semver.org/).

1. Update the version in `address-autocomplete-for-woocommerce.php` (header and `AAFWC_VERSION`), `readme.txt` (`Stable tag`) and `package.json`.
2. Move the "Unreleased" entries in `CHANGELOG.md` under the new version and add a line to the changelog in `readme.txt`.
3. Update "Tested up to" / "WC tested up to" after testing the latest WordPress and WooCommerce.
4. Merge to `main`, then tag: `git tag v1.2.3 && git push origin v1.2.3`. The release workflow checks the versions, builds `address-autocomplete-for-woocommerce.zip` (without development files, see `.distignore`) and publishes a GitHub release with the changelog section. `bash bin/build-zip.sh` builds the same zip locally.

## Support policy

Community-supported, best effort. After each major WooCommerce release, run the end-to-end tests against it (the CI matrix tests the latest and one previous WooCommerce), and watch the [Google Maps Platform release notes](https://developers.google.com/maps/documentation/places/web-service/release-notes) for Places API changes.
