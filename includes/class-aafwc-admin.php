<?php
/**
 * Admin: status panel data, "Test my key", privacy policy text, plugin links.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Admin-side helpers.
 */
class AAFWC_Admin {

	/**
	 * Hook in.
	 */
	public static function init() {
		add_action( 'wp_ajax_aafwc_test_key', array( __CLASS__, 'ajax_test_key' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_action( 'admin_init', array( __CLASS__, 'privacy_policy_content' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( AAFWC_FILE ), array( __CLASS__, 'action_links' ) );
	}

	/**
	 * URL of the settings screen.
	 *
	 * @return string
	 */
	public static function settings_url() {
		return admin_url( 'admin.php?page=wc-settings&tab=integration&section=' . AAFWC_Settings::INTEGRATION_ID );
	}

	/**
	 * "Settings" link on the Plugins screen.
	 *
	 * @param array $links Links.
	 * @return array
	 */
	public static function action_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( self::settings_url() ) . '">' . esc_html__( 'Settings', 'address-autocomplete-for-woocommerce' ) . '</a>' );
		return $links;
	}

	/**
	 * Load the "Test my key" script on the settings screen only.
	 */
	public static function enqueue() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- Only reads which screen is open.
		$section = isset( $_GET['section'] ) ? sanitize_key( wp_unslash( $_GET['section'] ) ) : '';
		if ( AAFWC_Settings::INTEGRATION_ID !== $section || ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		wp_enqueue_script( 'aafwc-admin', AAFWC_URL . 'assets/js/admin.js', array(), AAFWC_VERSION, array( 'in_footer' => true ) );
		wp_add_inline_script(
			'aafwc-admin',
			'window.aafwcAdmin = ' . wp_json_encode(
				array(
					'ajaxUrl' => admin_url( 'admin-ajax.php' ),
					'nonce'   => wp_create_nonce( 'aafwc_test_key' ),
					'testing' => __( 'Testing…', 'address-autocomplete-for-woocommerce' ),
					'failed'  => __( 'The test could not run. Reload the page and try again.', 'address-autocomplete-for-woocommerce' ),
				)
			) . ';',
			'before'
		);
	}

	/**
	 * AJAX: one test request to Google with the key from the settings field.
	 */
	public static function ajax_test_key() {
		check_ajax_referer( 'aafwc_test_key', 'nonce' );
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to do this.', 'address-autocomplete-for-woocommerce' ) ), 403 );
		}
		$key = isset( $_POST['key'] ) ? preg_replace( '/\s+/', '', sanitize_text_field( wp_unslash( $_POST['key'] ) ) ) : '';
		if ( '' === $key ) {
			$key = AAFWC_Settings::get( 'api_key' );
		}
		if ( '' === $key ) {
			wp_send_json_error( array( 'message' => __( 'Enter an API key first.', 'address-autocomplete-for-woocommerce' ) ) );
		}

		$result = AAFWC_Google::test_key( $key );
		if ( $result['ok'] ) {
			wp_send_json_success(
				array(
					/* translators: %d: number of suggestions Google returned. */
					'message' => sprintf( _n( 'The key works: Google returned %d suggestion.', 'The key works: Google returned %d suggestions.', $result['count'], 'address-autocomplete-for-woocommerce' ), $result['count'] ),
				)
			);
		}
		$detail = trim( sprintf( 'HTTP %d %s %s %s', $result['code'], $result['status'], $result['reason'], $result['message'] ) );
		wp_send_json_error(
			array(
				'message' => $result['hint'],
				'detail'  => $detail,
			)
		);
	}

	/**
	 * Rows of the status panel.
	 *
	 * @return array List of [ label, value (string|string[]), level (ok|warning|error|info) ].
	 */
	public static function status_rows() {
		$yes  = __( 'Yes', 'address-autocomplete-for-woocommerce' );
		$no   = __( 'No', 'address-autocomplete-for-woocommerce' );
		$rows = array();

		$enabled = 'yes' === AAFWC_Settings::get( 'enabled' );
		$has_key = '' !== AAFWC_Settings::get( 'api_key' );

		$rows[] = self::row( __( 'Plugin version', 'address-autocomplete-for-woocommerce' ), AAFWC_VERSION );
		$rows[] = self::row( __( 'Enabled', 'address-autocomplete-for-woocommerce' ), $enabled ? $yes : $no, $enabled ? 'ok' : 'error' );
		$rows[] = self::row( __( 'Google API key saved', 'address-autocomplete-for-woocommerce' ), $has_key ? $yes : $no, $has_key ? 'ok' : 'error' );
		$rows[] = self::row(
			__( 'Requests to Google', 'address-autocomplete-for-woocommerce' ),
			'proxy' === AAFWC_Settings::get( 'request_mode' )
				/* translators: %s: REST API address of the proxy. */
				? sprintf( __( 'Server proxy (%s)', 'address-autocomplete-for-woocommerce' ), rest_url( AAFWC_REST_Proxy::NAMESPACE_V1 . '/' ) )
				: __( 'Browser (the key is visible in the page: restrict it to your website)', 'address-autocomplete-for-woocommerce' )
		);

		$wc_version = defined( 'WC_VERSION' ) ? WC_VERSION : '?';
		$rows[]     = self::row( __( 'WooCommerce version', 'address-autocomplete-for-woocommerce' ), $wc_version );
		$rows[]     = self::list_in_use_row();

		$conflicts = self::conflicts();
		$rows[]    = self::row(
			__( 'Conflicts', 'address-autocomplete-for-woocommerce' ),
			$conflicts ? $conflicts : __( 'None found', 'address-autocomplete-for-woocommerce' ),
			$conflicts ? 'error' : 'ok'
		);

		$category = AAFWC_Settings::get( 'consent_category' );
		if ( '' !== $category ) {
			$consent_api = function_exists( 'wp_has_consent' );
			$rows[]      = self::row(
				__( 'Consent', 'address-autocomplete-for-woocommerce' ),
				$consent_api
					/* translators: %s: consent category. */
					? sprintf( __( 'Waits for "%s" consent (WP Consent API is active).', 'address-autocomplete-for-woocommerce' ), $category )
					/* translators: %s: consent category. */
					: sprintf( __( 'Set to wait for "%s" consent, but the WP Consent API plugin is not active, so no suggestions are shown.', 'address-autocomplete-for-woocommerce' ), $category ),
				$consent_api ? 'ok' : 'error'
			);
		}
		return $rows;
	}

	/**
	 * One status row.
	 *
	 * @param string          $label Label.
	 * @param string|string[] $value Value (several lines as an array).
	 * @param string          $level ok, warning, error or info.
	 * @return array
	 */
	private static function row( $label, $value, $level = 'info' ) {
		return array(
			'label' => $label,
			'value' => $value,
			'level' => $level,
		);
	}

	/**
	 * Which suggestion list WooCommerce's checkout and account forms use.
	 *
	 * @return array Row.
	 */
	private static function list_in_use_row() {
		$label     = __( 'Suggestion list on WooCommerce forms', 'address-autocomplete-for-woocommerce' );
		$mode      = AAFWC_Settings::get( 'suggestion_list' );
		$available = AAFWC_Settings::wc_provider_api_available();
		$builtin   = AAFWC_Settings::wc_builtin_enabled();
		$general   = __( 'WooCommerce > Settings > General > Address autocomplete', 'address-autocomplete-for-woocommerce' );

		if ( 'own' === $mode ) {
			return self::row( $label, __( 'The plugin\'s own list', 'address-autocomplete-for-woocommerce' ), 'ok' );
		}
		if ( ! $available ) {
			if ( 'builtin' === $mode ) {
				return self::row( $label, __( 'None: "WooCommerce built-in only" needs WooCommerce 10.3 or newer. Choose "Automatic".', 'address-autocomplete-for-woocommerce' ), 'error' );
			}
			return self::row( $label, __( 'The plugin\'s own list (WooCommerce\'s built-in list needs WooCommerce 10.3 or newer)', 'address-autocomplete-for-woocommerce' ), 'ok' );
		}
		if ( ! $builtin ) {
			if ( 'builtin' === $mode ) {
				/* translators: %s: settings path. */
				return self::row( $label, sprintf( __( 'None: tick %s, or choose "Automatic".', 'address-autocomplete-for-woocommerce' ), $general ), 'error' );
			}
			/* translators: %s: settings path. */
			return self::row( $label, sprintf( __( 'The plugin\'s own list. To use WooCommerce\'s built-in list instead, tick %s.', 'address-autocomplete-for-woocommerce' ), $general ), 'ok' );
		}
		$lines     = array( __( 'WooCommerce\'s built-in list, with Google results from this plugin', 'address-autocomplete-for-woocommerce' ) );
		$preferred = (string) get_option( 'woocommerce_address_autocomplete_provider', '' );
		if ( '' !== $preferred && AAFWC_Settings::PROVIDER_ID !== $preferred ) {
			foreach ( AAFWC_Settings::other_wc_providers() as $provider ) {
				if ( $provider->id === $preferred ) {
					/* translators: %s: name of another address provider. */
					$lines[] = sprintf( __( 'WooCommerce prefers "%s"; this plugin is used where that provider cannot search.', 'address-autocomplete-for-woocommerce' ), $provider->name );
				}
			}
		}
		$lines[] = __( 'The plugin\'s own list still serves the shipping calculator and custom forms.', 'address-autocomplete-for-woocommerce' );
		return self::row( $label, $lines, 'ok' );
	}

	/**
	 * Things that would open a second suggestion list.
	 *
	 * @return string[]
	 */
	private static function conflicts() {
		$conflicts = array();
		$others    = AAFWC_Settings::other_wc_providers();
		if ( 'own' === AAFWC_Settings::get( 'suggestion_list' ) && AAFWC_Settings::wc_builtin_enabled() && $others ) {
			$names       = implode(
				', ',
				array_map(
					function ( $provider ) {
						return (string) $provider->name;
					},
					$others
				)
			);
			$conflicts[] = sprintf(
				/* translators: %s: names of other address providers. */
				__( 'WooCommerce\'s built-in address autocomplete is on with another provider (%s). Its list is used on the checkout instead of this plugin\'s, because only one list may open on a field. Untick WooCommerce > Settings > General > Address autocomplete, or choose "Automatic".', 'address-autocomplete-for-woocommerce' ),
				$names
			);
		}
		if ( defined( 'HEYU_AAC_VERSION' ) ) {
			$conflicts[] = __( 'The earlier "HeyU Address Autocomplete" plugin is active. Deactivate it; its settings were imported.', 'address-autocomplete-for-woocommerce' );
		}
		if ( class_exists( 'SRH_Google_Address_Provider' ) ) {
			$conflicts[] = __( 'The "WooCommerce Google Address Autocomplete" plugin is active. Deactivate it.', 'address-autocomplete-for-woocommerce' );
		}
		if ( defined( 'AGA_PLUGIN_DIR' ) || function_exists( 'aga_is_pro' ) ) {
			$conflicts[] = __( 'The "Autocomplete Google Address" plugin is active. Deactivate it.', 'address-autocomplete-for-woocommerce' );
		}
		return $conflicts;
	}

	/**
	 * Suggested text for the site's privacy policy (Settings > Privacy).
	 */
	public static function privacy_policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}
		$content  = '<p class="privacy-policy-tutorial">' . esc_html__( 'Address Autocomplete for WooCommerce sends the address text customers type to Google to suggest addresses.', 'address-autocomplete-for-woocommerce' ) . '</p>';
		$content .= '<strong class="privacy-policy-tutorial">' . esc_html__( 'Suggested text:', 'address-autocomplete-for-woocommerce' ) . ' </strong>';
		$content .= '<p>' . esc_html__( 'When you type an address in our checkout or account address forms, the characters you type, a random session identifier and, when you choose a suggestion, the identifier of the chosen place are sent to Google (Google Places API) to suggest and complete addresses. Your browser also sends Google its IP address and browser information with these requests. Google processes this information under its own privacy policy: https://policies.google.com/privacy. We do not send your name, email address, phone number or order details to Google.', 'address-autocomplete-for-woocommerce' ) . '</p>';
		wp_add_privacy_policy_content( __( 'Address Autocomplete for WooCommerce', 'address-autocomplete-for-woocommerce' ), wp_kses_post( wpautop( $content, false ) ) );
	}
}
