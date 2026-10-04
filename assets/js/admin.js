/**
 * Address Autocomplete for WooCommerce: "Test my key" button on the settings screen.
 */
( function () {
	'use strict';

	const button = document.getElementById( 'aafwc-test-key' );
	const output = document.getElementById( 'aafwc-test-result' );
	const settings = window.aafwcAdmin;
	if ( ! button || ! output || ! settings ) {
		return;
	}

	function show( text, ok ) {
		output.textContent = text;
		output.style.color = ok ? '#1e7e34' : '#b32d2e';
	}

	button.addEventListener( 'click', function () {
		const field = document.getElementById( 'woocommerce_aafwc_api_key' );
		const body = new window.FormData();
		body.append( 'action', 'aafwc_test_key' );
		body.append( 'nonce', settings.nonce );
		body.append( 'key', field ? field.value : '' );

		button.disabled = true;
		output.style.color = '';
		output.textContent = settings.testing;

		window
			.fetch( settings.ajaxUrl, {
				method: 'POST',
				credentials: 'same-origin',
				body,
			} )
			.then( ( res ) => res.json() )
			.then( function ( result ) {
				const data = result.data || {};
				show(
					[ data.message, data.detail ]
						.filter( Boolean )
						.join( ' — ' ),
					!! result.success
				);
			} )
			.catch( function () {
				show( settings.failed, false );
			} )
			.finally( function () {
				button.disabled = false;
			} );
	} );
} )();
