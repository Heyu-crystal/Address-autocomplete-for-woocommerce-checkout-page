/**
 * Classic checkout, My Account addresses, cart shipping calculator and custom forms
 * (acceptance test 5).
 */
const { test, expect } = require( '@playwright/test' );
const { mockGoogle, fixture } = require( './utils/google-mock' );
const {
	setSettings,
	setWooCommerceAutocomplete,
	setTestMode,
	customerAddress,
	resetCustomer,
} = require( './utils/wp' );
const {
	openClassicCheckout,
	addToCart,
	typeAddress,
	pluginList,
	pickFromPluginList,
	waitForPlugin,
	login,
} = require( './utils/checkout' );

test.beforeEach( async () => {
	await setSettings();
	await setWooCommerceAutocomplete( false );
	await setTestMode( {} );
} );

async function expectClassic( page, type, e ) {
	await expect( page.locator( `#${ type }_address_1` ) ).toHaveValue(
		e.address_1
	);
	await expect( page.locator( `#${ type }_city` ) ).toHaveValue( e.city );
	await expect( page.locator( `#${ type }_postcode` ) ).toHaveValue(
		e.postcode
	);
	await expect( page.locator( `#${ type }_country` ) ).toHaveValue(
		e.country
	);
	if ( e.state ) {
		await expect( page.locator( `#${ type }_state` ) ).toHaveValue(
			e.state
		);
	}
}

test( 'classic checkout: AU address, selectWoo state shows the chosen state', async ( {
	page,
} ) => {
	const errors = [];
	page.on( 'pageerror', ( err ) => errors.push( err.message ) );
	await mockGoogle( page );
	await openClassicCheckout( page );
	await page.locator( '#billing_country' ).selectOption( 'AU' );
	await page.waitForTimeout( 500 );

	await typeAddress( page.locator( '#billing_address_1' ), '5/100 Mil' );
	await expect( pluginList( page ) ).toBeVisible();
	await pickFromPluginList( page, '5/100 Miller' );
	const e = fixture( 'au-unit' ).expected;
	await expectClassic( page, 'billing', e );
	await expect( page.locator( '#billing_address_2' ) ).toHaveValue( '5' );
	// selectWoo shows the chosen state.
	await expect(
		page.locator( '#select2-billing_state-container' )
	).toHaveText( /New South Wales/ );
	expect( errors ).toEqual( [] );
} );

test( 'classic checkout: different country (keyboard) rebuilds the state field', async ( {
	page,
} ) => {
	await setSettings( { restrict_to_selected: 'no' } );
	await mockGoogle( page );
	await openClassicCheckout( page );
	await page.locator( '#billing_country' ).selectOption( 'AU' );
	await page.waitForTimeout( 500 );

	const input = page.locator( '#billing_address_1' );
	await typeAddress( input, '1600 Amph' );
	await expect( pluginList( page ) ).toBeVisible();
	await input.press( 'ArrowDown' );
	await input.press( 'Enter' );
	await expectClassic( page, 'billing', fixture( 'us-california' ).expected );
	await expect( page ).toHaveURL( /classic-checkout/ );
	await expect(
		page.locator( '#select2-billing_state-container' )
	).toHaveText( /California/ );
} );

test( 'classic checkout: DE street order and free-text GB county', async ( {
	page,
} ) => {
	await mockGoogle( page );
	await openClassicCheckout( page );

	await page.locator( '#billing_country' ).selectOption( 'DE' );
	await page.waitForTimeout( 500 );
	await typeAddress( page.locator( '#billing_address_1' ), 'Unter den Li' );
	await pickFromPluginList( page, 'Unter den Linden 77' );
	await expectClassic( page, 'billing', fixture( 'de-berlin' ).expected );

	await page.locator( '#billing_country' ).selectOption( 'GB' );
	await page.waitForTimeout( 500 );
	await typeAddress( page.locator( '#billing_address_1' ), '10 Downi' );
	await pickFromPluginList( page, '10 Downing' );
	await expectClassic( page, 'billing', fixture( 'gb-london' ).expected );
} );

test( "classic checkout: the customer's own apartment stays", async ( {
	page,
} ) => {
	await mockGoogle( page );
	await openClassicCheckout( page );
	await page.locator( '#billing_country' ).selectOption( 'AU' );
	await page.waitForTimeout( 500 );
	await page.locator( '#billing_address_2' ).fill( 'Suite 12' );
	await typeAddress( page.locator( '#billing_address_1' ), '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( page.locator( '#billing_address_1' ) ).toHaveValue(
		'200 George Street'
	);
	await page.waitForTimeout( 800 );
	await expect( page.locator( '#billing_address_2' ) ).toHaveValue(
		'Suite 12'
	);
} );

test( 'My Account > Addresses: fill and save', async ( { page } ) => {
	await resetCustomer();
	await mockGoogle( page );
	await login( page );
	await page.goto( '/my-account/edit-address/shipping/' );
	await expect( page.locator( '#shipping_address_1' ) ).toBeVisible();
	await waitForPlugin( page );

	await typeAddress( page.locator( '#shipping_address_1' ), '1 Coll' );
	await pickFromPluginList( page, '1 Collins' );
	const e = fixture( 'au-vic' ).expected;
	await expectClassic( page, 'shipping', e );
	await page.locator( 'button[name="save_address"]' ).click();
	await page.waitForLoadState( 'domcontentloaded' );
	expect( await customerAddress( 'customer', 'shipping' ) ).toMatchObject( {
		address_1: e.address_1,
		city: e.city,
		state: e.state,
		postcode: e.postcode,
		country: e.country,
	} );
} );

test( 'cart shipping calculator: suggests places in the City field', async ( {
	page,
} ) => {
	const google = await mockGoogle( page );
	await addToCart( page );
	await page.goto( '/classic-cart/' );
	await waitForPlugin( page );
	await page.locator( '.shipping-calculator-button' ).click();
	await page
		.locator( '#calc_shipping_country' )
		.selectOption( 'AU', { force: true } );
	await page.waitForTimeout( 300 );
	const city = page.locator( '#calc_shipping_city' );
	await expect( city ).toBeVisible();
	await typeAddress( city, '1 Coll' );
	await pickFromPluginList( page, '1 Collins' );
	await expect( city ).toHaveValue( 'Melbourne' );
	await expect( page.locator( '#calc_shipping_postcode' ) ).toHaveValue(
		'3000'
	);
	await expect( page.locator( '#calc_shipping_state' ) ).toHaveValue( 'VIC' );
	expect( google.autocomplete[ 0 ].body.includedPrimaryTypes ).toEqual( [
		'(regions)',
	] );
} );

test( 'custom form from the "Custom address fields" setting', async ( {
	page,
} ) => {
	await setSettings( {
		custom_forms:
			'# My form\naddress_1: #my-street\naddress_2: #my-unit\ncity: #my-city\nstate: #my-state\npostcode: #my-postcode\ncountry: #my-country',
	} );
	await mockGoogle( page );
	await page.goto( '/custom-address-form/' );
	await waitForPlugin( page );
	await typeAddress( page.locator( '#my-street' ), '5/100 Mil' );
	await pickFromPluginList( page, '5/100 Miller' );
	await expect( page.locator( '#my-street' ) ).toHaveValue(
		'100 Miller Street'
	);
	await expect( page.locator( '#my-unit' ) ).toHaveValue( '5' );
	await expect( page.locator( '#my-city' ) ).toHaveValue( 'North Sydney' );
	await expect( page.locator( '#my-state' ) ).toHaveValue(
		'New South Wales'
	);
	await expect( page.locator( '#my-postcode' ) ).toHaveValue( '2060' );
} );

test( 'forms can be switched off', async ( { page } ) => {
	await setSettings( { form_classic: 'no' } );
	const google = await mockGoogle( page );
	await openClassicCheckout( page );
	await typeAddress( page.locator( '#billing_address_1' ), '200 Geo' );
	await page.waitForTimeout( 800 );
	await expect( pluginList( page ) ).toHaveCount( 0 );
	expect( google.autocomplete ).toHaveLength( 0 );
} );
