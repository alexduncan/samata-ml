export interface ParityDeviation {
	value: string;
	register: string;
}

export interface ParityEntry {
	id: string;
	mockupPage: string;
	mockupSelector: string;
	appRoute: string;
	appSelector: string;
	properties: string[];
	deviations?: Record<string, ParityDeviation>;
	knownDrift?: string;
}

export const parityMap: ParityEntry[] = [
	{
		id: 'sidebar',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar',
		appRoute: '/data',
		appSelector: 'app-sidebar',
		properties: ['background-color', 'width', 'box-shadow'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'sidebar-h1',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar h1',
		appRoute: '/data',
		appSelector: 'app-sidebar h1',
		properties: ['font-size', 'font-weight', 'color'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'sidebar-tagline',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar .tagline',
		appRoute: '/data',
		appSelector: 'app-sidebar .tagline',
		properties: ['font-size', 'font-weight', 'color'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'sidebar-project',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar .project',
		appRoute: '/data',
		appSelector: 'app-sidebar .project',
		properties: ['background-color', 'border-top-color', 'border-radius'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'step-links',
		mockupPage: '00_first-load.html',
		mockupSelector: '.step:nth-child(2) .step-link',
		appRoute: '/data',
		appSelector: 'app-sidebar li.step:nth-child(2) a',
		properties: ['font-size', 'font-weight', 'color'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'step-current',
		mockupPage: '00_first-load.html',
		mockupSelector: '.step[aria-current] .step-link',
		appRoute: '/data',
		appSelector: 'app-sidebar li.step:nth-child(1) a',
		properties: ['font-weight', 'color'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'sidebar-footer',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar footer',
		appRoute: '/data',
		appSelector: 'app-sidebar footer',
		properties: ['color', 'font-size'],
		deviations: {
			color: { value: 'rgb(109, 96, 86)', register: 'A11Y-02' }
		},
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'main',
		mockupPage: '00_first-load.html',
		mockupSelector: 'main',
		appRoute: '/data',
		appSelector: 'main',
		properties: ['margin-left', 'padding-top'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'page-header-h1',
		mockupPage: '00_first-load.html',
		mockupSelector: '.page-header > h1',
		appRoute: '/data',
		appSelector: '.page-header > h1',
		properties: ['font-size', 'font-weight', 'color'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'page-header-p',
		mockupPage: '00_first-load.html',
		mockupSelector: '.page-header > p',
		appRoute: '/data',
		appSelector: '.page-header > p',
		properties: ['font-size', 'color'],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'modal-dialog',
		mockupPage: '00_first-load.html',
		mockupSelector: 'dialog.modal',
		appRoute: '/data',
		appSelector: 'app-welcome-modal dialog',
		properties: [
			'background-color',
			'border-top-color',
			'border-radius',
			'box-shadow',
			'padding-top'
		],
		knownDrift: 'scaffolding-visual-remediation'
	},
	{
		id: 'btn-primary',
		mockupPage: '00_first-load.html',
		mockupSelector: 'dialog.modal .btn.btn-primary',
		appRoute: '/data',
		appSelector: 'app-welcome-modal button.btn-primary',
		properties: ['background-color', 'color', 'border-top-color', 'border-radius']
	}
];
