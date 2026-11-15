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
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'page-header-p',
		mockupPage: '00_first-load.html',
		mockupSelector: '.page-header > p',
		appRoute: '/data',
		appSelector: '.page-header > p',
		properties: ['font-size', 'color']
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
	},
	{
		id: 'select-data-header',
		mockupPage: '01-1_select-data.html',
		mockupSelector: '.page-header',
		appRoute: '/data',
		appSelector: 'app-data-view .page-header',
		properties: ['display', 'align-items']
	},
	{
		id: 'select-data-header-h1',
		mockupPage: '01-1_select-data.html',
		mockupSelector: '.page-header > h1',
		appRoute: '/data',
		appSelector: 'app-data-view .page-header > h1',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'select-data-header-p',
		mockupPage: '01-1_select-data.html',
		mockupSelector: '.page-header > p',
		appRoute: '/data',
		appSelector: 'app-data-view .page-header > p',
		properties: ['color', 'line-height']
	},
	{
		id: 'select-data-cards',
		mockupPage: '01-1_select-data.html',
		mockupSelector: '.cards',
		appRoute: '/data',
		appSelector: 'app-data-view .cards',
		properties: ['display', 'justify-content']
	},
	{
		id: 'select-data-card',
		mockupPage: '01-1_select-data.html',
		mockupSelector: '.card',
		appRoute: '/data',
		appSelector: 'app-dataset-card .card',
		properties: ['border-radius', 'display', 'flex-direction']
	},
	{
		id: 'datasheet-dialog',
		mockupPage: '01-2_dataset-card.html',
		mockupSelector: 'dialog.modal',
		appRoute: '/data',
		appSelector: 'app-datasheet-dialog dialog.modal',
		properties: ['border-radius', 'color']
	},
	{
		id: 'upload-dialog',
		mockupPage: '01-3_upload-dataset.html',
		mockupSelector: 'dialog.modal',
		appRoute: '/data',
		appSelector: 'app-upload-dataset-dialog dialog.modal',
		properties: ['border-radius', 'color']
	},
	{
		id: 'upload-dropzone',
		mockupPage: '01-3_upload-dataset.html',
		mockupSelector: '.dropzone',
		appRoute: '/data',
		appSelector: 'app-upload-dataset-dialog .dropzone',
		properties: [
			'cursor',
			'border-top-style',
			'border-top-color',
			'border-radius',
			'background-color',
			'text-align'
		]
	},
	{
		id: 'upload-file-picker',
		mockupPage: '01-3_upload-dataset.html',
		mockupSelector: '.file-picker',
		appRoute: '/data',
		appSelector: 'app-upload-dataset-dialog .file-picker',
		properties: ['display', 'position']
	},
	{
		id: 'upload-file-picker-button',
		mockupPage: '01-3_upload-dataset.html',
		mockupSelector: '.file-picker-button',
		appRoute: '/data',
		appSelector: 'app-upload-dataset-dialog .file-picker-button',
		properties: ['display', 'border-radius', 'background-color', 'color', 'font-weight']
	},
	{
		id: 'preview-header',
		mockupPage: '01-4_preview-dataset.html',
		mockupSelector: '.page-header',
		appRoute: '/data',
		appSelector: 'app-dataset-preview .page-header',
		properties: ['display', 'align-items']
	},
	{
		id: 'preview-header-h1',
		mockupPage: '01-4_preview-dataset.html',
		mockupSelector: '.page-header > h1',
		appRoute: '/data',
		appSelector: 'app-dataset-preview .page-header > h1',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'preview-header-p',
		mockupPage: '01-4_preview-dataset.html',
		mockupSelector: '.page-header > p',
		appRoute: '/data',
		appSelector: 'app-dataset-preview .page-header > p',
		properties: ['color', 'line-height']
	},
	{
		id: 'preview-aside-overlay',
		mockupPage: '01-5_preview-dataset-aside.html',
		mockupSelector: 'aside.overlay',
		appRoute: '/data',
		appSelector: 'app-column-details aside.overlay',
		properties: ['position', 'background-color', 'box-shadow', 'padding-top']
	},
	{
		id: 'target-header',
		mockupPage: '02-1_set-target.html',
		mockupSelector: '.page-header',
		appRoute: '/target',
		appSelector: 'app-target-view .page-header',
		properties: ['display', 'align-items']
	},
	{
		id: 'target-header-h1',
		mockupPage: '02-1_set-target.html',
		mockupSelector: '.page-header > h1',
		appRoute: '/target',
		appSelector: 'app-target-view .page-header > h1',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'target-header-p',
		mockupPage: '02-1_set-target.html',
		mockupSelector: '.page-header > p',
		appRoute: '/target',
		appSelector: 'app-target-view .page-header > p',
		properties: ['color', 'line-height']
	},
	{
		id: 'target-table',
		mockupPage: '02-1_set-target.html',
		mockupSelector: 'table.table',
		appRoute: '/target',
		appSelector: 'app-target-view table.table',
		properties: ['border-collapse']
	},
	{
		id: 'target-table-th',
		mockupPage: '02-1_set-target.html',
		mockupSelector: 'table.table thead th',
		appRoute: '/target',
		appSelector: 'app-target-view table.table thead th',
		properties: ['background-color', 'font-weight']
	},
	{
		id: 'target-alert-notification',
		mockupPage: '02-2_target-set.html',
		mockupSelector: '.notification.notification-alert',
		appRoute: '/target',
		appSelector: 'app-target-view .notification.notification-alert',
		properties: ['background-color', 'border-top-color', 'border-radius', 'color']
	},
	{
		id: 'models-disabled-alert',
		mockupPage: '03-1_train-models-disabled.html',
		mockupSelector: '.notification.notification-alert',
		appRoute: '/models',
		appSelector: 'app-models-view .notification.notification-alert',
		properties: ['background-color', 'border-top-color', 'border-radius', 'color']
	},
	{
		id: 'models-disabled-h1',
		mockupPage: '03-1_train-models-disabled.html',
		mockupSelector: '.page-header > h1',
		appRoute: '/models',
		appSelector: 'app-models-view .page-header > h1',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'models-disabled-p',
		mockupPage: '03-1_train-models-disabled.html',
		mockupSelector: '.page-header > p',
		appRoute: '/models',
		appSelector: 'app-models-view .page-header > p',
		properties: ['color', 'line-height']
	},
	{
		id: 'models-step-active',
		mockupPage: '03-2_train-models-1-choose-model.html',
		mockupSelector: 'li.train-step.train-step-active',
		appRoute: '/models/1',
		appSelector: 'app-model-builder-view li.train-step[aria-current="step"]',
		properties: ['background-color', 'border-top-color', 'border-bottom-color']
	},
	{
		id: 'models-step-active-h2',
		mockupPage: '03-2_train-models-1-choose-model.html',
		mockupSelector: 'li.train-step.train-step-active .train-step-header h2',
		appRoute: '/models/1',
		appSelector:
			'app-model-builder-view li.train-step[aria-current="step"] .train-step-header h2',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'models-step-pending',
		mockupPage: '03-2_train-models-1-choose-model.html',
		mockupSelector: 'li.train-step.train-step-pending',
		appRoute: '/models/1',
		appSelector: 'app-model-builder-view li.train-step.train-step-pending',
		properties: ['background-color', 'border-top-color']
	},
	{
		id: 'models-card',
		mockupPage: '03-2_train-models-1-choose-model.html',
		mockupSelector: 'article.card',
		appRoute: '/models/1',
		appSelector: 'app-model-builder-view app-model-card article.card',
		properties: ['display', 'flex-direction', 'border-radius', 'background-color']
	},
	{
		id: 'models-features-step-active',
		mockupPage: '03-3_train-models-2-select-features.html',
		mockupSelector: 'li.train-step.train-step-active',
		appRoute: '/models/1',
		appSelector: 'app-model-builder-view li.train-step[aria-current="step"]',
		properties: ['background-color', 'border-top-color', 'border-bottom-color']
	},
	{
		id: 'models-features-step-active-h2',
		mockupPage: '03-3_train-models-2-select-features.html',
		mockupSelector: 'li.train-step.train-step-active .train-step-header h2',
		appRoute: '/models/1',
		appSelector:
			'app-model-builder-view li.train-step[aria-current="step"] .train-step-header h2',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'models-features-table',
		mockupPage: '03-3_train-models-2-select-features.html',
		mockupSelector: 'table.table',
		appRoute: '/models/1',
		appSelector: 'app-model-builder-view table.table',
		properties: ['border-collapse', 'width']
	},
	{
		id: 'models-features-table-th',
		mockupPage: '03-3_train-models-2-select-features.html',
		mockupSelector: 'table.table thead th',
		appRoute: '/models/1',
		appSelector: 'app-model-builder-view table.table thead th',
		properties: ['background-color', 'font-weight']
	}
];
