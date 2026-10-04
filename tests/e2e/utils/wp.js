/**
 * Site helpers for the end-to-end tests. They call the test-only REST API in
 * tests/e2e/setup/mu-plugin.php (active when the site defines AAFWC_E2E).
 */
const BASE = ( process.env.WP_BASE_URL || 'http://localhost:8889' ).replace(
	/\/$/,
	''
);

const DEFAULT_SETTINGS = {
	enabled: 'yes',
	api_key: 'TEST_KEY',
	request_mode: 'browser',
	suggestion_list: 'auto',
	form_block: 'yes',
	form_classic: 'yes',
	form_account: 'yes',
	form_calculator: 'yes',
	custom_forms: '',
	load_assets: 'everywhere',
	restrict_to_selected: 'yes',
	countries: '',
	language: 'en',
	street_name: 'long',
	unit_format: 'separate',
	min_chars: '3',
	debounce: '50',
	consent_category: '',
};

async function call( path, options = {} ) {
	const res = await fetch(
		BASE + '/?rest_route=/aafwc-e2e/v1' + path,
		options
	);
	if ( ! res.ok ) {
		throw new Error(
			`E2E API ${ path } answered ${ res.status }: ${ await res.text() }`
		);
	}
	return res.json();
}

/**
 * Change the test site.
 *
 * @param {Object} state settings, wcAutocomplete, e2e, clearGoogleLog, clearRateLimits, resetCustomer.
 */
function setState( state ) {
	return call( '/state', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( state ),
	} );
}

function info( params = {} ) {
	const query = Object.entries( params )
		.map( ( [ k, v ] ) => `&${ k }=${ encodeURIComponent( v ) }` )
		.join( '' );
	return call( '/info' + query );
}

/**
 * Replace the plugin settings: defaults plus the given changes.
 *
 * @param {Object} changes Settings to change.
 */
const setSettings = ( changes = {} ) =>
	setState( { settings: { ...DEFAULT_SETTINGS, ...changes } } );

/**
 * Turn WooCommerce's built-in address autocomplete on or off.
 *
 * @param {boolean} on On.
 */
const setWooCommerceAutocomplete = ( on ) =>
	setState( { wcAutocomplete: !! on } );

/**
 * Test-only behaviour from the mu-plugin.
 *
 * @param {Object} options { scripts, google, rateLimit }.
 */
const setTestMode = ( options = {} ) => setState( { e2e: options } );

const resetCustomer = () => setState( { resetCustomer: true } );
const clearGoogleLog = () => setState( { clearGoogleLog: true } );
const clearRateLimits = () => setState( { clearRateLimits: true } );

const productId = async () => ( await info() ).productId;
const wcVersion = async () => ( await info() ).wcVersion;
const googleLog = async () => ( await info() ).googleLog || [];

const orderAddress = async ( orderId, type = 'shipping' ) =>
	( await info( { order: orderId, type } ) ).order;
const customerAddress = async ( login, type = 'shipping' ) =>
	( await info( { customer: login, type } ) ).customer;

/**
 * Is this WooCommerce at least the given version?
 *
 * @param {string} min Version such as "10.3".
 * @return {Promise<boolean>} True when it is.
 */
async function wcAtLeast( min ) {
	const have = ( await wcVersion() ).split( '.' ).map( Number );
	const want = min.split( '.' ).map( Number );
	for ( let i = 0; i < want.length; i++ ) {
		if ( ( have[ i ] || 0 ) !== want[ i ] ) {
			return ( have[ i ] || 0 ) > want[ i ];
		}
	}
	return true;
}

module.exports = {
	setState,
	setSettings,
	setWooCommerceAutocomplete,
	setTestMode,
	resetCustomer,
	clearGoogleLog,
	clearRateLimits,
	productId,
	wcVersion,
	wcAtLeast,
	googleLog,
	orderAddress,
	customerAddress,
	DEFAULT_SETTINGS,
};
