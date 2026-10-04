/**
 * Page helpers for the checkout and account forms.
 */
const { expect } = require( '@playwright/test' );
const { productId } = require( './wp' );

let cachedProductId = null;

async function addToCart( page ) {
	cachedProductId = cachedProductId || ( await productId() );
	// Add it on the cart page, so the "added to your cart" notice is shown (and used up)
	// there: on the checkout, WooCommerce moves the focus to that notice after loading,
	// which cuts off whatever is being typed.
	await page.goto( '/cart/?add-to-cart=' + cachedProductId );
}

async function openBlockCheckout( page ) {
	await addToCart( page );
	await page.goto( '/checkout/' );
	await expect( page.locator( '#shipping-address_1' ) ).toBeVisible();
	await waitForPlugin( page );
	await page.waitForLoadState( 'networkidle' );
}

/**
 * Wait until the block checkout has finished saving the address.
 *
 * WooCommerce sends address changes to the server (a new country at once, other fields
 * after a 1.5 s pause) and redraws the form with the answer; typing during a redraw is lost.
 *
 * @param {import('@playwright/test').Page} page Page.
 */
async function waitForCheckoutIdle( page ) {
	await page.waitForTimeout( 1600 );
	await page.waitForFunction( () => {
		const data = window.wp && window.wp.data;
		const cart = data && data.select( 'wc/store/cart' );
		if ( ! cart ) {
			return true;
		}
		const updatingRates =
			typeof cart.isAddressFieldsForShippingRatesUpdating ===
				'function' && cart.isAddressFieldsForShippingRatesUpdating();
		return ! cart.isCustomerDataUpdating() && ! updatingRates;
	} );
	await page.waitForLoadState( 'networkidle' );
}

async function openClassicCheckout( page ) {
	await addToCart( page );
	await page.goto( '/classic-checkout/' );
	await expect( page.locator( '#billing_address_1' ) ).toBeVisible();
	await waitForPlugin( page );
}

async function waitForPlugin( page ) {
	await page.waitForFunction( () => window.AAFWC && window.AAFWC.ready );
}

/**
 * Type like a person (trusted key events), so the plugin searches.
 *
 * @param {import('@playwright/test').Locator} input Field.
 * @param {string}                             text  Text.
 */
async function typeAddress( input, text ) {
	// If the checkout redraws mid-typing, the browser drops the keys: type again.
	for ( let attempt = 0; attempt < 3; attempt++ ) {
		await input.click();
		await input.fill( '' );
		await input.pressSequentially( text, { delay: 40 } );
		const landed = await input.evaluate(
			( el, expected ) =>
				el.value === expected && el.ownerDocument.activeElement === el,
			text
		);
		if ( landed ) {
			return;
		}
	}
	await expect( input ).toHaveValue( text );
	await expect( input ).toBeFocused();
}

function pluginList( page ) {
	return page.locator( '.aafwc.is-open' );
}

function pluginOptions( page ) {
	return page.locator( '.aafwc.is-open .aafwc__item' );
}

async function pickFromPluginList( page, textPart ) {
	const option = pluginOptions( page )
		.filter( { hasText: textPart } )
		.first();
	await expect( option ).toBeVisible();
	await option.click();
}

/**
 * The block checkout's saved state (what WooCommerce will submit).
 *
 * @param {import('@playwright/test').Page} page Page.
 * @param {string}                          type 'shipping' or 'billing'.
 * @return {Promise<Object>} Address in the cart store.
 */
async function blockStoreAddress( page, type = 'shipping' ) {
	return page.evaluate( ( t ) => {
		const data = window.wp.data.select( 'wc/store/cart' ).getCustomerData();
		return data[ t + 'Address' ];
	}, type );
}

async function selectBlockCountry( page, type, country ) {
	const select = page.locator( `#${ type }-country` );
	if ( ( await select.inputValue() ) === country ) {
		return;
	}
	await select.selectOption( country );
	await waitForCheckoutIdle( page );
}

async function fillBlockContact( page ) {
	const email = page.locator( '#email' );
	if ( await email.isVisible() ) {
		await email.fill( 'guest@example.com' );
	}
	await page.locator( '#shipping-first_name' ).fill( 'Test' );
	await page.locator( '#shipping-last_name' ).fill( 'Buyer' );
}

/**
 * Place the order on the block checkout and return its id.
 *
 * @param {import('@playwright/test').Page} page Page.
 * @return {Promise<string>} Order id.
 */
async function placeBlockOrder( page ) {
	await page
		.locator( '.wc-block-components-checkout-place-order-button' )
		.click();
	await page.waitForURL( /order-received\/(\d+)/, { timeout: 45000 } );
	return /order-received\/(\d+)/.exec( page.url() )[ 1 ];
}

async function login( page, user = 'customer', password = 'password' ) {
	await page.goto( '/wp-login.php' );
	await page.locator( '#user_login' ).fill( user );
	await page.locator( '#user_pass' ).fill( password );
	await Promise.all( [
		page.waitForURL( ( url ) => ! url.pathname.includes( 'wp-login.php' ), {
			timeout: 30000,
		} ),
		page.locator( '#wp-submit' ).click(),
	] );
}

module.exports = {
	addToCart,
	openBlockCheckout,
	openClassicCheckout,
	waitForPlugin,
	typeAddress,
	pluginList,
	pluginOptions,
	pickFromPluginList,
	blockStoreAddress,
	selectBlockCountry,
	waitForCheckoutIdle,
	fillBlockContact,
	placeBlockOrder,
	login,
};
