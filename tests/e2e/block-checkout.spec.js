/**
 * Block checkout (acceptance tests 1-4, 6).
 */
const { test, expect } = require( '@playwright/test' );
const { mockGoogle, fixture } = require( './utils/google-mock' );
const {
	setSettings,
	setWooCommerceAutocomplete,
	setTestMode,
	orderAddress,
	resetCustomer,
} = require( './utils/wp' );
const {
	addToCart,
	waitForPlugin,
	openBlockCheckout,
	typeAddress,
	pluginList,
	pickFromPluginList,
	blockStoreAddress,
	selectBlockCountry,
	fillBlockContact,
	placeBlockOrder,
	login,
} = require( './utils/checkout' );

test.beforeEach( async () => {
	await setSettings();
	await setWooCommerceAutocomplete( false );
	await setTestMode( {} );
} );

test( '1. guest, AU address picked with the mouse: every field filled, kept and saved', async ( {
	page,
} ) => {
	const google = await mockGoogle( page );
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( e.message ) );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );

	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '5/100 Mil' );
	await expect( pluginList( page ) ).toBeVisible();
	await expect( page.locator( '.aafwc__attribution' ) ).toHaveText(
		'Google Maps'
	);
	await pickFromPluginList( page, '5/100 Miller' );

	const e = fixture( 'au-unit' ).expected;
	await expect( input ).toHaveValue( e.address_1 );
	await expect( page.locator( '#shipping-address_2' ) ).toHaveValue(
		e.address_2
	);
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( e.city );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( e.state );
	await expect( page.locator( '#shipping-postcode' ) ).toHaveValue(
		e.postcode
	);
	await expect( page.locator( '#shipping-country' ) ).toHaveValue(
		e.country
	);

	// Kept after the block checkout re-renders (it pushes the address to the server).
	await page.waitForTimeout( 2500 );
	await expect( input ).toHaveValue( e.address_1 );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( e.state );
	const stored = await blockStoreAddress( page );
	expect( stored ).toMatchObject( {
		address_1: e.address_1,
		address_2: e.address_2,
		city: e.city,
		state: e.state,
		postcode: e.postcode,
		country: e.country,
	} );

	// One billing session: the details request reuses the autocomplete session token.
	const token =
		google.autocomplete[ google.autocomplete.length - 1 ].body.sessionToken;
	expect( token ).toBeTruthy();
	expect( google.details ).toHaveLength( 1 );
	expect( google.details[ 0 ].sessionToken ).toBe( token );
	expect( google.details[ 0 ].headers[ 'x-goog-fieldmask' ] ).toBe(
		'addressComponents,formattedAddress'
	);
	expect( google.autocomplete[ 0 ].body.includedRegionCodes ).toEqual( [
		'au',
	] );

	await fillBlockContact( page );
	const orderId = await placeBlockOrder( page );
	expect( await orderAddress( orderId, 'shipping' ) ).toMatchObject( {
		address_1: e.address_1,
		address_2: e.address_2,
		city: e.city,
		state: e.state,
		postcode: e.postcode,
		country: e.country,
	} );
	expect( errors ).toEqual( [] );
} );

test( '2. different country picked with the keyboard: country, state list and state switch; Enter does not submit', async ( {
	page,
} ) => {
	await setSettings( { restrict_to_selected: 'no' } );
	await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );

	let submitted = false;
	page.on( 'request', ( r ) => {
		if (
			r.method() === 'POST' &&
			/wc\/store\/v1\/checkout/.test( r.url() )
		) {
			submitted = true;
		}
	} );

	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '1600 Amph' );
	await expect( pluginList( page ) ).toBeVisible();
	await input.press( 'ArrowDown' );
	await expect( input ).toHaveAttribute(
		'aria-activedescendant',
		'aafwc-option-0'
	);
	await input.press( 'Enter' );

	const e = fixture( 'us-california' ).expected;
	await expect( page.locator( '#shipping-country' ) ).toHaveValue( 'US' );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( e.state );
	await expect( input ).toHaveValue( e.address_1 );
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( e.city );
	await expect( page.locator( '#shipping-postcode' ) ).toHaveValue(
		e.postcode
	);
	await page.waitForTimeout( 1500 );
	expect( submitted ).toBe( false );
	await expect( page ).toHaveURL( /\/checkout\/?$/ );
	expect( await blockStoreAddress( page ) ).toMatchObject( {
		country: 'US',
		state: 'CA',
		city: e.city,
	} );
} );

test( '3. house number after the street (DE) and a free-text county (GB)', async ( {
	page,
} ) => {
	await mockGoogle( page );
	await openBlockCheckout( page );

	await selectBlockCountry( page, 'shipping', 'DE' );
	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, 'Unter den Li' );
	await pickFromPluginList( page, 'Unter den Linden 77' );
	await expect( input ).toHaveValue( 'Unter den Linden 77' );
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( 'Berlin' );
	await expect( page.locator( '#shipping-postcode' ) ).toHaveValue( '10117' );
	const deState = page.locator( '#shipping-state' );
	if ( await deState.count() ) {
		await expect( deState ).toHaveValue( 'DE-BE' );
	}

	await selectBlockCountry( page, 'shipping', 'GB' );
	await typeAddress( input, '10 Downi' );
	await pickFromPluginList( page, '10 Downing' );
	await expect( input ).toHaveValue( '10 Downing Street' );
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( 'London' );
	await expect( page.locator( '#shipping-postcode' ) ).toHaveValue(
		'SW1A 2AA'
	);
	const gbState = page.locator( '#shipping-state' );
	if ( await gbState.count() ) {
		expect( await gbState.evaluate( ( el ) => el.tagName ) ).toBe(
			'INPUT'
		);
		await expect( gbState ).toHaveValue( 'Greater London' );
	}
	expect( await blockStoreAddress( page ) ).toMatchObject( {
		country: 'GB',
		city: 'London',
		postcode: 'SW1A 2AA',
	} );
} );

test( '4. logged-in customer with a saved address: Edit, type, fill', async ( {
	page,
} ) => {
	await resetCustomer();
	await mockGoogle( page );
	await login( page );
	await addToCart( page );
	await page.goto( '/checkout/' );
	await waitForPlugin( page );
	// WooCommerce redraws the saved-address card right after loading; let it settle.
	await page.waitForLoadState( 'networkidle' );
	const edit = page
		.locator( '.wc-block-components-address-card__edit' )
		.first();
	if ( await edit.isVisible().catch( () => false ) ) {
		await edit.click();
		await page.waitForLoadState( 'networkidle' );
	}
	const input = page.locator( '#shipping-address_1' );
	await expect( input ).toBeVisible();
	await expect( input ).toHaveValue( '1 Old Street' );
	await typeAddress( input, '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( input ).toHaveValue( '200 George Street' );
	await expect( page.locator( '#shipping-city' ) ).toHaveValue( 'Sydney' );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( 'NSW' );
	await expect( page.locator( '#shipping-postcode' ) ).toHaveValue( '2000' );
	expect( await blockStoreAddress( page ) ).toMatchObject( {
		address_1: '200 George Street',
		state: 'NSW',
		city: 'Sydney',
	} );
} );

test( "6. the customer's own apartment is never erased", async ( { page } ) => {
	await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );

	const toggle = page
		.locator( '.wc-block-components-address-form__address_2-toggle' )
		.first();
	if ( await toggle.isVisible().catch( () => false ) ) {
		await toggle.click();
	}
	const unit = page.locator( '#shipping-address_2' );
	await unit.fill( 'Level 9' );

	const input = page.locator( '#shipping-address_1' );
	await typeAddress( input, '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( input ).toHaveValue( '200 George Street' );
	await page.waitForTimeout( 800 );
	await expect( unit ).toHaveValue( 'Level 9' );

	// Google's unit does not replace the customer's own either.
	await typeAddress( input, '5/100 Mil' );
	await pickFromPluginList( page, '5/100 Miller' );
	await expect( input ).toHaveValue( '100 Miller Street' );
	await page.waitForTimeout( 800 );
	await expect( unit ).toHaveValue( 'Level 9' );

	// A unit the plugin filled is cleared when the next address has none.
	await unit.fill( '' );
	await typeAddress( input, '5/100 Mil' );
	await pickFromPluginList( page, '5/100 Miller' );
	await expect( unit ).toHaveValue( '5' );
	await typeAddress( input, '200 Geo' );
	await pickFromPluginList( page, '200 George' );
	await expect( input ).toHaveValue( '200 George Street' );
	await expect( unit ).toHaveValue( '' );
	expect( ( await blockStoreAddress( page ) ).address_2 ).toBe( '' );
} );
