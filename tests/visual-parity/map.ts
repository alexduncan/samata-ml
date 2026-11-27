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
	fixture?: 'empty' | 'models';
	/** Compare numeric boxes relative to the surface, within one CSS pixel. */
	geometry?: {
		mockupOrigin: string;
		appOrigin: string;
		axes: ('x' | 'y' | 'width' | 'height')[];
	};
}

export const parityMap: ParityEntry[] = [
	...(
		[
			[
				'workflow',
				'.workflow',
				[
					'display',
					'flex-grow',
					'margin-top',
					'margin-right',
					'margin-bottom',
					'margin-left'
				],
				'empty',
				['x', 'y', 'width']
			],
			[
				'steps',
				'.steps',
				[
					'margin-top',
					'margin-bottom',
					'padding-left',
					'list-style-type',
					'list-style-position'
				],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'step-first',
				'.step:first-child',
				[
					'border-top-width',
					'border-top-color',
					'border-top-left-radius',
					'border-top-right-radius',
					'overflow'
				],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'step-adjacent',
				'.step:nth-child(2)',
				['margin-top', 'border-top-width', 'border-top-color'],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'step-last',
				'.step:last-child',
				['border-bottom-left-radius', 'border-bottom-right-radius'],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'step-number',
				'.step:first-child .step-num',
				[
					'grid-area',
					'align-self',
					'font-size',
					'line-height',
					'text-align',
					'border-radius',
					'background-color'
				],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'step-label',
				'.step:nth-child(2) .step-label',
				['grid-area', 'line-height', 'font-size', 'font-weight'],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'project-title',
				'.project h4',
				[
					'grid-area',
					'margin-top',
					'margin-bottom',
					'font-size',
					'font-weight',
					'line-height',
					'color'
				],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'project-name',
				'.project-name',
				['grid-area', 'margin-top', 'margin-bottom', 'font-size', 'line-height', 'color'],
				'empty',
				['x', 'y', 'width', 'height']
			],
			[
				'summary-label',
				'.step:first-child .step-label-small',
				['grid-area', 'padding-top', 'font-size', 'font-weight'],
				'models',
				['x', 'y', 'width', 'height']
			],
			[
				'summary-value',
				'.step:first-child .step-value',
				['grid-area', 'padding-bottom', 'font-size', 'font-weight'],
				'models',
				['x', 'y', 'width', 'height']
			],
			[
				'summary-chiclets',
				'.step:first-child .step-chiclets',
				['grid-area', 'padding-right', 'font-size'],
				'models',
				['x', 'y', 'width', 'height']
			],
			[
				'summary-badge',
				'.step:first-child .chiclet',
				[
					'font-family',
					'font-size',
					'font-weight',
					'line-height',
					'padding-top',
					'padding-right',
					'border-radius',
					'border-top-color',
					'color'
				],
				'models',
				['x', 'y', 'width', 'height']
			],
			[
				'model-row',
				'.step-model:first-child .step-model-link',
				[
					'display',
					'position',
					'border-top-width',
					'border-top-color',
					'border-radius',
					'background-color',
					'padding-top',
					'padding-right',
					'padding-bottom',
					'padding-left',
					'font-size',
					'color'
				],
				'models',
				['x', 'width', 'height']
			],
			[
				'model-current',
				'.step-model:nth-child(2) .step-model-link',
				['border-top-color', 'background-color', 'color'],
				'models',
				['x', 'width', 'height']
			],
			[
				'footer-link',
				'footer a',
				['color', 'font-size', 'line-height', 'text-decoration-line'],
				'empty',
				['x', 'y', 'width', 'height']
			]
		] satisfies [
			string,
			string,
			string[],
			'empty' | 'models',
			('x' | 'y' | 'width' | 'height')[]
		][]
	).map(
		([id, selector, properties, fixture, axes]): ParityEntry => ({
			id: `sidebar-${id}`,
			mockupPage:
				fixture === 'empty' ? '01-1_select-data.html' : '03-7_train-models-5-results.html',
			mockupSelector: `.sidebar ${selector}`,
			appRoute: '/data',
			appSelector: `app-sidebar ${selector.replace('.project h4', '.project h2')}`,
			properties,
			fixture,
			geometry: { mockupOrigin: '.sidebar', appOrigin: 'app-sidebar', axes },
			...(id === 'summary-badge'
				? {
						deviations: {
							'border-top-color': { value: 'rgb(136, 123, 113)', register: 'SEM-11' }
						}
					}
				: {})
		})
	),
	{
		id: 'sidebar',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar',
		appRoute: '/data',
		appSelector: 'app-sidebar',
		properties: [
			'background-color',
			'width',
			'box-shadow',
			'position',
			'z-index',
			'min-height',
			'overflow-y'
		],
		fixture: 'empty',
		geometry: {
			mockupOrigin: '.sidebar',
			appOrigin: 'app-sidebar',
			axes: ['x', 'y', 'width', 'height']
		}
	},
	{
		id: 'sidebar-h1',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar h1',
		appRoute: '/data',
		appSelector: 'app-sidebar .brand',
		properties: [
			'font-size',
			'font-weight',
			'color',
			'line-height',
			'margin-top',
			'margin-right',
			'margin-bottom',
			'margin-left'
		],
		fixture: 'empty',
		geometry: {
			mockupOrigin: '.sidebar',
			appOrigin: 'app-sidebar',
			axes: ['x', 'y', 'width', 'height']
		}
	},
	{
		id: 'sidebar-tagline',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar .tagline',
		appRoute: '/data',
		appSelector: 'app-sidebar .tagline',
		properties: [
			'font-size',
			'font-weight',
			'color',
			'line-height',
			'margin-top',
			'margin-right',
			'margin-bottom',
			'margin-left'
		],
		fixture: 'empty',
		geometry: {
			mockupOrigin: '.sidebar',
			appOrigin: 'app-sidebar',
			axes: ['x', 'y', 'width', 'height']
		}
	},
	{
		id: 'sidebar-project',
		mockupPage: '00_first-load.html',
		mockupSelector: '.sidebar .project',
		appRoute: '/data',
		appSelector: 'app-sidebar .project',
		properties: [
			'display',
			'grid-template-areas',
			'background-color',
			'border-top-color',
			'border-radius',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left'
		],
		fixture: 'empty',
		geometry: {
			mockupOrigin: '.sidebar',
			appOrigin: 'app-sidebar',
			axes: ['x', 'y', 'width', 'height']
		}
	},
	{
		id: 'step-links',
		mockupPage: '00_first-load.html',
		mockupSelector: '.step:nth-child(2) .step-link',
		appRoute: '/data',
		appSelector: 'app-sidebar li.step:nth-child(2) a',
		properties: [
			'font-size',
			'font-weight',
			'color',
			'display',
			'grid-template-areas',
			'align-items',
			'text-decoration-line'
		],
		fixture: 'empty',
		geometry: {
			mockupOrigin: '.sidebar',
			appOrigin: 'app-sidebar',
			axes: ['x', 'y', 'width', 'height']
		}
	},
	{
		id: 'step-current',
		mockupPage: '00_first-load.html',
		mockupSelector: '.step[aria-current] .step-link',
		appRoute: '/data',
		appSelector: 'app-sidebar li.step:nth-child(1) a',
		properties: ['font-weight', 'color', 'background-color'],
		fixture: 'empty'
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
		fixture: 'empty',
		geometry: {
			mockupOrigin: '.sidebar',
			appOrigin: 'app-sidebar',
			axes: ['x', 'y', 'width', 'height']
		}
	},
	{
		id: 'main',
		mockupPage: '00_first-load.html',
		mockupSelector: 'main',
		appRoute: '/data',
		appSelector: 'main',
		properties: [
			'margin-left',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left',
			'min-height',
			'box-sizing'
		]
	},
	{
		id: 'page-header-h1',
		mockupPage: '00_first-load.html',
		mockupSelector: '.page-header > h1',
		appRoute: '/results',
		appSelector: '.page-header > h1',
		properties: ['font-size', 'font-weight', 'color']
	},
	{
		id: 'page-header-p',
		mockupPage: '00_first-load.html',
		mockupSelector: '.page-header > p',
		appRoute: '/results',
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
			'width',
			'height',
			'min-height',
			'background-color',
			'border-top-color',
			'border-radius',
			'box-shadow',
			'padding-top'
		]
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
	...(
		[
			[
				'header',
				'.modal-header',
				'.modal-header',
				['display', 'justify-content', 'align-items', 'padding-bottom']
			],
			[
				'title',
				'.modal-header h1',
				'.modal-header h2',
				['margin-top', 'margin-bottom', 'font-size', 'font-weight', 'line-height', 'color']
			],
			[
				'lead',
				'dialog.modal > h2',
				'p.lead',
				['margin-top', 'margin-bottom', 'font-size', 'font-weight', 'line-height', 'color']
			],
			[
				'body',
				'dialog.modal > p',
				'p.body',
				['margin-top', 'margin-bottom', 'font-size', 'font-weight', 'line-height', 'color']
			],
			[
				'action',
				'dialog.modal > button',
				'.modal-actions button',
				[
					'width',
					'height',
					'margin-top',
					'margin-bottom',
					'font-size',
					'font-weight',
					'line-height',
					'color'
				]
			],
			[
				'badge',
				'.badge-amber',
				'.chiclet-amber',
				[
					'background-color',
					'font-size',
					'font-weight',
					'letter-spacing',
					'text-transform',
					'color'
				]
			]
		] satisfies [string, string, string, string[]][]
	).map(
		([id, mockupSelector, selector, properties]): ParityEntry => ({
			id: `welcome-${id}`,
			mockupPage: '00_first-load.html',
			mockupSelector,
			appRoute: '/data',
			appSelector: `app-welcome-modal ${selector}`,
			properties,
			...(id === 'badge'
				? { deviations: { color: { value: 'rgb(51, 41, 35)', register: 'A11Y-04' } } }
				: {})
		})
	),
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
		properties: ['display', 'border-radius', 'background-color', 'color', 'font-weight'],
		deviations: { color: { value: 'rgb(109, 96, 86)', register: 'A11Y-03' } }
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
		appSelector:
			'app-model-builder-view app-model-card[model-id="logistic-regression"] article.card',
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
	},
	{
		id: 'vtable-header-cell',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-header-cell:not(.unsupported)',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-header-cell:not(.unsupported)',
		properties: [
			'font-size',
			'font-weight',
			'line-height',
			'color',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left',
			'border-top-width',
			'border-bottom-width',
			'border-inline-end-width',
			'block-size',
			'text-align',
			'background-color'
		]
	},
	{
		id: 'vtable-header-cell-unsupported',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-header-cell.unsupported',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-header-cell.unsupported',
		properties: ['background-color', 'color', 'align-items']
	},
	{
		id: 'vtable-header-icon',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-header-cell.unsupported .icon',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-header-cell.unsupported .icon',
		properties: ['color', 'flex-grow', 'flex-shrink', 'margin-inline-end']
	},
	{
		id: 'vtable-header-btn',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.header-btn',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .header-btn',
		properties: [
			'font-size',
			'font-weight',
			'line-height',
			'color',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left',
			'text-align'
		]
	},
	{
		id: 'vtable-row',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-row',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-row',
		properties: ['block-size', 'display'],
		deviations: { display: { value: 'grid', register: 'DATA-UI-04' } }
	},
	{
		id: 'vtable-cell',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-cell:not(.unsupported)',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-cell:not(.unsupported)',
		properties: [
			'font-size',
			'font-weight',
			'line-height',
			'color',
			'padding-top',
			'padding-right',
			'padding-bottom',
			'padding-left',
			'border-top-width',
			'border-bottom-width',
			'border-inline-end-width',
			'block-size',
			'text-align'
		]
	},
	{
		id: 'vtable-cell-num',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-cell-num',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-cell-num',
		properties: ['text-align', 'font-variant-numeric']
	},
	{
		id: 'vtable-cell-boolean',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.table-cell-boolean',
		appRoute: '/data',
		appSelector: 'app-dataset-preview ui-virtual-table .table-cell-boolean',
		properties: ['text-align']
	},
	{
		id: 'vtable-page-actions',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.page-header .page-actions',
		appRoute: '/data',
		appSelector: 'app-dataset-preview .page-header .page-actions',
		properties: [
			'display',
			'flex-wrap',
			'align-items',
			'column-gap',
			'row-gap',
			'justify-content'
		]
	},
	{
		id: 'vtable-btn-red',
		mockupPage: '01-6_virtual-table.html',
		mockupSelector: '.btn-red',
		appRoute: '/data',
		appSelector: 'app-dataset-preview .btn-red',
		properties: ['border-top-color', 'background-color', 'color']
	}
];
