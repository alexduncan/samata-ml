import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'iris',
	name: 'Iris Flower Species',
	tagline: 'Classify three Iris flower species from sepal and petal measurements.',
	description:
		"Collected by botanist Edgar Anderson primarily on Quebec's Gaspe Peninsula and popularized by statistician Ronald A. Fisher in 1936, the Iris dataset is the foundational multiclass classification benchmark in statistical and machine learning pedagogy. It contains 150 balanced specimens across three species (Iris setosa, Iris versicolor, and Iris virginica) described by four continuous morphological measurements in centimeters.\n\nPedagogically, Iris provides an intuitive geometric laboratory for decision boundaries: Iris setosa is linearly separable from the other two species in petal space, whereas Iris versicolor and Iris virginica partially overlap, illustrating the bias-variance trade-off across linear classifiers, k-Nearest Neighbors, Support Vector Machines, and Decision Trees.",
	domain: 'biology',
	difficulty: 'beginner',
	tags: ['multiclass', 'clean', 'linear-separability', 'decision-boundaries', 'classic'],
	missingValueTokens: ['NA', 'NaN'],
	modeling: {
		defaultTarget: 'class',
		targetCandidates: [
			{
				column: 'class',
				taskType: 'multiclass-classification',
				description:
					'Predict botanical species (Iris-setosa, Iris-versicolor, or Iris-virginica) from four floral dimensions.',
				leakyColumns: []
			}
		]
	},
	columns: [
		{
			name: 'sepal length',
			displayName: 'Sepal Length',
			description: 'Length of the outer floral sepal leaf measured along its central axis.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'cm'
		},
		{
			name: 'sepal width',
			displayName: 'Sepal Width',
			description:
				'Maximum width of the outer floral sepal leaf perpendicular to its length.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'cm'
		},
		{
			name: 'petal length',
			displayName: 'Petal Length',
			description:
				'Length of the inner floral petal leaf; highly discriminative for separating Iris setosa.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'cm'
		},
		{
			name: 'petal width',
			displayName: 'Petal Width',
			description:
				'Maximum width of the inner floral petal leaf; strongly correlated with petal length.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'cm'
		},
		{
			name: 'class',
			displayName: 'Iris Species',
			description: 'Taxonomic species classification of the Iris plant specimen.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'Iris-setosa': 'Iris setosa (Bristle-pointed Iris)',
				'Iris-versicolor': 'Iris versicolor (Blue Flag Iris)',
				'Iris-virginica': 'Iris virginica (Virginia Iris)'
			}
		}
	],
	provenance: {
		homepageUrl: 'https://archive.ics.uci.edu/dataset/53/iris',
		sourceRepositoryUrl: 'https://archive.ics.uci.edu/static/public/53/data.csv',
		retrievedAt: '2026-11-13',
		license: 'CC-BY-4.0',
		licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
		attribution:
			'Data collected by Edgar Anderson and published by Ronald A. Fisher through the UCI Machine Learning Repository.',
		yearPublished: 1936,
		creators: ['Ronald A. Fisher', 'Edgar Anderson'],
		transformations: []
	},
	references: [
		{
			title: 'The Use of Multiple Measurements in Taxonomic Problems',
			authors: ['Ronald A. Fisher'],
			year: 1936,
			type: 'seminal-paper',
			url: 'https://onlinelibrary.wiley.com/doi/10.1111/j.1469-1809.1936.tb02137.x',
			citation:
				'Fisher, R. A. (1936). The use of multiple measurements in taxonomic problems. Annals of Eugenics, 7(2), 179-188. https://doi.org/10.1111/j.1469-1809.1936.tb02137.x'
		},
		{
			title: 'The Irises of the Gaspe Peninsula',
			authors: ['Edgar Anderson'],
			year: 1935,
			type: 'seminal-paper',
			url: 'https://www.biodiversitylibrary.org/part/251042',
			citation:
				'Anderson, E. (1935). The irises of the Gaspe Peninsula. Bulletin of the American Iris Society, 59, 2-5.'
		},
		{
			title: 'The Iris Data Set: In Search of the Source of Virginica',
			authors: ['Antony Unwin', 'Kim Kleinman'],
			year: 2021,
			type: 'article',
			url: 'https://academic.oup.com/jrssig/article/18/6/26/7029547',
			citation:
				'Unwin, A., & Kleinman, K. (2021). The Iris data set: In search of the source of virginica. Significance, 18(6), 26-29. https://doi.org/10.1111/1740-9713.01589'
		},
		{
			title: 'UCI Machine Learning Repository: Iris Dataset Card',
			authors: ['Ronald A. Fisher'],
			year: 1988,
			type: 'documentation',
			url: 'https://archive.ics.uci.edu/dataset/53/iris',
			citation:
				'Fisher, R. A. (1936). Iris [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C56C76'
		}
	],
	ethicsWarnings: [
		"Contains botanical measurements with no human subjects or personal data, but Fisher's 1936 paper originally appeared in the Annals of Eugenics, providing important historical context on the origins of classical statistical methods.",
		"Two transcription discrepancies on rows 35 and 38 exist between Fisher's original 1936 table and the legacy UCI machine-learning archive (documented by Bezdek et al., 1999)."
	]
} satisfies AuthoredDatasetDescriptor;
