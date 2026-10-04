<?php
/**
 * Settings screen: WooCommerce > Settings > Integration > Address Autocomplete.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'ABSPATH' ) || exit;

/**
 * WooCommerce integration holding the settings and the status panel.
 */
class AAFWC_Integration extends WC_Integration {

	/**
	 * Set up the integration.
	 */
	public function __construct() {
		$this->id                 = AAFWC_Settings::INTEGRATION_ID;
		$this->method_title       = __( 'Address Autocomplete', 'address-autocomplete-for-woocommerce' );
		$this->method_description = __( 'Google address suggestions on the checkout and My Account address forms. Needs a Google Cloud API key with "Places API (New)" enabled.', 'address-autocomplete-for-woocommerce' );
		$this->init_form_fields();
		$this->init_settings();
		add_action( 'woocommerce_update_options_integration_' . $this->id, array( $this, 'process_admin_options' ) );
	}

	/**
	 * Setting fields.
	 */
	public function init_form_fields() {
		$d = AAFWC_Settings::defaults();

		$this->form_fields = array(
			'section_google'       => array(
				'title' => __( 'Google', 'address-autocomplete-for-woocommerce' ),
				'type'  => 'title',
			),
			'enabled'              => array(
				'title'   => __( 'Enable', 'address-autocomplete-for-woocommerce' ),
				'type'    => 'checkbox',
				'label'   => __( 'Show address suggestions', 'address-autocomplete-for-woocommerce' ),
				'default' => $d['enabled'],
			),
			'api_key'              => array(
				'title'       => __( 'Google API key', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'password',
				'description' => __( 'Enable "Places API (New)" for this key. In "Browser" mode the key is visible in the page source, so restrict it to your website and to "Places API (New)" in Google Cloud > Credentials.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['api_key'],
			),
			'request_mode'         => array(
				'title'       => __( 'Requests to Google', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'select',
				'options'     => array(
					'browser' => __( 'Browser: the customer\'s browser asks Google (fastest; key visible in the page)', 'address-autocomplete-for-woocommerce' ),
					'proxy'   => __( 'Server proxy: your site asks Google (key hidden; adds load to your server)', 'address-autocomplete-for-woocommerce' ),
				),
				'description' => __( 'The server proxy sends every search through your site (a REST endpoint with a nonce and a per-visitor rate limit). Each keystroke pause becomes one PHP request on your server.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['request_mode'],
			),
			'section_list'         => array(
				'title' => __( 'Suggestion list', 'address-autocomplete-for-woocommerce' ),
				'type'  => 'title',
			),
			'suggestion_list'      => array(
				'title'       => __( 'Suggestion list', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'select',
				'options'     => array(
					'auto'    => __( 'Automatic: WooCommerce built-in when it is on and working, otherwise the plugin\'s own', 'address-autocomplete-for-woocommerce' ),
					'builtin' => __( 'WooCommerce built-in only', 'address-autocomplete-for-woocommerce' ),
					'own'     => __( 'Plugin\'s own list only', 'address-autocomplete-for-woocommerce' ),
				),
				'description' => __( 'WooCommerce 10.3+ has its own address autocomplete (WooCommerce > Settings > General > Address autocomplete). This plugin registers Google as a provider for it. Only one list ever opens on a field.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['suggestion_list'],
			),
			'form_block'           => array(
				'title'   => __( 'Where', 'address-autocomplete-for-woocommerce' ),
				'type'    => 'checkbox',
				'label'   => __( 'Block checkout', 'address-autocomplete-for-woocommerce' ),
				'default' => $d['form_block'],
			),
			'form_classic'         => array(
				'type'    => 'checkbox',
				'label'   => __( 'Classic (shortcode) checkout', 'address-autocomplete-for-woocommerce' ),
				'default' => $d['form_classic'],
			),
			'form_account'         => array(
				'type'    => 'checkbox',
				'label'   => __( 'My Account > Addresses', 'address-autocomplete-for-woocommerce' ),
				'default' => $d['form_account'],
			),
			'form_calculator'      => array(
				'type'        => 'checkbox',
				'label'       => __( 'Classic cart shipping calculator (suggests cities and postcodes in the City field)', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['form_calculator'],
				'description' => __( 'Third-party checkouts that keep WooCommerce\'s field ids (CheckoutWC, FunnelKit, Fluid Checkout) work as "Classic checkout".', 'address-autocomplete-for-woocommerce' ),
			),
			'custom_forms'         => array(
				'title'       => __( 'Custom address fields', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'textarea',
				'css'         => 'min-height:140px;font-family:monospace',
				'placeholder' => "address_1: #my-street\naddress_2: #my-unit\ncity: #my-city\nstate: #my-state\npostcode: #my-postcode\ncountry: #my-country",
				'description' => __( 'For other forms: one "field: CSS selector" per line. Only address_1 (the field people type in) is required. Separate several forms with a blank line. Other fields are looked up inside the same &lt;form&gt; first.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['custom_forms'],
			),
			'load_assets'          => array(
				'title'       => __( 'Load scripts on', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'select',
				'options'     => array(
					'everywhere'        => __( 'Every page (safest; the scripts are small and do nothing without an address field)', 'address-autocomplete-for-woocommerce' ),
					'woocommerce_pages' => __( 'Checkout, cart and account pages only', 'address-autocomplete-for-woocommerce' ),
				),
				'description' => __( 'Some block themes make WooCommerce\'s page detection unreliable. If suggestions stop appearing, choose "Every page".', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['load_assets'],
			),
			'section_countries'    => array(
				'title' => __( 'Countries and language', 'address-autocomplete-for-woocommerce' ),
				'type'  => 'title',
			),
			'restrict_to_selected' => array(
				'title'   => __( 'Country', 'address-autocomplete-for-woocommerce' ),
				'type'    => 'checkbox',
				'label'   => __( 'Only suggest addresses in the country the customer has selected', 'address-autocomplete-for-woocommerce' ),
				'default' => $d['restrict_to_selected'],
			),
			'countries'            => array(
				'title'       => __( 'Limit to countries (optional)', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'text',
				'description' => __( 'Two-letter codes separated by commas, e.g. AU,NZ,US,GB,CA. No suggestions are shown for other countries. Leave empty for all countries.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['countries'],
			),
			'language'             => array(
				'title'       => __( 'Language', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'text',
				'description' => __( 'Language of the suggestions, e.g. en, de, ja or pt-BR. Leave empty to use the language of the page.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['language'],
			),
			'section_format'       => array(
				'title' => __( 'Address format', 'address-autocomplete-for-woocommerce' ),
				'type'  => 'title',
			),
			'street_name'          => array(
				'title'   => __( 'Street names', 'address-autocomplete-for-woocommerce' ),
				'type'    => 'select',
				'options' => array(
					'long'  => __( 'Full ("Miller Street")', 'address-autocomplete-for-woocommerce' ),
					'short' => __( 'Abbreviated ("Miller St")', 'address-autocomplete-for-woocommerce' ),
				),
				'default' => $d['street_name'],
			),
			'unit_format'          => array(
				'title'       => __( 'Apartment / unit', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'select',
				'options'     => array(
					'separate' => __( 'Separate field ("Apartment, suite, etc.")', 'address-autocomplete-for-woocommerce' ),
					'combined' => __( 'Australia and New Zealand: in the street line ("5/100 Miller St"); elsewhere: separate', 'address-autocomplete-for-woocommerce' ),
				),
				'description' => __( 'An apartment the customer typed is never erased or replaced.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['unit_format'],
			),
			'section_cost'         => array(
				'title'       => __( 'Cost control', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'title',
				'description' => __( 'Google bills the key owner. Each picked address is one billing session; waiting for a pause in typing and a minimum length keeps the number of requests down.', 'address-autocomplete-for-woocommerce' ),
			),
			'min_chars'            => array(
				'title'             => __( 'Minimum characters', 'address-autocomplete-for-woocommerce' ),
				'type'              => 'number',
				'custom_attributes' => array(
					'min'  => 1,
					'max'  => 10,
					'step' => 1,
				),
				'description'       => __( 'Characters typed before suggestions are requested (default 3).', 'address-autocomplete-for-woocommerce' ),
				'default'           => $d['min_chars'],
			),
			'debounce'             => array(
				'title'             => __( 'Typing pause (ms)', 'address-autocomplete-for-woocommerce' ),
				'type'              => 'number',
				'custom_attributes' => array(
					'min'  => 0,
					'max'  => 2000,
					'step' => 10,
				),
				'description'       => __( 'Wait this long after the last keystroke before asking Google (default 220).', 'address-autocomplete-for-woocommerce' ),
				'default'           => $d['debounce'],
			),
			'section_privacy'      => array(
				'title' => __( 'Privacy', 'address-autocomplete-for-woocommerce' ),
				'type'  => 'title',
			),
			'consent_category'     => array(
				'title'       => __( 'Wait for consent', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'select',
				'options'     => array(
					''                     => __( 'No: suggestions work without consent', 'address-autocomplete-for-woocommerce' ),
					'functional'           => __( 'Functional', 'address-autocomplete-for-woocommerce' ),
					'preferences'          => __( 'Preferences', 'address-autocomplete-for-woocommerce' ),
					'statistics-anonymous' => __( 'Anonymous statistics', 'address-autocomplete-for-woocommerce' ),
					'statistics'           => __( 'Statistics', 'address-autocomplete-for-woocommerce' ),
					'marketing'            => __( 'Marketing', 'address-autocomplete-for-woocommerce' ),
				),
				'description' => __( 'With a category chosen, nothing is sent to Google until the visitor consents to it in a cookie banner that supports the WP Consent API. Without the WP Consent API plugin, no suggestions are shown at all.', 'address-autocomplete-for-woocommerce' ),
				'default'     => $d['consent_category'],
			),
			'section_colours'      => array(
				'title'       => __( 'Colours (optional)', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'title',
				'description' => __( 'Leave empty for the neutral defaults. Themes can also override the CSS variables --aafwc-bg, --aafwc-text, --aafwc-hover, --aafwc-muted and --aafwc-line.', 'address-autocomplete-for-woocommerce' ),
			),
			'color_background'     => array(
				'title'       => __( 'Background', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'color',
				'placeholder' => '#ffffff',
				'css'         => 'width:8em',
				'default'     => $d['color_background'],
			),
			'color_text'           => array(
				'title'       => __( 'Text', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'color',
				'placeholder' => '#1e1e1e',
				'css'         => 'width:8em',
				'default'     => $d['color_text'],
			),
			'color_hover'          => array(
				'title'       => __( 'Highlighted suggestion', 'address-autocomplete-for-woocommerce' ),
				'type'        => 'color',
				'placeholder' => '#f0f0f1',
				'css'         => 'width:8em',
				'default'     => $d['color_hover'],
			),
		);
	}

	/**
	 * Validate the API key: trimmed, no spaces.
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_api_key_field( $key, $value ) {
		return preg_replace( '/\s+/', '', sanitize_text_field( wp_unslash( (string) $value ) ) );
	}

	/**
	 * Validate a select field against its options.
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_select_field( $key, $value ) {
		$value   = is_null( $value ) ? '' : sanitize_text_field( wp_unslash( $value ) );
		$options = isset( $this->form_fields[ $key ]['options'] ) ? $this->form_fields[ $key ]['options'] : array();
		if ( ! array_key_exists( $value, $options ) ) {
			$value = (string) $this->form_fields[ $key ]['default'];
		}
		return $value;
	}

	/**
	 * Validate the country list: two-letter codes only.
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_countries_field( $key, $value ) {
		$codes = preg_split( '/[\s,;]+/', strtoupper( sanitize_text_field( wp_unslash( (string) $value ) ) ) );
		$codes = array_values( array_unique( array_filter( (array) $codes, array( 'AAFWC_Settings', 'is_country_code' ) ) ) );
		return implode( ',', $codes );
	}

	/**
	 * Validate the language code.
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_language_field( $key, $value ) {
		$value = trim( sanitize_text_field( wp_unslash( (string) $value ) ) );
		return preg_match( '/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/', $value ) ? $value : '';
	}

	/**
	 * Validate the minimum characters (1-10).
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_min_chars_field( $key, $value ) {
		return (string) max( 1, min( 10, absint( $value ) ) );
	}

	/**
	 * Validate the typing pause (0-2000 ms).
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_debounce_field( $key, $value ) {
		return '' === trim( (string) $value ) ? '220' : (string) min( 2000, absint( wp_unslash( $value ) ) );
	}

	/**
	 * Validate the custom field selectors (kept as typed, minus tags).
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_custom_forms_field( $key, $value ) {
		$value = wp_strip_all_tags( wp_unslash( (string) $value ) );
		return substr( str_replace( "\r", '', $value ), 0, 5000 );
	}

	/**
	 * Validate a colour (hex or empty).
	 *
	 * @param string $key   Field key.
	 * @param string $value Posted value.
	 * @return string
	 */
	public function validate_color_field( $key, $value ) {
		$value = trim( sanitize_text_field( wp_unslash( (string) $value ) ) );
		return '' === $value ? '' : (string) sanitize_hex_color( $value );
	}

	/**
	 * Status panel and "Test my key" above the settings.
	 */
	public function admin_options() {
		$rows = AAFWC_Admin::status_rows();
		echo '<div class="aafwc-status-panel" style="max-width:820px;margin:16px 0 24px;padding:16px 20px;border:1px solid #c3c4c7;background:#fff">';
		echo '<h3 style="margin:0 0 10px">' . esc_html__( 'Status', 'address-autocomplete-for-woocommerce' ) . '</h3>';
		echo '<table class="widefat striped" style="border:0"><tbody>';
		foreach ( $rows as $row ) {
			$colour = 'ok' === $row['level'] ? '#1e7e34' : ( 'error' === $row['level'] ? '#b32d2e' : ( 'warning' === $row['level'] ? '#996800' : 'inherit' ) );
			echo '<tr><td style="width:36%">' . esc_html( $row['label'] ) . '</td><td style="color:' . esc_attr( $colour ) . '">';
			foreach ( (array) $row['value'] as $i => $line ) {
				echo ( $i ? '<br>' : '' ) . esc_html( $line );
			}
			echo '</td></tr>';
		}
		echo '</tbody></table>';
		echo '<p style="margin:14px 0 4px"><button type="button" class="button" id="aafwc-test-key">' . esc_html__( 'Test my key', 'address-autocomplete-for-woocommerce' ) . '</button> <span id="aafwc-test-result" role="status" aria-live="polite"></span></p>';
		echo '<p class="description" style="margin:0">' . esc_html__( 'Sends one request from this server to Places API (New) with the key in the field below (saved or not), using your site address as the referrer. It finds a disabled API, a wrong key, missing billing and a website restriction that excludes this site address. It cannot reproduce every browser check (for example a checkout on another domain or subdomain), so also try a real address on your checkout.', 'address-autocomplete-for-woocommerce' ) . '</p>';
		echo '</div>';
		parent::admin_options();
	}
}
