/**
 * WooCommerce's built-in address autocomplete with this plugin as the Google provider
 * (WooCommerce 10.3+; acceptance test 11).
 */
const { test, expect } = require( '@playwright/test' );
const { mockGoogle, fixture } = require( './utils/google-mock' );
const {
	setSettings,
	setWooCommerceAutocomplete,
	setTestMode,
	wcAtLeast,
} = require( './utils/wp' );
const {
	openBlockCheckout,
	openClassicCheckout,
	typeAddress,
	pluginList,
	blockStoreAddress,
	selectBlockCountry,
	fillBlockContact,
	placeBlockOrder,
} = require( './utils/checkout' );
const { orderAddress } = require( './utils/wp' );

test.beforeEach( async () => {
	test.skip( ! ( await wcAtLeast( '10.3' ) ), 'WooCommerce 10.3+ only' );
	await setSettings();
	await setWooCommerceAutocomplete( true );
	await setTestMode( {} );
} );

test.afterAll( async () => {
	await setWooCommerceAutocomplete( false );
} );

const wcBlockList = ( page ) =>
	page.locator( '.wc-block-components-address-autocomplete-suggestions' );
const wcBlockOptions = ( page ) =>
	page.locator( '.wc-block-components-address-autocomplete-suggestion' );

test( "11. block checkout: exactly one list (WooCommerce's), filled through WooCommerce", async ( {
	page,
} ) => {
	const google = await mockGoogle( page );
	await openBlockCheckout( page );
	await page.waitForFunction(
		() =>
			window.wc &&
			window.wc.addressAutocomplete &&
			window.wc.addressAutocomplete.providers[ 'aafwc-google-places' ]
	);
	await selectBlockCountry( page, 'shipping', 'AU' );

	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '5/100 Mil' );
	await expect( wcBlockList( page ) ).toBeVisible();
	await expect( pluginList( page ) ).toHaveCount( 0 );
	await expect( wcBlockList( page ) ).toContainText( 'Google Maps' );
	await expect( wcBlockOptions( page ) ).toHaveCount( 1 );

	await wcBlockOptions( page ).first().click();
	const e = fixture( 'au-unit' ).expected;
	await expect( input ).toHaveValue( e.address_1 );
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( e.city );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( e.state );
	await expect( page.locator( '#shipping-postcode' ) ).toHaveValue(
		e.postcode
	);
	await expect( page.locator( '#shipping-address_2' ) ).toHaveValue(
		e.address_2
	);
	expect( await blockStoreAddress( page ) ).toMatchObject( {
		address_1: e.address_1,
		address_2: e.address_2,
		city: e.city,
		state: e.state,
		postcode: e.postcode,
		country: e.country,
	} );
	expect( google.details ).toHaveLength( 1 );
	expect( google.details[ 0 ].sessionToken ).toBe(
		google.autocomplete[ google.autocomplete.length - 1 ].body.sessionToken
	);

	await fillBlockContact( page );
	const orderId = await placeBlockOrder( page );
	expect( await orderAddress( orderId, 'shipping' ) ).toMatchObject( {
		address_1: e.address_1,
		state: e.state,
		city: e.city,
	} );
} );

test( '11. block checkout: other country and keyboard, through WooCommerce', async ( {
	page,
} ) => {
	await setSettings( { restrict_to_selected: 'no' } );
	await mockGoogle( page );
	await openBlockCheckout( page );
	await page.waitForFunction(
		() => window.wc.addressAutocomplete.providers[ 'aafwc-google-places' ]
	);
	await selectBlockCountry( page, 'shipping', 'AU' );
	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '1600 Amph' );
	await expect( wcBlockList( page ) ).toBeVisible();
	await expect( pluginList( page ) ).toHaveCount( 0 );
	await input.press( 'ArrowDown' );
	await input.press( 'Enter' );
	await expect( page.locator( '#shipping-country' ) ).toHaveValue( 'US' );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( 'CA' );
	await expect( input ).toHaveValue( '1600 Amphitheatre Parkway' );
	await expect( page ).toHaveURL( /\/checkout\/?$/ );
} );

test( "11. block checkout: WooCommerce's list keeps the customer's own apartment", async ( {
	page,
} ) => {
	await mockGoogle( page );
	await openBlockCheckout( page );
	await page.waitForFunction(
		() => window.wc.addressAutocomplete.providers[ 'aafwc-google-places' ]
	);
	await selectBlockCountry( page, 'shipping', 'AU' );
	const toggle = page
		.locator( '.wc-block-components-address-form__address_2-toggle' )
		.first();
	if ( await toggle.isVisible().catch( () => false ) ) {
		await toggle.click();
	}
	await page.locator( '#shipping-address_2' ).fill( 'Level 9' );
	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '200 Geo' );
	await wcBlockOptions( page ).first().click();
	await expect( input ).toHaveValue( '200 George Street' );
	await expect( page.locator( '#shipping-address_2' ) ).toHaveValue(
		'Level 9'
	);
} );

test( "11. classic checkout: WooCommerce's list, plugin list stays closed", async ( {
	page,
} ) => {
	await mockGoogle( page );
	await openClassicCheckout( page );
	await page.waitForFunction(
		() =>
			window.wc &&
			window.wc.addressAutocomplete &&
			window.wc.addressAutocomplete.providers[ 'aafwc-google-places' ]
	);
	await page.locator( '#billing_country' ).selectOption( 'AU' );
	await page.waitForTimeout( 500 );
	await page.locator( '#billing_address_2' ).fill( 'Suite 12' );
	const input = page.locator( '#billing_address_1' );
	await typeAddress( input, '1 Coll' );
	const list = page.locator( '#address_suggestions_billing_list' );
	await expect( list ).toBeVisible();
	await expect( pluginList( page ) ).toHaveCount( 0 );
	await list.locator( 'li' ).first().click();
	await expect( input ).toHaveValue( '1 Collins Street' );
	await expect( page.locator( '#billing_city' ) ).toHaveValue( 'Melbourne' );
	await expect( page.locator( '#billing_state' ) ).toHaveValue( 'VIC' );
	await expect( page.locator( '#billing_postcode' ) ).toHaveValue( '3000' );
	await expect( page.locator( '#billing_address_2' ) ).toHaveValue(
		'Suite 12'
	);
} );

test( '"Plugin\'s own list only": WooCommerce\'s list is not fed by the plugin', async ( {
	page,
} ) => {
	await setSettings( { suggestion_list: 'own' } );
	await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	await typeAddress( page.locator( '#shipping-address_1' ), '200 Geo' );
	await expect( pluginList( page ) ).toBeVisible();
	await expect( wcBlockList( page ) ).toHaveCount( 0 );
} );

test( '"WooCommerce built-in only" with WooCommerce\'s setting off: no list at all', async ( {
	page,
} ) => {
	await setSettings( { suggestion_list: 'builtin' } );
	await setWooCommerceAutocomplete( false );
	const google = await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	await typeAddress( page.locator( '#shipping-address_1' ), '200 Geo' );
	await page.waitForTimeout( 800 );
	await expect( pluginList( page ) ).toHaveCount( 0 );
	expect( google.autocomplete ).toHaveLength( 0 );
} );
