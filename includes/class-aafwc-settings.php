<?php
/**
 * Saved settings and the checks built on them.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Reads the settings saved by AAFWC_Integration (works before WooCommerce
 * instantiates the integration) and answers questions about the setup.
 */
class AAFWC_Settings {

	/**
	 * WooCommerce integration id; the settings are saved as `woocommerce_{id}_settings`.
	 */
	const INTEGRATION_ID = 'aafwc';

	/**
	 * Option name of the saved settings.
	 */
	const OPTION = 'woocommerce_aafwc_settings';

	/**
	 * Id of the WooCommerce address provider (WooCommerce 10.3+).
	 */
	const PROVIDER_ID = 'aafwc-google-places';

	/**
	 * Settings of the earlier private build, imported once.
	 */
	const LEGACY_OPTION = 'woocommerce_heyu_address_autocomplete_settings';

	/**
	 * Default value of every setting.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'enabled'              => 'yes',
			'api_key'              => '',
			'request_mode'         => 'browser',
			'suggestion_list'      => 'auto',
			'form_block'           => 'yes',
			'form_classic'         => 'yes',
			'form_account'         => 'yes',
			'form_calculator'      => 'no',
			'custom_forms'         => '',
			'load_assets'          => 'everywhere',
			'restrict_to_selected' => 'yes',
			'countries'            => '',
			'language'             => '',
			'street_name'          => 'long',
			'unit_format'          => 'separate',
			'min_chars'            => '3',
			'debounce'             => '220',
			'consent_category'     => '',
			'color_background'     => '',
			'color_text'           => '',
			'color_hover'          => '',
		);
	}

	/**
	 * All settings, with defaults for anything not saved.
	 *
	 * @return array
	 */
	public static function all() {
		$saved = get_option( self::OPTION, array() );
		$saved = is_array( $saved ) ? $saved : array();
		return array_merge( self::defaults(), $saved );
	}

	/**
	 * One setting.
	 *
	 * @param string $key Setting key.
	 * @return string
	 */
	public static function get( $key ) {
		$all = self::all();
		return isset( $all[ $key ] ) ? (string) $all[ $key ] : '';
	}

	/**
	 * Is the plugin switched on and able to reach Google?
	 *
	 * @return bool
	 */
	public static function is_active() {
		return 'yes' === self::get( 'enabled' ) && '' !== trim( self::get( 'api_key' ) );
	}

	/**
	 * Does this WooCommerce have the address provider system (10.3+)?
	 *
	 * @return bool
	 */
	public static function wc_provider_api_available() {
		return class_exists( 'WC_Address_Provider' )
			&& class_exists( 'Automattic\\WooCommerce\\Internal\\AddressProvider\\AddressProviderController' )
			&& defined( 'WC_VERSION' )
			&& version_compare( WC_VERSION, '10.3', '>=' );
	}

	/**
	 * Should the plugin register itself as a WooCommerce address provider?
	 *
	 * @return bool
	 */
	public static function register_as_provider() {
		return self::is_active() && 'own' !== self::get( 'suggestion_list' ) && self::wc_provider_api_available();
	}

	/**
	 * Is WooCommerce > Settings > General > Address autocomplete ticked?
	 *
	 * @return bool
	 */
	public static function wc_builtin_enabled() {
		return 'yes' === get_option( 'woocommerce_address_autocomplete_enabled', 'no' );
	}

	/**
	 * Address providers registered with WooCommerce's built-in address autocomplete.
	 *
	 * @return array List of WC_Address_Provider objects.
	 */
	public static function wc_providers() {
		$controller_class = 'Automattic\\WooCommerce\\Internal\\AddressProvider\\AddressProviderController';
		if ( ! function_exists( 'wc_get_container' ) || ! class_exists( $controller_class ) ) {
			return array();
		}
		try {
			return (array) wc_get_container()->get( $controller_class )->get_providers();
		} catch ( \Throwable $e ) {
			return array();
		}
	}

	/**
	 * Address providers from other plugins.
	 *
	 * @return array List of WC_Address_Provider objects.
	 */
	public static function other_wc_providers() {
		return array_values(
			array_filter(
				self::wc_providers(),
				function ( $provider ) {
					return isset( $provider->id ) && self::PROVIDER_ID !== $provider->id;
				}
			)
		);
	}

	/**
	 * Two-letter country codes from the "Limit to countries" setting.
	 *
	 * @return string[]
	 */
	public static function countries() {
		$codes = preg_split( '/[\s,;]+/', strtoupper( self::get( 'countries' ) ) );
		return array_values( array_unique( array_filter( (array) $codes, array( __CLASS__, 'is_country_code' ) ) ) );
	}

	/**
	 * Is this a two-letter country code?
	 *
	 * @param string $code Code.
	 * @return bool
	 */
	public static function is_country_code( $code ) {
		return (bool) preg_match( '/^[A-Z]{2}$/', (string) $code );
	}

	/**
	 * Language for Google's results: the setting, or the visitor-facing site language.
	 *
	 * @return string BCP-47 language code such as "en", "pt-BR" or "zh-TW".
	 */
	public static function language() {
		$language = self::get( 'language' );
		if ( '' !== $language ) {
			return $language;
		}
		$locale   = str_replace( '_', '-', function_exists( 'determine_locale' ) ? determine_locale() : get_locale() );
		$regional = array( 'en-AU', 'en-GB', 'fr-CA', 'pt-BR', 'pt-PT', 'zh-CN', 'zh-HK', 'zh-TW' );
		if ( in_array( $locale, $regional, true ) ) {
			return $locale;
		}
		$primary = strtolower( strtok( $locale, '-' ) );
		return preg_match( '/^[a-z]{2,3}$/', $primary ) ? $primary : 'en';
	}

	/**
	 * Custom forms from the "Custom address fields" setting.
	 *
	 * One form per block of lines, blocks separated by a blank line or "---":
	 *
	 *     address_1: #my-street
	 *     city: #my-city
	 *
	 * @param string|null $text Setting text (defaults to the saved setting).
	 * @return array List of forms, each a map of field key => CSS selector.
	 */
	public static function custom_forms( $text = null ) {
		$text   = null === $text ? self::get( 'custom_forms' ) : (string) $text;
		$keys   = array( 'address_1', 'address_2', 'city', 'state', 'postcode', 'country' );
		$forms  = array();
		$text   = preg_replace( '/^\s*-{3,}\s*$/m', '', str_replace( "\r", '', $text ) );
		$blocks = preg_split( '/\n\s*\n/', trim( $text ) );
		foreach ( (array) $blocks as $block ) {
			$form = array();
			foreach ( explode( "\n", $block ) as $line ) {
				$line = trim( $line );
				if ( '' === $line || '#' === $line[0] ) {
					continue; // Blank line or comment.
				}
				$parts = explode( ':', $line, 2 );
				if ( 2 !== count( $parts ) ) {
					continue;
				}
				$key      = strtolower( trim( $parts[0] ) );
				$selector = trim( wp_strip_all_tags( $parts[1] ) );
				if ( in_array( $key, $keys, true ) && '' !== $selector && strlen( $selector ) <= 200 ) {
					$form[ $key ] = $selector;
				}
			}
			if ( isset( $form['address_1'] ) ) {
				$forms[] = $form;
			}
		}
		return $forms;
	}

	/**
	 * Import the settings of the earlier private build ("HeyU Address Autocomplete") once.
	 */
	public static function maybe_import_legacy() {
		if ( false !== get_option( self::OPTION, false ) ) {
			return;
		}
		$legacy = get_option( self::LEGACY_OPTION, false );
		if ( ! is_array( $legacy ) ) {
			return;
		}
		$keep = array_intersect_key( $legacy, array_flip( array( 'enabled', 'api_key', 'restrict_to_selected', 'countries', 'language' ) ) );
		update_option( self::OPTION, array_merge( self::defaults(), array_map( 'sanitize_text_field', $keep ) ) );
	}
}
