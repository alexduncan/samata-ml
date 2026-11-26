import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'compas-recidivism',
	name: 'ProPublica COMPAS Two-Year Recidivism',
	tagline: 'Audit criminal recidivism prediction, error-rate disparities, and leakage traps.',
	description:
		"Assembled via Florida public-records requests by ProPublica journalists Julia Angwin, Jeff Larson, Surya Mattu, and Lauren Kirchner (2016) from Broward County Sheriff's Office, Clerk of Courts, and Department of Corrections records (2013-2014), this 7,214-defendant dataset catalyzed the modern discipline of algorithmic fairness. ProPublica revealed that Northpointe's proprietary COMPAS risk score misclassified Black non-recidivists as Medium/High risk at nearly twice the rate of White non-recidivists (44.8% vs. 23.5%), whereas White recidivists were misclassified as Low risk far more often than Black recidivists (47.7% vs. 28.0%).\n\nTechnologically and pedagogically, raw COMPAS is the ultimate testbed for responsible tabular ML pipelines: out of 53 columns, 17 are PII strings, case numbers, dates, or SQLite join duplicates ('id', 'name', 'first', 'last', 'priors_count_1') that freeze browser encoders if left checked, and 24 are proprietary COMPAS scores ('decile_score', 'score_text') or post-screening rearrest records ('is_recid', 'r_case_number', 'end', 'event') that cause catastrophic target leakage if not auto-disabled.",
	domain: 'criminal-justice',
	difficulty: 'advanced',
	tags: ['binary', 'fairness-impossibility', 'pii-exclusion', 'target-leakage', 'recidivism'],
	missingValueTokens: ['NA', 'NaN', 'None'],
	remoteSource: {
		url: 'https://raw.githubusercontent.com/propublica/compas-analysis/bafff5da3f2e45eca6c2d5055faad269defd135a/compas-scores-two-years.csv',
		sha256: 'c451db85908b2f7fef1d83203bedf6b71ecda0d5af468d82ae62178f91d0cc7d',
		byteLength: 2546489
	},
	modeling: {
		defaultTarget: 'two_year_recid',
		targetCandidates: [
			{
				column: 'two_year_recid',
				taskType: 'binary-classification',
				positiveClass: '1',
				description:
					'Predict whether a defendant is rearrested within two years of COMPAS screening (1 = Rearrested, 0 = Not rearrested) using pre-screening criminal history and demographics.',
				leakyColumns: [
					{
						column: 'decile_score',
						reason: 'Proprietary COMPAS model output score; must be excluded when training an independent recidivism classifier.'
					},
					{
						column: 'is_recid',
						reason: "Post-outcome recidivism indicator recorded after screening; directly leaks 'two_year_recid'."
					},
					{
						column: 'r_case_number',
						reason: 'Post-outcome rearrest docket number: non-null only when defendant reoffended.'
					},
					{
						column: 'r_charge_degree',
						reason: 'Post-outcome rearrest attribute known only after recidivism occurs.'
					},
					{
						column: 'r_days_from_arrest',
						reason: 'Post-outcome rearrest timing variable.'
					},
					{
						column: 'r_offense_date',
						reason: 'Post-outcome rearrest date.'
					},
					{
						column: 'r_charge_desc',
						reason: 'Post-outcome rearrest description.'
					},
					{
						column: 'r_jail_in',
						reason: 'Post-outcome rearrest booking date.'
					},
					{
						column: 'r_jail_out',
						reason: 'Post-outcome rearrest release date.'
					},
					{
						column: 'violent_recid',
						reason: "100% empty legacy column in ProPublica's SQLite export (all 7,214 values missing)."
					},
					{
						column: 'is_violent_recid',
						reason: 'Post-outcome violent rearrest indicator that directly implies general recidivism.'
					},
					{
						column: 'vr_case_number',
						reason: 'Post-outcome violent rearrest identifier.'
					},
					{
						column: 'vr_charge_degree',
						reason: 'Post-outcome violent rearrest charge degree.'
					},
					{
						column: 'vr_offense_date',
						reason: 'Post-outcome violent rearrest date.'
					},
					{
						column: 'vr_charge_desc',
						reason: 'Post-outcome violent rearrest text.'
					},
					{
						column: 'decile_score_1',
						reason: 'Duplicate proprietary COMPAS decile score.'
					},
					{
						column: 'score_text',
						reason: "Proprietary COMPAS categorical risk output (excluded when predicting 'two_year_recid', or usable as a surrogate-audit target)."
					},
					{
						column: 'v_decile_score',
						reason: 'Proprietary COMPAS violent risk score.'
					},
					{
						column: 'v_score_text',
						reason: 'Proprietary COMPAS violent risk tier.'
					},
					{
						column: 'in_custody',
						reason: 'Post-screening custody tracking date.'
					},
					{
						column: 'out_custody',
						reason: 'Post-screening custody tracking date.'
					},
					{
						column: 'start',
						reason: 'Post-screening survival-analysis interval boundary.'
					},
					{
						column: 'end',
						reason: "Post-outcome follow-up duration until rearrest or censoring; leaks 'two_year_recid'."
					},
					{
						column: 'event',
						reason: "Post-outcome survival event indicator leaking 'two_year_recid'."
					}
				]
			},
			{
				column: 'score_text',
				taskType: 'multiclass-classification',
				description:
					"Surrogate black-box audit: predict COMPAS's assigned risk tier ('Low', 'Medium', or 'High') from defendant demographics and prior counts to inspect how COMPAS weights race and age.",
				leakyColumns: [
					{
						column: 'decile_score',
						reason: 'Proprietary COMPAS model output score; must be excluded when training an independent recidivism classifier.'
					},
					{
						column: 'decile_score_1',
						reason: 'Duplicate proprietary COMPAS decile score.'
					},
					{
						column: 'v_decile_score',
						reason: 'Proprietary COMPAS violent risk score.'
					},
					{
						column: 'v_score_text',
						reason: 'Proprietary COMPAS violent risk tier.'
					},
					{
						column: 'is_recid',
						reason: "Post-outcome recidivism indicator recorded after screening; directly leaks 'two_year_recid'."
					},
					{
						column: 'r_case_number',
						reason: 'Post-outcome rearrest docket number: non-null only when defendant reoffended.'
					},
					{
						column: 'r_charge_degree',
						reason: 'Post-outcome rearrest attribute known only after recidivism occurs.'
					},
					{
						column: 'r_days_from_arrest',
						reason: 'Post-outcome rearrest timing variable.'
					},
					{
						column: 'r_offense_date',
						reason: 'Post-outcome rearrest date.'
					},
					{
						column: 'r_charge_desc',
						reason: 'Post-outcome rearrest description.'
					},
					{
						column: 'r_jail_in',
						reason: 'Post-outcome rearrest booking date.'
					},
					{
						column: 'r_jail_out',
						reason: 'Post-outcome rearrest release date.'
					},
					{
						column: 'violent_recid',
						reason: "100% empty legacy column in ProPublica's SQLite export (all 7,214 values missing)."
					},
					{
						column: 'is_violent_recid',
						reason: 'Post-outcome violent rearrest indicator that directly implies general recidivism.'
					},
					{
						column: 'vr_case_number',
						reason: 'Post-outcome violent rearrest identifier.'
					},
					{
						column: 'vr_charge_degree',
						reason: 'Post-outcome violent rearrest charge degree.'
					},
					{
						column: 'vr_offense_date',
						reason: 'Post-outcome violent rearrest date.'
					},
					{
						column: 'vr_charge_desc',
						reason: 'Post-outcome violent rearrest text.'
					},
					{
						column: 'in_custody',
						reason: 'Post-screening custody tracking date.'
					},
					{
						column: 'out_custody',
						reason: 'Post-screening custody tracking date.'
					},
					{
						column: 'start',
						reason: 'Post-screening survival-analysis interval boundary.'
					},
					{
						column: 'end',
						reason: "Post-outcome follow-up duration until rearrest or censoring; leaks 'two_year_recid'."
					},
					{
						column: 'event',
						reason: "Post-outcome survival event indicator leaking 'two_year_recid'."
					},
					{
						column: 'two_year_recid',
						reason: 'two_year_recid leaks information about the target.'
					}
				]
			}
		]
	},
	columns: [
		{
			name: 'id',
			displayName: 'Defendant Row ID',
			description: 'Internal ProPublica SQLite defendant record identifier.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'name',
			displayName: 'Full Name',
			description: 'Defendant full name from public Broward County court records.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'first',
			displayName: 'First Name',
			description: 'Defendant given first name.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'last',
			displayName: 'Last Name',
			description: 'Defendant surname.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'compas_screening_date',
			displayName: 'COMPAS Screening Date',
			description: 'Date on which the pretrial COMPAS risk assessment was administered.',
			dataType: 'date',
			role: 'identifier'
		},
		{
			name: 'sex',
			displayName: 'Sex',
			description: 'Recorded binary sex of the defendant (80.6% Male, 19.4% Female).',
			dataType: 'categorical',
			role: 'feature',
			sensitive: true
		},
		{
			name: 'dob',
			displayName: 'Date of Birth',
			description: 'Defendant date of birth (YYYY-MM-DD).',
			dataType: 'date',
			role: 'identifier'
		},
		{
			name: 'age',
			displayName: 'Age',
			description: 'Defendant age in years at COMPAS screening.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'years',
			sensitive: true
		},
		{
			name: 'age_cat',
			displayName: 'Age Category',
			description:
				"Discretized age tier used in ProPublica's fairness regression ('Less than 25', '25 - 45', 'Greater than 45').",
			dataType: 'categorical',
			role: 'feature',
			sensitive: true
		},
		{
			name: 'race',
			displayName: 'Race',
			description:
				"Sheriff's Office racial/ethnic classification ('African-American', 'Caucasian', 'Hispanic', 'Asian', 'Native American', 'Other').",
			dataType: 'categorical',
			role: 'feature',
			sensitive: true
		},
		{
			name: 'juv_fel_count',
			displayName: 'Juvenile Felony Count',
			description: 'Number of prior juvenile felony offenses on record.',
			dataType: 'boolean',
			role: 'feature'
		},
		{
			name: 'decile_score',
			displayName: 'COMPAS Recidivism Decile (1-10)',
			description: "Northpointe's proprietary 1-to-10 general recidivism risk decile output.",
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'juv_misd_count',
			displayName: 'Juvenile Misdemeanor Count',
			description: 'Number of prior juvenile misdemeanor offenses on record.',
			dataType: 'boolean',
			role: 'feature'
		},
		{
			name: 'juv_other_count',
			displayName: 'Juvenile Other Count',
			description: 'Number of prior non-felony/non-misdemeanor juvenile infractions.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'priors_count',
			displayName: 'Prior Adult Offenses Count',
			description: 'Total count of prior adult criminal offenses prior to COMPAS screening.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'days_b_screening_arrest',
			displayName: 'Days Between Screening & Arrest',
			description:
				'Signed day offset between COMPAS screening and index arrest (ProPublica filtered to [-30, 30] in their 6,172-row subset).',
			dataType: 'numeric',
			role: 'feature',
			unit: 'days'
		},
		{
			name: 'c_jail_in',
			displayName: 'Index Custody Booking Time',
			description:
				'Timestamp when defendant entered Broward County jail for the index offense.',
			dataType: 'datetime',
			role: 'identifier'
		},
		{
			name: 'c_jail_out',
			displayName: 'Index Custody Release Time',
			description:
				'Timestamp when defendant exited Broward County jail for the index offense.',
			dataType: 'datetime',
			role: 'identifier'
		},
		{
			name: 'c_case_number',
			displayName: 'Index Case Number',
			description: 'Broward County Clerk court docket number for the index charge.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'c_offense_date',
			displayName: 'Index Offense Date',
			description: 'Recorded date of the index alleged offense.',
			dataType: 'date',
			role: 'identifier'
		},
		{
			name: 'c_arrest_date',
			displayName: 'Index Arrest Date',
			description:
				'Recorded arrest date when no offense date was filed (missing in 6,077 rows).',
			dataType: 'date',
			role: 'identifier'
		},
		{
			name: 'c_days_from_compas',
			displayName: 'Days From Index Offense to COMPAS',
			description: 'Unsigned days elapsed between index offense/arrest and COMPAS screening.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'days'
		},
		{
			name: 'c_charge_degree',
			displayName: 'Index Charge Degree',
			description:
				"Severity class of the current arrest charge ('F' = Felony, 'M' = Misdemeanor).",
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				F: 'Felony',
				M: 'Misdemeanor'
			}
		},
		{
			name: 'c_charge_desc',
			displayName: 'Index Charge Description',
			description:
				'Free-text statutory description of the index charge (437 distinct strings).',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'is_recid',
			displayName: 'Any Recidivism Flag (Leaky)',
			description:
				'Post-screening indicator of any subsequent rearrest regardless of the 2-year window.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				'0': 'No rearrest recorded',
				'1': 'Rearrested'
			}
		},
		{
			name: 'r_case_number',
			displayName: 'Recidivism Case Number',
			description:
				'Court docket number of the post-screening recidivism arrest (null if none).',
			dataType: 'text',
			role: 'feature'
		},
		{
			name: 'r_charge_degree',
			displayName: 'Recidivism Charge Degree',
			description: 'Statutory severity of the subsequent rearrest offense.',
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'r_days_from_arrest',
			displayName: 'Recidivism Jail Lag Days',
			description: 'Days between recidivism arrest and booking.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'days'
		},
		{
			name: 'r_offense_date',
			displayName: 'Recidivism Offense Date',
			description: 'Date of subsequent rearrest offense.',
			dataType: 'date',
			role: 'feature'
		},
		{
			name: 'r_charge_desc',
			displayName: 'Recidivism Charge Description',
			description: 'Statutory description of the subsequent rearrest charge.',
			dataType: 'text',
			role: 'feature'
		},
		{
			name: 'r_jail_in',
			displayName: 'Recidivism Jail In Date',
			description: 'Jail booking date for the subsequent rearrest.',
			dataType: 'date',
			role: 'feature'
		},
		{
			name: 'r_jail_out',
			displayName: 'Recidivism Jail Out Date',
			description: 'Jail release date for the subsequent rearrest.',
			dataType: 'date',
			role: 'feature'
		},
		{
			name: 'violent_recid',
			displayName: 'Legacy Empty Violent Recidivism',
			description:
				"Deprecated column left completely empty (100% null across all 7,214 rows) in ProPublica's export.",
			dataType: 'text',
			role: 'feature'
		},
		{
			name: 'is_violent_recid',
			displayName: 'Violent Recidivism Flag (Leaky)',
			description: 'Post-screening binary indicator of subsequent violent offense arrest.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				'0': 'No violent rearrest',
				'1': 'Violent rearrest'
			}
		},
		{
			name: 'vr_case_number',
			displayName: 'Violent Recidivism Case Number',
			description: 'Court docket number for post-screening violent offense.',
			dataType: 'text',
			role: 'feature'
		},
		{
			name: 'vr_charge_degree',
			displayName: 'Violent Recidivism Charge Degree',
			description: 'Severity tier of post-screening violent rearrest.',
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'vr_offense_date',
			displayName: 'Violent Recidivism Offense Date',
			description: 'Date of post-screening violent offense.',
			dataType: 'date',
			role: 'feature'
		},
		{
			name: 'vr_charge_desc',
			displayName: 'Violent Recidivism Charge Description',
			description: 'Statutory description of post-screening violent offense.',
			dataType: 'text',
			role: 'feature'
		},
		{
			name: 'type_of_assessment',
			displayName: 'COMPAS Assessment Type',
			description: "Constant string ('Risk of Recidivism') across all 7,214 rows.",
			dataType: 'categorical',
			role: 'identifier'
		},
		{
			name: 'decile_score_1',
			displayName: 'COMPAS Recidivism Decile (Join Copy)',
			description:
				"Duplicate of 'decile_score' produced by ProPublica's SQLite table join (disambiguated from duplicate header).",
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'score_text',
			displayName: "COMPAS Risk Tier ('Low'/'Medium'/'High')",
			description:
				"Coarsened COMPAS risk tier ('Low' = deciles 1-4, 'Medium' = 5-7, 'High' = 8-10); exhibits 44.8% FPR on Black non-recidivists vs. 23.5% on White non-recidivists.",
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'screening_date',
			displayName: 'Screening Date (Join Copy)',
			description: "Duplicate screening date column from ProPublica's SQLite join.",
			dataType: 'date',
			role: 'identifier'
		},
		{
			name: 'v_type_of_assessment',
			displayName: 'Violent Assessment Type',
			description: "Constant string ('Risk of Violence') across all 7,214 rows.",
			dataType: 'categorical',
			role: 'identifier'
		},
		{
			name: 'v_decile_score',
			displayName: 'COMPAS Violence Decile (1-10)',
			description: "Northpointe's proprietary 1-to-10 violent recidivism risk decile.",
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'v_score_text',
			displayName: 'COMPAS Violence Risk Tier',
			description: "Coarsened COMPAS violent risk category ('Low', 'Medium', 'High').",
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'v_screening_date',
			displayName: 'Violence Screening Date',
			description: 'Date of COMPAS violent risk screening.',
			dataType: 'date',
			role: 'identifier'
		},
		{
			name: 'in_custody',
			displayName: 'Subsequent Custody Start',
			description: "Custody start date used in ProPublica's Cox survival table.",
			dataType: 'date',
			role: 'feature'
		},
		{
			name: 'out_custody',
			displayName: 'Subsequent Custody End',
			description: "Custody release date used in ProPublica's Cox survival table.",
			dataType: 'date',
			role: 'feature'
		},
		{
			name: 'priors_count_1',
			displayName: 'Prior Offenses Count (Join Copy)',
			description:
				"Exact duplicate of 'priors_count' from ProPublica's SQLite join (disambiguated from duplicate header).",
			dataType: 'numeric',
			role: 'identifier'
		},
		{
			name: 'start',
			displayName: 'Survival Interval Start',
			description: 'Start day of Cox proportional-hazards follow-up interval.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'days'
		},
		{
			name: 'end',
			displayName: 'Survival Interval End',
			description:
				'End day of follow-up (time until rearrest or 2016-04-01 censoring); directly reveals recidivism.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'days'
		},
		{
			name: 'event',
			displayName: 'Survival Rearrest Event (Leaky)',
			description: 'Cox survival event indicator closely tracking post-release rearrest.',
			dataType: 'boolean',
			role: 'feature',
			valueLabels: {
				'0': 'Censored',
				'1': 'Rearrest event'
			}
		},
		{
			name: 'two_year_recid',
			displayName: 'Two-Year Recidivism',
			description:
				'Whether the defendant was rearrested for a new offense within two years of COMPAS screening.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'0': 'Not rearrested within 2 years',
				'1': 'Rearrested within 2 years'
			}
		}
	],
	provenance: {
		homepageUrl:
			'https://www.propublica.org/article/how-we-analyzed-the-compas-recidivism-algorithm',
		sourceRepositoryUrl:
			'https://github.com/propublica/compas-analysis/blob/master/compas-scores-two-years.csv',
		license: 'NOASSERTION',
		yearPublished: 2016,
		creators: ['Julia Angwin', 'Jeff Larson', 'Surya Mattu', 'Lauren Kirchner'],
		licenseUrl: 'https://projects.propublica.org/datastore/terms/',
		attribution:
			'Compiled by ProPublica (Julia Angwin, Jeff Larson, Surya Mattu and Lauren Kirchner, 2016) from Broward County, Florida, public records; downloaded from ProPublica’s compas-analysis repository when loaded.',
		retrievedAt: '2026-11-13',
		transformations: []
	},
	references: [
		{
			title: "Machine Bias: There's Software Used Across the Country to Predict Future Criminals. And It's Biased Against Blacks.",
			authors: ['Julia Angwin', 'Jeff Larson', 'Surya Mattu', 'Lauren Kirchner'],
			year: 2016,
			type: 'fairness-audit',
			url: 'https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing',
			citation:
				'Angwin, J., Larson, J., Mattu, S., & Kirchner, L. (2016, May 23). Machine bias. ProPublica. https://www.propublica.org/article/machine-bias-risk-assessments-in-criminal-sentencing'
		},
		{
			title: 'Fair Prediction with Disparate Impact: A Study of Bias in Recidivism Prediction Instruments',
			authors: ['Alexandra Chouldechova'],
			year: 2017,
			type: 'seminal-paper',
			url: 'https://journals.sagepub.com/doi/full/10.1089/big.2016.0047',
			citation:
				'Chouldechova, A. (2017). Fair prediction with disparate impact: A study of bias in recidivism prediction instruments. Big Data, 5(2), 153-163. https://doi.org/10.1089/big.2016.0047'
		},
		{
			title: 'Inherent Trade-Offs in the Fair Determination of Risk Scores',
			authors: ['Jon Kleinberg', 'Sendhil Mullainathan', 'Manish Raghavan'],
			year: 2017,
			type: 'seminal-paper',
			url: 'https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ITCS.2017.43',
			citation:
				'Kleinberg, J., Mullainathan, S., & Raghavan, M. (2017). Inherent trade-offs in the fair determination of risk scores. Proceedings of Innovations in Theoretical Computer Science (ITCS 2017), 43:1-43:23. https://doi.org/10.4230/LIPIcs.ITCS.2017.43'
		},
		{
			title: "It's COMPASlicated: The Messy Relationship between RAI Datasets and Algorithmic Fairness Benchmarks",
			authors: [
				'Michelle Bao',
				'Angela Zhou',
				'Samantha Zottola',
				'Brian Brubach',
				'Sarah Desmarais',
				'Aaron Horowitz',
				'Kristian Lum',
				'Suresh Venkatasubramanian'
			],
			year: 2021,
			type: 'fairness-audit',
			url: 'https://arxiv.org/abs/2106.05498',
			citation:
				"Bao, M., Zhou, A., Zottola, S., Brubach, B., Desmarais, S., Horowitz, A., Lum, K., & Venkatasubramanian, S. (2021). It's COMPASlicated: The messy relationship between RAI datasets and algorithmic fairness benchmarks. NeurIPS 2021 Datasets and Benchmarks Track. https://arxiv.org/abs/2106.05498"
		}
	],
	ethicsWarnings: [
		"Construct Validity Warning (Bao et al., 2021): 'two_year_recid' measures rearrest rather than reoffending; differential policing intensity across Broward County neighborhoods conflates law-enforcement surveillance disparities with individual behavior.",
		'Fairness Impossibility Theorem (Chouldechova, 2017; Kleinberg et al., 2017): Because observed rearrest base rates differ across groups (51.4% African-American vs. 39.4% Caucasian), no imperfect classifier can simultaneously satisfy Predictive Parity (calibration) and Equalized Odds (equal FPR and FNR).',
		"Contains real public-record defendant names ('name', 'first', 'last', 'dob'); these PII columns are disabled by default and must never be used as model features."
	]
} satisfies AuthoredDatasetDescriptor;
