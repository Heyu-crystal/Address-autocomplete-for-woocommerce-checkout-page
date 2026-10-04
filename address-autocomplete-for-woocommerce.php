<?php
/**
 * Plugin Name:          Address Autocomplete for WooCommerce
 * Plugin URI:           https://github.com/heyu-crystal/address-autocomplete-for-wp-woocommerce-checkout-page
 * Description:          Google address suggestions for the WooCommerce checkout (block and classic) and My Account addresses. Picks an address and fills street, apartment, city, state, postcode and country into their own fields.
 * Version:              1.0.0
 * Author:               HeyU Jewellery
 * License:              MIT with Commons Clause
 * License URI:          https://github.com/heyu-crystal/address-autocomplete-for-wp-woocommerce-checkout-page/blob/main/LICENSE
 * Text Domain:          address-autocomplete-for-woocommerce
 * Domain Path:          /languages
 * Requires at least:    6.3
 * Requires PHP:         7.4
 * Requires Plugins:     woocommerce
 * WC requires at least: 8.0
 * WC tested up to:      11.1
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

define( 'AAFWC_VERSION', '1.0.0' );
define( 'AAFWC_FILE', __FILE__ );
define( 'AAFWC_URL', plugin_dir_url( __FILE__ ) );
define( 'AAFWC_DIR', plugin_dir_path( __FILE__ ) );

require_once AAFWC_DIR . 'includes/class-aafwc-settings.php';
require_once AAFWC_DIR . 'includes/class-aafwc-google.php';
require_once AAFWC_DIR . 'includes/class-aafwc-frontend.php';
require_once AAFWC_DIR . 'includes/class-aafwc-rest-proxy.php';
require_once AAFWC_DIR . 'includes/class-aafwc-admin.php';
require_once AAFWC_DIR . 'includes/class-aafwc-plugin.php';

// Declare compatibility with WooCommerce's order storage and the block checkout.
add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', __FILE__, true );
		}
	}
);

AAFWC_Plugin::init();
