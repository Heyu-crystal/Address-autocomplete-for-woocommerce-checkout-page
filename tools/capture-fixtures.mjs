/**
 * Capture live Places API (New) responses for the address fixtures and compare
 * what the parser makes of them with the expected WooCommerce fields.
 *
 *   GOOGLE_API_KEY=... node tools/capture-fixtures.mjs            # every fixture
 *   GOOGLE_API_KEY=... node tools/capture-fixtures.mjs au-unit    # some fixtures
 *
 * Responses are written to tests/fixtures/captured/<id>.json (not used by the tests
 * until you copy them into tests/fixtures/places.js). Uses one autocomplete and one
 * place details request per fixture, billed to the key's Google Cloud project.
 * The key needs no website restriction for this (or use a separate key).
 */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire( import.meta.url );
const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const fixtures = require( join( root, 'tests/fixtures/places.js' ) );
const parser = require( join( root, 'assets/js/address-parser.js' ) );
const { states: WC_STATES } = require(
	join( root, 'tests/fixtures/wc-states.json' )
);

const key = process.env.GOOGLE_API_KEY;
if ( ! key ) {
	console.error( 'Set GOOGLE_API_KEY.' );
	process.exit( 1 );
}

const wanted = process.argv.slice( 2 );
const outDir = join( root, 'tests/fixtures/captured' );
mkdirSync( outDir, { recursive: true } );

let problems = 0;
for ( const fixture of fixtures ) {
	if ( wanted.length && ! wanted.includes( fixture.id ) ) {
		continue;
	}
	const language = fixture.language || 'en';
	const sessionToken = randomUUID();
	const country = fixture.expected.country;

	const auto = await fetch(
		'https://places.googleapis.com/v1/places:autocomplete',
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-Api-Key': key,
			},
			body: JSON.stringify( {
				input: fixture.place.formattedAddress,
				sessionToken,
				languageCode: language,
				includedRegionCodes: [ country.toLowerCase() ],
			} ),
		}
	).then( ( r ) => r.json() );
	const first = ( auto.suggestions || [] ).find( ( s ) => s.placePrediction );
	if ( ! first ) {
		console.log(
			`✗ ${ fixture.id }: no suggestion`,
			JSON.stringify( auto ).slice( 0, 300 )
		);
		problems++;
		continue;
	}

	const place = await fetch(
		`https://places.googleapis.com/v1/places/${ first.placePrediction.placeId }?sessionToken=${ sessionToken }&languageCode=${ language }`,
		{
			headers: {
				'X-Goog-Api-Key': key,
				'X-Goog-FieldMask': 'addressComponents,formattedAddress',
			},
		}
	).then( ( r ) => r.json() );
	writeFileSync(
		join( outDir, fixture.id + '.json' ),
		JSON.stringify( { autocomplete: first, place }, null, '\t' ) + '\n'
	);

	const address = parser.parse( place, {
		streetName: 'long',
		unitFormat: 'separate',
	} );
	const states = WC_STATES[ address.country ] || {};
	const state = Object.keys( states ).length
		? parser.resolveState( address, states )
		: address.stateName;
	const got = { ...address, state };
	const diffs = [
		'address_1',
		'address_2',
		'city',
		'state',
		'postcode',
		'country',
	]
		.filter(
			( field ) =>
				( got[ field ] || '' ) !== ( fixture.expected[ field ] || '' )
		)
		.map(
			( field ) =>
				`${ field }: expected "${ fixture.expected[ field ] }", live "${ got[ field ] }"`
		);
	if ( diffs.length ) {
		problems++;
		console.log(
			`✗ ${ fixture.id } (${ place.formattedAddress })\n    ${ diffs.join( '\n    ' ) }`
		);
	} else {
		console.log( `✓ ${ fixture.id }` );
	}
}
console.log(
	problems
		? `\n${ problems } fixture(s) differ from live data.`
		: '\nAll fixtures match live data.'
);
process.exitCode = problems ? 1 : 0;
