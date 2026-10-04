<?php
/**
 * Remove the plugin's data when it is deleted from the Plugins screen.
 *
 * @package AddressAutocompleteForWooCommerce
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

/**
 * Delete this site's settings and rate-limit counters.
 */
function aafwc_uninstall_site() {
	global $wpdb;
	delete_option( 'woocommerce_aafwc_settings' );
	// Rate-limit counters of the server proxy (short-lived transients).
	$wpdb->query( // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( '_transient_aafwc_' ) . '%',
			$wpdb->esc_like( '_transient_timeout_aafwc_' ) . '%'
		)
	);
}

if ( is_multisite() ) {
	foreach ( get_sites( array( 'fields' => 'ids' ) ) as $aafwc_site_id ) {
		switch_to_blog( $aafwc_site_id );
		aafwc_uninstall_site();
		restore_current_blog();
	}
} else {
	aafwc_uninstall_site();
}
