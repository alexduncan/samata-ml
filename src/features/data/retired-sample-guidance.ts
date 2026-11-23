import type { SampleDatasetGuidance } from '../../types/sample-dataset';

/** Guidance retained for already ingested samples that are no longer offered. */
export const retiredSampleGuidance: Record<string, SampleDatasetGuidance> = {
	'pima-diabetes': {
		columns: [
			{
				name: 'preg',
				displayName: 'Pregnancies',
				description:
					'Number of times pregnant (note: 0 is a valid clinical count for nulliparous patients, NOT a missing value).',
				dataType: 'numeric',
				role: 'feature'
			},
			{
				name: 'plas',
				displayName: 'Plasma Glucose (2-hr OGTT)',
				description:
					'Plasma glucose concentration at 2 hours in an oral glucose tolerance test; 0 in 5 rows represents unrecorded lab values.',
				dataType: 'numeric',
				role: 'feature',
				unit: 'mg/dL',
				implicitMissingValues: [0]
			},
			{
				name: 'pres',
				displayName: 'Diastolic Blood Pressure',
				description:
					'Resting diastolic arterial blood pressure; 0 in 35 rows is physiologically impossible in living patients and denotes missingness.',
				dataType: 'numeric',
				role: 'feature',
				unit: 'mm Hg',
				implicitMissingValues: [0]
			},
			{
				name: 'skin',
				displayName: 'Triceps Skinfold Thickness',
				description:
					'Triceps skinfold thickness measured via caliper; 0 in 227 rows (29.6%) denotes unmeasured values.',
				dataType: 'numeric',
				role: 'feature',
				unit: 'mm',
				implicitMissingValues: [0]
			},
			{
				name: 'insu',
				displayName: '2-Hour Serum Insulin',
				description:
					'2-hour post-load serum insulin concentration; 0 in 374 rows (48.7%) denotes unmeasured assays.',
				dataType: 'numeric',
				role: 'feature',
				unit: 'mu U/mL',
				implicitMissingValues: [0]
			},
			{
				name: 'mass',
				displayName: 'Body Mass Index (BMI)',
				description:
					'Body mass index (weight in kg divided by height in m squared); 0 in 11 rows denotes missing height/weight.',
				dataType: 'numeric',
				role: 'feature',
				unit: 'kg/m^2',
				implicitMissingValues: [0]
			},
			{
				name: 'pedi',
				displayName: 'Diabetes Pedigree Function',
				description:
					'Composite genetic-family history risk score synthesizing diabetes incidence and age of onset across relatives.',
				dataType: 'numeric',
				role: 'feature'
			},
			{
				name: 'age',
				displayName: 'Age',
				description:
					'Patient age in years (sample restricted to women aged 21 and older; diabetes prevalence is 21.2% under age 30 vs. 49.5% aged 30+).',
				dataType: 'numeric',
				role: 'feature',
				unit: 'years',
				sensitive: true
			},
			{
				name: 'class',
				displayName: 'Diabetes Diagnosis',
				description:
					'Diagnostic indicator of WHO-criteria diabetes mellitus (2-hour post-load plasma glucose >= 200 mg/dL).',
				dataType: 'categorical',
				role: 'feature',
				valueLabels: {
					tested_negative: 'Negative (No WHO diabetes signs)',
					tested_positive: 'Positive (WHO diabetes criteria met)'
				}
			}
		],
		modeling: {
			defaultTarget: 'class',
			targetCandidates: [
				{
					column: 'class',
					taskType: 'binary-classification',
					positiveClass: 'tested_positive',
					description:
						"Predict WHO-criteria diabetes mellitus status ('tested_positive' vs. 'tested_negative').",
					leakyColumns: []
				}
			]
		}
	},
	titanic: {
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
				description:
					"Full town name duplicate of the single-letter 'embarked' port column.",
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
		}
	}
};
