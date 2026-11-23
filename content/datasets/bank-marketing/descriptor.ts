import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'bank-marketing',
	buildSource: {
		url: 'https://archive.ics.uci.edu/ml/machine-learning-databases/00222/bank.zip',
		sha256: '99d7e8eb12401ed278b793984423915411ea8df099e1795f9fefe254f513fe5e',
		byteLength: 579043,
		transform: 'bank-full-zip',
		outputSha256: 'd1513ec63b385506f7cfce9f2c5caa9fe99e7ba4e8c3fa264b3aaf0f849ed32d',
		outputByteLength: 4610348
	},
	name: 'Bank Telemarketing Term Deposit',
	tagline:
		'Predict term-deposit subscriptions with semicolon CSV parsing and call-duration leakage.',
	description:
		"Collected from direct outbound phone-call marketing campaigns of a Portuguese retail banking institution between May 2008 and November 2010 and published by Moro, Cortez, and Rita (2014), this canonical 45,211-record ('bank-full.csv') dataset predicts whether a contacted client subscribes to a long-term bank deposit ('y' = 'yes' in 11.7% of calls).\n\nBank Marketing serves four indispensable functions in Phase 1: (1) testing semicolon-delimited (';') CSV parsing in the browser; (2) illustrating post-outcome target leakage via 'duration' (call length in seconds is unknown before dialing and strongly reveals whether a sale occurred); (3) demonstrating severe 1:7.55 class imbalance where naive accuracy reaches 88.3% while predicting zero subscribers; and (4) auditing U-shaped age-group targeting disparities (25.6% subscription under age 25 and 42.3% over age 60 vs. 10.6% aged 25-60).",
	domain: 'marketing',
	difficulty: 'advanced',
	tags: ['binary', 'semicolon-csv', 'target-leakage', 'severe-imbalance', 'age-fairness'],
	missingValueTokens: ['NA', 'NaN'],
	modeling: {
		defaultTarget: 'y',
		targetCandidates: [
			{
				column: 'y',
				taskType: 'binary-classification',
				positiveClass: 'yes',
				description:
					"Predict whether the contacted client subscribes to a bank term deposit ('yes' vs. 'no') using only pre-call attributes.",
				leakyColumns: [
					{
						column: 'duration',
						reason: 'Post-outcome target leakage: call duration is unknown before placing a call and directly reflects enrollment completion (Moro et al., 2014).'
					}
				]
			}
		]
	},
	columns: [
		{
			name: 'age',
			displayName: 'Client Age',
			description:
				'Client age in years (exhibits U-shaped conversion rates: higher among youth <25 and retirees >60 than working-age adults 25-60).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'years',
			sensitive: true
		},
		{
			name: 'job',
			displayName: 'Occupation',
			description:
				"Client occupation category ('unknown' in 288 records represents unrecorded job status).",
			dataType: 'categorical',
			role: 'feature',
			implicitMissingValues: ['unknown']
		},
		{
			name: 'marital',
			displayName: 'Marital Status',
			description:
				"Client marital status ('married', 'single', or 'divorced' [which includes widowed]).",
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				divorced: 'Divorced or widowed',
				married: 'Married',
				single: 'Single'
			},
			sensitive: true
		},
		{
			name: 'education',
			displayName: 'Education Level',
			description:
				"Highest formal educational tier ('primary', 'secondary', 'tertiary', or 'unknown' in 1,857 records).",
			dataType: 'categorical',
			role: 'feature',
			implicitMissingValues: ['unknown']
		},
		{
			name: 'default',
			displayName: 'Credit in Default',
			description: 'Whether the client currently has credit in default.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				no: 'No',
				yes: 'Yes'
			}
		},
		{
			name: 'balance',
			displayName: 'Average Yearly Balance',
			description:
				'Average yearly bank account balance in euros (can be negative when overdrawn).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'EUR'
		},
		{
			name: 'housing',
			displayName: 'Housing Loan',
			description: 'Whether the client holds an active residential mortgage loan.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				no: 'No',
				yes: 'Yes'
			}
		},
		{
			name: 'loan',
			displayName: 'Personal Loan',
			description: 'Whether the client holds an active personal consumer loan.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				no: 'No',
				yes: 'Yes'
			}
		},
		{
			name: 'contact',
			displayName: 'Contact Channel',
			description:
				"Telecommunication channel used ('cellular', 'telephone', or 'unknown' in 13,020 records).",
			dataType: 'categorical',
			role: 'feature',
			implicitMissingValues: ['unknown']
		},
		{
			name: 'day',
			displayName: 'Last Contact Day of Month',
			description: 'Calendar day of the month (1 to 31) of the last campaign contact.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'month',
			displayName: 'Last Contact Month',
			description:
				"Calendar month abbreviation ('jan' through 'dec') of the last campaign contact.",
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'duration',
			displayName: 'Last Call Duration (Leaky)',
			description:
				'Duration of the last phone call in seconds; unknown prior to placing a call and strongly reveals whether the client stayed on the line to subscribe.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'seconds'
		},
		{
			name: 'campaign',
			displayName: 'Contacts in Current Campaign',
			description:
				'Number of phone contacts performed during this campaign for this client (includes last contact).',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'pdays',
			displayName: 'Days Since Previous Campaign',
			description:
				'Days elapsed since the client was last contacted in a prior campaign (-1 in 36,954 records indicates the client was never previously contacted).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'days',
			implicitMissingValues: [-1]
		},
		{
			name: 'previous',
			displayName: 'Prior Campaign Contacts',
			description:
				'Number of contacts performed before the current marketing campaign for this client.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'poutcome',
			displayName: 'Previous Campaign Outcome',
			description:
				"Outcome of the prior marketing campaign ('success', 'failure', 'other', or 'unknown' for the 36,959 uncontacted/unrecorded cases).",
			dataType: 'categorical',
			role: 'feature',
			implicitMissingValues: ['unknown']
		},
		{
			name: 'y',
			displayName: 'Subscribed Term Deposit',
			description: 'Whether the client subscribed to the offered bank term deposit.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				no: 'Did not subscribe',
				yes: 'Subscribed to term deposit'
			}
		}
	],
	provenance: {
		homepageUrl: 'https://archive.ics.uci.edu/dataset/222/bank+marketing',
		sourceRepositoryUrl:
			'https://archive.ics.uci.edu/ml/machine-learning-databases/00222/bank.zip',
		license: 'CC-BY-4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		yearPublished: 2012,
		creators: ['Sergio Moro', 'Paulo Cortez', 'Paulo Rita'],
		attribution:
			'Data by Sergio Moro and Paulo Cortez and Paulo Rita, sourced from https://archive.ics.uci.edu/dataset/222/bank+marketing.',
		retrievedAt: '2026-11-13',
		transformations: []
	},
	references: [
		{
			title: 'A Data-Driven Approach to Predict the Success of Bank Telemarketing',
			authors: ['Sergio Moro', 'Paulo Cortez', 'Paulo Rita'],
			year: 2014,
			type: 'seminal-paper',
			url: 'https://doi.org/10.1016/j.dss.2014.03.001',
			citation:
				'Moro, S., Cortez, P., & Rita, P. (2014). A data-driven approach to predict the success of bank telemarketing. Decision Support Systems, 62, 22-31. https://doi.org/10.1016/j.dss.2014.03.001'
		},
		{
			title: 'Bias Begins with Data: The FairGround Corpus for Robust and Reproducible Research on Algorithmic Fairness',
			authors: [
				'Jan Simson',
				'Alessandro Fabris',
				'Cosima Froehner',
				'Frauke Kreuter',
				'Christoph Kern'
			],
			year: 2025,
			type: 'fairness-audit',
			url: 'https://arxiv.org/abs/2510.22363',
			citation:
				'Simson, J., Fabris, A., Froehner, C., Kreuter, F., & Kern, C. (2025). Bias begins with data: The FairGround corpus for robust and reproducible research on algorithmic fairness. arXiv preprint arXiv:2510.22363.'
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
		"Variant Ambiguity Warning (Simson et al., 2025): UCI distributes four Bank Marketing files (45,211x17 'bank-full.csv' used here, 4,521x17 'bank.csv', 41,188x21 'bank-additional-full.csv', and 4,119x21 'bank-additional.csv'); never compare metrics across papers without verifying which variant and whether leaky 'duration' were used.",
		'Automated financial product targeting disproportionately selects older retirees (>60) and excludes working-age adults (25-60), raising dual ethical questions around exclusionary financial marketing vs. predatory telemarketing of seniors.'
	]
} satisfies AuthoredDatasetDescriptor;
