<?php
/**
 * Wires everything together.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Plugin bootstrap.
 */
class AAFWC_Plugin {

	/**
	 * Hook in.
	 */
	public static function init() {
		add_action( 'plugins_loaded', array( __CLASS__, 'plugins_loaded' ) );
		add_action( 'init', array( __CLASS__, 'load_textdomain' ) );
		register_activation_hook( AAFWC_FILE, array( 'AAFWC_Settings', 'maybe_import_legacy' ) );
	}

	/**
	 * Translations shipped in /languages (WordPress.org language packs take precedence).
	 */
	public static function load_textdomain() {
		load_plugin_textdomain( 'address-autocomplete-for-woocommerce', false, dirname( plugin_basename( AAFWC_FILE ) ) . '/languages' );
	}

	/**
	 * Start once WooCommerce is loaded.
	 */
	public static function plugins_loaded() {
		if ( ! class_exists( 'WooCommerce' ) || ! class_exists( 'WC_Integration' ) ) {
			add_action( 'admin_notices', array( __CLASS__, 'missing_woocommerce_notice' ) );
			return;
		}

		AAFWC_Settings::maybe_import_legacy();

		require_once AAFWC_DIR . 'includes/class-aafwc-integration.php';
		add_filter(
			'woocommerce_integrations',
			function ( $integrations ) {
				$integrations[] = 'AAFWC_Integration';
				return $integrations;
			}
		);

		// WooCommerce's built-in address autocomplete (WooCommerce 10.3+).
		if ( class_exists( 'WC_Address_Provider' ) ) {
			require_once AAFWC_DIR . 'includes/class-aafwc-address-provider.php';
			add_filter( 'woocommerce_address_providers', array( __CLASS__, 'register_provider' ) );
		}

		AAFWC_Frontend::init();
		AAFWC_REST_Proxy::init();
		if ( is_admin() ) {
			AAFWC_Admin::init();
		}
	}

	/**
	 * Add Google to WooCommerce's address providers (unless "Plugin's own list only").
	 *
	 * @param array $providers Providers (class names or instances).
	 * @return array
	 */
	public static function register_provider( $providers ) {
		if ( AAFWC_Settings::register_as_provider() ) {
			$providers   = is_array( $providers ) ? $providers : array();
			$providers[] = new AAFWC_Address_Provider();
		}
		return $providers;
	}

	/**
	 * Admin notice when WooCommerce is missing.
	 */
	public static function missing_woocommerce_notice() {
		if ( ! current_user_can( 'activate_plugins' ) ) {
			return;
		}
		echo '<div class="notice notice-error"><p>' . esc_html__( 'Address Autocomplete for WooCommerce needs WooCommerce to be installed and active.', 'address-autocomplete-for-woocommerce' ) . '</p></div>';
	}
}
