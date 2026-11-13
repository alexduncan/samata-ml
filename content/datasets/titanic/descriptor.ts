import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'titanic',
	name: 'Titanic Passenger Survival',
	tagline: 'Predict passenger survival on the RMS Titanic from demographic and ticket records.',
	description:
		"Historical passenger manifest records from the April 1912 sinking of the RMS Titanic, curated from Encyclopedia Titanica sources by Thomas Cason and Frank E. Harrell Jr. and packaged in the canonical 891-passenger training subset popularized by Kaggle and seaborn.\n\nWidely used as an introductory binary classification benchmark, Titanic combines mixed numeric, boolean, and categorical features, explicit missing values across age (177), cabin deck (688), and embarkation port (2), derived duplicate columns that teach target leakage hygiene ('alive', 'class'), and stark demographic survival disparities shaped by 'women and children first' evacuation norms and third-class structural barriers.",
	domain: 'social-science',
	difficulty: 'beginner',
	tags: ['mixed-types', 'missing-values', 'leakage-hygiene', 'historical-bias', 'classic'],
	missingValueTokens: ['NA', 'NaN'],
	modeling: {
		defaultTarget: 'survived',
		targetCandidates: [
			{
				column: 'survived',
				taskType: 'binary-classification',
				positiveClass: '1',
				description:
					'Predict whether the passenger survived the sinking (1 = Survived, 0 = Did not survive).',
				leakyColumns: [
					{
						column: 'alive',
						reason: "Exact string duplicate of the 'survived' target column."
					}
				]
			},
			{
				column: 'pclass',
				taskType: 'multiclass-classification',
				description:
					'Predict passenger ticket class (1st, 2nd, or 3rd) from fare, family size, and demographics.',
				leakyColumns: [
					{
						column: 'class',
						reason: "Exact string duplicate of 'pclass' (unchecked by default and auto-disabled when predicting 'pclass')."
					},
					{
						column: 'survived',
						reason: 'survived leaks information about the target.'
					},
					{
						column: 'alive',
						reason: "Exact string duplicate of the 'survived' target column."
					}
				]
			}
		]
	},
	columns: [
		{
			name: 'survived',
			displayName: 'Survived',
			description: 'Survival outcome of the passenger in the 1912 sinking.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Did not survive',
				'1': 'Survived'
			}
		},
		{
			name: 'pclass',
			displayName: 'Ticket Class',
			description:
				'Proxy for socioeconomic status and shipboard deck location based on ticket tier.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'1': '1st Class (Upper)',
				'2': '2nd Class (Middle)',
				'3': '3rd Class (Lower)'
			}
		},
		{
			name: 'sex',
			displayName: 'Sex',
			description: 'Recorded biological sex of the passenger.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				female: 'Female',
				male: 'Male'
			},
			sensitive: true
		},
		{
			name: 'age',
			displayName: 'Age',
			description:
				'Passenger age in years (fractional if infant under 1 year; missing for 177 passengers).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'years',
			sensitive: true
		},
		{
			name: 'sibsp',
			displayName: 'Siblings / Spouses Aboard',
			description:
				'Number of siblings or spouses traveling aboard the Titanic with the passenger.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'parch',
			displayName: 'Parents / Children Aboard',
			description:
				'Number of parents or children traveling aboard the Titanic with the passenger.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'fare',
			displayName: 'Passenger Fare',
			description:
				'Ticket fare paid in 1912 British pounds sterling (often shared across multi-person group tickets; 0.0 indicates complimentary or employee passage).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'GBP'
		},
		{
			name: 'embarked',
			displayName: 'Port of Embarkation',
			description: 'Port where the passenger boarded the RMS Titanic.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				C: 'Cherbourg, France',
				Q: 'Queenstown (Cobh), Ireland',
				S: 'Southampton, England'
			}
		},
		{
			name: 'class',
			displayName: 'Ticket Class (String)',
			description:
				"Text duplicate of the integer-coded 'pclass' column added in seaborn's export.",
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'who',
			displayName: 'Demographic Category',
			description:
				"Derived grouping ('man', 'woman', 'child') constructed from 'sex' and 'age'.",
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'adult_male',
			displayName: 'Adult Male',
			description:
				'Boolean indicator equal to True when passenger is male and age >= 16 (or age unknown).',
			dataType: 'boolean',
			role: 'feature'
		},
		{
			name: 'deck',
			displayName: 'Cabin Deck',
			description:
				'Ship deck letter (A through G) extracted from cabin number; missing for 688 of 891 passengers.',
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'embark_town',
			displayName: 'Embarkation Town (String)',
			description: "Full town name duplicate of the single-letter 'embarked' port column.",
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'alive',
			displayName: 'Alive (String)',
			description: "Text duplicate ('yes'/'no') of the binary 'survived' target column.",
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				no: 'Did not survive',
				yes: 'Survived'
			}
		},
		{
			name: 'alone',
			displayName: 'Traveling Alone',
			description:
				"Derived boolean indicator equal to True when both 'sibsp' and 'parch' equal 0.",
			dataType: 'boolean',
			role: 'feature'
		}
	],
	provenance: {
		homepageUrl: 'https://www.openml.org/d/40945',
		sourceRepositoryUrl:
			'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/titanic.csv',
		license: 'CC0-1.0',
		licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
		yearPublished: 1999,
		creators: ['Thomas Cason', 'Frank E. Harrell Jr.'],
		attribution:
			'Data by Thomas Cason and Frank E. Harrell Jr., sourced from https://www.openml.org/d/40945.',
		retrievedAt: '2026-11-13',
		transformations: []
	},
	references: [
		{
			title: "The 'Unusual Episode' Data Revisited",
			authors: ['Robert J. MacG. Dawson'],
			year: 1995,
			type: 'seminal-paper',
			url: 'https://www.tandfonline.com/doi/abs/10.1080/10691898.1995.11910499',
			citation:
				"Dawson, R. J. M. (1995). The 'unusual episode' data revisited. Journal of Statistics Education, 3(3). https://doi.org/10.1080/10691898.1995.11910499"
		},
		{
			title: 'Regression Modeling Strategies: With Applications to Linear Models, Logistic and Ordinal Regression, and Survival Analysis',
			authors: ['Frank E. Harrell Jr.'],
			year: 2015,
			type: 'seminal-paper',
			url: 'https://link.springer.com/book/10.1007/978-3-319-19425-7',
			citation:
				'Harrell, F. E., Jr. (2015). Regression modeling strategies (2nd ed.). Springer. https://doi.org/10.1007/978-3-319-19425-7'
		},
		{
			title: 'A Comprehensive Review and Benchmarking of Fairness-Aware Variants of Machine Learning Models',
			authors: [
				'George Raftopoulos',
				'Nikos Fazakis',
				'Gregory Davrazos',
				'Sotiris Kotsiantis'
			],
			year: 2025,
			type: 'fairness-audit',
			url: 'https://doi.org/10.3390/a18070435',
			citation:
				'Raftopoulos, G., Fazakis, N., Davrazos, G., & Kotsiantis, S. (2025). A comprehensive review and benchmarking of fairness-aware variants of machine learning models. Algorithms, 18(7), 435. https://doi.org/10.3390/a18070435'
		}
	],
	ethicsWarnings: [
		"Historical rescue protocols ('women and children first') and shipboard class segregation produce extreme survival disparities (74.2% female vs. 18.9% male; 63.0% 1st class vs. 24.2% 3rd class), illustrating how social norms and structural privilege become encoded in historical data.",
		"Missingness in 'deck' (77.2%) and 'age' (19.9%) is not missing completely at random (MCAR): 3rd-class passengers were disproportionately less likely to have recorded cabin numbers or ages."
	]
} satisfies AuthoredDatasetDescriptor;
