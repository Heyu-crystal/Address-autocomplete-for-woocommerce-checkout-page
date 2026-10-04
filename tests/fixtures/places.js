/**
 * Address fixtures: Places API (New) place details (`addressComponents` +
 * `formattedAddress`) and the WooCommerce fields each one should fill.
 *
 * These follow the documented Places API (New) response format and the component
 * types Google uses in each country. They were written by hand, not captured from
 * Google: run `node tools/capture-fixtures.mjs` with a real key to record live
 * responses and compare (see tools/README.md).
 *
 * `language` is the languageCode the place is requested in (default "en").
 * `expected.state` is the WooCommerce state code (or the text typed into a free-text
 * state field when WooCommerce has no list for the country).
 */

/**
 * One address component.
 *
 * @param {string}    longText  Long name.
 * @param {string}    shortText Short name ('' = same as long).
 * @param {...string} types     Component types.
 * @return {Object} Component.
 */
function c( longText, shortText, ...types ) {
	return { longText, shortText: shortText || longText, types };
}

const P = 'political';

module.exports = [
	{
		id: 'au-unit',
		placeId: 'ChIJ_test_AU_miller_street_5',
		query: '5/100 Miller',
		place: {
			formattedAddress:
				'5/100 Miller St, North Sydney NSW 2060, Australia',
			addressComponents: [
				c( '5', '', 'subpremise' ),
				c( '100', '', 'street_number' ),
				c( 'Miller Street', 'Miller St', 'route' ),
				c( 'North Sydney', '', 'locality', P ),
				c(
					'North Sydney Council',
					'',
					'administrative_area_level_2',
					P
				),
				c( 'New South Wales', 'NSW', 'administrative_area_level_1', P ),
				c( 'Australia', 'AU', 'country', P ),
				c( '2060', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '100 Miller Street',
			address_2: '5',
			city: 'North Sydney',
			state: 'NSW',
			postcode: '2060',
			country: 'AU',
		},
		variants: [
			{
				options: { unitFormat: 'combined', streetName: 'short' },
				expected: { address_1: '5/100 Miller St', address_2: '' },
			},
		],
	},
	{
		id: 'au-no-unit',
		placeId: 'ChIJ_test_AU_george_street',
		query: '200 George',
		place: {
			formattedAddress: '200 George St, Sydney NSW 2000, Australia',
			addressComponents: [
				c( '200', '', 'street_number' ),
				c( 'George Street', 'George St', 'route' ),
				c( 'Sydney', '', 'locality', P ),
				c(
					'Council of the City of Sydney',
					'',
					'administrative_area_level_2',
					P
				),
				c( 'New South Wales', 'NSW', 'administrative_area_level_1', P ),
				c( 'Australia', 'AU', 'country', P ),
				c( '2000', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '200 George Street',
			address_2: '',
			city: 'Sydney',
			state: 'NSW',
			postcode: '2000',
			country: 'AU',
		},
	},
	{
		id: 'au-vic',
		placeId: 'ChIJ_test_AU_collins_street',
		query: '1 Collins',
		place: {
			formattedAddress: '1 Collins St, Melbourne VIC 3000, Australia',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Collins Street', 'Collins St', 'route' ),
				c( 'Melbourne', '', 'locality', P ),
				c( 'Melbourne City', '', 'administrative_area_level_2', P ),
				c( 'Victoria', 'VIC', 'administrative_area_level_1', P ),
				c( 'Australia', 'AU', 'country', P ),
				c( '3000', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '1 Collins Street',
			address_2: '',
			city: 'Melbourne',
			state: 'VIC',
			postcode: '3000',
			country: 'AU',
		},
	},
	{
		id: 'nz-auckland',
		placeId: 'ChIJ_test_NZ_queen_street',
		query: '1 Queen Street Auckland',
		place: {
			formattedAddress:
				'1 Queen Street, Auckland CBD, Auckland 1010, New Zealand',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Queen Street', 'Queen St', 'route' ),
				c(
					'Auckland CBD',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'Auckland', '', 'locality', P ),
				c( 'Auckland', '', 'administrative_area_level_1', P ),
				c( 'New Zealand', 'NZ', 'country', P ),
				c( '1010', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '1 Queen Street',
			address_2: '',
			city: 'Auckland',
			state: 'AUK',
			postcode: '1010',
			country: 'NZ',
		},
	},
	{
		id: 'nz-macron',
		placeId: 'ChIJ_test_NZ_broadway_avenue',
		query: '100 Broadway Avenue',
		place: {
			formattedAddress:
				'100 Broadway Avenue, Palmerston North 4410, New Zealand',
			addressComponents: [
				c( '100', '', 'street_number' ),
				c( 'Broadway Avenue', 'Broadway Ave', 'route' ),
				c(
					'Palmerston North Central',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'Palmerston North', '', 'locality', P ),
				c( 'Manawatū-Whanganui', '', 'administrative_area_level_1', P ),
				c( 'New Zealand', 'NZ', 'country', P ),
				c( '4410', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '100 Broadway Avenue',
			address_2: '',
			city: 'Palmerston North',
			state: 'MWT',
			postcode: '4410',
			country: 'NZ',
		},
	},
	{
		id: 'nz-apostrophe',
		placeId: 'ChIJ_test_NZ_emerson_street',
		query: '1 Emerson Street Napier',
		place: {
			formattedAddress:
				'1 Emerson Street, Napier South, Napier 4110, New Zealand',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Emerson Street', 'Emerson St', 'route' ),
				c(
					'Napier South',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'Napier', '', 'locality', P ),
				c( "Hawke's Bay", '', 'administrative_area_level_1', P ),
				c( 'New Zealand', 'NZ', 'country', P ),
				c( '4110', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '1 Emerson Street',
			address_2: '',
			city: 'Napier',
			state: 'HKB',
			postcode: '4110',
			country: 'NZ',
		},
	},
	{
		id: 'us-california',
		placeId: 'ChIJ_test_US_amphitheatre_parkway',
		query: '1600 Amphitheatre',
		place: {
			formattedAddress:
				'1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
			addressComponents: [
				c( '1600', '', 'street_number' ),
				c( 'Amphitheatre Parkway', 'Amphitheatre Pkwy', 'route' ),
				c( 'Mountain View', '', 'locality', P ),
				c( 'Santa Clara County', '', 'administrative_area_level_2', P ),
				c( 'California', 'CA', 'administrative_area_level_1', P ),
				c( 'United States', 'US', 'country', P ),
				c( '94043', '', 'postal_code' ),
				c( '1351', '', 'postal_code_suffix' ),
			],
		},
		expected: {
			address_1: '1600 Amphitheatre Parkway',
			address_2: '',
			city: 'Mountain View',
			state: 'CA',
			postcode: '94043',
			country: 'US',
		},
	},
	{
		id: 'us-brooklyn-apartment',
		placeId: 'ChIJ_test_US_jay_street_apt',
		query: '350 Jay Street',
		place: {
			formattedAddress: '350 Jay St Apt 4B, Brooklyn, NY 11201, USA',
			addressComponents: [
				c( 'Apt 4B', '', 'subpremise' ),
				c( '350', '', 'street_number' ),
				c( 'Jay Street', 'Jay St', 'route' ),
				c( 'Downtown Brooklyn', '', 'neighborhood', P ),
				c( 'Brooklyn', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Kings County', '', 'administrative_area_level_2', P ),
				c( 'New York', 'NY', 'administrative_area_level_1', P ),
				c( 'United States', 'US', 'country', P ),
				c( '11201', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '350 Jay Street',
			address_2: 'Apt 4B',
			city: 'Brooklyn',
			state: 'NY',
			postcode: '11201',
			country: 'US',
		},
	},
	{
		id: 'ca-ontario',
		placeId: 'ChIJ_test_CA_bremner_boulevard',
		query: '290 Bremner',
		place: {
			formattedAddress: '290 Bremner Blvd, Toronto, ON M5V 3L9, Canada',
			addressComponents: [
				c( '290', '', 'street_number' ),
				c( 'Bremner Boulevard', 'Bremner Blvd', 'route' ),
				c( 'Downtown Toronto', '', 'neighborhood', P ),
				c( 'Old Toronto', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Toronto', '', 'locality', P ),
				c( 'Toronto', '', 'administrative_area_level_2', P ),
				c( 'Ontario', 'ON', 'administrative_area_level_1', P ),
				c( 'Canada', 'CA', 'country', P ),
				c( 'M5V 3L9', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '290 Bremner Boulevard',
			address_2: '',
			city: 'Toronto',
			state: 'ON',
			postcode: 'M5V 3L9',
			country: 'CA',
		},
	},
	{
		id: 'gb-london',
		placeId: 'ChIJ_test_GB_downing_street',
		query: '10 Downing',
		place: {
			formattedAddress: '10 Downing St, London SW1A 2AA, UK',
			addressComponents: [
				c( '10', '', 'street_number' ),
				c( 'Downing Street', 'Downing St', 'route' ),
				c( 'London', '', 'postal_town' ),
				c( 'Greater London', '', 'administrative_area_level_2', P ),
				c( 'England', '', 'administrative_area_level_1', P ),
				c( 'United Kingdom', 'GB', 'country', P ),
				c( 'SW1A 2AA', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '10 Downing Street',
			address_2: '',
			city: 'London',
			state: 'Greater London',
			postcode: 'SW1A 2AA',
			country: 'GB',
		},
	},
	{
		id: 'gb-postal-town',
		placeId: 'ChIJ_test_GB_station_road',
		query: '12 Station Road Hampton',
		place: {
			formattedAddress:
				'12 Station Rd, Hampton-in-Arden, Solihull B92 0BJ, UK',
			addressComponents: [
				c( '12', '', 'street_number' ),
				c( 'Station Road', 'Station Rd', 'route' ),
				c( 'Hampton-in-Arden', '', 'locality', P ),
				c( 'Solihull', '', 'postal_town' ),
				c( 'West Midlands', '', 'administrative_area_level_2', P ),
				c( 'England', '', 'administrative_area_level_1', P ),
				c( 'United Kingdom', 'GB', 'country', P ),
				c( 'B92 0BJ', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '12 Station Road',
			address_2: '',
			city: 'Solihull',
			state: 'West Midlands',
			postcode: 'B92 0BJ',
			country: 'GB',
		},
	},
	{
		id: 'ie-dublin',
		placeId: 'ChIJ_test_IE_grafton_street',
		query: '1 Grafton Street',
		place: {
			formattedAddress: '1 Grafton Street, Dublin 2, D02 X285, Ireland',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Grafton Street', 'Grafton St', 'route' ),
				c( 'Dublin 2', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Dublin', '', 'locality', P ),
				c(
					'County Dublin',
					'Co. Dublin',
					'administrative_area_level_1',
					P
				),
				c( 'Ireland', 'IE', 'country', P ),
				c( 'D02 X285', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '1 Grafton Street',
			address_2: '',
			city: 'Dublin',
			state: 'D',
			postcode: 'D02 X285',
			country: 'IE',
		},
	},
	{
		id: 'ie-cork',
		placeId: 'ChIJ_test_IE_patrick_street',
		query: '10 Saint Patrick Street Cork',
		place: {
			formattedAddress:
				"10 St Patrick's St, Centre, Cork, T12 X123, Ireland",
			addressComponents: [
				c( '10', '', 'street_number' ),
				c( "Saint Patrick's Street", "St Patrick's St", 'route' ),
				c( 'Centre', '', 'neighborhood', P ),
				c( 'Cork', '', 'locality', P ),
				c(
					'County Cork',
					'Co. Cork',
					'administrative_area_level_1',
					P
				),
				c( 'Ireland', 'IE', 'country', P ),
				c( 'T12 X123', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: "10 Saint Patrick's Street",
			address_2: '',
			city: 'Cork',
			state: 'CO',
			postcode: 'T12 X123',
			country: 'IE',
		},
	},
	{
		id: 'de-berlin',
		placeId: 'ChIJ_test_DE_unter_den_linden',
		query: 'Unter den Linden 77',
		place: {
			formattedAddress: 'Unter den Linden 77, 10117 Berlin, Germany',
			addressComponents: [
				c( '77', '', 'street_number' ),
				c( 'Unter den Linden', '', 'route' ),
				c( 'Mitte', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Berlin', '', 'locality', P ),
				c( 'Berlin', 'BE', 'administrative_area_level_1', P ),
				c( 'Germany', 'DE', 'country', P ),
				c( '10117', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Unter den Linden 77',
			address_2: '',
			city: 'Berlin',
			state: 'DE-BE',
			postcode: '10117',
			country: 'DE',
		},
	},
	{
		id: 'de-bayern-german',
		language: 'de',
		placeId: 'ChIJ_test_DE_marienplatz',
		query: 'Marienplatz 8',
		place: {
			formattedAddress: 'Marienplatz 8, 80331 München, Deutschland',
			addressComponents: [
				c( '8', '', 'street_number' ),
				c( 'Marienplatz', '', 'route' ),
				c(
					'Altstadt-Lehel',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'München', '', 'locality', P ),
				c( 'Oberbayern', '', 'administrative_area_level_2', P ),
				c( 'Bayern', 'BY', 'administrative_area_level_1', P ),
				c( 'Deutschland', 'DE', 'country', P ),
				c( '80331', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Marienplatz 8',
			address_2: '',
			city: 'München',
			state: 'DE-BY',
			postcode: '80331',
			country: 'DE',
		},
	},
	{
		id: 'fr-paris',
		placeId: 'ChIJ_test_FR_faubourg_saint_honore',
		query: '55 Rue du Faubourg',
		place: {
			formattedAddress:
				'55 Rue du Faubourg Saint-Honoré, 75008 Paris, France',
			addressComponents: [
				c( '55', '', 'street_number' ),
				c(
					'Rue du Faubourg Saint-Honoré',
					'Rue du Faubourg Saint-Honoré',
					'route'
				),
				c( 'Paris', '', 'locality', P ),
				c(
					'Département de Paris',
					'',
					'administrative_area_level_2',
					P
				),
				c( 'Île-de-France', 'IDF', 'administrative_area_level_1', P ),
				c( 'France', 'FR', 'country', P ),
				c( '75008', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '55 Rue du Faubourg Saint-Honoré',
			address_2: '',
			city: 'Paris',
			state: '',
			postcode: '75008',
			country: 'FR',
		},
	},
	{
		id: 'it-roma',
		placeId: 'ChIJ_test_IT_via_del_corso',
		query: 'Via del Corso 12',
		place: {
			formattedAddress: 'Via del Corso, 12, 00186 Roma RM, Italy',
			addressComponents: [
				c( '12', '', 'street_number' ),
				c( 'Via del Corso', '', 'route' ),
				c( 'Roma', '', 'locality', P ),
				c( 'Roma', '', 'administrative_area_level_3', P ),
				c(
					'Città Metropolitana di Roma',
					'RM',
					'administrative_area_level_2',
					P
				),
				c( 'Lazio', '', 'administrative_area_level_1', P ),
				c( 'Italy', 'IT', 'country', P ),
				c( '00186', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Via del Corso, 12',
			address_2: '',
			city: 'Roma',
			state: 'RM',
			postcode: '00186',
			country: 'IT',
		},
	},
	{
		id: 'it-milan-english',
		placeId: 'ChIJ_test_IT_via_dante',
		query: 'Via Dante 2 Milan',
		place: {
			formattedAddress: 'Via Dante, 2, 20121 Milano MI, Italy',
			addressComponents: [
				c( '2', '', 'street_number' ),
				c( 'Via Dante', '', 'route' ),
				c( 'Milan', '', 'locality', P ),
				c( 'Milan', '', 'administrative_area_level_3', P ),
				c(
					'Metropolitan City of Milan',
					'MI',
					'administrative_area_level_2',
					P
				),
				c( 'Lombardy', '', 'administrative_area_level_1', P ),
				c( 'Italy', 'IT', 'country', P ),
				c( '20121', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Via Dante, 2',
			address_2: '',
			city: 'Milan',
			state: 'MI',
			postcode: '20121',
			country: 'IT',
		},
	},
	{
		id: 'es-madrid',
		placeId: 'ChIJ_test_ES_calle_de_alcala',
		query: 'Calle de Alcalá 50',
		place: {
			formattedAddress: 'C. de Alcalá, 50, Centro, 28014 Madrid, Spain',
			addressComponents: [
				c( '50', '', 'street_number' ),
				c( 'Calle de Alcalá', 'C. de Alcalá', 'route' ),
				c( 'Centro', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Madrid', '', 'locality', P ),
				c( 'Madrid', 'M', 'administrative_area_level_2', P ),
				c(
					'Comunidad de Madrid',
					'MD',
					'administrative_area_level_1',
					P
				),
				c( 'Spain', 'ES', 'country', P ),
				c( '28014', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Calle de Alcalá, 50',
			address_2: '',
			city: 'Madrid',
			state: 'M',
			postcode: '28014',
			country: 'ES',
		},
	},
	{
		id: 'es-bizkaia-alias',
		placeId: 'ChIJ_test_ES_gran_via_bilbao',
		query: 'Gran Vía 1 Bilbao',
		place: {
			formattedAddress:
				'Gran Vía de Don Diego López de Haro, 1, 48001 Bilbao, Bizkaia, Spain',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Gran Vía de Don Diego López de Haro', 'Gran Vía', 'route' ),
				c( 'Bilbao', '', 'locality', P ),
				c( 'Bizkaia', 'Bizkaia', 'administrative_area_level_2', P ),
				c( 'País Vasco', 'PV', 'administrative_area_level_1', P ),
				c( 'Spain', 'ES', 'country', P ),
				c( '48001', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Gran Vía de Don Diego López de Haro, 1',
			address_2: '',
			city: 'Bilbao',
			state: 'BI',
			postcode: '48001',
			country: 'ES',
		},
	},
	{
		id: 'nl-amsterdam',
		placeId: 'ChIJ_test_NL_damrak',
		query: 'Damrak 1',
		place: {
			formattedAddress: 'Damrak 1, 1012 LG Amsterdam, Netherlands',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Damrak', '', 'route' ),
				c(
					'Amsterdam-Centrum',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'Amsterdam', '', 'locality', P ),
				c( 'Amsterdam', '', 'administrative_area_level_2', P ),
				c( 'Noord-Holland', 'NH', 'administrative_area_level_1', P ),
				c( 'Netherlands', 'NL', 'country', P ),
				c( '1012 LG', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Damrak 1',
			address_2: '',
			city: 'Amsterdam',
			state: '',
			postcode: '1012 LG',
			country: 'NL',
		},
	},
	{
		id: 'jp-tokyo-japanese',
		language: 'ja',
		placeId: 'ChIJ_test_JP_dogenzaka_ja',
		query: '道玄坂2丁目24',
		place: {
			formattedAddress:
				'日本、〒150-0043 東京都渋谷区道玄坂２丁目２４−１',
			addressComponents: [
				c( '1', '', 'premise' ),
				c( '24', '', 'sublocality_level_4', 'sublocality', P ),
				c( '2丁目', '', 'sublocality_level_2', 'sublocality', P ),
				c( '道玄坂', '', 'sublocality_level_1', 'sublocality', P ),
				c( '渋谷区', '', 'locality', P ),
				c( '東京都', '', 'administrative_area_level_1', P ),
				c( '日本', 'JP', 'country', P ),
				c( '150-0043', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '道玄坂2丁目24-1',
			address_2: '',
			city: '渋谷区',
			state: 'JP13',
			postcode: '150-0043',
			country: 'JP',
		},
	},
	{
		id: 'jp-tokyo-english',
		placeId: 'ChIJ_test_JP_dogenzaka_en',
		query: '2-24-1 Dogenzaka',
		place: {
			formattedAddress:
				'2-chōme-24-1 Dōgenzaka, Shibuya, Tokyo 150-0043, Japan',
			addressComponents: [
				c( '1', '', 'premise' ),
				c( '24', '', 'sublocality_level_4', 'sublocality', P ),
				c( '2-chōme', '', 'sublocality_level_2', 'sublocality', P ),
				c( 'Dōgenzaka', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Shibuya', '', 'locality', P ),
				c( 'Tokyo', '', 'administrative_area_level_1', P ),
				c( 'Japan', 'JP', 'country', P ),
				c( '150-0043', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '2-chōme-24-1 Dōgenzaka',
			address_2: '',
			city: 'Shibuya',
			state: 'JP13',
			postcode: '150-0043',
			country: 'JP',
		},
	},
	{
		id: 'jp-yokohama-ward',
		language: 'ja',
		placeId: 'ChIJ_test_JP_honcho_yokohama',
		query: '本町6丁目50',
		place: {
			formattedAddress:
				'日本、〒231-0005 神奈川県横浜市中区本町６丁目５０−１０',
			addressComponents: [
				c( '10', '', 'premise' ),
				c( '50', '', 'sublocality_level_4', 'sublocality', P ),
				c( '6丁目', '', 'sublocality_level_2', 'sublocality', P ),
				c( '本町', '', 'sublocality_level_1', 'sublocality', P ),
				c( '中区', '', 'locality', P, 'ward' ),
				c( '横浜市', '', 'locality', P ),
				c( '神奈川県', '', 'administrative_area_level_1', P ),
				c( '日本', 'JP', 'country', P ),
				c( '231-0005', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '本町6丁目50-10',
			address_2: '',
			city: '横浜市中区',
			state: 'JP14',
			postcode: '231-0005',
			country: 'JP',
		},
	},
	{
		id: 'sg-raffles',
		placeId: 'ChIJ_test_SG_raffles_place',
		query: '1 Raffles Place',
		place: {
			formattedAddress: '1 Raffles Pl, Singapore 048616',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Raffles Place', 'Raffles Pl', 'route' ),
				c( 'Downtown Core', '', 'neighborhood', P ),
				c( 'Singapore', 'SG', 'country', P ),
				c( '048616', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '1 Raffles Place',
			address_2: '',
			city: 'Singapore',
			state: '',
			postcode: '048616',
			country: 'SG',
		},
	},
	{
		id: 'hk-kowloon',
		placeId: 'ChIJ_test_HK_nathan_road',
		query: '100 Nathan Road',
		place: {
			formattedAddress: '100 Nathan Rd, Tsim Sha Tsui, Hong Kong',
			addressComponents: [
				c( '100', '', 'street_number' ),
				c( 'Nathan Road', 'Nathan Rd', 'route' ),
				c( 'Tsim Sha Tsui', '', 'neighborhood', P ),
				c( 'Kowloon', '', 'administrative_area_level_1', P ),
				c( 'Hong Kong', 'HK', 'country', P ),
			],
		},
		expected: {
			address_1: '100 Nathan Road',
			address_2: '',
			city: 'Tsim Sha Tsui',
			state: 'KOWLOON',
			postcode: '',
			country: 'HK',
		},
	},
	{
		id: 'cn-beijing-chinese',
		language: 'zh-CN',
		placeId: 'ChIJ_test_CN_jianguo_road',
		query: '建国路88号',
		place: {
			formattedAddress: '中国北京市朝阳区建国路88号 邮政编码: 100022',
			addressComponents: [
				c( '88号', '', 'street_number' ),
				c( '建国路', '', 'route' ),
				c( '朝阳区', '', 'sublocality_level_1', 'sublocality', P ),
				c( '北京市', '', 'locality', P ),
				c( '北京市', '', 'administrative_area_level_1', P ),
				c( '中国', 'CN', 'country', P ),
				c( '100022', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '朝阳区建国路88号',
			address_2: '',
			city: '北京市',
			state: 'CN2',
			postcode: '100022',
			country: 'CN',
		},
	},
	{
		id: 'cn-shanghai-english',
		placeId: 'ChIJ_test_CN_century_avenue',
		query: '1 Century Avenue',
		place: {
			formattedAddress: '1 Century Ave, Pudong, Shanghai, China, 200120',
			addressComponents: [
				c( '1', '', 'street_number' ),
				c( 'Century Avenue', 'Century Ave', 'route' ),
				c( 'Pudong', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Shanghai', '', 'locality', P ),
				c( 'Shanghai', '', 'administrative_area_level_1', P ),
				c( 'China', 'CN', 'country', P ),
				c( '200120', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '1 Century Avenue, Pudong',
			address_2: '',
			city: 'Shanghai',
			state: 'CN10',
			postcode: '200120',
			country: 'CN',
		},
	},
	{
		id: 'cn-guangdong-province',
		placeId: 'ChIJ_test_CN_tianhe_road',
		query: '208 Tianhe Road',
		place: {
			formattedAddress:
				'208 Tianhe Rd, Tianhe District, Guangzhou, Guangdong Province, China',
			addressComponents: [
				c( '208', '', 'street_number' ),
				c( 'Tianhe Road', 'Tianhe Rd', 'route' ),
				c(
					'Tianhe District',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'Guangzhou', '', 'locality', P ),
				c( 'Guangdong Province', '', 'administrative_area_level_1', P ),
				c( 'China', 'CN', 'country', P ),
				c( '510620', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '208 Tianhe Road, Tianhe District',
			address_2: '',
			city: 'Guangzhou',
			state: 'CN20',
			postcode: '510620',
			country: 'CN',
		},
	},
	{
		id: 'in-bengaluru',
		placeId: 'ChIJ_test_IN_mg_road',
		query: '12 MG Road Bengaluru',
		place: {
			formattedAddress:
				'12, Mahatma Gandhi Rd, Indiranagar, Bengaluru, Karnataka 560038, India',
			addressComponents: [
				c( '12', '', 'street_number' ),
				c( 'Mahatma Gandhi Road', 'Mahatma Gandhi Rd', 'route' ),
				c( 'Indiranagar', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Bengaluru', '', 'locality', P ),
				c( 'Bangalore Urban', '', 'administrative_area_level_3', P ),
				c( 'Karnataka', 'KA', 'administrative_area_level_1', P ),
				c( 'India', 'IN', 'country', P ),
				c( '560038', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: '12, Mahatma Gandhi Road, Indiranagar',
			address_2: '',
			city: 'Bengaluru',
			state: 'KA',
			postcode: '560038',
			country: 'IN',
		},
	},
	{
		id: 'in-telangana-code-differs',
		placeId: 'ChIJ_test_IN_road_no_36',
		query: 'Road Number 36 Jubilee Hills',
		place: {
			formattedAddress:
				'Road Number 36, Jubilee Hills, Hyderabad, Telangana 500033, India',
			addressComponents: [
				c( 'Road Number 36', 'Rd Number 36', 'route' ),
				c(
					'Jubilee Hills',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'Hyderabad', '', 'locality', P ),
				c( 'Hyderabad', '', 'administrative_area_level_3', P ),
				c( 'Telangana', 'TG', 'administrative_area_level_1', P ),
				c( 'India', 'IN', 'country', P ),
				c( '500033', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Road Number 36, Jubilee Hills',
			address_2: '',
			city: 'Hyderabad',
			state: 'TS',
			postcode: '500033',
			country: 'IN',
		},
	},
	{
		id: 'br-sao-paulo',
		placeId: 'ChIJ_test_BR_avenida_paulista',
		query: 'Avenida Paulista 1578',
		place: {
			formattedAddress:
				'Av. Paulista, 1578 - Bela Vista, São Paulo - SP, 01310-200, Brazil',
			addressComponents: [
				c( '1578', '', 'street_number' ),
				c( 'Avenida Paulista', 'Av. Paulista', 'route' ),
				c( 'Bela Vista', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'São Paulo', '', 'administrative_area_level_2', P ),
				c( 'São Paulo', 'SP', 'administrative_area_level_1', P ),
				c( 'Brazil', 'BR', 'country', P ),
				c( '01310-200', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Avenida Paulista, 1578',
			address_2: '',
			city: 'São Paulo',
			state: 'SP',
			postcode: '01310-200',
			country: 'BR',
		},
	},
	{
		id: 'br-unit',
		placeId: 'ChIJ_test_BR_rua_oscar_freire',
		query: 'Rua Oscar Freire 379',
		place: {
			formattedAddress:
				'R. Oscar Freire, 379 - apto 52 - Jardim Paulista, São Paulo - SP, 01426-001, Brazil',
			addressComponents: [
				c( 'apto 52', '', 'subpremise' ),
				c( '379', '', 'street_number' ),
				c( 'Rua Oscar Freire', 'R. Oscar Freire', 'route' ),
				c(
					'Jardim Paulista',
					'',
					'sublocality_level_1',
					'sublocality',
					P
				),
				c( 'São Paulo', '', 'administrative_area_level_2', P ),
				c(
					'State of São Paulo',
					'SP',
					'administrative_area_level_1',
					P
				),
				c( 'Brazil', 'BR', 'country', P ),
				c( '01426-001', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Rua Oscar Freire, 379',
			address_2: 'apto 52',
			city: 'São Paulo',
			state: 'SP',
			postcode: '01426-001',
			country: 'BR',
		},
	},
	{
		id: 'mx-cdmx',
		placeId: 'ChIJ_test_MX_paseo_de_la_reforma',
		query: 'Paseo de la Reforma 222',
		place: {
			formattedAddress:
				'Av. Paseo de la Reforma 222, Juárez, Cuauhtémoc, 06600 Ciudad de México, CDMX, Mexico',
			addressComponents: [
				c( '222', '', 'street_number' ),
				c(
					'Avenida Paseo de la Reforma',
					'Av. Paseo de la Reforma',
					'route'
				),
				c( 'Juárez', '', 'sublocality_level_1', 'sublocality', P ),
				c( 'Ciudad de México', '', 'locality', P ),
				c( 'Cuauhtémoc', '', 'administrative_area_level_2', P ),
				c(
					'Ciudad de México',
					'CDMX',
					'administrative_area_level_1',
					P
				),
				c( 'Mexico', 'MX', 'country', P ),
				c( '06600', '', 'postal_code' ),
			],
		},
		expected: {
			address_1: 'Avenida Paseo de la Reforma 222',
			address_2: '',
			city: 'Ciudad de México',
			state: 'DF',
			postcode: '06600',
			country: 'MX',
		},
	},
];
