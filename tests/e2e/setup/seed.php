<?php
/**
 * Test shop for the end-to-end tests. Run with: wp eval-file tests/e2e/setup/seed.php
 *
 * Creates a product, free shipping everywhere, cash on delivery, a classic (shortcode)
 * checkout page, a customer with a saved address, and default plugin settings.
 * Safe to run more than once.
 *
 * @package AddressAutocompleteForWooCommerce
 */

// phpcs:disable WordPress.WP.GlobalVariablesOverride.Prohibited

update_option( 'woocommerce_default_country', 'AU:NSW' );
update_option( 'woocommerce_currency', 'AUD' );
update_option( 'woocommerce_allowed_countries', 'all' );
update_option( 'woocommerce_ship_to_countries', '' );
update_option( 'woocommerce_ship_to_destination', 'shipping' );
update_option( 'woocommerce_enable_guest_checkout', 'yes' );
update_option( 'woocommerce_enable_checkout_login_reminder', 'no' );
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_store_pages_only', 'no' );
update_option( 'woocommerce_task_list_hidden', 'yes' );
update_option( 'woocommerce_onboarding_profile', array( 'skipped' => true ) );
update_option( 'woocommerce_checkout_address_2_field', 'optional' );
update_option( 'woocommerce_address_autocomplete_enabled', 'no' );
update_option( 'woocommerce_enable_shipping_calc', 'yes' );
update_option( 'woocommerce_shipping_cost_requires_address', 'no' );

update_option(
	'woocommerce_cod_settings',
	array(
		'enabled'            => 'yes',
		'title'              => 'Cash on delivery',
		'description'        => 'Pay with cash upon delivery.',
		'instructions'       => '',
		'enable_for_methods' => array(),
		'enable_for_virtual' => 'yes',
	)
);

// Free shipping everywhere ("Locations not covered by your other zones").
$aafwc_zone = WC_Shipping_Zones::get_zone( 0 );
if ( $aafwc_zone ) {
	$aafwc_has_free = false;
	foreach ( $aafwc_zone->get_shipping_methods() as $aafwc_method ) {
		$aafwc_has_free = $aafwc_has_free || 'free_shipping' === $aafwc_method->id;
	}
	if ( ! $aafwc_has_free ) {
		$aafwc_zone->add_shipping_method( 'free_shipping' );
	}
}

// Product.
$aafwc_product_id = (int) get_option( 'aafwc_e2e_product_id' );
if ( ! $aafwc_product_id || ! wc_get_product( $aafwc_product_id ) ) {
	$aafwc_product = new WC_Product_Simple();
	$aafwc_product->set_name( 'Test Ring' );
	$aafwc_product->set_regular_price( '10' );
	$aafwc_product->set_status( 'publish' );
	$aafwc_product->set_virtual( false );
	$aafwc_product_id = $aafwc_product->save();
	update_option( 'aafwc_e2e_product_id', $aafwc_product_id );
}

// Classic (shortcode) checkout page.
$aafwc_classic = get_page_by_path( 'classic-checkout' );
if ( ! $aafwc_classic ) {
	wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 'Classic checkout',
			'post_name'    => 'classic-checkout',
			'post_content' => '<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->',
		)
	);
}

// Classic cart page (for the shipping calculator).
if ( ! get_page_by_path( 'classic-cart' ) ) {
	wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 'Classic cart',
			'post_name'    => 'classic-cart',
			'post_content' => '<!-- wp:shortcode -->[woocommerce_cart]<!-- /wp:shortcode -->',
		)
	);
}

// A non-WooCommerce form, for the "Custom address fields" setting.
if ( ! get_page_by_path( 'custom-address-form' ) ) {
	wp_insert_post(
		array(
			'post_type'    => 'page',
			'post_status'  => 'publish',
			'post_title'   => 'Custom address form',
			'post_name'    => 'custom-address-form',
			'post_content' => '<!-- wp:html --><form id="my-form" onsubmit="return false"><p><label for="my-street">Street</label><input id="my-street" type="text"></p><p><label for="my-unit">Unit</label><input id="my-unit" type="text"></p><p><label for="my-city">City</label><input id="my-city" type="text"></p><p><label for="my-state">State</label><input id="my-state" type="text"></p><p><label for="my-postcode">Postcode</label><input id="my-postcode" type="text"></p><p><label for="my-country">Country</label><select id="my-country"><option value="AU">Australia</option><option value="US">United States</option></select></p></form><!-- /wp:html -->',
		)
	);
}

// Customer with a saved address.
$aafwc_user = get_user_by( 'login', 'customer' );
if ( ! $aafwc_user ) {
	$aafwc_user_id = wc_create_new_customer( 'customer@example.com', 'customer', 'password' );
} else {
	$aafwc_user_id = $aafwc_user->ID;
}
if ( ! is_wp_error( $aafwc_user_id ) ) {
	$aafwc_customer = new WC_Customer( $aafwc_user_id );
	$aafwc_customer->set_first_name( 'Casey' );
	$aafwc_customer->set_last_name( 'Customer' );
	foreach ( array( 'billing', 'shipping' ) as $aafwc_type ) {
		$aafwc_customer->{"set_{$aafwc_type}_first_name"}( 'Casey' );
		$aafwc_customer->{"set_{$aafwc_type}_last_name"}( 'Customer' );
		$aafwc_customer->{"set_{$aafwc_type}_address_1"}( '1 Old Street' );
		$aafwc_customer->{"set_{$aafwc_type}_city"}( 'Melbourne' );
		$aafwc_customer->{"set_{$aafwc_type}_state"}( 'VIC' );
		$aafwc_customer->{"set_{$aafwc_type}_postcode"}( '3000' );
		$aafwc_customer->{"set_{$aafwc_type}_country"}( 'AU' );
	}
	$aafwc_customer->set_billing_email( 'customer@example.com' );
	$aafwc_customer->set_billing_phone( '0400000000' );
	$aafwc_customer->save();
}

// Plugin defaults for the tests (each test may change them).
update_option(
	'woocommerce_aafwc_settings',
	array(
		'enabled'              => 'yes',
		'api_key'              => 'TEST_KEY',
		'request_mode'         => 'browser',
		'suggestion_list'      => 'auto',
		'form_block'           => 'yes',
		'form_classic'         => 'yes',
		'form_account'         => 'yes',
		'form_calculator'      => 'yes',
		'restrict_to_selected' => 'yes',
		'countries'            => '',
		'language'             => 'en',
		'street_name'          => 'long',
		'unit_format'          => 'separate',
		'min_chars'            => '3',
		'debounce'             => '50',
	)
);

update_option( 'permalink_structure', '/%postname%/' );
flush_rewrite_rules();
WP_CLI::success( 'Seeded. Product id: ' . $aafwc_product_id );
