# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-10-04

First public release, based on the private "HeyU Address Autocomplete" build used on the HeyU Jewellery shop.

### Added

- Google provider for WooCommerce's built-in address autocomplete (WooCommerce 10.3+), with a "Suggestion list" setting (automatic / WooCommerce built-in / plugin's own). Only one list opens on a field.
- Per-country address parsing: house number after the street (extended country list, comma styles such as `Via del Corso, 12`), Japanese block addresses and wards, UK post towns, Italian and Spanish provinces, Brazilian cities, Chinese and Indian districts, city states.
- WooCommerce state code matching for NZ, IE, IT, ES, JP, BR, CN, IN, MX and DE (`DE-` codes), with name matching as fallback.
- Settings for street names (full or abbreviated), Australian/New Zealand combined units (`5/100 Miller St`), minimum characters, typing pause, colours, which forms are enabled, custom forms (CSS selectors), and where scripts load.
- Classic cart shipping calculator support (city and postcode suggestions).
- Full ARIA combobox pattern and a live region announcing the number of suggestions.
- Optional server proxy (REST endpoint with nonce, input validation and per-visitor rate limit) that keeps the API key out of the page.
- WP Consent API support: no request to Google before consent when a category is chosen.
- "Test my key" button showing Google's exact error, and a status panel with conflict detection.
- In-memory cache of recent searches; requests stop for the page view after Google refuses the key.
- JavaScript hook (`aafwc:address` event) and PHP filters (`aafwc_country_rules`, `aafwc_frontend_config`, `aafwc_load_assets`, `aafwc_place_details`, `aafwc_proxy_rate_limit`, `aafwc_proxy_client_ip`).
- Suggested privacy policy text, translation template, `uninstall.php`.
- Settings of the private build (`woocommerce_heyu_address_autocomplete_settings`) are imported once.
- Unit tests with address fixtures for 18 countries; end-to-end tests on real WooCommerce (block, classic, My Account, calculator, custom forms, WooCommerce built-in list, proxy, deferred scripts, accessibility); GitHub Actions CI and release builds.

### Changed

- New name, prefix (`aafwc`), text domain and neutral default colours.
- The suggestion list is positioned with `position: fixed`, flips above the field when there is no room below, and follows scrolling containers and modals.
- Enter never submits the checkout while the list is open.
- The re-check after filling (for block checkout re-renders) no longer overwrites what the customer types right after picking an address.

[Unreleased]: https://github.com/heyu-crystal/address-autocomplete-for-wp-woocommerce-checkout-page/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/heyu-crystal/address-autocomplete-for-wp-woocommerce-checkout-page/releases/tag/v1.0.0
