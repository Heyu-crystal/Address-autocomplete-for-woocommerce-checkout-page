import wordpress from '@wordpress/eslint-plugin';
import globals from 'globals';

export default [
	{
		ignores: [ 'node_modules/**', 'vendor/**', 'build/**', 'test-results/**', 'playwright-report/**' ],
	},
	// WordPress rules, formatted with wp-prettier (as Gutenberg and WooCommerce).
	...wordpress.configs.recommended,
	{
		files: [ 'assets/js/**/*.js' ],
		languageOptions: {
			sourceType: 'script',
			globals: { ...globals.browser },
		},
	},
	{
		// The parser also runs in Node for the unit tests.
		files: [ 'assets/js/address-parser.js' ],
		languageOptions: {
			globals: { module: 'readonly' },
		},
	},
	{
		files: [ 'tests/**/*.js', 'tools/**/*.mjs', 'playwright.config.js' ],
		languageOptions: {
			globals: { ...globals.node, ...globals.browser },
		},
		rules: {
			'no-console': 'off',
		},
	},
];
