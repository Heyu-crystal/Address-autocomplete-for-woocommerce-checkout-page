/**
 * Script-deferring tools, Google errors, country limits, consent and caching
 * (acceptance tests 7, 8, 9).
 */
const { test, expect } = require( '@playwright/test' );
const { mockGoogle } = require( './utils/google-mock' );
const {
	setSettings,
	setWooCommerceAutocomplete,
	setTestMode,
} = require( './utils/wp' );
const {
	openBlockCheckout,
	addToCart,
	typeAddress,
	pluginList,
	pickFromPluginList,
	selectBlockCountry,
	blockStoreAddress,
} = require( './utils/checkout' );

test.beforeEach( async () => {
	await setSettings();
	await setWooCommerceAutocomplete( false );
	await setTestMode( {} );
} );

test.afterAll( async () => {
	await setTestMode( {} );
} );

test( '7a. plugin scripts deferred and moved into <head> (above their configuration)', async ( {
	page,
} ) => {
	await setTestMode( { scripts: 'defer-head' } );
	await mockGoogle( page );
	await openBlockCheckout( page );
	const inHead = await page.evaluate(
		() =>
			!! document.head.querySelector(
				'script[src*="address-autocomplete.js"][defer]'
			)
	);
	expect( inHead ).toBe( true );
	await selectBlockCountry( page, 'shipping', 'AU' );
	await typeAddress( page.locator( '#shipping-address_1' ), '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( 'NSW' );
	expect( await blockStoreAddress( page ) ).toMatchObject( {
		address_1: '200 George Street',
		city: 'Sydney',
	} );
} );

test( '7b. plugin scripts delayed until the first interaction', async ( {
	page,
} ) => {
	await setTestMode( { scripts: 'delay' } );
	await mockGoogle( page );
	await addToCart( page );
	await page.goto( '/checkout/' );
	const input = page.locator( '#shipping-address_1' );
	await expect( input ).toBeVisible();
	expect( await page.evaluate( () => !! window.AAFWC ) ).toBe( false );
	await selectBlockCountry( page, 'shipping', 'AU' );
	// The first key press loads the scripts; later key presses search.
	await input.click();
	await input.press( 'Shift' );
	await page.waitForFunction( () => window.AAFWC && window.AAFWC.ready );
	await typeAddress( input, '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( 'Sydney' );
} );

test( '7c. every script on the page deferred (classic checkout)', async ( {
	page,
} ) => {
	// Deferring all scripts also breaks WooCommerce's own block checkout, so this
	// variant runs on the classic checkout, which survives it.
	await setTestMode( { scripts: 'defer-all' } );
	await mockGoogle( page );
	await addToCart( page );
	await page.goto( '/classic-checkout/' );
	await page.waitForFunction( () => window.AAFWC && window.AAFWC.ready );
	await page.locator( '#billing_country' ).selectOption( 'AU' );
	await page.waitForTimeout( 500 );
	await typeAddress( page.locator( '#billing_address_1' ), '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( page.locator( '#billing_address_1' ) ).toHaveValue(
		'200 George Street'
	);
	await expect( page.locator( '#billing_state' ) ).toHaveValue( 'NSW' );
} );

test( '8. Google refuses the key (403): no list, no errors, one clear Console message, no more requests', async ( {
	page,
} ) => {
	const google = await mockGoogle( page, { fail: 403 } );
	const warnings = [];
	const errors = [];
	page.on(
		'console',
		( m ) => m.type() === 'warning' && warnings.push( m.text() )
	);
	page.on( 'pageerror', ( e ) => errors.push( e.message ) );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '200 Geo' );
	await page.waitForTimeout( 800 );
	await expect( pluginList( page ) ).toHaveCount( 0 );
	await typeAddress( input, '1 Collins' );
	await page.waitForTimeout( 800 );
	await expect( pluginList( page ) ).toHaveCount( 0 );

	const ours = warnings.filter( ( w ) =>
		w.includes( 'Address Autocomplete for WooCommerce' )
	);
	expect( ours ).toHaveLength( 1 );
	expect( ours[ 0 ] ).toContain( 'API_KEY_HTTP_REFERRER_BLOCKED' );
	expect( ours[ 0 ] ).toContain( 'website restriction' );
	expect( google.autocomplete ).toHaveLength( 1 );
	expect( errors ).toEqual( [] );
	// The field still works as a normal text field.
	await expect( input ).toHaveValue( '1 Collins' );
} );

test( '9. country limit AU,NZ with US selected: no suggestions and no request', async ( {
	page,
} ) => {
	await setSettings( { countries: 'AU,NZ', restrict_to_selected: 'no' } );
	const google = await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'US' );
	await typeAddress( page.locator( '#shipping-address_1' ), '1600 Amph' );
	await page.waitForTimeout( 800 );
	await expect( pluginList( page ) ).toHaveCount( 0 );
	expect( google.autocomplete ).toHaveLength( 0 );

	// AU selected: Google is asked for AU and NZ only.
	await selectBlockCountry( page, 'shipping', 'AU' );
	await typeAddress( page.locator( '#shipping-address_1' ), '200 Geo' );
	await expect( pluginList( page ) ).toBeVisible();
	expect( google.autocomplete[ 0 ].body.includedRegionCodes ).toEqual( [
		'au',
		'nz',
	] );
} );

test( 'repeated searches are answered from the page cache', async ( {
	page,
} ) => {
	const google = await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '200 Geo' );
	await expect( pluginList( page ) ).toBeVisible();
	const count = google.autocomplete.length;
	await input.press( 'Escape' );
	await typeAddress( input, '200 Geo' );
	await expect( pluginList( page ) ).toBeVisible();
	expect( google.autocomplete.length ).toBeGreaterThanOrEqual( count );
	const inputs = google.autocomplete.map( ( r ) => r.body.input );
	expect( inputs.filter( ( i ) => i === '200 Geo' ) ).toHaveLength( 1 );
} );

test( 'minimum characters and typing pause settings are respected', async ( {
	page,
} ) => {
	await setSettings( { min_chars: '5', debounce: '400' } );
	const google = await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	await typeAddress( page.locator( '#shipping-address_1' ), '200 ' );
	await page.waitForTimeout( 900 );
	expect( google.autocomplete ).toHaveLength( 0 );
	await page
		.locator( '#shipping-address_1' )
		.pressSequentially( 'Geo', { delay: 40 } );
	await expect( pluginList( page ) ).toBeVisible();
	// Typed quickly, so only the final text was sent.
	expect( google.autocomplete.map( ( r ) => r.body.input ) ).toEqual( [
		'200 Geo',
	] );
} );

test( 'consent: nothing is sent to Google until the visitor consents', async ( {
	page,
} ) => {
	await setSettings( { consent_category: 'functional' } );
	const google = await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	const input = page.locator( '#shipping-address_1' );

	// No WP Consent API on the page: no requests at all.
	await typeAddress( input, '200 Geo' );
	await page.waitForTimeout( 800 );
	expect( google.autocomplete ).toHaveLength( 0 );

	// A consent banner says "not yet".
	await page.evaluate( () => {
		window.aafwcConsent = false;
		window.wp_has_consent = () => window.aafwcConsent;
	} );
	await typeAddress( input, '200 Geor' );
	await page.waitForTimeout( 800 );
	expect( google.autocomplete ).toHaveLength( 0 );

	// The visitor consents.
	await page.evaluate( () => {
		window.aafwcConsent = true;
	} );
	await typeAddress( input, '200 Geo' );
	await expect( pluginList( page ) ).toBeVisible();
	expect( google.autocomplete.length ).toBeGreaterThan( 0 );
} );
