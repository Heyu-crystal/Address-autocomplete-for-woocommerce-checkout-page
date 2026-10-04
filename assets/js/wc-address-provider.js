/**
 * Address Autocomplete for WooCommerce: WooCommerce address provider.
 *
 * Registers Google as an address provider for WooCommerce's built-in address
 * autocomplete (WooCommerce 10.3+, WooCommerce > Settings > General > Address
 * autocomplete). WooCommerce then shows its own suggestion list on the checkout and
 * fills the fields itself; this file only answers its search and select calls.
 *
 * Loaded on its own script handle, after `wc-address-autocomplete-common`. Everything
 * it needs may arrive late (performance tools that defer or delay scripts), so it waits
 * for each piece instead of giving up.
 */
( function () {
	'use strict';

	const WAIT_MS = 100;
	const MAX_WAIT_MS = 30000;

	let lastType = 'shipping';
	let pending = null;

	function waitFor( check, done ) {
		const started = Date.now();
		( function poll() {
			let value = null;
			try {
				value = check();
			} catch {}
			if ( value ) {
				done( value );
			} else if ( Date.now() - started < MAX_WAIT_MS ) {
				setTimeout( poll, WAIT_MS );
			}
		} )();
	}

	function addressTypeFromFocus() {
		// eslint-disable-next-line @wordpress/no-global-active-element -- The checkout is in the main document, not an iframe.
		const el = document.activeElement;
		const m =
			el && el.id
				? /^(shipping|billing)[-_]address_1$/.exec( el.id )
				: null;
		return m ? m[ 1 ] : '';
	}

	function field( type, key ) {
		return (
			document.getElementById( type + '-' + key ) ||
			document.getElementById( type + '_' + key )
		);
	}

	function toSuggestion( s ) {
		return {
			id: s.placeId,
			label: s.text,
			matchedSubstrings: ( s.matches || [] )
				.map( function ( m ) {
					const start = m.startOffset || 0;
					return {
						offset: start,
						length: ( m.endOffset || 0 ) - start,
					};
				} )
				.filter( ( m ) => m.length > 0 ),
		};
	}

	/**
	 * Apartment safety: never erase or replace an apartment the customer typed.
	 *
	 * @param {Object} core    window.AAFWC.
	 * @param {string} type    'billing' or 'shipping'.
	 * @param {string} unit    Unit from Google ('' when none).
	 * @param {Object} address Address object being returned to WooCommerce.
	 */
	function applyUnit( core, type, unit, address ) {
		const key = 'wc:' + type;
		const el = field( type, 'address_2' );
		const current = el ? el.value : '';
		const mine = core.filledUnits[ key ] || '';
		if ( current && current !== mine ) {
			address.address_2 = current; // The customer's own entry wins.
			return;
		}
		if ( unit ) {
			address.address_2 = unit;
			core.filledUnits[ key ] = unit;
		} else if ( current && current === mine ) {
			address.address_2 = '';
			core.filledUnits[ key ] = '';
		}
	}

	function register( core ) {
		const config = core.config;
		const providerId = config.providerId;

		const provider = {
			id: providerId,

			canSearch( country ) {
				return (
					! core.blocked &&
					core.countryAllowed( String( country || '' ).toUpperCase() )
				);
			},

			search( input, country, type ) {
				lastType = type || addressTypeFromFocus() || lastType;
				const minChars = Math.max(
					1,
					parseInt( config.minChars, 10 ) || 3
				);
				// WooCommerce searches on every keystroke: wait for a pause in typing, and let
				// the superseded searches answer with nothing (WooCommerce ignores them anyway).
				if ( pending ) {
					clearTimeout( pending.timer );
					pending.resolve( [] );
					pending = null;
				}
				if ( String( input || '' ).trim().length < minChars ) {
					return Promise.resolve( [] );
				}
				const delay = Math.max(
					0,
					parseInt( config.debounce, 10 ) || 0
				);
				return new Promise( function ( resolve ) {
					const entry = { resolve };
					entry.timer = setTimeout( function () {
						if ( pending === entry ) {
							pending = null;
						}
						core.suggest(
							String( input ).trim(),
							String( country || '' ).toUpperCase()
						).then(
							( list ) => resolve( list.map( toSuggestion ) ),
							() => resolve( [] )
						);
					}, delay );
					pending = entry;
				} );
			},

			select( placeId ) {
				const type = addressTypeFromFocus() || lastType;
				return core.details( placeId ).then( function ( place ) {
					if ( ! place ) {
						return null;
					}
					const parsed = core.toAddress( place, {
						source: 'woocommerce',
						type,
						kind: 'woocommerce',
					} );
					if ( ! parsed ) {
						return null;
					}
					const states = core.statesFor( parsed.country );
					let state = '';
					if ( states && ! Object.keys( states ).length ) {
						state = parsed.stateName; // No state list: free text (e.g. a GB county).
					} else {
						state = core.resolveState( parsed, states );
					}
					const address = {
						address_1: parsed.address_1,
						city: parsed.city,
						state,
						postcode: parsed.postcode,
						country: parsed.country,
					};
					applyUnit( core, type, parsed.address_2, address );
					core.log(
						'WooCommerce provider: filling address',
						address
					);
					return address;
				} );
			},
		};

		const registered =
			window.wc.addressAutocomplete.registerAddressAutocompleteProvider(
				provider
			);
		core.log(
			'WooCommerce address provider "' +
				providerId +
				'" registered: ' +
				registered
		);

		// The block checkout only learns about providers registered after its store exists.
		waitFor(
			() =>
				window.wp &&
				window.wp.data &&
				window.wp.data.dispatch &&
				window.wc.wcBlocksData &&
				window.wc.wcBlocksData.checkoutStore,
			function ( store ) {
				try {
					const actions = window.wp.data.dispatch( store );
					if (
						actions &&
						typeof actions.addAddressAutocompleteProvider ===
							'function'
					) {
						actions.addAddressAutocompleteProvider( providerId );
					}
				} catch {}
			}
		);
	}

	waitFor( function () {
		const core = window.AAFWC;
		const aa = window.wc && window.wc.addressAutocomplete;
		return core &&
			core.ready &&
			aa &&
			typeof aa.registerAddressAutocompleteProvider === 'function'
			? core
			: null;
	}, register );
} )();
