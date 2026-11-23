import type { AuthoredDatasetDescriptor } from '../../../src/types/sample-dataset';

export default {
	id: 'palmer-penguins',
	remoteSource: {
		url: 'https://raw.githubusercontent.com/allisonhorst/palmerpenguins/156daa4301838d9fdcc5b018b29b9149bf975552/inst/extdata/penguins.csv',
		sha256: 'f204db2c753b0937caac3cb35258562c14f073e4bbc76be24b4c51ce22767a93',
		byteLength: 15241
	},
	name: 'Palmer Archipelago Penguins',
	tagline:
		"Classify Antarctic penguin species with mixed types, missingness, and Simpson's paradox.",
	description:
		"Collected between 2007 and 2009 by Dr. Kristen Gorman and the Palmer Station Long Term Ecological Research (LTER) program in Antarctica, and curated by Allison Horst, Alison Hill, and Kristen Gorman (2020), Palmer Penguins is the modern open-licensed ecological benchmark designed to complement or replace Iris.\n\nUnlike Iris, Palmer Penguins introduces realistic tabular complexities ideal for early learners: moderate class imbalance across three Pygoscelis species (Adelie, Gentoo, Chinstrap), mixed continuous and categorical predictors (island, sex, study year), 19 explicit missing values across 11 incomplete rows, and a textbook manifestation of Simpson's paradox where overall negative correlation between bill length and bill depth reverses to positive within each species.",
	domain: 'biology',
	difficulty: 'beginner',
	tags: ['multiclass', 'mixed-types', 'missing-values', 'simpsons-paradox', 'ecology'],
	missingValueTokens: ['NA', 'NaN'],
	modeling: {
		defaultTarget: 'species',
		targetCandidates: [
			{
				column: 'species',
				taskType: 'multiclass-classification',
				description:
					'Predict penguin species (Adelie, Chinstrap, or Gentoo) from bill dimensions, flipper length, body mass, island, and sex.',
				leakyColumns: []
			},
			{
				column: 'sex',
				taskType: 'binary-classification',
				positiveClass: 'female',
				description:
					"Predict biological sex ('female' vs. 'male') to explore ecological sexual dimorphism within penguin species.",
				leakyColumns: []
			},
			{
				column: 'island',
				taskType: 'multiclass-classification',
				description:
					'Predict nesting island (Biscoe, Dream, or Torgersen) in the Palmer Archipelago.',
				leakyColumns: []
			}
		]
	},
	columns: [
		{
			name: 'species',
			displayName: 'Penguin Species',
			description: 'Pygoscelis penguin species observed nesting in the Palmer Archipelago.',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				Adelie: 'Adelie Penguin (Pygoscelis adeliae)',
				Chinstrap: 'Chinstrap Penguin (Pygoscelis antarcticus)',
				Gentoo: 'Gentoo Penguin (Pygoscelis papua)'
			}
		},
		{
			name: 'island',
			displayName: 'Island',
			description:
				'Island in the Palmer Archipelago, Antarctica where the penguin was measured (note: Gentoo was sampled only on Biscoe and Chinstrap only on Dream).',
			dataType: 'categorical',
			role: 'feature'
		},
		{
			name: 'bill_length_mm',
			displayName: 'Bill (Culmen) Length',
			description: "Length of the dorsal ridge of the penguin's upper bill (culmen).",
			dataType: 'numeric',
			role: 'feature',
			unit: 'mm'
		},
		{
			name: 'bill_depth_mm',
			displayName: 'Bill (Culmen) Depth',
			description:
				"Vertical thickness (depth) of the penguin's bill; exhibits Simpson's paradox when plotted against bill length without species conditioning.",
			dataType: 'numeric',
			role: 'feature',
			unit: 'mm'
		},
		{
			name: 'flipper_length_mm',
			displayName: 'Flipper Length',
			description: "Length of the penguin's flipper wing measured with a ruler.",
			dataType: 'numeric',
			role: 'feature',
			unit: 'mm'
		},
		{
			name: 'body_mass_g',
			displayName: 'Body Mass',
			description:
				'Total body mass in grams; differs in numeric scale by two orders of magnitude from bill dimensions, illustrating feature scaling effects.',
			dataType: 'numeric',
			role: 'feature',
			unit: 'g'
		},
		{
			name: 'sex',
			displayName: 'Sex',
			description:
				'Biological sex determined via molecular or morphometric field protocols (missing for 11 specimens).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: { female: 'Female', male: 'Male' }
		},
		{
			name: 'year',
			displayName: 'Study Year',
			description:
				'Calendar year in which the field observation season began (2007, 2008, or 2009).',
			dataType: 'categorical',
			role: 'feature',
			valueLabels: {
				'2007': '2007-2008 Austral Summer',
				'2008': '2008-2009 Austral Summer',
				'2009': '2009-2010 Austral Summer'
			}
		}
	],
	provenance: {
		homepageUrl: 'https://allisonhorst.github.io/palmerpenguins/',
		sourceRepositoryUrl:
			'https://raw.githubusercontent.com/allisonhorst/palmerpenguins/156daa4301838d9fdcc5b018b29b9149bf975552/inst/extdata/penguins.csv',
		retrievedAt: '2026-11-13',
		license: 'CC0-1.0',
		licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
		attribution:
			'Data curated by Kristen B. Gorman, Allison M. Horst and Alison P. Hill for Palmer Station Antarctica LTER.',
		yearPublished: 2020,
		creators: [
			'Kristen B. Gorman',
			'Allison M. Horst',
			'Alison P. Hill',
			'Palmer Station Antarctica LTER'
		],
		transformations: [
			'Use the curated table, which omits raw isotope, clutch-completion and sample-ID columns.'
		]
	},
	references: [
		{
			title: "Palmer Archipelago Penguins Data in the palmerpenguins R Package - An Alternative to Anderson's Irises",
			authors: ['Allison M. Horst', 'Alison P. Hill', 'Kristen B. Gorman'],
			year: 2022,
			type: 'seminal-paper',
			url: 'https://journal.r-project.org/articles/RJ-2022-020/',
			citation:
				"Horst, A. M., Hill, A. P., & Gorman, K. B. (2022). Palmer Archipelago Penguins Data in the palmerpenguins R Package - An Alternative to Anderson's Irises. The R Journal, 14(1), 244-254. https://doi.org/10.32614/RJ-2022-020"
		},
		{
			title: 'Ecological Sexual Dimorphism and Environmental Variability within a Community of Antarctic Penguins (Genus Pygoscelis)',
			authors: ['Kristen B. Gorman', 'Tony D. Williams', 'William R. Fraser'],
			year: 2014,
			type: 'seminal-paper',
			url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0090081',
			citation:
				'Gorman, K. B., Williams, T. D., & Fraser, W. R. (2014). Ecological sexual dimorphism and environmental variability within a community of Antarctic penguins (genus Pygoscelis). PLoS ONE, 9(3), e90081. https://doi.org/10.1371/journal.pone.0090081'
		},
		{
			title: 'Hugging Face Dataset Card: SIH/palmer-penguins',
			authors: ['Sydney Informatics Hub'],
			year: 2023,
			type: 'documentation',
			url: 'https://huggingface.co/datasets/SIH/palmer-penguins',
			citation:
				'Sydney Informatics Hub. (2023). palmer-penguins [Dataset Card]. Hugging Face Hub. https://huggingface.co/datasets/SIH/palmer-penguins'
		}
	],
	ethicsWarnings: [
		'Ecological wildlife data with no human subjects; field handling of Antarctic wildlife followed US Antarctic Program and LTER animal welfare permits.',
		'Because island strongly co-varies with species in this three-island sample (Gentoo only on Biscoe, Chinstrap only on Dream), learners should inspect whether tree models rely on geographic shortcuts rather than morphology.'
	]
} satisfies AuthoredDatasetDescriptor;
