/**
 * Keyboard-only use and the ARIA combobox pattern (acceptance test 10).
 * A real screen reader pass (NVDA/VoiceOver) is still a manual check before release.
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
	openClassicCheckout,
	pluginOptions,
	selectBlockCountry,
} = require( './utils/checkout' );

test.beforeEach( async () => {
	await setSettings();
	await setWooCommerceAutocomplete( false );
	await setTestMode( {} );
} );

test( '10. combobox roles, states and announcements; keyboard only', async ( {
	page,
} ) => {
	await mockGoogle( page );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	const input = page.locator( '#shipping-address_1' );

	// Reach the field with Tab only (after the country change has re-rendered the form).
	await page.waitForLoadState( 'networkidle' );
	const lastName = page.locator( '#shipping-last_name' );
	await lastName.click();
	await expect( lastName ).toBeFocused();
	await page.keyboard.press( 'Tab' );
	await expect( input ).toBeFocused();
	await expect( input ).toHaveAttribute( 'role', 'combobox' );
	await expect( input ).toHaveAttribute( 'aria-autocomplete', 'list' );
	await expect( input ).toHaveAttribute( 'aria-expanded', 'false' );
	await expect( input ).toHaveAttribute( 'aria-controls', 'aafwc-listbox' );

	await page.keyboard.type( '1 Coll', { delay: 40 } );
	const listbox = page.locator( '#aafwc-listbox' );
	await expect( listbox ).toBeVisible();
	await expect( listbox ).toHaveAttribute( 'role', 'listbox' );
	await expect( listbox ).toHaveAttribute(
		'aria-label',
		'Address suggestions'
	);
	await expect( input ).toHaveAttribute( 'aria-expanded', 'true' );
	await expect( pluginOptions( page ).first() ).toHaveAttribute(
		'role',
		'option'
	);
	await expect( pluginOptions( page ).first() ).toHaveAttribute(
		'aria-selected',
		'false'
	);

	// Live region announces the number of suggestions.
	await expect( page.locator( '#aafwc-status' ) ).toHaveText(
		/1 address suggestion available/
	);
	await expect( page.locator( '#aafwc-status' ) ).toHaveAttribute(
		'aria-live',
		'polite'
	);

	// Arrow keys move the active option.
	await page.keyboard.press( 'ArrowDown' );
	await expect( input ).toHaveAttribute(
		'aria-activedescendant',
		'aafwc-option-0'
	);
	await expect( pluginOptions( page ).first() ).toHaveAttribute(
		'aria-selected',
		'true'
	);

	// Escape closes without filling.
	await page.keyboard.press( 'Escape' );
	await expect( input ).toHaveAttribute( 'aria-expanded', 'false' );
	await expect( input ).not.toHaveAttribute( 'aria-activedescendant', /.+/ );
	await expect( input ).toHaveValue( '1 Coll' );

	// Type again, choose with Enter.
	await page.keyboard.type( 'i', { delay: 40 } );
	await expect( listbox ).toBeVisible();
	await page.keyboard.press( 'ArrowDown' );
	await page.keyboard.press( 'Enter' );
	await expect( input ).toHaveValue( '1 Collins Street' );
	await expect( page.locator( '#shipping-state' ) ).toHaveValue( 'VIC' );
	await expect( page.locator( '#aafwc-status' ) ).toHaveText(
		'Address filled in.'
	);

	// Tab closes the list and moves on.
	await page.keyboard.type( 'x', { delay: 40 } );
	await page.keyboard.press( 'Tab' );
	await expect( input ).not.toBeFocused();
	await expect( page.locator( '.aafwc.is-open' ) ).toHaveCount( 0 );
} );

test( 'RTL pages get a right-to-left list', async ( { page } ) => {
	await mockGoogle( page );
	await openClassicCheckout( page );
	await page.evaluate( () =>
		document.documentElement.setAttribute( 'dir', 'rtl' )
	);
	await page.locator( '#billing_country' ).selectOption( 'AU' );
	await page.waitForTimeout( 500 );
	await page.locator( '#billing_address_1' ).click();
	await page.keyboard.type( '1 Coll', { delay: 40 } );
	await expect( page.locator( '.aafwc.is-open' ) ).toHaveAttribute(
		'dir',
		'rtl'
	);
	const box = await page.locator( '.aafwc.is-open' ).boundingBox();
	const field = await page.locator( '#billing_address_1' ).boundingBox();
	expect( Math.abs( box.x - field.x ) ).toBeLessThan( 2 );
	expect( Math.abs( box.width - field.width ) ).toBeLessThan( 2 );
} );

test( 'the list stays under the field when the page scrolls', async ( {
	page,
} ) => {
	await mockGoogle( page );
	await page.setViewportSize( { width: 390, height: 700 } );
	await openBlockCheckout( page );
	await selectBlockCountry( page, 'shipping', 'AU' );
	const input = page.locator( '#shipping-address_1' );
	await input.scrollIntoViewIfNeeded();
	await input.click();
	await page.keyboard.type( '1 Coll', { delay: 40 } );
	const list = page.locator( '.aafwc.is-open' );
	await expect( list ).toBeVisible();
	await page.mouse.wheel( 0, 60 );
	await page.waitForTimeout( 300 );
	const box = await list.boundingBox();
	const field = await input.boundingBox();
	if ( box ) {
		const touching =
			Math.abs( box.y - ( field.y + field.height ) ) < 8 ||
			Math.abs( box.y + box.height - field.y ) < 8;
		expect( touching ).toBe( true );
	}
} );
