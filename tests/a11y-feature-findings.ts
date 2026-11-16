interface FeatureFinding {
	rule: string;
	target: string[][];
	/** Equivalent exact selectors observed in another browser's axe output. */
	alternateTargets?: string[][][];
	owner: string;
	data: {
		fgColor: string;
		bgColor: string;
		contrastRatio: number;
		fontSize: string;
		fontWeight: string;
	};
}

/**
 * Measured feature-owned findings from the complete T8 audit inventory.
 * Each entry identifies one rule, exact shadow path, owning source and observed
 * colours/type. Shell audits use no exceptions. Remove entries when repaired.
 */
export const featureA11yFindings: readonly FeatureFinding[] = [
	{
		rule: 'color-contrast',
		target: [['app-data-view', '.remote-notice']],
		owner: 'src/features/data/app-data-view.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#fcfbfa',
			contrastRatio: 3.96,
			fontSize: '9.8pt (13px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-data-view', 'app-datasheet-dialog', '.header-subtitle']],
		owner: 'src/features/data/app-datasheet-dialog.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#ffffff',
			contrastRatio: 4.1,
			fontSize: '10.5pt (14px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-data-view', 'app-upload-dataset-dialog', '.file-picker-button']],
		owner: 'src/features/data/app-upload-dataset-dialog.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#f3f2ef',
			contrastRatio: 3.66,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-data-view', 'app-upload-dataset-dialog', 'small']],
		owner: 'src/features/data/app-upload-dataset-dialog.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#dbeafe',
			contrastRatio: 3.36,
			fontSize: '9.8pt (13px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-models-view', '.compare-hint']],
		owner: 'src/features/models/app-models-view.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#fcfbfa',
			contrastRatio: 3.96,
			fontSize: '10.5pt (14px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [
			['app-model-builder-view', '.train-step-content > .section-actions > .validation-hint']
		],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#ffffff',
			contrastRatio: 4.1,
			fontSize: '10.5pt (14px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'legend']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'caption']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', '.table-checkbox-col[scope="col"]']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		},
		alternateTargets: [[['app-model-builder-view', '.table-checkbox-col']]]
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'th[scope="col"]:nth-child(2)']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		},
		alternateTargets: [[['app-model-builder-view', 'th:nth-child(2)']]]
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'th[scope="col"]:nth-child(3)']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		},
		alternateTargets: [[['app-model-builder-view', 'th:nth-child(3)']]]
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'th[scope="col"]:nth-child(4)']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		},
		alternateTargets: [[['app-model-builder-view', 'th:nth-child(4)']]]
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'label[for="feature-sepal-length"]']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'tr:nth-child(1) > td:nth-child(3) > code']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'label[for="feature-sepal-width"]']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'tr:nth-child(2) > td:nth-child(3) > code']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'label[for="feature-petal-length"]']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'tr:nth-child(3) > td:nth-child(3) > code']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'label[for="feature-petal-width"]']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'tr:nth-child(4) > td:nth-child(3) > code']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'label[for="feature-class"]']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'tr:nth-child(5) > td:nth-child(3) > code']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', '.notes-list > li']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#a6988e',
			bgColor: '#f8f7f5',
			contrastRatio: 2.61,
			fontSize: '12.0pt (16px)',
			fontWeight: 'normal'
		}
	},
	{
		rule: 'color-contrast',
		target: [['app-model-builder-view', 'fieldset > .section-actions > .validation-hint']],
		owner: 'src/features/models/app-model-builder-view.ts',
		data: {
			fgColor: '#887b71',
			bgColor: '#f8f7f5',
			contrastRatio: 3.83,
			fontSize: '10.5pt (14px)',
			fontWeight: 'normal'
		}
	}
];
