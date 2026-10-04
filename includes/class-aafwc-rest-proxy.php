<?php
/**
 * Optional server proxy: the browser asks this site, the site asks Google,
 * so the API key never appears in the page.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * REST endpoints /wp-json/aafwc/v1/autocomplete and /wp-json/aafwc/v1/place.
 */
class AAFWC_REST_Proxy {

	const NAMESPACE_V1 = 'aafwc/v1';

	/**
	 * Hook in.
	 */
	public static function init() {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Is the proxy switched on?
	 *
	 * @return bool
	 */
	public static function enabled() {
		return AAFWC_Settings::is_active() && 'proxy' === AAFWC_Settings::get( 'request_mode' );
	}

	/**
	 * Register the routes (only when the proxy mode is on).
	 */
	public static function register_routes() {
		if ( ! self::enabled() ) {
			return;
		}
		register_rest_route(
			self::NAMESPACE_V1,
			'/autocomplete',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'autocomplete' ),
				'permission_callback' => array( __CLASS__, 'permission' ),
				'args'                => array(
					'input'                => array(
						'type'              => 'string',
						'required'          => true,
						'sanitize_callback' => array( __CLASS__, 'sanitize_input' ),
						'validate_callback' => array( __CLASS__, 'validate_input' ),
					),
					'sessionToken'         => array(
						'type'              => 'string',
						'default'           => '',
						'validate_callback' => array( __CLASS__, 'validate_token' ),
					),
					'languageCode'         => array(
						'type'              => 'string',
						'default'           => 'en',
						'validate_callback' => array( __CLASS__, 'validate_language' ),
					),
					'includedRegionCodes'  => array(
						'type'              => 'array',
						'default'           => array(),
						'items'             => array( 'type' => 'string' ),
						'validate_callback' => array( __CLASS__, 'validate_regions' ),
					),
					'includedPrimaryTypes' => array(
						'type'    => 'array',
						'default' => array(),
						'items'   => array(
							'type' => 'string',
							'enum' => array( '(regions)', '(cities)' ),
						),
					),
				),
			)
		);
		register_rest_route(
			self::NAMESPACE_V1,
			'/place',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'place' ),
				'permission_callback' => array( __CLASS__, 'permission' ),
				'args'                => array(
					'placeId'      => array(
						'type'              => 'string',
						'required'          => true,
						'validate_callback' => array( __CLASS__, 'validate_place_id' ),
					),
					'sessionToken' => array(
						'type'              => 'string',
						'default'           => '',
						'validate_callback' => array( __CLASS__, 'validate_token' ),
					),
					'languageCode' => array(
						'type'              => 'string',
						'default'           => 'en',
						'validate_callback' => array( __CLASS__, 'validate_language' ),
					),
				),
			)
		);
	}

	/**
	 * Nonce check plus rate limit. Works for guests: the nonce printed in the page
	 * belongs to whoever loaded it.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public static function permission( $request ) {
		$nonce = $request->get_header( 'X-WP-Nonce' );
		if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'aafwc_bad_nonce', __( 'The page has expired. Reload it and try again.', 'address-autocomplete-for-woocommerce' ), array( 'status' => 403 ) );
		}
		if ( ! self::within_rate_limit() ) {
			return new WP_Error( 'aafwc_rate_limited', __( 'Too many address searches. Wait a minute and try again.', 'address-autocomplete-for-woocommerce' ), array( 'status' => 429 ) );
		}
		return true;
	}

	/**
	 * Count requests per visitor IP in a transient.
	 *
	 * Defaults to 120 requests per 10 minutes; change it with the
	 * `aafwc_proxy_rate_limit` filter, e.g. array( 'requests' => 300, 'window' => 600 ).
	 *
	 * @return bool False when the visitor is over the limit.
	 */
	private static function within_rate_limit() {
		$limit  = (array) apply_filters(
			'aafwc_proxy_rate_limit',
			array(
				'requests' => 120,
				'window'   => 600,
			)
		);
		$max    = isset( $limit['requests'] ) ? absint( $limit['requests'] ) : 120;
		$window = isset( $limit['window'] ) ? max( 1, absint( $limit['window'] ) ) : 600;
		if ( 0 === $max ) {
			return true;
		}
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		/**
		 * Filter the visitor IP used for the rate limit (e.g. read a trusted proxy header).
		 *
		 * @param string $ip REMOTE_ADDR.
		 */
		$ip    = (string) apply_filters( 'aafwc_proxy_client_ip', $ip );
		$key   = 'aafwc_rl_' . md5( $ip . '|' . (int) floor( time() / $window ) );
		$count = (int) get_transient( $key );
		if ( $count >= $max ) {
			return false;
		}
		set_transient( $key, $count + 1, $window );
		return true;
	}

	/**
	 * Clean the search text.
	 *
	 * @param string $value Value.
	 * @return string
	 */
	public static function sanitize_input( $value ) {
		return trim( sanitize_text_field( (string) $value ) );
	}

	/**
	 * Search text: 1 to 200 characters.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	public static function validate_input( $value ) {
		$length = function_exists( 'mb_strlen' ) ? mb_strlen( trim( (string) $value ) ) : strlen( trim( (string) $value ) );
		return is_string( $value ) && $length >= 1 && $length <= 200;
	}

	/**
	 * Session token: empty or a UUID-like string.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	public static function validate_token( $value ) {
		return is_string( $value ) && ( '' === $value || (bool) preg_match( '/^[A-Za-z0-9_-]{8,64}$/', $value ) );
	}

	/**
	 * Language code such as "en", "pt-BR" or "es-419".
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	public static function validate_language( $value ) {
		return is_string( $value ) && (bool) preg_match( '/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/', $value );
	}

	/**
	 * Up to 15 two-letter region codes.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	public static function validate_regions( $value ) {
		if ( ! is_array( $value ) || count( $value ) > 15 ) {
			return false;
		}
		foreach ( $value as $code ) {
			if ( ! is_string( $code ) || ! preg_match( '/^[A-Za-z]{2}$/', $code ) ) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Google place id.
	 *
	 * @param mixed $value Value.
	 * @return bool
	 */
	public static function validate_place_id( $value ) {
		return is_string( $value ) && (bool) preg_match( '/^[A-Za-z0-9_-]{10,512}$/', $value );
	}

	/**
	 * Pass Google's answer (or error) back to the browser.
	 *
	 * @param int   $code HTTP status from Google (0 = unreachable).
	 * @param array $body Decoded body.
	 * @return WP_REST_Response
	 */
	private static function respond( $code, array $body ) {
		return new WP_REST_Response( $body, $code ? $code : 502 );
	}

	/**
	 * POST /aafwc/v1/autocomplete.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function autocomplete( $request ) {
		$body = array(
			'input'        => $request['input'],
			'languageCode' => $request['languageCode'],
		);
		if ( '' !== $request['sessionToken'] ) {
			$body['sessionToken'] = $request['sessionToken'];
		}
		$regions = array_map( 'strtolower', (array) $request['includedRegionCodes'] );
		$allowed = array_map( 'strtolower', AAFWC_Settings::countries() );
		if ( $allowed ) {
			// The store's own country limit always applies, whatever the browser asks for.
			$regions = $regions ? array_values( array_intersect( $regions, $allowed ) ) : array_slice( $allowed, 0, 15 );
			if ( ! $regions ) {
				return new WP_REST_Response( array( 'suggestions' => array() ), 200 );
			}
		}
		if ( $regions ) {
			$body['includedRegionCodes'] = $regions;
		}
		if ( $request['includedPrimaryTypes'] ) {
			$body['includedPrimaryTypes'] = array_values( (array) $request['includedPrimaryTypes'] );
		}
		list( $code, $data ) = AAFWC_Google::autocomplete( $body, AAFWC_Settings::get( 'api_key' ) );
		return self::respond( $code, $data );
	}

	/**
	 * GET /aafwc/v1/place.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response
	 */
	public static function place( $request ) {
		list( $code, $data ) = AAFWC_Google::details(
			$request['placeId'],
			$request['sessionToken'],
			$request['languageCode'],
			AAFWC_Settings::get( 'api_key' )
		);
		if ( $code >= 200 && $code < 300 ) {
			/**
			 * Filter Google's place details before they go back to the browser (proxy mode only).
			 *
			 * @param array  $data     Place with addressComponents and formattedAddress.
			 * @param string $place_id Google place id.
			 */
			$data = (array) apply_filters( 'aafwc_place_details', $data, $request['placeId'] );
		}
		return self::respond( $code, $data );
	}
}
