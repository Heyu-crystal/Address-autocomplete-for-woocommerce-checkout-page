/**
 * Fake Places API (New) for the browser, using Playwright route interception.
 * Answers from tests/fixtures/places.js and records every request.
 */
const fixtures = require( '../../fixtures/places.js' );

function norm( value ) {
	return String( value || '' )
		.toLowerCase()
		.replace( /\s+/g, ' ' )
		.trim();
}

function matches( item, input ) {
	const q = norm( item.query );
	const i = norm( input );
	return q.startsWith( i ) || i.startsWith( q );
}

/**
 * Build an Autocomplete (New) suggestion for a fixture.
 *
 * @param {Object} item  Fixture.
 * @param {string} input Typed text.
 * @return {Object} Suggestion.
 */
function suggestion( item, input ) {
	const text = item.place.formattedAddress;
	const comma = text.indexOf( ',' );
	const main = comma > 0 ? text.slice( 0, comma ) : text;
	const secondary = comma > 0 ? text.slice( comma + 1 ).trim() : '';
	const length = Math.min( input.length, main.length );
	return {
		placePrediction: {
			place: 'places/' + item.placeId,
			placeId: item.placeId,
			text: { text, matches: [ { endOffset: length } ] },
			structuredFormat: {
				mainText: { text: main, matches: [ { endOffset: length } ] },
				secondaryText: { text: secondary },
			},
			types: [ 'street_address', 'geocode' ],
		},
	};
}

const ERROR_BODIES = {
	403: {
		error: {
			code: 403,
			message:
				'Requests from referer http://localhost:8889/ are blocked.',
			status: 'PERMISSION_DENIED',
			details: [
				{
					'@type': 'type.googleapis.com/google.rpc.ErrorInfo',
					reason: 'API_KEY_HTTP_REFERRER_BLOCKED',
					domain: 'googleapis.com',
				},
			],
		},
	},
};

/**
 * Intercept requests to places.googleapis.com.
 *
 * @param {import('@playwright/test').Page} page      Page.
 * @param {Object}                          [options] { fail: 403 } to refuse every request.
 * @return {Object} { autocomplete: [], details: [] } recorded requests.
 */
async function mockGoogle( page, options = {} ) {
	const log = { autocomplete: [], details: [] };

	await page.route(
		'https://places.googleapis.com/v1/places:autocomplete',
		async ( route ) => {
			const request = route.request();
			const body = JSON.parse( request.postData() || '{}' );
			log.autocomplete.push( { body, headers: request.headers() } );
			if ( options.fail ) {
				return route.fulfill( {
					status: options.fail,
					json: ERROR_BODIES[ options.fail ] || {},
				} );
			}
			const regions = ( body.includedRegionCodes || [] ).map( ( c ) =>
				c.toUpperCase()
			);
			const list = fixtures
				.filter( ( f ) => matches( f, body.input ) )
				.filter(
					( f ) =>
						! regions.length ||
						regions.includes( f.expected.country )
				)
				.slice( 0, 5 )
				.map( ( f ) => suggestion( f, body.input ) );
			return route.fulfill( {
				status: 200,
				json: list.length ? { suggestions: list } : {},
			} );
		}
	);

	await page.route(
		/^https:\/\/places\.googleapis\.com\/v1\/places\/[^:?]+(\?.*)?$/,
		async ( route ) => {
			const request = route.request();
			const url = new URL( request.url() );
			const placeId = decodeURIComponent(
				url.pathname.split( '/' ).pop()
			);
			log.details.push( {
				placeId,
				sessionToken: url.searchParams.get( 'sessionToken' ),
				languageCode: url.searchParams.get( 'languageCode' ),
				headers: request.headers(),
			} );
			if ( options.fail ) {
				return route.fulfill( {
					status: options.fail,
					json: ERROR_BODIES[ options.fail ] || {},
				} );
			}
			const found = fixtures.find( ( f ) => f.placeId === placeId );
			if ( ! found ) {
				return route.fulfill( {
					status: 404,
					json: { error: { code: 404, status: 'NOT_FOUND' } },
				} );
			}
			return route.fulfill( { status: 200, json: found.place } );
		}
	);

	return log;
}

function fixture( id ) {
	const found = fixtures.find( ( f ) => f.id === id );
	if ( ! found ) {
		throw new Error( 'No fixture ' + id );
	}
	return found;
}

module.exports = { mockGoogle, fixture, fixtures, suggestion, matches };
