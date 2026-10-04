/**
 * End-to-end tests against a real WordPress + WooCommerce site.
 *
 * Default target: the `@wordpress/env` "tests" site (http://localhost:8889), see .wp-env.json.
 * Set WP_BASE_URL to test another site. The site needs the test-only helper
 * plugin tests/e2e/setup/mu-plugin.php, the AAFWC_E2E constant and the seed data
 * from tests/e2e/setup/seed.php (see CONTRIBUTING.md).
 */
const { defineConfig, devices } = require( '@playwright/test' );

module.exports = defineConfig( {
	testDir: './tests/e2e',
	timeout: 90 * 1000,
	expect: { timeout: 15 * 1000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: process.env.CI
		? [ [ 'list' ], [ 'html', { open: 'never' } ] ]
		: 'list',
	use: {
		baseURL: process.env.WP_BASE_URL || 'http://localhost:8889',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		locale: 'en-AU',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices[ 'Desktop Chrome' ] },
		},
	],
} );
