import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'breast-cancer-wisconsin',
	buildSource: {
		url: 'https://archive.ics.uci.edu/static/public/17/data.csv',
		sha256: '3487b754ff02c93cdc8a18afafe223961d9cfbfdb932e57483e52581042767d7',
		byteLength: 125031,
		transform: 'identity',
		outputSha256: '3487b754ff02c93cdc8a18afafe223961d9cfbfdb932e57483e52581042767d7',
		outputByteLength: 125031
	},
	name: 'Breast Cancer Wisconsin (Diagnostic)',
	tagline: 'Classify breast biopsy nuclei as malignant or benign across 30 correlated features.',
	description:
		"Created by Dr. William H. Wolberg, W. Nick Street, and Olvi L. Mangasarian at the University of Wisconsin Hospitals, Madison, this dataset comprises 569 digitized fine-needle aspirate (FNA) breast mass cytology specimens. Each specimen is summarized by the mean, standard error, and worst (largest) values of ten nuclear geometry traits—yielding 30 continuous predictors—paired with a confirmed Benign ('B') or Malignant ('M') diagnosis.\n\nIn machine learning education, Breast Cancer Wisconsin (Diagnostic) is the premier introductory binary classification dataset for teaching feature scaling (predictors span six orders of magnitude from ~0.001 to >4,000), severe multicollinearity (radius, perimeter, and area are geometrically coupled), L1/L2 regularization, Principal Component Analysis (PCA), and asymmetric clinical false-negative vs. false-positive decision thresholds.",
	domain: 'healthcare',
	difficulty: 'beginner',
	tags: ['binary', 'feature-scaling', 'multicollinearity', 'pca', 'medical-screening'],
	missingValueTokens: ['NA', 'NaN'],
	modeling: {
		defaultTarget: 'Diagnosis',
		targetCandidates: [
			{
				column: 'Diagnosis',
				taskType: 'binary-classification',
				positiveClass: 'M',
				description:
					"Predict whether a breast mass fine-needle aspirate is Malignant ('M', positive class) or Benign ('B').",
				leakyColumns: []
			}
		]
	},
	columns: [
		{
			name: 'ID',
			displayName: 'Specimen ID',
			description:
				'Unique clinical cytology case identifier assigned at University of Wisconsin Hospitals.',
			dataType: 'text',
			role: 'identifier'
		},
		{
			name: 'radius1',
			displayName: 'Radius (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: mean of distances from center to points on the nuclear perimeter.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um'
		},
		{
			name: 'texture1',
			displayName: 'Texture (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: standard deviation of gray-scale pixel intensity values inside the cell nucleus.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'perimeter1',
			displayName: 'Perimeter (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: total boundary length of the cell nucleus contour.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um'
		},
		{
			name: 'area1',
			displayName: 'Area (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: cross-sectional area of the digitized cell nucleus.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um^2'
		},
		{
			name: 'smoothness1',
			displayName: 'Smoothness (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: local variation in radius lengths around the nuclear boundary.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'compactness1',
			displayName: 'Compactness (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: shape compactness index computed as (perimeter^2 / area - 1.0).',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'concavity1',
			displayName: 'Concavity (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: severity of concave indentations along the nuclear contour.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'concave_points1',
			displayName: 'Concave Points (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: number of concave portions along the cell nucleus contour.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'symmetry1',
			displayName: 'Symmetry (Mean)',
			description:
				'Sample mean across nuclei in the FNA image: bilateral symmetry score of the digitized cell nucleus.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'fractal_dimension1',
			displayName: 'Fractal Dimension (Mean)',
			description:
				"Sample mean across nuclei in the FNA image: boundary complexity ('coastline approximation' minus 1).",
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'radius2',
			displayName: 'Radius (SE)',
			description:
				'Standard error across nuclei in the FNA image: mean of distances from center to points on the nuclear perimeter.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um'
		},
		{
			name: 'texture2',
			displayName: 'Texture (SE)',
			description:
				'Standard error across nuclei in the FNA image: standard deviation of gray-scale pixel intensity values inside the cell nucleus.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'perimeter2',
			displayName: 'Perimeter (SE)',
			description:
				'Standard error across nuclei in the FNA image: total boundary length of the cell nucleus contour.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um'
		},
		{
			name: 'area2',
			displayName: 'Area (SE)',
			description:
				'Standard error across nuclei in the FNA image: cross-sectional area of the digitized cell nucleus.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um^2'
		},
		{
			name: 'smoothness2',
			displayName: 'Smoothness (SE)',
			description:
				'Standard error across nuclei in the FNA image: local variation in radius lengths around the nuclear boundary.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'compactness2',
			displayName: 'Compactness (SE)',
			description:
				'Standard error across nuclei in the FNA image: shape compactness index computed as (perimeter^2 / area - 1.0).',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'concavity2',
			displayName: 'Concavity (SE)',
			description:
				'Standard error across nuclei in the FNA image: severity of concave indentations along the nuclear contour.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'concave_points2',
			displayName: 'Concave Points (SE)',
			description:
				'Standard error across nuclei in the FNA image: number of concave portions along the cell nucleus contour.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'symmetry2',
			displayName: 'Symmetry (SE)',
			description:
				'Standard error across nuclei in the FNA image: bilateral symmetry score of the digitized cell nucleus.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'fractal_dimension2',
			displayName: 'Fractal Dimension (SE)',
			description:
				"Standard error across nuclei in the FNA image: boundary complexity ('coastline approximation' minus 1).",
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'radius3',
			displayName: 'Radius (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: mean of distances from center to points on the nuclear perimeter.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um'
		},
		{
			name: 'texture3',
			displayName: 'Texture (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: standard deviation of gray-scale pixel intensity values inside the cell nucleus.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'perimeter3',
			displayName: 'Perimeter (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: total boundary length of the cell nucleus contour.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um'
		},
		{
			name: 'area3',
			displayName: 'Area (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: cross-sectional area of the digitized cell nucleus.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'um^2'
		},
		{
			name: 'smoothness3',
			displayName: 'Smoothness (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: local variation in radius lengths around the nuclear boundary.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'compactness3',
			displayName: 'Compactness (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: shape compactness index computed as (perimeter^2 / area - 1.0).',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'concavity3',
			displayName: 'Concavity (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: severity of concave indentations along the nuclear contour.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'concave_points3',
			displayName: 'Concave Points (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: number of concave portions along the cell nucleus contour.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'symmetry3',
			displayName: 'Symmetry (Worst)',
			description:
				'Worst (mean of the three largest values) across nuclei in the FNA image: bilateral symmetry score of the digitized cell nucleus.',
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'fractal_dimension3',
			displayName: 'Fractal Dimension (Worst)',
			description:
				"Worst (mean of the three largest values) across nuclei in the FNA image: boundary complexity ('coastline approximation' minus 1).",
			dataType: 'numeric',
			role: 'feature'
		},
		{
			name: 'Diagnosis',
			displayName: 'Diagnosis',
			description: 'Confirmed histopathological diagnosis of the breast mass biopsy.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				B: 'Benign',
				M: 'Malignant'
			}
		}
	],
	provenance: {
		homepageUrl: 'https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic',
		sourceRepositoryUrl: 'https://archive.ics.uci.edu/static/public/17/data.csv',
		license: 'CC-BY-4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		yearPublished: 1995,
		creators: ['William H. Wolberg', 'W. Nick Street', 'Olvi L. Mangasarian'],
		attribution:
			'Data by William H. Wolberg and W. Nick Street and Olvi L. Mangasarian, sourced from https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic.',
		retrievedAt: '2026-11-13',
		transformations: []
	},
	references: [
		{
			title: 'Nuclear Feature Extraction for Breast Tumor Diagnosis',
			authors: ['W. Nick Street', 'William H. Wolberg', 'Olvi L. Mangasarian'],
			year: 1993,
			type: 'seminal-paper',
			url: 'https://doi.org/10.1117/12.148698',
			citation:
				'Street, W. N., Wolberg, W. H., & Mangasarian, O. L. (1993). Nuclear feature extraction for breast tumor diagnosis. Biomedical Image Processing and Biomedical Visualization, SPIE Vol. 1905, 861-870. https://doi.org/10.1117/12.148698'
		},
		{
			title: 'Breast Cancer Diagnosis and Prognosis via Linear Programming',
			authors: ['Olvi L. Mangasarian', 'W. Nick Street', 'William H. Wolberg'],
			year: 1995,
			type: 'seminal-paper',
			url: 'https://pubsonline.informs.org/doi/10.1287/opre.43.4.570',
			citation:
				'Mangasarian, O. L., Street, W. N., & Wolberg, W. H. (1995). Breast cancer diagnosis and prognosis via linear programming. Operations Research, 43(4), 570-577. https://doi.org/10.1287/opre.43.4.570'
		},
		{
			title: 'UCI Machine Learning Repository: Breast Cancer Wisconsin (Diagnostic)',
			authors: ['William H. Wolberg', 'Olvi L. Mangasarian', 'W. Nick Street'],
			year: 1995,
			type: 'documentation',
			url: 'https://archive.ics.uci.edu/dataset/17/breast+cancer+wisconsin+diagnostic',
			citation:
				'Wolberg, W., Mangasarian, O., & Street, N. (1995). Breast Cancer Wisconsin (Diagnostic) [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5DW2B'
		}
	],
	ethicsWarnings: [
		'Omits patient demographics (age, race, ethnicity), making it impossible to audit subgroup performance disparities across underrepresented populations despite documented racial inequities in breast cancer mortality.',
		'In oncology screening, false negatives (missing a malignant tumor) carry far graver clinical harm than false positives, requiring learners to evaluate recall/sensitivity and probability thresholds rather than raw accuracy alone.'
	]
} satisfies AuthoredDatasetDescriptor;
