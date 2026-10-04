<?php
/**
 * Server-side requests to Google Places API (New): the proxy mode and "Test my key".
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * Talks to Places API (New) from the server.
 */
class AAFWC_Google {

	const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
	const DETAILS_URL      = 'https://places.googleapis.com/v1/places/';
	const DETAILS_FIELDS   = 'addressComponents,formattedAddress';

	/**
	 * Common request arguments.
	 *
	 * The site address is sent as the referrer, so a key restricted to this website
	 * also works for requests made by the server.
	 *
	 * @param string $api_key API key.
	 * @return array
	 */
	private static function args( $api_key ) {
		return array(
			'timeout' => 8,
			'headers' => array(
				'X-Goog-Api-Key' => $api_key,
				'Referer'        => home_url( '/' ),
			),
		);
	}

	/**
	 * Turn a wp_remote_* response into [ status, decoded body ].
	 *
	 * @param array|WP_Error $response Response.
	 * @return array{0:int,1:array}
	 */
	private static function result( $response ) {
		if ( is_wp_error( $response ) ) {
			return array(
				0,
				array(
					'error' => array(
						'status'  => 'UNREACHABLE',
						'message' => $response->get_error_message(),
					),
				),
			);
		}
		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		return array( (int) wp_remote_retrieve_response_code( $response ), is_array( $body ) ? $body : array() );
	}

	/**
	 * Autocomplete (New) request.
	 *
	 * @param array  $body    Request body (input, sessionToken, languageCode, includedRegionCodes, includedPrimaryTypes).
	 * @param string $api_key API key.
	 * @return array{0:int,1:array} Status code and decoded body.
	 */
	public static function autocomplete( array $body, $api_key ) {
		$args                            = self::args( $api_key );
		$args['headers']['Content-Type'] = 'application/json';
		$args['body']                    = wp_json_encode( $body );
		return self::result( wp_remote_post( self::AUTOCOMPLETE_URL, $args ) );
	}

	/**
	 * Place Details (New) request for the address parts only.
	 *
	 * @param string $place_id      Place id.
	 * @param string $session_token Session token ('' for none).
	 * @param string $language      Language code.
	 * @param string $api_key       API key.
	 * @return array{0:int,1:array} Status code and decoded body.
	 */
	public static function details( $place_id, $session_token, $language, $api_key ) {
		$args                                = self::args( $api_key );
		$args['headers']['X-Goog-FieldMask'] = self::DETAILS_FIELDS;
		$url                                 = add_query_arg(
			array_filter(
				array(
					'sessionToken' => rawurlencode( $session_token ),
					'languageCode' => rawurlencode( $language ),
				)
			),
			self::DETAILS_URL . rawurlencode( $place_id )
		);
		return self::result( wp_remote_get( $url, $args ) );
	}

	/**
	 * Google's error, in parts.
	 *
	 * @param array $body Decoded error body.
	 * @return array{status:string,reason:string,message:string}
	 */
	public static function error_parts( array $body ) {
		$error  = isset( $body['error'] ) && is_array( $body['error'] ) ? $body['error'] : array();
		$reason = '';
		if ( ! empty( $error['details'] ) && is_array( $error['details'] ) ) {
			foreach ( $error['details'] as $detail ) {
				if ( is_array( $detail ) && ! empty( $detail['reason'] ) ) {
					$reason = (string) $detail['reason'];
					break;
				}
			}
		}
		return array(
			'status'  => isset( $error['status'] ) ? (string) $error['status'] : '',
			'reason'  => $reason,
			'message' => isset( $error['message'] ) ? (string) $error['message'] : '',
		);
	}

	/**
	 * What to do about Google's error, in plain words.
	 *
	 * @param int   $code HTTP status code.
	 * @param array $body Decoded error body.
	 * @return string
	 */
	public static function explain( $code, array $body ) {
		$parts = self::error_parts( $body );
		switch ( $parts['reason'] ) {
			case 'API_KEY_HTTP_REFERRER_BLOCKED':
				/* translators: %s: site address. */
				return sprintf( __( 'The key\'s website restriction does not allow %s. In Google Cloud > Credentials, add your site with and without "www", e.g. https://example.com/* and *.example.com/* (no "https://" before the "*").', 'address-autocomplete-for-woocommerce' ), home_url( '/' ) );
			case 'API_KEY_SERVICE_BLOCKED':
				return __( 'The key\'s API restrictions do not include "Places API (New)". Add it in Google Cloud > Credentials > your key > API restrictions.', 'address-autocomplete-for-woocommerce' );
			case 'SERVICE_DISABLED':
				return __( '"Places API (New)" is not enabled for this Google Cloud project. Enable it in Google Cloud > APIs & Services > Library.', 'address-autocomplete-for-woocommerce' );
			case 'API_KEY_INVALID':
				return __( 'Google does not recognise this API key. Copy it again from Google Cloud > Credentials.', 'address-autocomplete-for-woocommerce' );
			case 'BILLING_DISABLED':
				return __( 'Billing is not enabled for this Google Cloud project. Google requires a billing account even for the free monthly usage.', 'address-autocomplete-for-woocommerce' );
			case 'API_KEY_IP_ADDRESS_BLOCKED':
				return __( 'The key is restricted to other IP addresses. IP restrictions only suit the server proxy mode, and must list this server\'s IP address.', 'address-autocomplete-for-woocommerce' );
		}
		if ( 0 === $code ) {
			return __( 'This server could not reach Google. Check outgoing connections (firewall, WP_HTTP_BLOCK_EXTERNAL).', 'address-autocomplete-for-woocommerce' );
		}
		if ( 429 === $code ) {
			return __( 'Google\'s quota for this key was reached. Check the quotas and billing in Google Cloud.', 'address-autocomplete-for-woocommerce' );
		}
		if ( 403 === $code ) {
			return __( 'Google refused the key. Check that "Places API (New)" is enabled, billing is on, and the key restrictions allow this site.', 'address-autocomplete-for-woocommerce' );
		}
		return __( 'Google returned an error. See the details below.', 'address-autocomplete-for-woocommerce' );
	}

	/**
	 * One test request for "Test my key".
	 *
	 * @param string $api_key API key.
	 * @return array{ok:bool,code:int,status:string,reason:string,message:string,hint:string,count:int}
	 */
	public static function test_key( $api_key ) {
		list( $code, $body ) = self::autocomplete(
			array(
				'input'        => 'Main Street',
				'languageCode' => AAFWC_Settings::language(),
			),
			$api_key
		);
		$ok                  = $code >= 200 && $code < 300;
		$parts               = self::error_parts( $body );
		return array(
			'ok'      => $ok,
			'code'    => $code,
			'status'  => $parts['status'],
			'reason'  => $parts['reason'],
			'message' => $parts['message'],
			'hint'    => $ok ? '' : self::explain( $code, $body ),
			'count'   => $ok && isset( $body['suggestions'] ) && is_array( $body['suggestions'] ) ? count( $body['suggestions'] ) : 0,
		);
	}
}
