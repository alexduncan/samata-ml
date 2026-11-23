import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'titanic-inquiry',
	name: 'Titanic Survival (1912 British Inquiry)',
	tagline: 'Explore survival across the published inquiry strata.',
	description:
		'A reconstruction of the 1912 British inquiry contingency counts. Repeated rows represent people in the same published stratum, not individually recovered records. Age is categorical; fare, names and family attributes are unavailable.',
	domain: 'social-science',
	difficulty: 'beginner',
	tags: ['binary', 'historical', 'fairness'],
	buildSource: {
		url: 'https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/cc03c29690889dbe83089f5206e2422db8c3f71f/csv/datasets/Titanic.csv',
		sha256: 'ca983380c99d10ece64011fef5e07150ce49949d52b517e3fc55c7715938d179',
		byteLength: 846,
		transform: 'titanic-inquiry-counts',
		outputSha256: '10aac9f02b02eacfb809c17807fcdcda1e1fd09a72fc211e69a90c89ccc5b994',
		outputByteLength: 39281
	},
	modeling: {
		defaultTarget: 'survived',
		targetCandidates: [
			{
				column: 'survived',
				taskType: 'binary-classification',
				positiveClass: '1',
				description: 'Whether a person survived the sinking.'
			}
		]
	},
	columns: [
		{
			name: 'passenger_class',
			displayName: 'Class',
			description: 'Passenger class or crew.',
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'sex',
			displayName: 'Sex',
			description: 'Sex as recorded in the published table.',
			dataType: 'categorical',
			role: 'feature',
			sensitive: true
		},
		{
			name: 'age_group',
			displayName: 'Age group',
			description: 'Child or adult.',
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'survived',
			displayName: 'Survived',
			description: 'Survival outcome.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: { '0': 'No', '1': 'Yes' }
		}
	],
	provenance: {
		homepageUrl: 'https://www.titanicinquiry.org/BOTInq/BOTReport/botRepSaved.php',
		sourceRepositoryUrl:
			'https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/cc03c29690889dbe83089f5206e2422db8c3f71f/csv/datasets/Titanic.csv',
		retrievedAt: '2026-11-23',
		license: 'LicenseRef-Public-Domain',
		licenseUrl:
			'https://www.nationalarchives.gov.uk/terms-and-conditions/copyright/copyright-and-related-rights/',
		attribution:
			'British Wreck Commissioner’s Inquiry (1912); published contingency counts transported through the R datasets table.',
		yearPublished: 1912,
		creators: ['British Wreck Commissioner’s Inquiry'],
		transformations: [
			'Expand published contingency counts into repeated non-identifying strata; map survival to 0 or 1.'
		]
	},
	references: [
		{
			title: 'British Wreck Commissioner’s report: numbers saved',
			type: 'documentation',
			url: 'https://www.titanicinquiry.org/BOTInq/BOTReport/botRepSaved.php'
		},
		{
			title: 'Titanic data documentation',
			type: 'documentation',
			url: 'https://search.r-project.org/R/refmans/datasets/html/Titanic.html'
		},
		{
			title: 'Dawson’s teaching dataset',
			type: 'article',
			url: 'https://jse.amstat.org/v3n3/datasets.dawson.html'
		}
	]
} satisfies AuthoredDatasetDescriptor;
