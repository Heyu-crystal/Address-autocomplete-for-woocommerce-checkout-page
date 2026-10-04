<?php
/**
 * Front-end scripts, styles and the browser configuration.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Loads the assets and prints the configuration.
 */
class AAFWC_Frontend {

	/**
	 * Whether this page loads the plugin (set while enqueuing).
	 *
	 * @var bool
	 */
	private static $loaded = false;

	/**
	 * Hook in.
	 */
	public static function init() {
		// After WooCommerce registers its scripts (10) and the block checkout dequeues some (20).
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 30 );
		add_action( 'wp_footer', array( __CLASS__, 'print_config' ), 5 );
	}

	/**
	 * Should this page load the assets?
	 *
	 * @return bool
	 */
	private static function should_load() {
		$load = true;
		if ( 'woocommerce_pages' === AAFWC_Settings::get( 'load_assets' ) ) {
			$load = ( function_exists( 'is_checkout' ) && is_checkout() )
				|| ( function_exists( 'is_account_page' ) && is_account_page() )
				|| ( function_exists( 'is_cart' ) && is_cart() )
				|| self::post_has_address_form();
		}
		/**
		 * Filter whether the current page loads the address autocomplete assets.
		 *
		 * @param bool $load Load the assets.
		 */
		return (bool) apply_filters( 'aafwc_load_assets', $load );
	}

	/**
	 * Does the current post contain a checkout, cart or account block or shortcode?
	 *
	 * @return bool
	 */
	private static function post_has_address_form() {
		$post = get_post();
		if ( ! $post instanceof WP_Post ) {
			return false;
		}
		foreach ( array( 'woocommerce/checkout', 'woocommerce/cart', 'woocommerce/customer-account' ) as $block ) {
			if ( has_block( $block, $post ) ) {
				return true;
			}
		}
		foreach ( array( 'woocommerce_checkout', 'woocommerce_cart', 'woocommerce_my_account' ) as $shortcode ) {
			if ( has_shortcode( $post->post_content, $shortcode ) ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Enqueue the scripts and styles.
	 */
	public static function enqueue() {
		if ( is_admin() || ! AAFWC_Settings::is_active() || ! self::should_load() ) {
			return;
		}
		self::$loaded = true;

		wp_enqueue_style( 'aafwc', AAFWC_URL . 'assets/css/address-autocomplete.css', array(), AAFWC_VERSION );
		$css = self::colour_css();
		if ( '' !== $css ) {
			wp_add_inline_style( 'aafwc', $css );
		}

		wp_register_script( 'aafwc-parser', AAFWC_URL . 'assets/js/address-parser.js', array(), AAFWC_VERSION, array( 'in_footer' => true ) );
		wp_enqueue_script( 'aafwc', AAFWC_URL . 'assets/js/address-autocomplete.js', array( 'aafwc-parser' ), AAFWC_VERSION, array( 'in_footer' => true ) );

		// The provider for WooCommerce's built-in address autocomplete, on its own handle.
		// WooCommerce only registers `wc-address-autocomplete-common` when its setting is on
		// and a provider exists; never attach to `wc-address-autocomplete`, which the block
		// checkout dequeues.
		if ( AAFWC_Settings::register_as_provider() && wp_script_is( 'wc-address-autocomplete-common', 'registered' ) ) {
			wp_enqueue_script(
				'aafwc-wc-provider',
				AAFWC_URL . 'assets/js/wc-address-provider.js',
				array( 'aafwc', 'wc-address-autocomplete-common' ),
				AAFWC_VERSION,
				array( 'in_footer' => true )
			);
		}
	}

	/**
	 * CSS variables from the colour settings.
	 *
	 * @return string
	 */
	private static function colour_css() {
		$map  = array(
			'color_background' => array( '--aafwc-bg' ),
			'color_text'       => array( '--aafwc-text' ),
			'color_hover'      => array( '--aafwc-hover' ),
		);
		$vars = '';
		foreach ( $map as $key => $properties ) {
			$colour = sanitize_hex_color( AAFWC_Settings::get( $key ) );
			if ( $colour ) {
				foreach ( $properties as $property ) {
					$vars .= $property . ':' . $colour . ';';
				}
			}
		}
		return '' === $vars ? '' : '.aafwc{' . $vars . '}';
	}

	/**
	 * Settings for the browser.
	 *
	 * @return array
	 */
	public static function config() {
		$settings = AAFWC_Settings::all();
		$request  = array( 'proxy' => false );
		if ( 'proxy' === $settings['request_mode'] ) {
			$request = array(
				'proxy' => true,
				'url'   => esc_url_raw( rest_url( AAFWC_REST_Proxy::NAMESPACE_V1 . '/' ) ),
				'nonce' => wp_create_nonce( 'wp_rest' ),
			);
		} else {
			$request['apiKey'] = trim( $settings['api_key'] );
		}

		$config = array(
			'version'            => AAFWC_VERSION,
			'mode'               => in_array( $settings['suggestion_list'], array( 'auto', 'builtin', 'own' ), true ) ? $settings['suggestion_list'] : 'auto',
			'providerId'         => AAFWC_Settings::PROVIDER_ID,
			'request'            => $request,
			'countries'          => AAFWC_Settings::countries(),
			'restrictToSelected' => 'yes' === $settings['restrict_to_selected'],
			'language'           => AAFWC_Settings::language(),
			'minChars'           => max( 1, min( 10, absint( $settings['min_chars'] ) ) ),
			'debounce'           => min( 2000, absint( $settings['debounce'] ) ),
			'forms'              => array(
				'block'      => 'yes' === $settings['form_block'],
				'classic'    => 'yes' === $settings['form_classic'],
				'account'    => 'yes' === $settings['form_account'],
				'calculator' => 'yes' === $settings['form_calculator'],
			),
			'customForms'        => AAFWC_Settings::custom_forms(),
			'streetName'         => 'short' === $settings['street_name'] ? 'short' : 'long',
			'unitFormat'         => 'combined' === $settings['unit_format'] ? 'combined' : 'separate',
			/**
			 * Filter the per-country parsing rules (see assets/js/address-parser.js).
			 *
			 * Example: use the suburb as the city in New Zealand.
			 *
			 *     add_filter( 'aafwc_country_rules', function ( $rules ) {
			 *         $rules['NZ'] = array( 'cityTypes' => array( 'sublocality_level_1', 'locality' ) );
			 *         return $rules;
			 *     } );
			 *
			 * @param array $rules Map of country code => partial rules.
			 */
			'rules'              => (object) apply_filters( 'aafwc_country_rules', array() ),
			'consentCategory'    => (string) $settings['consent_category'],
			'debug'              => current_user_can( 'manage_woocommerce' ),
			'i18n'               => array(
				'listLabel'   => __( 'Address suggestions', 'address-autocomplete-for-woocommerce' ),
				/* translators: Required attribution for Google's data. Keep the product name "Google Maps" unchanged. */
				'attribution' => __( 'Google Maps', 'address-autocomplete-for-woocommerce' ),
				/* translators: %d: number of suggestions (always 1). */
				'resultsOne'  => __( '%d address suggestion available. Use the up and down arrow keys to review it and Enter to select it.', 'address-autocomplete-for-woocommerce' ),
				/* translators: %d: number of suggestions. */
				'resultsMany' => __( '%d address suggestions available. Use the up and down arrow keys to review them and Enter to select one.', 'address-autocomplete-for-woocommerce' ),
				'filled'      => __( 'Address filled in.', 'address-autocomplete-for-woocommerce' ),
			),
		);

		/**
		 * Filter the configuration passed to the browser.
		 *
		 * @param array $config Configuration.
		 */
		return (array) apply_filters( 'aafwc_frontend_config', $config );
	}

	/**
	 * Print the configuration as a JSON block (not a script), so tools that delay or
	 * reorder JavaScript cannot run the plugin before its settings exist.
	 */
	public static function print_config() {
		if ( ! self::$loaded ) {
			return;
		}
		echo "\n" . '<script type="application/json" id="aafwc-config">' . wp_json_encode( self::config(), JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_SLASHES ) . '</script>' . "\n";
	}
}
