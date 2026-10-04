/**
 * Address Autocomplete for WooCommerce: suggestions and field filling.
 *
 * Works on:
 *  - WooCommerce block checkout   (#shipping-address_1, #billing-address_1 ...)
 *  - WooCommerce classic checkout (#shipping_address_1, #billing_address_1 ...)
 *  - My Account > Addresses       (same ids as the classic checkout)
 *  - the classic cart's shipping calculator (#calc_shipping_city), when enabled
 *  - custom forms described in the settings
 *
 * How it works:
 *  1. Listens for typing on the whole page (event delegation), so it keeps working when the
 *     block checkout redraws its fields.
 *  2. Asks Google "Places API (New)" for suggestions (directly, or through the site's own
 *     REST proxy) and shows its own list under the field, unless WooCommerce's built-in
 *     address autocomplete is already handling that field.
 *  3. When an address is picked, asks Google for the address parts and writes each one into
 *     its own field using the browser's native value setter plus real input/change events,
 *     which is what React (the block checkout) needs to keep the values.
 *
 * Also exposes window.AAFWC, which the WooCommerce address provider (wc-address-provider.js)
 * uses for its Google requests.
 */
( function () {
	'use strict';

	if ( window.AAFWC ) {
		return; // Loaded twice.
	}

	const LIST_ID = 'aafwc-listbox';
	const OPTION_ID = 'aafwc-option-';
	const STATUS_ID = 'aafwc-status';
	const DETAILS_FIELDS = 'addressComponents,formattedAddress';
	const CACHE_SIZE = 50;
	const WC_KINDS = [ 'block', 'classic', 'account' ];

	let config = null;
	let parser = null;
	let sessionToken = null;
	let typingTimer = null;
	let requestCount = 0;
	let lastTyped = 0; // When the customer last typed in any field.
	let warnedOnce = false;
	const cache = new Map();

	const ui = {
		root: null,
		list: null,
		status: null,
		input: null,
		form: null,
		items: [],
		active: -1,
		pointerDown: false,
	};

	/* ------------------------------------------------------------------ */
	/* Setup and helpers                                                    */
	/* ------------------------------------------------------------------ */

	function readConfig() {
		const el = document.getElementById( 'aafwc-config' );
		if ( ! el ) {
			return null;
		}
		try {
			return JSON.parse( el.textContent );
		} catch {
			return null;
		}
	}

	function i18n( key ) {
		return ( config && config.i18n && config.i18n[ key ] ) || '';
	}

	function log( ...args ) {
		if ( config && config.debug && window.console ) {
			window.console.info(
				'[Address Autocomplete ' + config.version + ']',
				...args
			);
		}
	}

	function warn( message, detail ) {
		if ( warnedOnce || ! window.console ) {
			return;
		}
		warnedOnce = true;
		window.console.warn(
			'[Address Autocomplete for WooCommerce] ' + message,
			detail || ''
		);
	}

	function newSessionToken() {
		if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) {
			return window.crypto.randomUUID();
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
			/[xy]/g,
			function ( c ) {
				const r = Math.floor( Math.random() * 16 );
				return ( c === 'x' ? r : ( r % 4 ) + 8 ).toString( 16 );
			}
		);
	}

	function minChars() {
		return Math.max( 1, parseInt( config.minChars, 10 ) || 3 );
	}

	function debounceMs() {
		const value = parseInt( config.debounce, 10 );
		return isNaN( value ) ? 220 : Math.max( 0, value );
	}

	/**
	 * Has the visitor agreed to the consent category the store chose (WP Consent API)?
	 * With no category chosen, there is nothing to wait for.
	 */
	function hasConsent() {
		const category = config && config.consentCategory;
		if ( ! category ) {
			return true;
		}
		if ( typeof window.wp_has_consent === 'function' ) {
			return !! window.wp_has_consent( category );
		}
		return false;
	}

	function allowedCountries() {
		return ( config.countries || [] ).map( ( c ) =>
			String( c ).toUpperCase()
		);
	}

	function countryAllowed( country ) {
		const allowed = allowedCountries();
		return (
			! allowed.length || ! country || allowed.indexOf( country ) !== -1
		);
	}

	/**
	 * Region codes for the Google request, or false when this country must not get suggestions.
	 *
	 * @param {string} country Selected country (may be empty).
	 * @return {Array|false} Lower-case region codes.
	 */
	function regionCodes( country ) {
		const allowed = allowedCountries();
		if ( allowed.length && country && allowed.indexOf( country ) === -1 ) {
			return false;
		}
		if ( config.restrictToSelected && country ) {
			return [ country.toLowerCase() ];
		}
		return allowed.slice( 0, 15 ).map( ( c ) => c.toLowerCase() );
	}

	/* ------------------------------------------------------------------ */
	/* Google requests (Places API New), direct or through the site proxy   */
	/* ------------------------------------------------------------------ */

	function query( params ) {
		return Object.keys( params )
			.filter( ( k ) => params[ k ] !== undefined && params[ k ] !== '' )
			.map(
				( k ) =>
					encodeURIComponent( k ) +
					'=' +
					encodeURIComponent( params[ k ] )
			)
			.join( '&' );
	}

	function fetchJson( url, options ) {
		return window.fetch( url, options ).then( function ( res ) {
			return res
				.json()
				.catch( () => ( {} ) )
				.then( ( data ) => ( {
					ok: res.ok,
					status: res.status,
					data,
				} ) );
		} );
	}

	function request( kind, payload ) {
		const r = config.request || {};
		if ( r.proxy ) {
			const headers = { 'X-WP-Nonce': r.nonce };
			if ( kind === 'autocomplete' ) {
				headers[ 'Content-Type' ] = 'application/json';
				return fetchJson( r.url + 'autocomplete', {
					method: 'POST',
					credentials: 'same-origin',
					headers,
					body: JSON.stringify( payload ),
				} );
			}
			return fetchJson( r.url + 'place?' + query( payload ), {
				credentials: 'same-origin',
				headers,
			} );
		}
		if ( kind === 'autocomplete' ) {
			return fetchJson(
				'https://places.googleapis.com/v1/places:autocomplete',
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-Goog-Api-Key': r.apiKey,
					},
					body: JSON.stringify( payload ),
				}
			);
		}
		return fetchJson(
			'https://places.googleapis.com/v1/places/' +
				encodeURIComponent( payload.placeId ) +
				'?' +
				query( {
					sessionToken: payload.sessionToken,
					languageCode: payload.languageCode,
				} ),
			{
				headers: {
					'X-Goog-Api-Key': r.apiKey,
					'X-Goog-FieldMask': DETAILS_FIELDS,
				},
			}
		);
	}

	/**
	 * Explain Google's error in plain words (for the browser Console).
	 *
	 * @param {Object} result { status, data } from fetchJson().
	 * @return {Object} { code, reason, hint }.
	 */
	function explainError( result ) {
		const error = ( result.data && result.data.error ) || {};
		let reason = '';
		( error.details || [] ).forEach( function ( d ) {
			if ( d && d.reason && ! reason ) {
				reason = d.reason;
			}
		} );
		const code = error.status || String( result.status );
		const hints = {
			API_KEY_HTTP_REFERRER_BLOCKED:
				"The key's website restriction does not allow this site. Add https://" +
				window.location.host +
				'/* (and *.yourdomain.com/* without "https://") in Google Cloud > Credentials.',
			API_KEY_SERVICE_BLOCKED:
				'The key\'s API restriction does not include "Places API (New)".',
			SERVICE_DISABLED:
				'Enable "Places API (New)" for this Google Cloud project.',
			API_KEY_INVALID:
				'The API key is not valid. Copy it again from Google Cloud > Credentials.',
			BILLING_DISABLED:
				'Billing is not enabled for this Google Cloud project.',
			API_KEY_IP_ADDRESS_BLOCKED:
				'The key is restricted by IP address, which only works with the server proxy mode.',
		};
		let hint = hints[ reason ] || '';
		if ( ! hint && result.status === 403 ) {
			hint =
				'Check that "Places API (New)" is enabled for the key and the key restrictions allow this site.';
		}
		if ( ! hint && result.status === 429 ) {
			hint =
				"Too many requests: Google quota or the site's rate limit was reached.";
		}
		return { code, reason, hint, message: error.message || '' };
	}

	function handleError( what, result ) {
		const info = explainError( result );
		// A refused key will be refused on every request: stop asking for this page view.
		if (
			result.status === 403 ||
			result.status === 401 ||
			info.reason === 'API_KEY_INVALID'
		) {
			core.blocked = info.reason || info.code;
		}
		warn(
			'Google refused the ' +
				what +
				' request (' +
				result.status +
				' ' +
				info.code +
				( info.reason ? ': ' + info.reason : '' ) +
				'). ' +
				info.hint,
			result.data
		);
	}

	function normaliseSuggestions( data ) {
		return ( ( data && data.suggestions ) || [] )
			.filter( ( s ) => s.placePrediction && s.placePrediction.placeId )
			.map( function ( s ) {
				const p = s.placePrediction;
				const sf = p.structuredFormat || {};
				const full = p.text || { text: '' };
				return {
					placeId: p.placeId,
					text: full.text || '',
					matches: full.matches || [],
					main: sf.mainText ? sf.mainText.text : full.text || '',
					mainMatches: sf.mainText
						? sf.mainText.matches || []
						: full.matches || [],
					secondary: sf.secondaryText ? sf.secondaryText.text : '',
				};
			} );
	}

	/**
	 * Address suggestions for a query.
	 *
	 * @param {string} input   What the customer typed.
	 * @param {string} country Selected country code (may be empty).
	 * @param {string} [kind]  'address' (default) or 'regions' (city/postcode search).
	 * @return {Promise<Array>} Suggestions (empty on any problem).
	 */
	function suggest( input, country, kind ) {
		if ( ! hasConsent() ) {
			log(
				'No consent yet for "' +
					config.consentCategory +
					'": not contacting Google.'
			);
			return Promise.resolve( [] );
		}
		if ( core.blocked ) {
			return Promise.resolve( [] );
		}
		const regions = regionCodes( String( country || '' ).toUpperCase() );
		if ( regions === false ) {
			return Promise.resolve( [] );
		}
		const key = [
			kind || 'address',
			regions.join( ',' ),
			input.toLowerCase(),
		].join( '|' );
		if ( cache.has( key ) ) {
			return Promise.resolve( cache.get( key ) );
		}
		if ( ! sessionToken ) {
			sessionToken = newSessionToken();
		}
		const body = {
			input,
			sessionToken,
			languageCode: config.language || 'en',
		};
		if ( regions.length ) {
			body.includedRegionCodes = regions;
		}
		if ( kind === 'regions' ) {
			body.includedPrimaryTypes = [ '(regions)' ];
		}
		return request( 'autocomplete', body ).then(
			function ( result ) {
				if ( ! result.ok ) {
					handleError( 'suggestion', result );
					return [];
				}
				const list = normaliseSuggestions( result.data );
				cache.set( key, list );
				if ( cache.size > CACHE_SIZE ) {
					cache.delete( cache.keys().next().value );
				}
				return list;
			},
			function ( err ) {
				warn( 'Could not reach Google for suggestions.', err );
				return [];
			}
		);
	}

	/**
	 * Address parts for a picked suggestion. Ends the Google billing session.
	 *
	 * @param {string} placeId Google place id.
	 * @return {Promise<Object|null>} Place, or null on any problem.
	 */
	function details( placeId ) {
		const token = sessionToken || '';
		sessionToken = null;
		return request( 'details', {
			placeId,
			sessionToken: token,
			languageCode: config.language || 'en',
		} ).then(
			function ( result ) {
				if ( ! result.ok ) {
					handleError( 'address details', result );
					return null;
				}
				return result.data;
			},
			function ( err ) {
				warn( 'Could not reach Google for the address details.', err );
				return null;
			}
		);
	}

	function parserOptions() {
		return {
			streetName: config.streetName,
			unitFormat: config.unitFormat,
			rules: config.rules || {},
		};
	}

	/**
	 * Parse a place and let developers adjust the result:
	 *
	 *     document.addEventListener( 'aafwc:address', function ( e ) {
	 *         e.detail.address.city = e.detail.address.city.toUpperCase();
	 *         // e.preventDefault() cancels filling.
	 *     } );
	 *
	 * @param {Object} place   Google place.
	 * @param {Object} context { source, type, kind }.
	 * @return {Object|null} Address, or null when a listener cancelled it.
	 */
	function toAddress( place, context ) {
		const address = parser.parse( place, parserOptions() );
		let event;
		try {
			event = new window.CustomEvent( 'aafwc:address', {
				detail: { address, place, context: context || {} },
				cancelable: true,
			} );
		} catch {
			return address;
		}
		document.dispatchEvent( event );
		if ( event.defaultPrevented ) {
			log( 'Filling cancelled by an aafwc:address listener.' );
			return null;
		}
		return event.detail.address || address;
	}

	/**
	 * WooCommerce's state list for a country, from the page.
	 *
	 * @param {string} country Country code.
	 * @return {Object|null} { code: name }, {} when the country has none, null when unknown.
	 */
	function statesFor( country ) {
		try {
			const settings = window.wc && window.wc.wcSettings;
			const data =
				settings && typeof settings.getSetting === 'function'
					? settings.getSetting( 'countryData', null )
					: null;
			if ( data && data[ country ] ) {
				const states = data[ country ].states;
				return states && typeof states === 'object' ? states : {};
			}
		} catch {}
		try {
			const params = window.wc_country_select_params;
			if ( params && params.countries ) {
				const all =
					typeof params.countries === 'string'
						? JSON.parse( params.countries )
						: params.countries;
				if (
					all &&
					Object.prototype.hasOwnProperty.call( all, country )
				) {
					return all[ country ] && typeof all[ country ] === 'object'
						? all[ country ]
						: {};
				}
			}
		} catch {}
		return null;
	}

	const core = {
		ready: false,
		blocked: '',
		filledUnits: {},
		get config() {
			return config;
		},
		suggest,
		details,
		toAddress,
		statesFor,
		countryAllowed,
		hasConsent,
		resolveState: ( address, states ) =>
			parser.resolveState( address, states, parserOptions() ),
		log,
	};

	/* ------------------------------------------------------------------ */
	/* Which forms                                                          */
	/* ------------------------------------------------------------------ */

	function formEnabled( kind ) {
		const forms = config.forms || {};
		return forms[ kind ] !== false;
	}

	function byId( id ) {
		return document.getElementById( id );
	}

	function safeQuery( scope, selector ) {
		if ( ! selector ) {
			return null;
		}
		try {
			return scope.querySelector( selector );
		} catch {
			return null;
		}
	}

	function safeMatches( el, selector ) {
		try {
			return !! selector && el.matches( selector );
		} catch {
			return false;
		}
	}

	function classicKind( el ) {
		const body = document.body.classList;
		if (
			el.closest( 'form.checkout, form.woocommerce-checkout' ) ||
			body.contains( 'woocommerce-checkout' )
		) {
			return 'classic';
		}
		if (
			body.contains( 'woocommerce-account' ) ||
			el.closest( '.woocommerce-MyAccount-content' )
		) {
			return 'account';
		}
		return 'classic';
	}

	/**
	 * Which address form does this input belong to?
	 *
	 * @param {Element} el The element the customer is typing in.
	 * @return {Object|null} Form description, or null when the element is not a main address field.
	 */
	function formFor( el ) {
		if ( ! el || el.tagName !== 'INPUT' ) {
			return null;
		}
		const m = el.id
			? /^(shipping|billing)([-_])address_1$/.exec( el.id )
			: null;
		if ( m ) {
			const kind = m[ 2 ] === '-' ? 'block' : classicKind( el );
			if ( ! formEnabled( kind ) ) {
				return null;
			}
			return {
				key: kind + ':' + m[ 1 ],
				kind,
				type: m[ 1 ],
				get: ( field ) => byId( m[ 1 ] + m[ 2 ] + field ),
			};
		}
		if ( el.id === 'calc_shipping_city' && formEnabled( 'calculator' ) ) {
			return {
				key: 'calculator',
				kind: 'calculator',
				type: 'shipping',
				search: 'regions',
				get: ( field ) => byId( 'calc_shipping_' + field ),
			};
		}
		const custom = config.customForms || [];
		for ( let i = 0; i < custom.length; i++ ) {
			const def = custom[ i ];
			if ( safeMatches( el, def.address_1 ) ) {
				const scope = el.closest( 'form' ) || document;
				return {
					key: 'custom:' + i,
					kind: 'custom',
					type: 'shipping',
					get: ( field ) =>
						field === 'address_1'
							? el
							: safeQuery( scope, def[ field ] ) ||
								safeQuery( document, def[ field ] ),
				};
			}
		}
		return null;
	}

	/**
	 * Is WooCommerce's built-in address autocomplete showing its own list on this field?
	 *
	 * @param {Object} form Form description.
	 * @return {boolean} True when WooCommerce handles it.
	 */
	function wooCommerceHandles( form ) {
		if ( WC_KINDS.indexOf( form.kind ) === -1 ) {
			return false;
		}
		const aa = window.wc && window.wc.addressAutocomplete;
		return !! ( aa && aa.activeProvider && aa.activeProvider[ form.type ] );
	}

	/**
	 * Only one suggestion list per field: ours, or WooCommerce's.
	 *
	 * @param {Object} form Form description.
	 * @return {boolean} True when the plugin's own list may open.
	 */
	function ownListAllowed( form ) {
		if ( wooCommerceHandles( form ) ) {
			return false;
		}
		if (
			config.mode === 'builtin' &&
			WC_KINDS.indexOf( form.kind ) !== -1
		) {
			return false;
		}
		return true;
	}

	function selectedCountry( form ) {
		const el = form.get( 'country' );
		let country = el && el.value ? String( el.value ).toUpperCase() : '';
		if ( ! country && form.kind === 'block' ) {
			// The block checkout hides the country select when the store sells to one country.
			try {
				const cart = window.wp.data
					.select( 'wc/store/cart' )
					.getCartData();
				country = String(
					( cart[ form.type + 'Address' ] || {} ).country || ''
				).toUpperCase();
			} catch {}
		}
		return country;
	}

	/* ------------------------------------------------------------------ */
	/* Suggestion list (ARIA combobox pattern)                              */
	/* ------------------------------------------------------------------ */

	function buildList() {
		if ( ui.root ) {
			return;
		}
		ui.root = document.createElement( 'div' );
		ui.root.className = 'aafwc';

		ui.list = document.createElement( 'ul' );
		ui.list.className = 'aafwc__list';
		ui.list.id = LIST_ID;
		ui.list.setAttribute( 'role', 'listbox' );
		ui.list.setAttribute( 'aria-label', i18n( 'listLabel' ) );
		ui.root.appendChild( ui.list );

		// Google requires this attribution when Places results are shown without a Google map.
		const attribution = document.createElement( 'div' );
		attribution.className = 'aafwc__attribution';
		attribution.setAttribute( 'aria-hidden', 'true' );
		attribution.textContent = i18n( 'attribution' ) || 'Google Maps';
		ui.root.appendChild( attribution );

		// Keep focus in the field while clicking or tapping a suggestion.
		ui.root.addEventListener( 'mousedown', ( e ) => e.preventDefault() );
		ui.root.addEventListener( 'pointerdown', function () {
			ui.pointerDown = true;
		} );
		const release = function () {
			setTimeout( function () {
				ui.pointerDown = false;
			}, 300 );
		};
		ui.root.addEventListener( 'pointerup', release );
		ui.root.addEventListener( 'pointercancel', release );
		ui.list.addEventListener( 'click', function ( e ) {
			const li = e.target.closest( '.aafwc__item' );
			if ( li ) {
				choose( Number( li.getAttribute( 'data-index' ) ) );
			}
		} );
		ui.list.addEventListener( 'mousemove', function ( e ) {
			const li = e.target.closest( '.aafwc__item' );
			if (
				li &&
				Number( li.getAttribute( 'data-index' ) ) !== ui.active
			) {
				setActive( Number( li.getAttribute( 'data-index' ) ), true );
			}
		} );
		document.body.appendChild( ui.root );
	}

	function statusRegion() {
		if ( ! ui.status ) {
			ui.status = document.createElement( 'div' );
			ui.status.id = STATUS_ID;
			ui.status.className = 'aafwc-visually-hidden';
			ui.status.setAttribute( 'role', 'status' );
			ui.status.setAttribute( 'aria-live', 'polite' );
			ui.status.setAttribute( 'aria-atomic', 'true' );
			document.body.appendChild( ui.status );
		}
		return ui.status;
	}

	function announce( message ) {
		const region = statusRegion();
		region.textContent = '';
		if ( message ) {
			setTimeout( function () {
				region.textContent = message;
			}, 60 );
		}
	}

	/**
	 * Mark a main address field as a combobox (only fields the plugin manages).
	 *
	 * @param {Element} input Address line 1 field.
	 */
	function prepareInput( input ) {
		if ( input.getAttribute( 'aria-controls' ) === LIST_ID ) {
			return;
		}
		input.setAttribute( 'role', 'combobox' );
		input.setAttribute( 'aria-autocomplete', 'list' );
		input.setAttribute( 'aria-haspopup', 'listbox' );
		input.setAttribute( 'aria-expanded', 'false' );
		input.setAttribute( 'aria-controls', LIST_ID );
	}

	function position() {
		if ( ! ui.input || ! ui.root ) {
			return;
		}
		const r = ui.input.getBoundingClientRect();
		const viewportHeight =
			window.innerHeight || document.documentElement.clientHeight;
		if (
			( r.width === 0 && r.height === 0 ) ||
			r.bottom < 0 ||
			r.top > viewportHeight
		) {
			close();
			return;
		}
		const below = viewportHeight - r.bottom - 8;
		const above = r.top - 8;
		const wanted = Math.min( ui.list.scrollHeight + 40, 320 );
		const flip = below < Math.min( wanted, 200 ) && above > below;
		ui.root.style.left = Math.max( 0, r.left ) + 'px';
		ui.root.style.width = r.width + 'px';
		if ( flip ) {
			ui.root.style.top = 'auto';
			ui.root.style.bottom = viewportHeight - r.top + 4 + 'px';
		} else {
			ui.root.style.bottom = 'auto';
			ui.root.style.top = r.bottom + 4 + 'px';
		}
		ui.list.style.maxHeight =
			Math.max( 120, Math.min( 280, ( flip ? above : below ) - 40 ) ) +
			'px';
		ui.root.setAttribute(
			'dir',
			window.getComputedStyle( ui.input ).direction === 'rtl'
				? 'rtl'
				: 'ltr'
		);
		ui.root.classList.toggle( 'is-above', flip );
	}

	function isOpen() {
		return !! ( ui.root && ui.root.classList.contains( 'is-open' ) );
	}

	function open() {
		buildList();
		ui.root.classList.add( 'is-open' );
		position();
		if ( ui.input ) {
			ui.input.setAttribute( 'aria-expanded', 'true' );
		}
	}

	function close() {
		if ( ui.root ) {
			ui.root.classList.remove( 'is-open' );
		}
		if ( ui.input ) {
			ui.input.setAttribute( 'aria-expanded', 'false' );
			ui.input.removeAttribute( 'aria-activedescendant' );
		}
		ui.items = [];
		ui.active = -1;
	}

	function highlight( value, matches ) {
		const frag = document.createDocumentFragment();
		let last = 0;
		( matches || [] ).forEach( function ( m ) {
			const from = m.startOffset || 0;
			const to = m.endOffset || 0;
			if ( to <= from || from < last ) {
				return;
			}
			frag.appendChild(
				document.createTextNode( value.slice( last, from ) )
			);
			const mark = document.createElement( 'mark' );
			mark.textContent = value.slice( from, to );
			frag.appendChild( mark );
			last = to;
		} );
		frag.appendChild( document.createTextNode( value.slice( last ) ) );
		return frag;
	}

	function render( suggestions ) {
		buildList();
		ui.list.textContent = '';
		ui.items = suggestions;
		ui.active = -1;
		if ( ! suggestions.length ) {
			close();
			return;
		}
		suggestions.forEach( function ( s, i ) {
			const li = document.createElement( 'li' );
			li.className = 'aafwc__item';
			li.id = OPTION_ID + i;
			li.setAttribute( 'role', 'option' );
			li.setAttribute( 'aria-selected', 'false' );
			li.setAttribute( 'data-index', i );
			const main = document.createElement( 'span' );
			main.className = 'aafwc__main';
			main.appendChild( highlight( s.main, s.mainMatches ) );
			li.appendChild( main );
			if ( s.secondary ) {
				const secondary = document.createElement( 'span' );
				secondary.className = 'aafwc__secondary';
				secondary.textContent = s.secondary;
				li.appendChild( secondary );
			}
			ui.list.appendChild( li );
		} );
		open();
		const template =
			suggestions.length === 1
				? i18n( 'resultsOne' )
				: i18n( 'resultsMany' );
		announce( template.replace( '%d', suggestions.length ) );
	}

	function setActive( index, fromPointer ) {
		const lis = ui.list ? ui.list.querySelectorAll( '.aafwc__item' ) : [];
		if ( ! lis.length ) {
			return;
		}
		ui.active = ( index + lis.length ) % lis.length;
		Array.prototype.forEach.call( lis, function ( li, i ) {
			const on = i === ui.active;
			li.classList.toggle( 'is-active', on );
			li.setAttribute( 'aria-selected', on ? 'true' : 'false' );
			if ( on && ! fromPointer ) {
				// Scroll inside the list only, never the page.
				const top = li.offsetTop;
				const bottom = top + li.offsetHeight;
				if ( top < ui.list.scrollTop ) {
					ui.list.scrollTop = top;
				} else if (
					bottom >
					ui.list.scrollTop + ui.list.clientHeight
				) {
					ui.list.scrollTop = bottom - ui.list.clientHeight;
				}
			}
		} );
		if ( ui.input ) {
			ui.input.setAttribute(
				'aria-activedescendant',
				OPTION_ID + ui.active
			);
		}
	}

	/* ------------------------------------------------------------------ */
	/* Searching and picking                                                */
	/* ------------------------------------------------------------------ */

	function search( input, form, text ) {
		const thisRequest = ++requestCount;
		suggest( text, selectedCountry( form ), form.search ).then(
			function ( suggestions ) {
				if (
					thisRequest !== requestCount ||
					ui.input !== input ||
					input.ownerDocument.activeElement !== input
				) {
					return; // An older request, or the customer moved to another field.
				}
				render( suggestions );
			}
		);
	}

	function choose( index ) {
		const item = ui.items[ index ];
		const form = ui.form;
		if ( ! item || ! form ) {
			return;
		}
		close();
		details( item.placeId ).then( function ( place ) {
			if ( ! place ) {
				return;
			}
			const address = toAddress( place, {
				source: 'plugin-list',
				type: form.type,
				kind: form.kind,
			} );
			if ( ! address ) {
				return;
			}
			log( 'Filling address', address );
			fill( form, address );
			announce( i18n( 'filled' ) );
		} );
	}

	/* ------------------------------------------------------------------ */
	/* Filling the fields                                                   */
	/* ------------------------------------------------------------------ */

	/**
	 * Write a value the way a person typing would: native setter + real events.
	 * React (block checkout) only keeps values set like this; jQuery listeners
	 * (classic checkout, selectWoo) also receive these native events.
	 *
	 * @param {Element} el    Field.
	 * @param {string}  value Value.
	 * @return {boolean} Whether a field was written.
	 */
	function setValue( el, value ) {
		if ( ! el || value === undefined || value === null ) {
			return false;
		}
		let proto = window.HTMLInputElement.prototype;
		if ( el.tagName === 'SELECT' ) {
			proto = window.HTMLSelectElement.prototype;
		} else if ( el.tagName === 'TEXTAREA' ) {
			proto = window.HTMLTextAreaElement.prototype;
		}
		const descriptor = Object.getOwnPropertyDescriptor( proto, 'value' );
		if ( descriptor && descriptor.set ) {
			descriptor.set.call( el, value );
		} else {
			el.value = value;
		}
		el.dispatchEvent( new window.Event( 'input', { bubbles: true } ) );
		el.dispatchEvent( new window.Event( 'change', { bubbles: true } ) );
		return true;
	}

	function optionsOf( select ) {
		const states = {};
		Array.prototype.forEach.call( select.options, function ( o ) {
			if ( o.value ) {
				states[ o.value ] = o.textContent;
			}
		} );
		return states;
	}

	function setState( form, address ) {
		const el = form.get( 'state' );
		if ( ! el ) {
			return;
		}
		if ( el.tagName === 'SELECT' ) {
			const code = parser.resolveState(
				address,
				optionsOf( el ),
				parserOptions()
			);
			if ( code ) {
				setValue( el, code );
			} else {
				log( 'No matching state option for', address.stateCandidates );
			}
		} else if ( el.type !== 'hidden' ) {
			setValue( el, address.stateName || address.stateCode );
		}
	}

	function setUnit( form, unit ) {
		const key = form.key;
		const el = form.get( 'address_2' );
		const mine = ui.filled[ key ] || '';
		if ( ! unit ) {
			// New address has no apartment: clear the old one only if this plugin put it there.
			if ( el && mine && el.value === mine ) {
				setValue( el, '' );
			}
			ui.filled[ key ] = '';
			return;
		}
		if ( el ) {
			if ( ! el.value || el.value === mine ) {
				setValue( el, unit );
				ui.filled[ key ] = unit;
			}
			return;
		}
		// The block checkout hides "Apartment, suite" behind a toggle: open it, then fill it.
		const street = form.get( 'address_1' );
		const scope = street
			? street.closest( '.wc-block-components-address-form' )
			: null;
		const toggle = scope
			? scope.querySelector(
					'.wc-block-components-address-form__address_2-toggle'
				)
			: null;
		if ( toggle ) {
			toggle.click();
			setTimeout( function () {
				if ( setValue( form.get( 'address_2' ), unit ) ) {
					ui.filled[ key ] = unit;
				}
			}, 150 );
		}
	}

	function fillRest( form, address ) {
		if ( form.kind === 'calculator' ) {
			setValue( form.get( 'city' ), address.city );
			setValue( form.get( 'postcode' ), address.postcode );
			setState( form, address );
			return;
		}
		setValue( form.get( 'address_1' ), address.address_1 );
		setValue( form.get( 'city' ), address.city );
		setValue( form.get( 'postcode' ), address.postcode );
		setState( form, address );
		setUnit( form, address.address_2 );
	}

	function secondPass( form, address, startedAt ) {
		// The block checkout can re-render after the first values land. Once the
		// customer types again, their changes win: never put the old values back.
		if ( lastTyped > startedAt ) {
			return;
		}
		const street = form.get( 'address_1' );
		if (
			form.kind !== 'calculator' &&
			street &&
			street.value !== address.address_1
		) {
			setValue( street, address.address_1 );
		}
		const state = form.get( 'state' );
		if ( state && state.tagName === 'SELECT' && ! state.value ) {
			setState( form, address );
		}
		const city = form.get( 'city' );
		if ( city && ! city.value && address.city ) {
			setValue( city, address.city );
		}
		const postcode = form.get( 'postcode' );
		if ( postcode && ! postcode.value && address.postcode ) {
			setValue( postcode, address.postcode );
		}
	}

	function fill( form, address ) {
		const startedAt = Date.now();
		const countryEl = form.get( 'country' );
		let countryChanges = false;
		if (
			countryEl &&
			address.country &&
			countryEl.tagName === 'SELECT' &&
			String( countryEl.value ).toUpperCase() !== address.country
		) {
			// Changing country redraws the state field, so give the form a moment.
			const option = Array.prototype.filter.call(
				countryEl.options,
				( o ) => o.value.toUpperCase() === address.country
			)[ 0 ];
			if ( option ) {
				setValue( countryEl, option.value );
				countryChanges = true;
			}
		}
		setTimeout(
			function () {
				fillRest( form, address );
				setTimeout( () => secondPass( form, address, startedAt ), 400 );
			},
			countryChanges ? 450 : 0
		);
	}

	ui.filled = {}; // Apartment values this plugin wrote, per form, so it never erases the customer's own.

	/* ------------------------------------------------------------------ */
	/* Page-wide listeners (survive the block checkout redrawing)           */
	/* ------------------------------------------------------------------ */

	function onFocusIn( e ) {
		const form = formFor( e.target );
		if ( form && ownListAllowed( form ) && ! core.blocked ) {
			prepareInput( e.target );
		}
	}

	function onInput( e ) {
		if ( ! e.isTrusted ) {
			return; // Our own value changes, not the customer typing.
		}
		lastTyped = Date.now();
		const input = e.target;
		const form = formFor( input );
		if ( ! form ) {
			return;
		}
		clearTimeout( typingTimer );
		if ( ! ownListAllowed( form ) ) {
			if ( ui.input === input ) {
				close();
			}
			return;
		}
		if ( ui.input && ui.input !== input ) {
			close();
		}
		prepareInput( input );
		ui.input = input;
		ui.form = form;
		const text = input.value.trim();
		if ( text.length < minChars() ) {
			close();
			return;
		}
		input.setAttribute( 'autocomplete', 'off' );
		typingTimer = setTimeout(
			() => search( input, form, text ),
			debounceMs()
		);
	}

	function onKeydown( e ) {
		if ( ! isOpen() || e.target !== ui.input ) {
			return;
		}
		if ( e.key === 'ArrowDown' || e.key === 'Down' ) {
			e.preventDefault();
			setActive( ui.active + 1 );
		} else if ( e.key === 'ArrowUp' || e.key === 'Up' ) {
			e.preventDefault();
			setActive( ui.active - 1 );
		} else if ( e.key === 'Enter' ) {
			// Never let Enter submit the checkout while the list is open.
			e.preventDefault();
			e.stopPropagation();
			if ( ui.active >= 0 ) {
				choose( ui.active );
			} else {
				close();
			}
		} else if ( e.key === 'Escape' || e.key === 'Esc' ) {
			e.preventDefault();
			e.stopPropagation();
			close();
		} else if ( e.key === 'Tab' ) {
			close();
		}
	}

	function onFocusOut( e ) {
		if ( e.target === ui.input ) {
			setTimeout( function () {
				if (
					! ui.pointerDown &&
					ui.input &&
					ui.input.ownerDocument.activeElement !== ui.input
				) {
					close();
				}
			}, 200 );
		}
	}

	function reposition() {
		if ( isOpen() ) {
			position();
		}
	}

	function start() {
		window.AAFWC = core;
		core.ready = true;
		document.addEventListener( 'focusin', onFocusIn, true );
		document.addEventListener( 'input', onInput, true );
		document.addEventListener( 'keydown', onKeydown, true );
		document.addEventListener( 'focusout', onFocusOut, true );
		window.addEventListener( 'resize', reposition );
		window.addEventListener( 'scroll', reposition, true );
		if ( window.visualViewport ) {
			window.visualViewport.addEventListener( 'resize', reposition );
			window.visualViewport.addEventListener( 'scroll', reposition );
		}
		log(
			'Ready. Type at least ' +
				minChars() +
				' characters in an address field.',
			config
		);
	}

	/**
	 * Start whenever this script runs: on DOMContentLoaded, immediately, or (when a
	 * performance tool moved things around) as soon as the configuration and parser exist.
	 */
	function boot() {
		let tries = 0;
		( function attempt() {
			config = config || readConfig();
			parser = parser || window.AAFWCParser;
			if ( config && parser ) {
				if (
					config.request &&
					( config.request.apiKey || config.request.proxy )
				) {
					start();
				}
				return;
			}
			if ( ++tries < 150 ) {
				setTimeout( attempt, 100 );
			}
		} )();
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
} )();
