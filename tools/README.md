# Tools

## capture-fixtures.mjs

The address fixtures in `tests/fixtures/places.js` follow the Places API (New) response
format and Google's component types per country, but were written by hand. This script
checks them against live Google data:

```bash
GOOGLE_API_KEY=your-key node tools/capture-fixtures.mjs          # all fixtures
GOOGLE_API_KEY=your-key node tools/capture-fixtures.mjs it-roma  # one fixture
```

For each fixture it searches Google for the fixture's address, fetches the place details
(one billing session per fixture), saves the raw response to
`tests/fixtures/captured/<id>.json`, and prints any field where the parser's result on
live data differs from the fixture's `expected` values.

When live data differs, decide which is right for WooCommerce, then update the parser
rules in `assets/js/address-parser.js` and/or the fixture, and run `npm run test:unit`.
