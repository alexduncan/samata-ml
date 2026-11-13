import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'heart-disease',
	name: 'Cleveland Heart Disease Diagnosis',
	tagline:
		'Diagnose coronary artery disease severity from clinical vitals, ECGs, and fluoroscopy.',
	description:
		"Collected at the Cleveland Clinic Foundation by Dr. Robert Detrano and colleagues between 1981 and 1984 (part of the four-hospital Heart Disease collaboration donated to UCI in 1988), this canonical clinical dataset contains 303 patient cardiology workups across 13 non-invasive and imaging predictors plus angiographic coronary artery narrowing severity ('num', coded 0 to 4).\n\nHeart Disease bridges foundational clinical ML with fairness and data-quality challenges: integer-coded nominal medical attributes ('cp', 'restecg', 'slope', 'thal') that must not be treated as linear quantities, explicit missing values in fluoroscopy ('ca') and thallium scintigraphy ('thal'), severe rare-class scarcity across disease grades 1-4, and a 68% male patient sample reflecting historical under-enrollment and underdiagnosis of women in cardiovascular research.",
	domain: 'healthcare',
	difficulty: 'intermediate',
	tags: ['multiclass', 'coded-categoricals', 'missing-values', 'clinical-fairness', 'cardiology'],
	missingValueTokens: ['NA', 'NaN', '?'],
	modeling: {
		defaultTarget: 'num',
		targetCandidates: [
			{
				column: 'num',
				taskType: 'multiclass-classification',
				description:
					'Predict angiographic coronary artery disease severity grade (0 = <50% vessel narrowing [no disease]; 1 to 4 = increasing multi-vessel stenosis severity).',
				leakyColumns: []
			},
			{
				column: 'exang',
				taskType: 'binary-classification',
				positiveClass: '1',
				description:
					'Predict whether exercise stress testing induces angina pectoris (1 = Yes, 0 = No) from baseline patient indicators.',
				leakyColumns: [
					{
						column: 'oldpeak',
						reason: 'oldpeak leaks information about the target.'
					},
					{
						column: 'slope',
						reason: 'slope leaks information about the target.'
					},
					{
						column: 'thalach',
						reason: 'thalach leaks information about the target.'
					},
					{
						column: 'num',
						reason: 'num leaks information about the target.'
					}
				]
			}
		]
	},
	columns: [
		{
			name: 'age',
			displayName: 'Age',
			description: 'Patient age in years at the time of cardiac catheterization.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'years',
			sensitive: true
		},
		{
			name: 'sex',
			displayName: 'Sex',
			description:
				'Recorded biological sex of the patient (cohort is 68.0% male, 32.0% female).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Female',
				'1': 'Male'
			},
			sensitive: true
		},
		{
			name: 'cp',
			displayName: 'Chest Pain Type',
			description: 'Clinical classification of presenting chest pain syndrome.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'1': 'Typical angina',
				'2': 'Atypical angina',
				'3': 'Non-anginal pain',
				'4': 'Asymptomatic'
			}
		},
		{
			name: 'trestbps',
			displayName: 'Resting Blood Pressure',
			description:
				'Resting systolic arterial blood pressure measured upon hospital admission.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'mm Hg'
		},
		{
			name: 'chol',
			displayName: 'Serum Cholesterol',
			description: 'Total serum cholesterol concentration.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'mg/dL'
		},
		{
			name: 'fbs',
			displayName: 'Fasting Blood Sugar > 120 mg/dL',
			description: 'Indicator of elevated fasting blood glucose exceeding 120 mg/dL.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				'0': 'False (<= 120 mg/dL)',
				'1': 'True (> 120 mg/dL)'
			}
		},
		{
			name: 'restecg',
			displayName: 'Resting ECG Results',
			description: 'Resting 12-lead electrocardiographic classification.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Normal',
				'1': 'ST-T wave abnormality (>0.05 mV elevation/depression)',
				'2': 'Probable or definite left ventricular hypertrophy (Estes criteria)'
			}
		},
		{
			name: 'thalach',
			displayName: 'Max Heart Rate Achieved',
			description: 'Peak heart rate achieved during graded exercise stress testing.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'bpm'
		},
		{
			name: 'exang',
			displayName: 'Exercise-Induced Angina',
			description:
				'Whether chest pain (angina) was provoked during the exercise stress test.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'No',
				'1': 'Yes'
			}
		},
		{
			name: 'oldpeak',
			displayName: 'ST Depression (Oldpeak)',
			description: 'Magnitude of exercise-induced ST-segment depression relative to rest.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'mV'
		},
		{
			name: 'slope',
			displayName: 'Peak Exercise ST Slope',
			description: 'Slope direction of the peak exercise ST segment.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'1': 'Upsloping',
				'2': 'Flat',
				'3': 'Downsloping'
			}
		},
		{
			name: 'ca',
			displayName: 'Major Vessels Colored (Fluoroscopy)',
			description:
				'Number of major coronary vessels (0 to 3) visualized by fluoroscopy (4 missing records).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': '0 major vessels',
				'1': '1 major vessel',
				'2': '2 major vessels',
				'3': '3 major vessels'
			}
		},
		{
			name: 'thal',
			displayName: 'Thallium Stress Scintigraphy',
			description:
				'Myocardial perfusion defect status on thallium-201 scintigraphy (2 missing records).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'3': 'Normal perfusion',
				'6': 'Fixed perfusion defect',
				'7': 'Reversible perfusion defect'
			}
		},
		{
			name: 'num',
			displayName: 'Angiographic Disease Grade',
			description:
				'Coronary angiography diagnosis: 0 indicates <50% luminal narrowing in all major vessels; grades 1-4 reflect >=50% stenosis across increasing vessel counts.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Grade 0: No significant disease (<50% narrowing)',
				'1': 'Grade 1: Mild/single-vessel coronary stenosis',
				'2': 'Grade 2: Moderate coronary stenosis',
				'3': 'Grade 3: Multi-vessel coronary stenosis',
				'4': 'Grade 4: Severe multi-vessel coronary stenosis'
			}
		}
	],
	provenance: {
		homepageUrl: 'https://archive.ics.uci.edu/dataset/45/heart+disease',
		sourceRepositoryUrl: 'https://archive.ics.uci.edu/static/public/45/data.csv',
		license: 'CC-BY-4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		yearPublished: 1988,
		creators: ['Andras Janosi', 'William Steinbrunn', 'Matthias Pfisterer', 'Robert Detrano'],
		attribution:
			'Data by Andras Janosi and William Steinbrunn and Matthias Pfisterer and Robert Detrano, sourced from https://archive.ics.uci.edu/dataset/45/heart+disease.',
		retrievedAt: '2026-11-13',
		transformations: []
	},
	references: [
		{
			title: 'International Application of a New Probability Algorithm for the Diagnosis of Coronary Artery Disease',
			authors: [
				'Robert Detrano',
				'Andras Janosi',
				'William Steinbrunn',
				'Matthias Pfisterer',
				'Johann-Jakob Schmid',
				'Sarbjit Sandhu',
				'Kern H. Guppy',
				'Stella Lee',
				'Victor Froelicher'
			],
			year: 1989,
			type: 'seminal-paper',
			url: 'https://doi.org/10.1016/0002-9149(89)90524-9',
			citation:
				'Detrano, R., Janosi, A., Steinbrunn, W., Pfisterer, M., Schmid, J.-J., Sandhu, S., Guppy, K. H., Lee, S., & Froelicher, V. (1989). International application of a new probability algorithm for the diagnosis of coronary artery disease. The American Journal of Cardiology, 64(5), 304-310. https://doi.org/10.1016/0002-9149(89)90524-9'
		},
		{
			title: 'Algorithmic Bias in AI-Based Diagnostic Models: A Systematic Review and Lifecycle Framework for Fairness Auditing and Governance in Healthcare',
			authors: ['Reyadh Alluhaibi'],
			year: 2026,
			type: 'fairness-audit',
			url: 'https://doi.org/10.3390/healthcare14193293',
			citation:
				'Alluhaibi, R. (2026). Algorithmic bias in AI-based diagnostic models: A systematic review and lifecycle framework for fairness auditing and governance in healthcare. Healthcare, 14(19), 3293. https://doi.org/10.3390/healthcare14193293'
		},
		{
			title: 'A Suite of Fairness Datasets for Tabular Classification',
			authors: ['Martin Hirzel', 'Michael Feffer'],
			year: 2023,
			type: 'fairness-audit',
			url: 'https://arxiv.org/abs/2308.00133',
			citation:
				'Hirzel, M., & Feffer, M. (2023). A suite of fairness datasets for tabular classification. arXiv preprint arXiv:2308.00133.'
		},
		{
			title: 'UCI Machine Learning Repository: Heart Disease Dataset Card',
			authors: [
				'Andras Janosi',
				'William Steinbrunn',
				'Matthias Pfisterer',
				'Robert Detrano'
			],
			year: 1988,
			type: 'documentation',
			url: 'https://archive.ics.uci.edu/dataset/45/heart+disease',
			citation:
				'Janosi, A., Steinbrunn, W., Pfisterer, M., & Detrano, R. (1988). Heart Disease [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C52P4X'
		}
	],
	ethicsWarnings: [
		'Male patients outnumber female patients more than 2-to-1 (206 men vs. 97 women), and positive angiographic stenosis prevalence is 55.3% in men vs. 25.8% in women, causing uncalibrated classifiers to exhibit elevated false-negative rates on female patients presenting with atypical angina.',
		"Note: Many popular Kaggle mirrors labeled 'heart.csv' invert the target coding (0 = disease, 1 = healthy) and alter chest-pain codes; always verify against this canonical UCI Cleveland schema."
	]
} satisfies AuthoredDatasetDescriptor;
