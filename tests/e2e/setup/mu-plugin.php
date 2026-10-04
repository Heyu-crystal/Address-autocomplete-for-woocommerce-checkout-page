<?php
/**
 * Plugin Name: Address Autocomplete E2E helpers
 * Description: Test-only. Fakes Google for server-side requests and simulates script-deferring tools. Never use on a real site.
 *
 * Controlled by the option `aafwc_e2e` (set by the tests):
 *   scripts: 'normal' | 'defer-all' (every external script deferred) | 'defer-head' (plugin scripts in <head> with defer)
 *            | 'delay' (plugin scripts load on first interaction)
 *   google:  array( 'autocomplete' => array( 'status' => 200, 'body' => array() ), 'details' => ... )
 *            answers for server-side requests to places.googleapis.com
 *   rateLimit: array( 'requests' => 3, 'window' => 600 ) for the proxy
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Test options.
 *
 * @return array
 */
function aafwc_e2e_options() {
	$options = get_option( 'aafwc_e2e', array() );
	return is_array( $options ) ? $options : array();
}

// Fake Google for requests made by the server (proxy mode, "Test my key").
add_filter(
	'pre_http_request',
	function ( $response, $args, $url ) {
		$options = aafwc_e2e_options();
		if ( empty( $options['google'] ) || 0 !== strpos( $url, 'https://places.googleapis.com/' ) ) {
			return $response;
		}
		$log   = get_option( 'aafwc_e2e_google_log', array() );
		$log[] = array(
			'url'     => $url,
			'body'    => isset( $args['body'] ) ? $args['body'] : '',
			'referer' => isset( $args['headers']['Referer'] ) ? $args['headers']['Referer'] : '',
			'key'     => isset( $args['headers']['X-Goog-Api-Key'] ) ? $args['headers']['X-Goog-Api-Key'] : '',
		);
		update_option( 'aafwc_e2e_google_log', $log, false );
		$answer = false !== strpos( $url, ':autocomplete' ) ? $options['google']['autocomplete'] : $options['google']['details'];
		return array(
			'headers'  => array( 'content-type' => 'application/json' ),
			'body'     => wp_json_encode( $answer['body'] ),
			'response' => array(
				'code'    => (int) $answer['status'],
				'message' => 'Mocked',
			),
			'cookies'  => array(),
			'filename' => null,
		);
	},
	10,
	3
);

// Small rate limit for the proxy test.
add_filter(
	'aafwc_proxy_rate_limit',
	function ( $limit ) {
		$options = aafwc_e2e_options();
		return empty( $options['rateLimit'] ) ? $limit : $options['rateLimit'];
	}
);

// Simulate performance tools that defer or delay JavaScript.
add_filter(
	'script_loader_tag',
	function ( $tag, $handle ) {
		$options = aafwc_e2e_options();
		$mode    = isset( $options['scripts'] ) ? $options['scripts'] : 'normal';
		if ( 'defer-all' === $mode ) {
			// Like "Defer render-blocking JavaScript": every external script, WooCommerce's too.
			return false === strpos( $tag, ' defer' ) ? str_replace( ' src=', ' defer src=', $tag ) : $tag;
		}
		if ( 0 !== strpos( $handle, 'aafwc' ) || 'normal' === $mode ) {
			return $tag;
		}
		if ( 'defer-head' === $mode ) {
			return str_replace( ' src=', ' defer src=', $tag );
		}
		if ( 'delay' === $mode ) {
			// Like "delay JavaScript until user interaction" options.
			return str_replace( array( '<script ', ' src=' ), array( '<script type="aafwc/delayed" ', ' data-src=' ), $tag );
		}
		return $tag;
	},
	10,
	2
);

add_action(
	'wp_enqueue_scripts',
	function () {
		$options = aafwc_e2e_options();
		if ( isset( $options['scripts'] ) && 'defer-head' === $options['scripts'] ) {
			// Move the plugin's scripts into <head>, above the configuration printed in the footer.
			foreach ( array( 'aafwc-parser', 'aafwc', 'aafwc-wc-provider' ) as $handle ) {
				wp_script_add_data( $handle, 'group', 0 );
			}
		}
	},
	99
);

add_action(
	'wp_footer',
	function () {
		$options = aafwc_e2e_options();
		if ( empty( $options['scripts'] ) || 'delay' !== $options['scripts'] ) {
			return;
		}
		?>
		<script>
		( function () {
			var started = false;
			function load() {
				if ( started ) { return; }
				started = true;
				var queue = Array.prototype.slice.call( document.querySelectorAll( 'script[type="aafwc/delayed"]' ) );
				( function next() {
					var old = queue.shift();
					if ( ! old ) { return; }
					var s = document.createElement( 'script' );
					s.src = old.getAttribute( 'data-src' );
					s.onload = next;
					document.body.appendChild( s );
				} )();
			}
			[ 'keydown', 'pointerdown', 'touchstart' ].forEach( function ( type ) {
				window.addEventListener( type, load, { once: true, passive: true } );
			} );
		} )();
		</script>
		<?php
	},
	999
);

/*
 * Test-only REST API used by tests/e2e/utils/wp.js, so the tests drive the site over
 * HTTP in every environment (wp-env, a local server). Only active when the site defines
 * AAFWC_E2E (see .wp-env.json).
 */
add_action(
	'rest_api_init',
	function () {
		if ( ! defined( 'AAFWC_E2E' ) || ! AAFWC_E2E ) {
			return;
		}
		register_rest_route(
			'aafwc-e2e/v1',
			'/state',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => function ( WP_REST_Request $request ) {
					global $wpdb;
					$p = (array) $request->get_json_params();
					if ( isset( $p['settings'] ) ) {
						update_option( 'woocommerce_aafwc_settings', (array) $p['settings'] );
					}
					if ( isset( $p['wcAutocomplete'] ) ) {
						update_option( 'woocommerce_address_autocomplete_enabled', $p['wcAutocomplete'] ? 'yes' : 'no' );
					}
					if ( isset( $p['e2e'] ) ) {
						update_option( 'aafwc_e2e', (array) $p['e2e'] );
					}
					if ( ! empty( $p['clearGoogleLog'] ) ) {
						delete_option( 'aafwc_e2e_google_log' );
					}
					if ( ! empty( $p['clearRateLimits'] ) ) {
						$wpdb->query( "DELETE FROM {$wpdb->options} WHERE option_name LIKE '%transient%aafwc_rl_%'" ); // phpcs:ignore WordPress.DB
					}
					if ( ! empty( $p['resetCustomer'] ) ) {
						$customer = new WC_Customer( get_user_by( 'login', 'customer' )->ID );
						foreach ( array( 'billing', 'shipping' ) as $type ) {
							$customer->{"set_{$type}_address_1"}( '1 Old Street' );
							$customer->{"set_{$type}_address_2"}( '' );
							$customer->{"set_{$type}_city"}( 'Melbourne' );
							$customer->{"set_{$type}_state"}( 'VIC' );
							$customer->{"set_{$type}_postcode"}( '3000' );
							$customer->{"set_{$type}_country"}( 'AU' );
						}
						$customer->save();
					}
					return array( 'ok' => true );
				},
			)
		);
		register_rest_route(
			'aafwc-e2e/v1',
			'/info',
			array(
				'methods'             => 'GET',
				'permission_callback' => '__return_true',
				'callback'            => function ( WP_REST_Request $request ) {
					$info = array(
						'productId' => (int) get_option( 'aafwc_e2e_product_id' ),
						'wcVersion' => defined( 'WC_VERSION' ) ? WC_VERSION : '',
						'googleLog' => get_option( 'aafwc_e2e_google_log', array() ),
					);
					$type = 'billing' === $request['type'] ? 'billing' : 'shipping';
					if ( $request['order'] ) {
						$order         = wc_get_order( (int) $request['order'] );
						$info['order'] = $order ? $order->get_address( $type ) : null;
					}
					if ( $request['customer'] ) {
						$user     = get_user_by( 'login', (string) $request['customer'] );
						$customer = $user ? new WC_Customer( $user->ID ) : null;
						if ( $customer ) {
							$info['customer'] = array();
							foreach ( array( 'address_1', 'address_2', 'city', 'state', 'postcode', 'country' ) as $field ) {
								$info['customer'][ $field ] = $customer->{"get_{$type}_{$field}"}();
							}
						}
					}
					return $info;
				},
			)
		);
	}
);
