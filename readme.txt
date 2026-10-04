=== Address Autocomplete for WooCommerce ===
Tags: address autocomplete, checkout, google places, woocommerce, address
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
WC requires at least: 8.0
WC tested up to: 11.1
Stable tag: 1.0.0
License: MIT with Commons Clause
License URI: https://github.com/heyu-crystal/address-autocomplete-for-wp-woocommerce-checkout-page/blob/main/LICENSE

Google address suggestions for the WooCommerce checkout (block and classic) and My Account addresses.

== Description ==

Customers type a few characters of their address, pick a suggestion, and the street, apartment, city, state, postcode and country are filled into their own fields.

* Block checkout, classic checkout, My Account > Addresses, the classic cart shipping calculator, and your own forms (CSS selectors).
* Values are written the way the block checkout (React) keeps them, so they are saved with the order.
* Local address formats: house number after the street, Japanese block addresses, UK post towns, Italian and Spanish provinces, and more.
* Google's regions are matched to WooCommerce's state codes.
* An apartment number the customer typed is never erased.
* Google Places API (New) with session tokens: one billing session per address picked.
* Also a Google provider for WooCommerce's own address autocomplete (WooCommerce 10.3+). Only one suggestion list ever opens on a field.
* Accessible (ARIA combobox, keyboard, screen-reader announcements, right-to-left).
* Keeps working with tools that defer or delay JavaScript.
* Optional server proxy (API key hidden), consent support (WP Consent API) and cost controls.

Free by HeyU Jewellery. Use it on any number of sites, including commercial shops; it may not be sold. Full documentation: https://github.com/heyu-crystal/address-autocomplete-for-wp-woocommerce-checkout-page

== Installation ==

1. Upload the plugin zip (Plugins > Add New Plugin > Upload Plugin) and activate it.
2. In Google Cloud: link billing, enable "Places API (New)", create an API key, and restrict it to your website (`https://example.com/*` and `*.example.com/*`, the second without "https://") and to "Places API (New)". Set a budget alert.
3. WooCommerce > Settings > Integration > Address Autocomplete: paste the key, save, and press "Test my key".

== Frequently Asked Questions ==

= Does it cost anything? =

The plugin is free. Google bills the owner of the API key for Places API (New) usage, with a free monthly allowance. Each picked address is one session. See Google's pricing page and set a budget alert in Google Cloud.

= My API key is visible in the page source. Is that a problem? =

Browser keys are always visible. Restrict the key to your website and to Places API (New) so no one else can use it, or switch "Requests to Google" to "Server proxy" to keep the key on your server.

= Two suggestion lists open on the address field =

Another address autocomplete plugin is active, or WooCommerce's built-in address autocomplete uses another provider. The status panel on the settings screen lists what it finds.

= Suggestions stopped working after I installed a performance plugin =

The plugin copes with deferred and delayed scripts, but "defer all JavaScript" options can break WooCommerce's block checkout itself. Exclude the checkout page or WooCommerce and WordPress core scripts from that option.

== External services ==

This plugin connects to Google Places API (New), a service of Google LLC, to suggest addresses and to get the parts of the address the customer picks. It is needed for the plugin to work.

* What is sent: the text typed in an address field, the selected country (as a region filter), the language, a random session token, and the id of the suggestion the customer picks. In the default "Browser" mode the visitor's browser sends these requests directly to Google, so Google also receives the visitor's IP address and browser details. In "Server proxy" mode your server sends them, with your site address. When the "Test my key" button is pressed, your server sends one test search ("Main Street").
* When: only while someone types in an address field (after the minimum number of characters, and after consent when "Wait for consent" is set) and when they pick a suggestion. Nothing is sent on page load.
* Not sent: names, email addresses, phone numbers or order details.

Google Maps Platform Terms of Service: https://cloud.google.com/maps-platform/terms
Google Privacy Policy: https://policies.google.com/privacy
Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies

== Screenshots ==

1. Suggestions under the address field on the block checkout.
2. Every field filled after picking a suggestion.
3. WooCommerce's built-in list with Google results from this plugin.
4. Settings status panel and "Test my key".

== Changelog ==

= 1.0.0 =
* First public release. See CHANGELOG.md for details.
