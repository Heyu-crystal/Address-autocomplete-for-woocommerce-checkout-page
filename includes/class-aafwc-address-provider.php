<?php
/**
 * Google as a provider for WooCommerce's built-in address autocomplete (WooCommerce 10.3+).
 *
 * Only loaded when WooCommerce has the WC_Address_Provider class.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Server-side half of the provider. The browser half is assets/js/wc-address-provider.js.
 */
class AAFWC_Address_Provider extends WC_Address_Provider {

	/**
	 * Set the id, name and the required Google attribution.
	 */
	public function __construct() {
		$this->id   = AAFWC_Settings::PROVIDER_ID;
		$this->name = __( 'Google (Address Autocomplete for WooCommerce)', 'address-autocomplete-for-woocommerce' );
		// Google requires this attribution when Places results are shown without a Google map.
		$this->branding_html = '<span class="aafwc-branding" style="font-family:Roboto,Arial,sans-serif;font-size:12px;color:#5e5e5e">'
			/* translators: Required attribution for Google's data. Keep the product name "Google Maps" unchanged. */
			. esc_html__( 'Google Maps', 'address-autocomplete-for-woocommerce' )
			. '</span>';
	}
}
