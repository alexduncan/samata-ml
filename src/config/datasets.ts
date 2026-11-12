type DatasetTask = 'classification' | 'regression';

type DatasetColumn = {
	name: string;
	type: 'string' | 'number' | 'boolean';
};

type Dataset = {
	name: string;
	description: string;
	shape: {
		columns: number;
		rows: number;
	};
	url: string;
	idColumn: string | null;
	tasks: DatasetTask[];
	source: {
		title: string;
		url: string;
		date: string;
	};
	columns: DatasetColumn[];
};

export default [
	{
		name: 'Penguins',
		url: 'https://gist.githubusercontent.com/slopp/ce3b90b9168f2f921784de84fa445651/raw/4ecf3041f0ed4913e7c230758733948bc561f434/penguins.csv',
		description: 'Penguin dataset',
		shape: {
			columns: 5,
			rows: 344
		},
		idColumn: 'rowid',
		tasks: ['classification']
	},
	{
		name: 'Iris',
		description:
			'https://gist.githubusercontent.com/curran/a08a1080b88344b0c8a7/raw/0e7a9b0a5d22642a06d3d5b9bcbad9890c8ee534/iris.csv',
		idColumn: null,
		tasks: ['classification']
	},
	{}
] as Dataset[];
