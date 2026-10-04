/**
 * Address Autocomplete for WooCommerce: address parser.
 *
 * Turns a Google Places API (New) place (`addressComponents` + `formattedAddress`)
 * into WooCommerce address fields, and matches Google's state/province to
 * WooCommerce's state codes.
 *
 * No DOM access, so the same file runs in the browser (window.AAFWCParser)
 * and in Node for the unit tests (module.exports).
 *
 * @param {Object}       root    Global object (window in browsers).
 * @param {() => Object} factory Builds the parser.
 */
( function ( root, factory ) {
	const api = factory();
	if ( typeof module === 'object' && module.exports ) {
		module.exports = api;
	} else {
		root.AAFWCParser = api;
	}
} )( typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	/**
	 * Rules used when a country has no rules of its own.
	 *
	 * numberAfterStreet  Write the house number after the street name ("Musterstraße 12").
	 * numberSeparator    Text between street and number ("Via del Corso, 12", "12, MG Road").
	 * cityTypes          Google component types tried, in order, for the city field.
	 * stateTypes         Google component types tried, in order, for the state field.
	 * streetExtras       Components added after the street (smallest first), e.g. districts.
	 * combineUnit        Write the unit into address 1 as "5/100 Miller St" when the
	 *                    "combined" unit format is chosen.
	 * cityFallbackCountry Use the country name as the city (city states such as Singapore).
	 * codePrefix         WooCommerce state code = prefix + Google short code ("DE-" + "BY").
	 * stateAliases       Normalised Google name => WooCommerce state code.
	 */
	const DEFAULT_RULES = {
		numberAfterStreet: false,
		numberSeparator: ' ',
		cityTypes: [
			'locality',
			'postal_town',
			'sublocality_level_1',
			'sublocality',
			'administrative_area_level_3',
			'administrative_area_level_2',
		],
		stateTypes: [ 'administrative_area_level_1' ],
		streetExtras: [],
		combineUnit: false,
		cityFallbackCountry: false,
		codePrefix: '',
		stateAliases: {},
	};

	// Countries that write the house number after the street name.
	const NUMBER_AFTER_STREET = [
		'AL',
		'AR',
		'AT',
		'BA',
		'BE',
		'BG',
		'BO',
		'BR',
		'BY',
		'CH',
		'CL',
		'CY',
		'CZ',
		'DE',
		'DK',
		'EC',
		'EE',
		'ES',
		'FI',
		'GR',
		'HR',
		'HU',
		'ID',
		'IL',
		'IS',
		'IT',
		'KZ',
		'LI',
		'LT',
		'LV',
		'MD',
		'ME',
		'MK',
		'MX',
		'NL',
		'NO',
		'PE',
		'PL',
		'PT',
		'PY',
		'RO',
		'RS',
		'RU',
		'SE',
		'SI',
		'SK',
		'TR',
		'UA',
		'UY',
		'VE',
	];

	// Japanese prefecture names (as Google returns them in Japanese) => WooCommerce codes.
	const JP_PREFECTURES = [
		'北海道',
		'青森県',
		'岩手県',
		'宮城県',
		'秋田県',
		'山形県',
		'福島県',
		'茨城県',
		'栃木県',
		'群馬県',
		'埼玉県',
		'千葉県',
		'東京都',
		'神奈川県',
		'新潟県',
		'富山県',
		'石川県',
		'福井県',
		'山梨県',
		'長野県',
		'岐阜県',
		'静岡県',
		'愛知県',
		'三重県',
		'滋賀県',
		'京都府',
		'大阪府',
		'兵庫県',
		'奈良県',
		'和歌山県',
		'鳥取県',
		'島根県',
		'岡山県',
		'広島県',
		'山口県',
		'徳島県',
		'香川県',
		'愛媛県',
		'高知県',
		'福岡県',
		'佐賀県',
		'長崎県',
		'熊本県',
		'大分県',
		'宮崎県',
		'鹿児島県',
		'沖縄県',
	];
	const JP_ALIASES = {};
	JP_PREFECTURES.forEach( function ( name, i ) {
		JP_ALIASES[ name ] = 'JP' + ( i < 9 ? '0' : '' ) + ( i + 1 );
	} );

	const COUNTRY_RULES = {
		AU: { combineUnit: true },
		NZ: { combineUnit: true },
		GB: {
			// The post town is what Royal Mail expects as the town; the county is level 2.
			cityTypes: [
				'postal_town',
				'locality',
				'sublocality_level_1',
				'administrative_area_level_3',
			],
			stateTypes: [ 'administrative_area_level_2' ],
		},
		IE: {
			cityTypes: [
				'locality',
				'postal_town',
				'sublocality_level_1',
				'administrative_area_level_3',
			],
			stateTypes: [
				'administrative_area_level_1',
				'administrative_area_level_2',
			],
		},
		US: {
			cityTypes: [
				'locality',
				'sublocality_level_1',
				'sublocality',
				'neighborhood',
				'administrative_area_level_3',
				'postal_town',
			],
		},
		DE: { codePrefix: 'DE-' },
		IT: {
			numberSeparator: ', ',
			cityTypes: [
				'locality',
				'administrative_area_level_3',
				'postal_town',
			],
			// WooCommerce uses Italian provinces (level 2, e.g. "RM"), not regions.
			stateTypes: [
				'administrative_area_level_2',
				'administrative_area_level_1',
			],
			stateAliases: {
				valledaosta: 'AO',
				aostavalley: 'AO',
				valleedaoste: 'AO',
				rome: 'RM',
				milan: 'MI',
				turin: 'TO',
				naples: 'NA',
				florence: 'FI',
				venice: 'VE',
				genoa: 'GE',
				padua: 'PD',
				mantua: 'MN',
				syracuse: 'SR',
				southsardinia: 'SU',
				southtyrol: 'BZ',
				sudtirol: 'BZ',
			},
		},
		ES: {
			numberSeparator: ', ',
			cityTypes: [
				'locality',
				'administrative_area_level_3',
				'administrative_area_level_4',
				'postal_town',
			],
			// WooCommerce uses Spanish provinces (level 2), not autonomous communities.
			stateTypes: [
				'administrative_area_level_2',
				'administrative_area_level_1',
			],
			stateAliases: {
				acoruna: 'C',
				lacoruna: 'C',
				coruna: 'C',
				alava: 'VI',
				araba: 'VI',
				arabaalava: 'VI',
				bizkaia: 'BI',
				vizcaya: 'BI',
				biscay: 'BI',
				gipuzkoa: 'SS',
				guipuzcoa: 'SS',
				illesbalears: 'PM',
				islasbaleares: 'PM',
				balearicislands: 'PM',
				baleares: 'PM',
				girona: 'GI',
				gerona: 'GI',
				lleida: 'L',
				lerida: 'L',
				ourense: 'OR',
				orense: 'OR',
				castello: 'CS',
				castellon: 'CS',
				alacant: 'A',
				alicante: 'A',
				valencia: 'V',
				navarre: 'NA',
				nafarroa: 'NA',
				navarra: 'NA',
				laspalmas: 'GC',
				santacruzdetenerife: 'TF',
				comunidaddemadrid: 'M',
				communityofmadrid: 'M',
				principadodeasturias: 'O',
				asturias: 'O',
				regiondemurcia: 'MU',
				murcia: 'MU',
				cantabria: 'S',
				larioja: 'LO',
			},
		},
		BR: {
			numberSeparator: ', ',
			// Brazilian cities are often level 2 only; the sublocality is the bairro, never the city.
			cityTypes: [
				'locality',
				'administrative_area_level_2',
				'postal_town',
			],
		},
		MX: {
			cityTypes: [
				'locality',
				'administrative_area_level_2',
				'sublocality_level_1',
				'postal_town',
			],
			stateAliases: {
				cdmx: 'DF',
				ciudaddemexico: 'DF',
				mexicocity: 'DF',
				distritofederal: 'DF',
				mex: 'MX',
				edomex: 'MX',
				estadodemexico: 'MX',
				stateofmexico: 'MX',
				mexico: 'MX',
			},
		},
		JP: {
			layout: 'jp',
			cityTypes: [ 'locality', 'administrative_area_level_2' ],
			stateAliases: JP_ALIASES,
		},
		CN: {
			cityTypes: [
				'locality',
				'administrative_area_level_2',
				'administrative_area_level_1',
			],
			streetExtras: [ 'sublocality_level_1' ],
			stateAliases: {
				内蒙古: 'CN6',
				内蒙古自治区: 'CN6',
				innermongolia: 'CN6',
				guangxi: 'CN21',
				ningxia: 'CN29',
				xinjiang: 'CN32',
				tibet: 'CN31',
				xizang: 'CN31',
				macau: 'CN30',
				macao: 'CN30',
			},
		},
		HK: {
			cityTypes: [
				'neighborhood',
				'sublocality_level_1',
				'sublocality',
				'locality',
				'administrative_area_level_2',
			],
			stateAliases: {
				hongkongisland: 'HONG KONG',
				hongkong: 'HONG KONG',
				香港島: 'HONG KONG',
				kowloon: 'KOWLOON',
				九龍: 'KOWLOON',
				九龙: 'KOWLOON',
				newterritories: 'NEW TERRITORIES',
				新界: 'NEW TERRITORIES',
			},
		},
		SG: {
			cityTypes: [ 'locality', 'postal_town' ],
			cityFallbackCountry: true,
		},
		IN: {
			numberSeparator: ', ',
			cityTypes: [
				'locality',
				'administrative_area_level_3',
				'administrative_area_level_2',
				'postal_town',
			],
			// Areas matter for delivery in India, so keep them with the street.
			streetExtras: [
				'sublocality_level_3',
				'sublocality_level_2',
				'sublocality_level_1',
			],
			stateAliases: {
				telangana: 'TS',
				odisha: 'OD',
				orissa: 'OD',
				uttarakhand: 'UK',
				uttaranchal: 'UK',
				puducherry: 'PY',
				pondicherry: 'PY',
				nctofdelhi: 'DL',
				delhi: 'DL',
			},
		},
	};

	NUMBER_AFTER_STREET.forEach( function ( code ) {
		COUNTRY_RULES[ code ] = Object.assign(
			{ numberAfterStreet: true },
			COUNTRY_RULES[ code ] || {}
		);
	} );

	/**
	 * Rules for one country, with optional overrides (from the PHP filter
	 * `aafwc_country_rules`, passed in the page configuration).
	 *
	 * @param {string} country   Two-letter country code.
	 * @param {Object} overrides Map of country code => partial rules.
	 * @return {Object} Rules.
	 */
	function getRules( country, overrides ) {
		const rules = Object.assign(
			{},
			DEFAULT_RULES,
			COUNTRY_RULES[ country ] || {}
		);
		const extra = overrides && overrides[ country ];
		if ( extra && typeof extra === 'object' ) {
			Object.keys( extra ).forEach( function ( key ) {
				if ( key === 'stateAliases' ) {
					rules.stateAliases = Object.assign(
						{},
						rules.stateAliases,
						extra.stateAliases
					);
				} else {
					rules[ key ] = extra[ key ];
				}
			} );
		}
		return rules;
	}

	/* ------------------------------------------------------------------ */
	/* Helpers                                                              */
	/* ------------------------------------------------------------------ */

	const CJK = /[぀-ヿ㐀-鿿豈-﫿]/;
	const HANGUL = /[가-힯]/;
	const DIGIT = /[0-9０-９]/;

	function find( comps, type ) {
		for ( let i = 0; i < comps.length; i++ ) {
			if ( comps[ i ].types && comps[ i ].types.indexOf( type ) !== -1 ) {
				return comps[ i ];
			}
		}
		return null;
	}

	function text( comps, type, useShort ) {
		const c = find( comps, type );
		if ( ! c ) {
			return '';
		}
		return String(
			( useShort
				? c.shortText || c.longText
				: c.longText || c.shortText ) || ''
		).trim();
	}

	/**
	 * Lower-case, accent-free, punctuation-free text for comparing names.
	 * Keeps letters of every script (Japanese and Chinese names included) and
	 * drops words such as "County", "Province" or "Region".
	 *
	 * @param {string} value Text.
	 * @return {string} Normalised text.
	 */
	function normalise( value ) {
		return String( value || '' )
			.toLowerCase()
			.normalize( 'NFD' )
			.replace( /[̀-ͯ]/g, '' )
			.replace(
				/\b(state|province|provincia|county|co|region|prefecture|territory|of|the|metropolitan|autonomous|community)\b\.?/g,
				' '
			)
			.replace(
				/(特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市)$/u,
				''
			)
			.replace( /[^\p{L}\p{N}]/gu, '' );
	}

	function joinStreet( route, number, rules ) {
		if ( ! route || ! number ) {
			return route || number || '';
		}
		if ( CJK.test( route ) ) {
			return route + number; // 中山路100号
		}
		if ( HANGUL.test( route ) ) {
			return route + ' ' + number; // 세종대로 110
		}
		return rules.numberAfterStreet
			? route + rules.numberSeparator + number
			: number +
					( rules.numberSeparator === ' '
						? ' '
						: rules.numberSeparator ) +
					route;
	}

	/**
	 * Japanese addresses have no street names: they are district + chōme + block + building.
	 *
	 * @param {Array} comps Address components (smallest first, as Google sends them).
	 * @return {string} Address line 1, or '' when there is nothing to build it from.
	 */
	function japaneseStreet( comps ) {
		const parts = [];
		comps.forEach( function ( c ) {
			const types = c.types || [];
			const isSub = types.some( function ( t ) {
				return t.indexOf( 'sublocality' ) === 0;
			} );
			if (
				( isSub && types.indexOf( 'ward' ) === -1 ) ||
				types.indexOf( 'premise' ) !== -1
			) {
				parts.push( String( c.longText || '' ).trim() );
			}
		} );
		parts.reverse(); // largest first
		const filtered = parts.filter( Boolean );
		if ( ! filtered.length ) {
			return '';
		}
		const japanese = filtered.some( function ( p ) {
			return CJK.test( p );
		} );
		if ( japanese ) {
			return filtered.reduce( function ( acc, part ) {
				if ( ! acc ) {
					return part;
				}
				if (
					DIGIT.test( acc.slice( -1 ) ) &&
					DIGIT.test( part.charAt( 0 ) )
				) {
					return acc + '-' + part;
				}
				return (
					acc +
					( DIGIT.test( part.charAt( 0 ) ) ||
					CJK.test( part.charAt( 0 ) )
						? ''
						: ' ' ) +
					part
				);
			}, '' );
		}
		const numbers = filtered.filter( function ( p ) {
			return DIGIT.test( p );
		} );
		const names = filtered.filter( function ( p ) {
			return ! DIGIT.test( p );
		} );
		return [ numbers.join( '-' ), names.join( ' ' ) ]
			.filter( Boolean )
			.join( ' ' );
	}

	function japaneseCity( comps, japanese ) {
		const parts = comps
			.filter( function ( c ) {
				const types = c.types || [];
				return (
					types.indexOf( 'locality' ) !== -1 ||
					types.indexOf( 'ward' ) !== -1
				);
			} )
			.map( function ( c ) {
				return String( c.longText || '' ).trim();
			} )
			.filter( Boolean );
		if ( ! parts.length ) {
			return text( comps, 'administrative_area_level_2' );
		}
		// Google lists components smallest first: "中区" before "横浜市".
		return japanese
			? parts.slice().reverse().join( '' )
			: parts.join( ', ' );
	}

	/* ------------------------------------------------------------------ */
	/* Parse                                                                */
	/* ------------------------------------------------------------------ */

	/**
	 * Parse a Places API (New) place into WooCommerce address fields.
	 *
	 * @param {Object} place                Place with addressComponents and formattedAddress.
	 * @param {Object} [options]            Options.
	 * @param {string} [options.streetName] 'long' ("Miller Street") or 'short' ("Miller St").
	 * @param {string} [options.unitFormat] 'separate' (address 2) or 'combined' ("5/100 Miller St" where the country allows it).
	 * @param {Object} [options.rules]      Per-country rule overrides.
	 * @return {Object} Parsed address.
	 */
	function parse( place, options ) {
		const opts = options || {};
		const comps = ( place && place.addressComponents ) || [];
		const country = text( comps, 'country', true ).toUpperCase();
		const rules = getRules( country, opts.rules );
		const useShortRoute = opts.streetName === 'short';
		const japanese = comps.some( function ( c ) {
			return CJK.test( c.longText || '' );
		} );

		const number = text( comps, 'street_number' );
		const route = text( comps, 'route', useShortRoute );
		let street = '';

		if ( rules.layout === 'jp' && ! route ) {
			street = japaneseStreet( comps );
		}
		if ( ! street ) {
			street = joinStreet( route, number, rules );
		}
		if ( ! street ) {
			street =
				text( comps, 'premise' ) ||
				text( comps, 'point_of_interest' ) ||
				text( comps, 'establishment' );
		}

		// Districts/areas that belong with the street (China, India).
		const cityTypes = rules.cityTypes;
		let city = '';
		if ( rules.layout === 'jp' ) {
			city = japaneseCity( comps, japanese );
		} else {
			for ( let i = 0; i < cityTypes.length && ! city; i++ ) {
				city = text( comps, cityTypes[ i ] );
			}
		}
		if ( ! city && rules.cityFallbackCountry ) {
			city = text( comps, 'country' );
		}

		const extras = [];
		( rules.streetExtras || [] ).forEach( function ( type ) {
			const value = text( comps, type );
			if (
				value &&
				value !== city &&
				extras.indexOf( value ) === -1 &&
				value !== street
			) {
				extras.push( value );
			}
		} );
		if ( extras.length && street ) {
			street = CJK.test( street )
				? extras.slice().reverse().join( '' ) + street
				: [ street ].concat( extras ).join( ', ' );
		} else if ( extras.length ) {
			street = CJK.test( extras[ 0 ] )
				? extras.slice().reverse().join( '' )
				: extras.join( ', ' );
		}

		if ( ! street ) {
			street = String( ( place && place.formattedAddress ) || '' )
				.split( ',' )[ 0 ]
				.trim();
		}

		let unit = text( comps, 'subpremise' );
		const floor = text( comps, 'floor' );
		if ( floor && unit.indexOf( floor ) === -1 ) {
			unit = [ unit, floor ].filter( Boolean ).join( ', ' );
		}
		let address1 = street;
		let address2 = unit;
		if (
			unit &&
			opts.unitFormat === 'combined' &&
			rules.combineUnit &&
			/^[0-9]+[a-z]?$/i.test( unit ) &&
			/^[0-9]/.test( street )
		) {
			address1 = unit + '/' + street;
			address2 = '';
		}

		const stateCandidates = [];
		rules.stateTypes.forEach( function ( type ) {
			const c = find( comps, type );
			if ( c && ( c.longText || c.shortText ) ) {
				stateCandidates.push( {
					short: String( c.shortText || c.longText || '' ).trim(),
					long: String( c.longText || c.shortText || '' ).trim(),
				} );
			}
		} );

		return {
			country,
			address_1: address1,
			address_2: address2,
			unit,
			street,
			city,
			postcode: text( comps, 'postal_code' ),
			stateCode: stateCandidates.length ? stateCandidates[ 0 ].short : '',
			stateName: stateCandidates.length ? stateCandidates[ 0 ].long : '',
			stateCandidates,
			formatted: ( place && place.formattedAddress ) || '',
		};
	}

	/* ------------------------------------------------------------------ */
	/* State matching                                                       */
	/* ------------------------------------------------------------------ */

	function nameVariants( name ) {
		// WooCommerce writes some names in two scripts: "Beijing / 北京".
		return String( name || '' )
			.split( '/' )
			.map( normalise )
			.filter( Boolean )
			.concat( [ normalise( name ) ] );
	}

	function longEnough( value ) {
		return value.length >= 4 || ( CJK.test( value ) && value.length >= 2 );
	}

	/**
	 * Find the WooCommerce state code for a parsed address.
	 *
	 * @param {Object}      address   Result of parse().
	 * @param {Object|null} states    WooCommerce states for the country ({ code: name }),
	 *                                {} when the country has no list, or null when unknown.
	 * @param {Object}      [options] Same options as parse() (for rule overrides).
	 * @return {string} WooCommerce state code, or '' when nothing matches.
	 */
	function resolveState( address, states, options ) {
		const rules = getRules( address.country, options && options.rules );
		const candidates = address.stateCandidates || [];
		const aliases = rules.stateAliases || {};
		const known = states && typeof states === 'object' ? states : null;
		const codes = known ? Object.keys( known ) : [];
		const has = function ( code ) {
			return (
				! known || Object.prototype.hasOwnProperty.call( known, code )
			);
		};

		if ( known && ! codes.length ) {
			return '';
		}

		for ( let i = 0; i < candidates.length; i++ ) {
			const short = candidates[ i ].short;
			const long = candidates[ i ].long;
			const upper = short.toUpperCase();
			const compact = upper.replace( /[^A-Z0-9]/g, '' );
			const tries = [
				rules.codePrefix + upper,
				upper,
				rules.codePrefix + compact,
				compact,
			];

			// 1. Google's short code is WooCommerce's code ("NSW", "CA", "DE-BY").
			if ( known ) {
				for ( let t = 0; t < tries.length; t++ ) {
					if ( tries[ t ] && has( tries[ t ] ) ) {
						return tries[ t ];
					}
				}
			}

			// 2. Known differences ("Bizkaia" => "BI", "東京都" => "JP13").
			const aliasKeys = [
				long,
				short,
				normalise( long ),
				normalise( short ),
			];
			for ( let a = 0; a < aliasKeys.length; a++ ) {
				const code = aliases[ aliasKeys[ a ] ];
				if ( code && has( code ) ) {
					return code;
				}
			}

			if ( ! known ) {
				continue;
			}

			// 3. Same name ("Manawatū-Whanganui" = "Manawatu-Whanganui").
			const targets = [ normalise( long ), normalise( short ) ].filter(
				Boolean
			);
			let match = '';
			codes.some( function ( code ) {
				const variants = nameVariants( known[ code ] );
				if ( targets.some( ( t ) => variants.indexOf( t ) !== -1 ) ) {
					match = code;
					return true;
				}
				return false;
			} );
			if ( match ) {
				return match;
			}

			// 4. One name contains the other ("Coahuila de Zaragoza" ~ "Coahuila").
			codes.some( function ( code ) {
				return nameVariants( known[ code ] ).some( function ( v ) {
					return targets.some( function ( t ) {
						if (
							longEnough( v ) &&
							longEnough( t ) &&
							( t.indexOf( v ) !== -1 || v.indexOf( t ) !== -1 )
						) {
							match = code;
							return true;
						}
						return false;
					} );
				} );
			} );
			if ( match ) {
				return match;
			}
		}

		if ( ! known && candidates.length ) {
			// No list to check against: Google's short code with the country prefix is the best guess.
			const first = candidates[ 0 ].short.toUpperCase();
			return /^[A-Z0-9-]{1,10}$/.test( first )
				? rules.codePrefix + first
				: '';
		}
		return '';
	}

	return {
		parse,
		resolveState,
		getRules,
		normalise,
		NUMBER_AFTER_STREET,
	};
} );
