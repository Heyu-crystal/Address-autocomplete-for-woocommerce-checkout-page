/**
 * Server proxy mode, the settings screen, "Test my key" and the privacy text.
 */
const { test, expect } = require( '@playwright/test' );
const { fixture, suggestion } = require( './utils/google-mock' );
const {
	setSettings,
	setWooCommerceAutocomplete,
	setTestMode,
	clearGoogleLog,
	clearRateLimits,
	googleLog,
	wcAtLeast,
} = require( './utils/wp' );
const {
	openBlockCheckout,
	typeAddress,
	pickFromPluginList,
	selectBlockCountry,
	blockStoreAddress,
	login,
} = require( './utils/checkout' );

const AU = fixture( 'au-unit' );

function googleAnswers( status = 200 ) {
	const error = {
		error: {
			code: status,
			status: 'PERMISSION_DENIED',
			message:
				'Places API (New) has not been used in project 123 before or it is disabled.',
			details: [ { reason: 'SERVICE_DISABLED' } ],
		},
	};
	return {
		autocomplete: {
			status,
			body:
				status === 200
					? { suggestions: [ suggestion( AU, '5/100 Mil' ) ] }
					: error,
		},
		details: { status, body: status === 200 ? AU.place : error },
	};
}

test.beforeEach( async () => {
	await setSettings();
	await setWooCommerceAutocomplete( false );
	await setTestMode( {} );
	await clearGoogleLog();
	await clearRateLimits();
} );

test.afterAll( async () => {
	await setTestMode( {} );
	await setSettings();
} );

test( 'proxy mode: the key stays on the server and addresses still fill', async ( {
	page,
} ) => {
	await setSettings( {
		request_mode: 'proxy',
		api_key: 'SECRET_SERVER_KEY',
	} );
	await setTestMode( { google: googleAnswers( 200 ) } );
	const browserGoogle = [];
	await page.route( 'https://places.googleapis.com/**', ( route ) => {
		browserGoogle.push( route.request().url() );
		return route.abort();
	} );
	await openBlockCheckout( page );
	expect( await page.content() ).not.toContain( 'SECRET_SERVER_KEY' );
	await selectBlockCountry( page, 'shipping', 'AU' );
	await typeAddress( page.locator( '#shipping-address_1' ), '5/100 Mil' );
	await pickFromPluginList( page, '5/100 Miller' );
	await expect( page.locator( '#shipping-address_1' ) ).toHaveValue(
		'100 Miller Street'
	);
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( 'NSW' );
	expect( ( await blockStoreAddress( page ) ).city ).toBe( 'North Sydney' );
	expect( browserGoogle ).toEqual( [] );

	const log = await googleLog();
	expect( log.length ).toBeGreaterThanOrEqual( 2 );
	expect( log[ 0 ].key ).toBe( 'SECRET_SERVER_KEY' );
	expect( log[ 0 ].url ).toContain( 'places:autocomplete' );
	expect( JSON.parse( log[ 0 ].body ).includedRegionCodes ).toEqual( [
		'au',
	] );
	const details = log.find( ( l ) => l.url.includes( '/v1/places/' ) );
	expect( details.url ).toContain( AU.placeId );
	expect( details.url ).toContain( 'sessionToken=' );
} );

test( 'proxy mode: nonce, input validation, store country limit and rate limit', async ( {
	page,
	request,
} ) => {
	await setSettings( { request_mode: 'proxy', countries: 'AU' } );
	await setTestMode( {
		google: googleAnswers( 200 ),
		rateLimit: { requests: 4, window: 600 },
	} );
	await openBlockCheckout( page );
	const { url, nonce } = await page.evaluate(
		() =>
			JSON.parse( document.getElementById( 'aafwc-config' ).textContent )
				.request
	);

	const noNonce = await request.post( url + 'autocomplete', {
		data: { input: 'abc' },
	} );
	expect( noNonce.status() ).toBe( 403 );

	const headers = { 'X-WP-Nonce': nonce };
	const tooLong = await page.request.post( url + 'autocomplete', {
		headers,
		data: { input: 'x'.repeat( 201 ) },
	} );
	expect( tooLong.status() ).toBe( 400 );
	const badPlace = await page.request.get(
		url + 'place?placeId=' + encodeURIComponent( '../../etc' ),
		{ headers }
	);
	expect( badPlace.status() ).toBe( 400 );

	// The store limit applies whatever the browser asks for.
	await clearGoogleLog();
	const outside = await page.request.post( url + 'autocomplete', {
		headers,
		data: { input: 'abc', includedRegionCodes: [ 'us' ] },
	} );
	expect( outside.status() ).toBe( 200 );
	expect( ( await outside.json() ).suggestions ).toEqual( [] );
	expect( await googleLog() ).toHaveLength( 0 );

	let last = 200;
	for ( let i = 0; i < 6; i++ ) {
		last = (
			await page.request.post( url + 'autocomplete', {
				headers,
				data: { input: 'abc ' + i },
			} )
		).status();
	}
	expect( last ).toBe( 429 );
} );

test( 'settings screen: status panel, saving, Test my key', async ( {
	page,
} ) => {
	await login( page, 'admin', 'password' );
	await page.goto(
		'/wp-admin/admin.php?page=wc-settings&tab=integration&section=aafwc'
	);
	const panel = page.locator( '.aafwc-status-panel' );
	await expect( panel ).toContainText( 'Plugin version' );
	await expect( panel ).toContainText( '1.0.0' );
	await expect( panel ).toContainText( 'None found' );

	// Saving cleans the values.
	await page
		.locator( '#woocommerce_aafwc_countries' )
		.fill( 'au, nz;xx1,US' );
	await page.locator( '#woocommerce_aafwc_min_chars' ).fill( '7' );
	await page.locator( '#woocommerce_aafwc_language' ).fill( 'pt-BR' );
	await Promise.all( [
		page.waitForNavigation(),
		page.locator( 'button[name="save"]' ).click(),
	] );
	await expect( page.locator( '#woocommerce_aafwc_countries' ) ).toHaveValue(
		'AU,NZ,US'
	);
	await expect( page.locator( '#woocommerce_aafwc_min_chars' ) ).toHaveValue(
		'7'
	);
	await expect( page.locator( '#woocommerce_aafwc_language' ) ).toHaveValue(
		'pt-BR'
	);

	// Test my key: Google refuses.
	await setTestMode( { google: googleAnswers( 403 ) } );
	await page.locator( '#aafwc-test-key' ).click();
	await expect( page.locator( '#aafwc-test-result' ) ).toContainText(
		'Places API (New)" is not enabled'
	);
	await expect( page.locator( '#aafwc-test-result' ) ).toContainText(
		'SERVICE_DISABLED'
	);
	const log = await googleLog();
	expect( log[ log.length - 1 ].referer ).toMatch( /^http:\/\/localhost/ );

	// Test my key: works.
	await setTestMode( { google: googleAnswers( 200 ) } );
	await page.locator( '#aafwc-test-key' ).click();
	await expect( page.locator( '#aafwc-test-result' ) ).toContainText(
		'The key works'
	);
} );

test( 'status panel explains which list is in use and warns about conflicts', async ( {
	page,
} ) => {
	await setSettings( { suggestion_list: 'auto' } );
	await setWooCommerceAutocomplete( true );
	await login( page, 'admin', 'password' );
	await page.goto(
		'/wp-admin/admin.php?page=wc-settings&tab=integration&section=aafwc'
	);
	const panel = page.locator( '.aafwc-status-panel' );
	const modern = await wcAtLeast( '10.3' );
	if ( modern ) {
		await expect( panel ).toContainText(
			"WooCommerce's built-in list, with Google results from this plugin"
		);
	}
	await setSettings( { consent_category: 'marketing' } );
	await page.reload();
	await expect( panel ).toContainText(
		'WP Consent API plugin is not active'
	);
	await setWooCommerceAutocomplete( false );
} );

test( 'privacy policy guide includes the suggested text', async ( {
	page,
} ) => {
	await login( page, 'admin', 'password' );
	await page.goto( '/wp-admin/options-privacy.php?tab=policyguide' );
	await expect( page.locator( 'body' ) ).toContainText(
		'Address Autocomplete for WooCommerce'
	);
	await expect( page.locator( 'body' ) ).toContainText( 'sent to Google' );
} );
