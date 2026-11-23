import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'credit-card-default',
	remoteSource: {
		url: 'https://huggingface.co/datasets/scikit-learn/credit-card-clients/resolve/f809522649eaf948ad40a11ed575c4bb4d4460c1/UCI_Credit_Card.csv',
		sha256: 'a0f0ab49d6326671d6cd83be5c88dcf18007025fe9a53ecd699119c871176ca1',
		byteLength: 2862995
	},
	name: 'Default of Credit Card Clients',
	tagline:
		'Predict consumer credit card default from 6-month billing histories and demographics.',
	description:
		"Collected from a major Taiwanese card-issuing bank during Taiwan's 2005 consumer credit ('cash card') debt crisis by I-Cheng Yeh and Che-hui Lien (2009), this 30,000-client benchmark pairs demographic attributes and credit limits with six consecutive months (April-September 2005) of repayment status codes, billed balances, and payment amounts to predict October 2005 default (22.1% positive class).\n\nIn both credit analytics and algorithmic fairness benchmarks (Le Quy et al., 2022; Simson et al., 2025; de Castro Vieira et al., 2025), this dataset teaches sequential financial feature collinearity, sequential ID exclusion, handling of undocumented upstream category codes ('EDUCATION' codes 0/5/6, 'MARRIAGE' code 0, and 'PAY_*' codes -2/0), class-imbalanced probability calibration, and Equalized Odds / Demographic Parity auditing across sex, age, education, and marital status.",
	domain: 'finance',
	difficulty: 'advanced',
	tags: ['binary', 'imbalanced', 'undocumented-codes', 'credit-fairness', 'temporal-features'],
	missingValueTokens: ['NA', 'NaN'],
	modeling: {
		defaultTarget: 'default.payment.next.month',
		targetCandidates: [
			{
				column: 'default.payment.next.month',
				taskType: 'binary-classification',
				positiveClass: '1',
				description:
					'Predict whether the cardholder defaults on their October 2005 payment (1 = Default, 0 = Non-default).',
				leakyColumns: []
			}
		]
	},
	columns: [
		{
			name: 'ID',
			displayName: 'Client ID',
			description: 'Sequential row identifier (1 to 30,000) with no predictive meaning.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'LIMIT_BAL',
			displayName: 'Credit Limit',
			description:
				'Total credit line extended to the individual and supplementary family cards in New Taiwan Dollars (NTD).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'SEX',
			displayName: 'Sex',
			description:
				'Recorded binary gender of the cardholder (default rate is 24.2% for men [1] vs. 20.8% for women [2]).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'1': 'Male',
				'2': 'Female'
			},
			sensitive: true
		},
		{
			name: 'EDUCATION',
			displayName: 'Education Level',
			description:
				"Highest educational attainment; contains 345 undocumented codes (0, 5, 6) absent from Yeh & Lien's (2009) original codebook.",
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Undocumented code 0',
				'1': 'Graduate school',
				'2': 'University',
				'3': 'High school',
				'4': 'Others',
				'5': 'Undocumented code 5',
				'6': 'Undocumented code 6'
			},
			sensitive: true
		},
		{
			name: 'MARRIAGE',
			displayName: 'Marital Status',
			description: 'Marital status of the cardholder; contains 54 undocumented 0 codes.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Undocumented code 0',
				'1': 'Married',
				'2': 'Single',
				'3': 'Others'
			},
			sensitive: true
		},
		{
			name: 'AGE',
			displayName: 'Age',
			description: 'Cardholder age in years (21 to 79).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'years',
			sensitive: true
		},
		{
			name: 'PAY_0',
			displayName: 'Repayment Status (September 2005)',
			description:
				'Monthly repayment status in September 2005 (note: codes -2 and 0 were undocumented in the initial UCI release and later clarified as inactive cycle and revolving minimum-paid status).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Revolving credit used (minimum payment met)',
				'1': 'Payment delay for 1 month',
				'2': 'Payment delay for 2 months',
				'3': 'Payment delay for 3 months',
				'4': 'Payment delay for 4 months',
				'5': 'Payment delay for 5 months',
				'6': 'Payment delay for 6 months',
				'7': 'Payment delay for 7 months',
				'8': 'Payment delay for 8+ months',
				'-2': 'No consumption / inactive billing cycle',
				'-1': 'Paid in full duly'
			}
		},
		{
			name: 'PAY_2',
			displayName: 'Repayment Status (August 2005)',
			description:
				'Monthly repayment status in August 2005 (note: codes -2 and 0 were undocumented in the initial UCI release and later clarified as inactive cycle and revolving minimum-paid status).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Revolving credit used (minimum payment met)',
				'1': 'Payment delay for 1 month',
				'2': 'Payment delay for 2 months',
				'3': 'Payment delay for 3 months',
				'4': 'Payment delay for 4 months',
				'5': 'Payment delay for 5 months',
				'6': 'Payment delay for 6 months',
				'7': 'Payment delay for 7 months',
				'8': 'Payment delay for 8+ months',
				'-2': 'No consumption / inactive billing cycle',
				'-1': 'Paid in full duly'
			}
		},
		{
			name: 'PAY_3',
			displayName: 'Repayment Status (July 2005)',
			description:
				'Monthly repayment status in July 2005 (note: codes -2 and 0 were undocumented in the initial UCI release and later clarified as inactive cycle and revolving minimum-paid status).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Revolving credit used (minimum payment met)',
				'1': 'Payment delay for 1 month',
				'2': 'Payment delay for 2 months',
				'3': 'Payment delay for 3 months',
				'4': 'Payment delay for 4 months',
				'5': 'Payment delay for 5 months',
				'6': 'Payment delay for 6 months',
				'7': 'Payment delay for 7 months',
				'8': 'Payment delay for 8+ months',
				'-2': 'No consumption / inactive billing cycle',
				'-1': 'Paid in full duly'
			}
		},
		{
			name: 'PAY_4',
			displayName: 'Repayment Status (June 2005)',
			description:
				'Monthly repayment status in June 2005 (note: codes -2 and 0 were undocumented in the initial UCI release and later clarified as inactive cycle and revolving minimum-paid status).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Revolving credit used (minimum payment met)',
				'1': 'Payment delay for 1 month',
				'2': 'Payment delay for 2 months',
				'3': 'Payment delay for 3 months',
				'4': 'Payment delay for 4 months',
				'5': 'Payment delay for 5 months',
				'6': 'Payment delay for 6 months',
				'7': 'Payment delay for 7 months',
				'8': 'Payment delay for 8+ months',
				'-2': 'No consumption / inactive billing cycle',
				'-1': 'Paid in full duly'
			}
		},
		{
			name: 'PAY_5',
			displayName: 'Repayment Status (May 2005)',
			description:
				'Monthly repayment status in May 2005 (note: codes -2 and 0 were undocumented in the initial UCI release and later clarified as inactive cycle and revolving minimum-paid status).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Revolving credit used (minimum payment met)',
				'2': 'Payment delay for 2 months',
				'3': 'Payment delay for 3 months',
				'4': 'Payment delay for 4 months',
				'5': 'Payment delay for 5 months',
				'6': 'Payment delay for 6 months',
				'7': 'Payment delay for 7 months',
				'8': 'Payment delay for 8+ months',
				'-2': 'No consumption / inactive billing cycle',
				'-1': 'Paid in full duly'
			}
		},
		{
			name: 'PAY_6',
			displayName: 'Repayment Status (April 2005)',
			description:
				'Monthly repayment status in April 2005 (note: codes -2 and 0 were undocumented in the initial UCI release and later clarified as inactive cycle and revolving minimum-paid status).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Revolving credit used (minimum payment met)',
				'2': 'Payment delay for 2 months',
				'3': 'Payment delay for 3 months',
				'4': 'Payment delay for 4 months',
				'5': 'Payment delay for 5 months',
				'6': 'Payment delay for 6 months',
				'7': 'Payment delay for 7 months',
				'8': 'Payment delay for 8+ months',
				'-2': 'No consumption / inactive billing cycle',
				'-1': 'Paid in full duly'
			}
		},
		{
			name: 'BILL_AMT1',
			displayName: 'Bill Statement (September 2005)',
			description:
				'Billed statement balance in September 2005 in New Taiwan Dollars (negative values reflect credit overpayments).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'BILL_AMT2',
			displayName: 'Bill Statement (August 2005)',
			description:
				'Billed statement balance in August 2005 in New Taiwan Dollars (negative values reflect credit overpayments).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'BILL_AMT3',
			displayName: 'Bill Statement (July 2005)',
			description:
				'Billed statement balance in July 2005 in New Taiwan Dollars (negative values reflect credit overpayments).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'BILL_AMT4',
			displayName: 'Bill Statement (June 2005)',
			description:
				'Billed statement balance in June 2005 in New Taiwan Dollars (negative values reflect credit overpayments).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'BILL_AMT5',
			displayName: 'Bill Statement (May 2005)',
			description:
				'Billed statement balance in May 2005 in New Taiwan Dollars (negative values reflect credit overpayments).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'BILL_AMT6',
			displayName: 'Bill Statement (April 2005)',
			description:
				'Billed statement balance in April 2005 in New Taiwan Dollars (negative values reflect credit overpayments).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'PAY_AMT1',
			displayName: 'Previous Payment (September 2005)',
			description:
				'Amount actually paid by the cardholder in September 2005 in New Taiwan Dollars.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'PAY_AMT2',
			displayName: 'Previous Payment (August 2005)',
			description:
				'Amount actually paid by the cardholder in August 2005 in New Taiwan Dollars.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'PAY_AMT3',
			displayName: 'Previous Payment (July 2005)',
			description:
				'Amount actually paid by the cardholder in July 2005 in New Taiwan Dollars.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'PAY_AMT4',
			displayName: 'Previous Payment (June 2005)',
			description:
				'Amount actually paid by the cardholder in June 2005 in New Taiwan Dollars.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'PAY_AMT5',
			displayName: 'Previous Payment (May 2005)',
			description:
				'Amount actually paid by the cardholder in May 2005 in New Taiwan Dollars.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'PAY_AMT6',
			displayName: 'Previous Payment (April 2005)',
			description:
				'Amount actually paid by the cardholder in April 2005 in New Taiwan Dollars.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'NTD'
		},
		{
			name: 'default.payment.next.month',
			displayName: 'Default Next Month (Oct 2005)',
			description: 'Binary indicator of credit card payment default in October 2005.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'No default',
				'1': 'Defaulted next month'
			}
		}
	],
	provenance: {
		homepageUrl: 'https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients',
		sourceRepositoryUrl:
			'https://huggingface.co/datasets/scikit-learn/credit-card-clients/resolve/f809522649eaf948ad40a11ed575c4bb4d4460c1/UCI_Credit_Card.csv',
		license: 'CC-BY-4.0',
		yearPublished: 2009,
		creators: ['I-Cheng Yeh', 'Che-hui Lien'],
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		attribution:
			'Data by I-Cheng Yeh and Che-hui Lien, sourced from https://archive.ics.uci.edu/dataset/350/default+of+credit+card+clients.',
		retrievedAt: '2026-11-13',
		transformations: []
	},
	references: [
		{
			title: 'The Comparisons of Data Mining Techniques for the Predictive Accuracy of Probability of Default of Credit Card Clients',
			authors: ['I-Cheng Yeh', 'Che-hui Lien'],
			year: 2009,
			type: 'seminal-paper',
			url: 'https://doi.org/10.1016/j.eswa.2007.12.020',
			citation:
				'Yeh, I.-C., & Lien, C.-H. (2009). The comparisons of data mining techniques for the predictive accuracy of probability of default of credit card clients. Expert Systems with Applications, 36(2), 2473-2480. https://doi.org/10.1016/j.eswa.2007.12.020'
		},
		{
			title: 'A Survey on Datasets for Fairness-Aware Machine Learning',
			authors: [
				'Tai Le Quy',
				'Arjun Roy',
				'Vasileios Iosifidis',
				'Wenbin Zhang',
				'Eirini Ntoutsi'
			],
			year: 2022,
			type: 'fairness-audit',
			url: 'https://wires.onlinelibrary.wiley.com/doi/10.1002/widm.1452',
			citation:
				'Le Quy, T., Roy, A., Iosifidis, V., Zhang, W., & Ntoutsi, E. (2022). A survey on datasets for fairness-aware machine learning. WIREs Data Mining and Knowledge Discovery, 12(3), e1452. https://doi.org/10.1002/widm.1452'
		},
		{
			title: 'Hugging Face Dataset Card: scikit-learn/credit-card-clients',
			authors: ['scikit-learn Contributors', 'I-Cheng Yeh'],
			year: 2022,
			type: 'documentation',
			url: 'https://huggingface.co/datasets/scikit-learn/credit-card-clients',
			citation:
				'Yeh, I.-C. (2016). Default of Credit Card Clients [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C55S3H'
		}
	],
	ethicsWarnings: [
		"Captured during Taiwan's 2005-2006 Twin-Card consumer debt crisis, meaning macroeconomic delinquency dynamics and bank credit-limit policies reflect a historical crisis regime that does not generalize to modern lending.",
		"Male cardholders exhibit a higher empirical default rate (24.2%) than female cardholders (20.8%), and 'LIMIT_BAL' acts as a historical bank-assigned risk proxy correlated with age, education, and gender."
	]
} satisfies AuthoredDatasetDescriptor;
