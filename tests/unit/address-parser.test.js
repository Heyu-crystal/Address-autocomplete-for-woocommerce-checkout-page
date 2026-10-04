/**
 * Unit tests for assets/js/address-parser.js. Run with: npm run test:unit
 */
const { describe, test } = require( 'node:test' );
const assert = require( 'node:assert/strict' );

const parser = require( '../../assets/js/address-parser.js' );
const fixtures = require( '../fixtures/places.js' );
const { states: WC_STATES } = require( '../fixtures/wc-states.json' );

const DEFAULTS = { streetName: 'long', unitFormat: 'separate' };

function fill( fixture, options ) {
	const address = parser.parse( fixture.place, options );
	const states = WC_STATES[ address.country ] || {};
	const hasList = Object.keys( states ).length > 0;
	return {
		address,
		states,
		hasList,
		state: hasList ? parser.resolveState( address, states, options ) : '',
	};
}

describe( 'country fixtures', () => {
	for ( const fixture of fixtures ) {
		test( fixture.id, () => {
			const { address, states, hasList, state } = fill(
				fixture,
				DEFAULTS
			);
			const e = fixture.expected;
			assert.equal( address.country, e.country, 'country' );
			assert.equal( address.address_1, e.address_1, 'address_1' );
			assert.equal( address.address_2, e.address_2, 'address_2' );
			assert.equal( address.city, e.city, 'city' );
			assert.equal( address.postcode, e.postcode, 'postcode' );
			if ( hasList ) {
				assert.equal( state, e.state, 'state code' );
				assert.ok(
					e.state === '' || states[ e.state ],
					'expected state exists in WooCommerce'
				);
			} else {
				assert.equal(
					parser.resolveState( address, states ),
					'',
					'no list, no code'
				);
				if ( e.state ) {
					assert.equal(
						address.stateName,
						e.state,
						'free-text state'
					);
				}
			}
		} );
		for ( const [ i, variant ] of ( fixture.variants || [] ).entries() ) {
			test( `${ fixture.id } (variant ${ i + 1 })`, () => {
				const options = { ...DEFAULTS, ...variant.options };
				const { address } = fill( fixture, options );
				for ( const [ key, value ] of Object.entries(
					variant.expected
				) ) {
					assert.equal( address[ key ], value, key );
				}
			} );
		}
	}

	test( 'covers every country the checklist names', () => {
		const covered = new Set( fixtures.map( ( f ) => f.expected.country ) );
		for ( const country of [
			'AU',
			'NZ',
			'US',
			'CA',
			'GB',
			'IE',
			'DE',
			'FR',
			'IT',
			'ES',
			'NL',
			'JP',
			'SG',
			'HK',
			'CN',
			'IN',
			'BR',
		] ) {
			assert.ok( covered.has( country ), country );
		}
	} );
} );

describe( 'parse()', () => {
	const auUnit = fixtures.find( ( f ) => f.id === 'au-unit' );
	const usApartment = fixtures.find(
		( f ) => f.id === 'us-brooklyn-apartment'
	);

	test( 'short street names', () => {
		const address = parser.parse( auUnit.place, { streetName: 'short' } );
		assert.equal( address.address_1, '100 Miller St' );
		assert.equal( address.address_2, '5' );
	} );

	test( 'combined unit only for AU/NZ numeric units', () => {
		const us = parser.parse( usApartment.place, {
			unitFormat: 'combined',
		} );
		assert.equal( us.address_1, '350 Jay Street' );
		assert.equal( us.address_2, 'Apt 4B' );
	} );

	test( 'rule overrides (aafwc_country_rules)', () => {
		const nz = fixtures.find( ( f ) => f.id === 'nz-auckland' );
		const address = parser.parse( nz.place, {
			rules: { NZ: { cityTypes: [ 'sublocality_level_1', 'locality' ] } },
		} );
		assert.equal( address.city, 'Auckland CBD' );
	} );

	test( 'falls back to the first part of the formatted address', () => {
		const address = parser.parse( {
			formattedAddress: 'Somewhere Farm, Rural Road, Nowhere',
			addressComponents: [
				{
					longText: 'Australia',
					shortText: 'AU',
					types: [ 'country' ],
				},
			],
		} );
		assert.equal( address.address_1, 'Somewhere Farm' );
		assert.equal( address.country, 'AU' );
	} );

	test( 'never throws on empty input', () => {
		const address = parser.parse( {} );
		assert.equal( address.address_1, '' );
		assert.equal( address.country, '' );
		assert.equal( parser.parse( null ).city, '' );
	} );

	test( 'floor is kept with the unit', () => {
		const address = parser.parse( {
			addressComponents: [
				{ longText: '3', types: [ 'floor' ] },
				{ longText: '12', types: [ 'subpremise' ] },
				{ longText: '1', types: [ 'street_number' ] },
				{ longText: 'Main Street', types: [ 'route' ] },
				{
					longText: 'United States',
					shortText: 'US',
					types: [ 'country' ],
				},
			],
		} );
		assert.equal( address.address_2, '12, 3' );
	} );
} );

describe( 'resolveState()', () => {
	const nz = fixtures.find( ( f ) => f.id === 'nz-auckland' );

	test( 'older WooCommerce NZ codes are matched by name', () => {
		const address = parser.parse( nz.place );
		assert.equal(
			parser.resolveState( address, {
				NL: 'Northland',
				AK: 'Auckland',
				WA: 'Waikato',
			} ),
			'AK'
		);
	} );

	test( 'unknown list: Google short code with country prefix', () => {
		const de = fixtures.find( ( f ) => f.id === 'de-berlin' );
		assert.equal(
			parser.resolveState( parser.parse( de.place ), null ),
			'DE-BE'
		);
	} );

	test( 'no match returns empty', () => {
		const address = parser.parse( nz.place );
		assert.equal( parser.resolveState( address, { XX: 'Elsewhere' } ), '' );
	} );

	test( 'state options from a <select> (value => label)', () => {
		const au = fixtures.find( ( f ) => f.id === 'au-vic' );
		const options = { NSW: 'New South Wales', VIC: 'Victoria' };
		assert.equal(
			parser.resolveState( parser.parse( au.place ), options ),
			'VIC'
		);
	} );
} );

describe( 'normalise()', () => {
	test( 'drops accents, punctuation and generic words', () => {
		assert.equal(
			parser.normalise( 'Manawatū-Whanganui Region' ),
			'manawatuwhanganui'
		);
		assert.equal( parser.normalise( 'Co. Dublin' ), 'dublin' );
		assert.equal( parser.normalise( 'Guangdong Province' ), 'guangdong' );
		assert.equal( parser.normalise( '北京市' ), '北京' );
	} );
} );
