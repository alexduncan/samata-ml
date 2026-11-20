import { css, html, LitElement, noChange, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { repeat } from 'lit/directives/repeat.js';
import { parseNumberText } from '../../common/parameter-scale';
import { buttonStyles } from '../../styles/button.styles';
import { hyperparametersStyles } from '../../styles/hyperparameters.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { trainModelStyles } from '../../styles/train-model.styles';
import {
	DEFAULT_CV_FOLDS,
	DEFAULT_ONE_SHOT_SETUP,
	MAX_CV_FOLDS,
	MIN_CV_FOLDS,
	type ValidationMethodology
} from '../../types/state';
import { createCrossValidationSetup, validateFoldCount } from './training-setup';

/** Translated copy and formatters supplied by the owner of the training setup form. */
export interface TrainingSetupLabels {
	readonly formLabel: string;
	readonly strategyLabel: string;
	readonly strategyOneShot: string;
	readonly strategyCrossValidation: string;
	readonly strategyHelp: string;
	readonly strategyHelpLinkText: string;
	readonly strategyHelpHref: string;
	readonly oneShotNote: string;
	readonly foldsLabel: string;
	readonly foldsExactValueLabel: string;
	readonly foldsHelp: string;
	readonly matrixCaption: string;
	readonly matrixRunHeader: string;
	readonly matrixTrainingCell: string;
	readonly matrixValidationCell: string;
	readonly legendLabel: string;
	readonly legendTraining: string;
	readonly legendValidation: string;
	readonly foldSummary: (params: {
		readonly folds: number;
		readonly trainFolds: number;
		readonly trainPercent: string;
		readonly validationPercent: string;
	}) => string;
	readonly formatPercent: (percent: number) => string;
	readonly foldErrorInvalidNumber: string;
	readonly foldErrorRange: (min: number, max: number) => string;
	readonly submitButton: string;
}

const englishPercent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 });
const DEFAULT_TRAINING_SETUP_LABELS: TrainingSetupLabels = {
	formLabel: 'Training Setup',
	strategyLabel: 'Training Strategy',
	strategyOneShot: 'One-Shot',
	strategyCrossValidation: 'Cross-Validation',
	strategyHelp: 'How the rows are divided to train and evaluate the model.',
	strategyHelpLinkText: 'Learn more',
	strategyHelpHref: '/help/training-setup',
	oneShotNote: 'Requests an 80% training and 20% held-out test split.',
	foldsLabel: 'Cross-validation Folds',
	foldsExactValueLabel: 'Number of folds (exact value)',
	foldsHelp: 'Each fold is used once for validation. More folds take longer to train.',
	matrixCaption: 'Cross-validation training iterations',
	matrixRunHeader: 'Run',
	matrixTrainingCell: 'Training',
	matrixValidationCell: 'Validation',
	legendLabel: 'Fold partition legend',
	legendTraining: 'Training',
	legendValidation: 'Validation',
	foldSummary: ({ folds, trainFolds, trainPercent, validationPercent }) =>
		`Each of the ${folds} runs trains on ${trainFolds} folds (${trainPercent}) and validates on 1 fold (${validationPercent}).`,
	formatPercent: (percent) => englishPercent.format(percent / 100),
	foldErrorInvalidNumber: 'Enter a valid whole number.',
	foldErrorRange: (min, max) => `Enter a whole number between ${min} and ${max}.`,
	submitButton: 'Train Model'
};

type FoldEditState =
	| { status: 'bad-input' }
	| { status: 'empty' }
	| { status: 'text'; text: string };
type SetupDetail = { readonly setup: ValidationMethodology };

/**
 * Shows the training strategy and, for Cross-Validation, the fold controls and partition matrix.
 *
 * @fires app-training-setup-change - A strategy change or a valid fold edit.
 * @fires app-training-setup-submit - A valid training setup submitted by the user.
 */
@customElement('app-training-setup')
export class AppTrainingSetup extends LitElement {
	static override styles = [
		buttonStyles,
		notificationStyles,
		trainModelStyles,
		hyperparametersStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			.section-actions {
				margin-block-start: 1rem;
			}

			.blocked-notice {
				margin-block-end: 1rem;
			}
		`
	];

	/** Saved setup. A null value uses the One-Shot default without emitting a change. */
	@property({ attribute: false }) accessor value: ValidationMethodology | null = null;
	/** Maximum fold count allowed for the current target. */
	@property({ attribute: false }) accessor maxFolds = MAX_CV_FOLDS;
	/** Localised reason both strategies are blocked, or an empty string when eligible. */
	@property({ attribute: false }) accessor blockedReason = '';
	/** Whether the form's controls are read-only. */
	@property({ attribute: false }) accessor disabled = false;
	/** Localised form text and formatters, with English defaults. */
	@property({ attribute: false }) accessor labels: TrainingSetupLabels =
		DEFAULT_TRAINING_SETUP_LABELS;

	@state() private accessor strategy: ValidationMethodology['type'] = 'one_shot';
	@state() private accessor lastValidFolds = DEFAULT_CV_FOLDS;
	@state() private accessor foldEditState: FoldEditState | null = null;
	@state() private accessor foldError = '';
	@state() private accessor liveAnnouncement = '';
	private lastEmittedSetup: ValidationMethodology | null = null;
	private pendingNumberFocus = false;
	private controlsDisabled = false;
	private sliderMax = MAX_CV_FOLDS;
	private clampedSliderFolds = DEFAULT_CV_FOLDS;
	private matrixFolds = DEFAULT_CV_FOLDS;
	private displayText = String(DEFAULT_CV_FOLDS);

	override willUpdate(changed: PropertyValues<this>): void {
		const externalSetupChanged = changed.has('value') && !this.matchesLastEmission();
		if (externalSetupChanged) {
			this.strategy = this.value?.type ?? 'one_shot';
			this.lastValidFolds =
				this.value?.type === 'nested_cv' ? this.value.outerFolds : DEFAULT_CV_FOLDS;
			this.lastEmittedSetup = null;
			this.clearFoldEdit();
		}

		this.controlsDisabled =
			this.disabled || Boolean(this.blockedReason) || this.maxFolds < MIN_CV_FOLDS;
		this.sliderMax = Math.min(MAX_CV_FOLDS, Math.max(MIN_CV_FOLDS, this.maxFolds));
		this.clampedSliderFolds = Math.min(
			this.sliderMax,
			Math.max(MIN_CV_FOLDS, this.lastValidFolds)
		);
		this.matrixFolds = Math.min(
			MAX_CV_FOLDS,
			Math.max(MIN_CV_FOLDS, Math.round(this.lastValidFolds))
		);
		const edit = this.foldEditState;
		this.displayText =
			edit?.status === 'text'
				? edit.text
				: edit?.status === 'empty'
					? ''
					: String(this.lastValidFolds);

		if (
			this.strategy === 'nested_cv' &&
			(externalSetupChanged || changed.has('maxFolds') || changed.has('labels')) &&
			(!this.foldEditState || this.foldError)
		) {
			this.foldError = this.maxFolds < MIN_CV_FOLDS ? '' : this.getFoldError();
		}
	}

	override updated(): void {
		if (this.pendingNumberFocus) {
			this.pendingNumberFocus = false;
			this.renderRoot.querySelector<HTMLInputElement>('#folds-number')?.focus();
		}
	}

	private matchesLastEmission(): boolean {
		const current = this.value;
		const emitted = this.lastEmittedSetup;
		if (!current || !emitted || current.type !== emitted.type) return false;
		if (current.type === 'one_shot') return true;
		return (
			emitted.type === 'nested_cv' &&
			current.outerFolds === emitted.outerFolds &&
			current.innerFolds === emitted.innerFolds
		);
	}

	private getFoldError(): string {
		const edit = this.foldEditState;
		if (edit?.status === 'bad-input' || edit?.status === 'empty') {
			return this.labels.foldErrorInvalidNumber;
		}
		const count = edit ? (parseNumberText(edit.text) ?? NaN) : this.lastValidFolds;
		const issue = validateFoldCount(count, this.maxFolds);
		if (issue === 'invalid-number') return this.labels.foldErrorInvalidNumber;
		return issue === 'out-of-range'
			? this.labels.foldErrorRange(MIN_CV_FOLDS, this.maxFolds)
			: '';
	}

	private clearFoldEdit(): void {
		this.foldEditState = null;
		this.foldError = '';
		this.liveAnnouncement = '';
	}

	private emitSetup(type: 'app-training-setup-change' | 'app-training-setup-submit'): void {
		const setup =
			this.strategy === 'nested_cv'
				? createCrossValidationSetup(this.lastValidFolds)
				: { ...DEFAULT_ONE_SHOT_SETUP };
		this.lastEmittedSetup = setup;
		this.dispatchEvent(new CustomEvent<SetupDetail>(type, { detail: { setup } }));
	}

	private handleStrategyChange(event: Event): void {
		if (this.controlsDisabled) return;
		const strategy = (event.currentTarget as HTMLSelectElement).value;
		if ((strategy !== 'one_shot' && strategy !== 'nested_cv') || strategy === this.strategy)
			return;
		this.strategy = strategy;
		this.clearFoldEdit();
		if (strategy === 'nested_cv') this.lastValidFolds = this.clampedSliderFolds;
		this.emitSetup('app-training-setup-change');
	}

	private handleNumberInput(event: Event): void {
		if (this.controlsDisabled) return;
		const number = event.currentTarget as HTMLInputElement;
		const text = number.value;
		if (number.validity.badInput) {
			this.foldEditState = { status: 'bad-input' };
			return;
		}
		if (text.trim() === '') {
			this.foldEditState = { status: 'empty' };
			return;
		}
		const count = parseNumberText(text);
		if (count === null || validateFoldCount(count, this.maxFolds) !== null) {
			this.foldEditState = { status: 'text', text };
			return;
		}
		this.acceptFoldCount(count);
	}

	private handleRangeInput(event: Event): void {
		if (this.controlsDisabled) return;
		this.acceptFoldCount((event.currentTarget as HTMLInputElement).valueAsNumber);
	}

	private acceptFoldCount(count: number): void {
		this.clearFoldEdit();
		this.lastValidFolds = count;
		this.emitSetup('app-training-setup-change');
	}

	private handleNumberBlur(): void {
		if (this.controlsDisabled) return;
		const error = this.getFoldError();
		this.foldError = error;
		this.liveAnnouncement = error;
	}

	private handleSubmit(event: SubmitEvent): void {
		event.preventDefault();
		if (this.controlsDisabled) return;
		if (this.strategy === 'nested_cv') {
			const error = this.getFoldError();
			if (error) {
				this.foldError = error;
				this.liveAnnouncement = '';
				this.pendingNumberFocus = true;
				this.requestUpdate();
				return;
			}
		}
		this.emitSetup('app-training-setup-submit');
	}

	private renderMatrix() {
		const t = this.labels;
		const folds = this.matrixFolds;
		const numbers = Array.from({ length: folds }, (_, index) => index + 1);
		const summary = t.foldSummary({
			folds,
			trainFolds: folds - 1,
			trainPercent: t.formatPercent(((folds - 1) / folds) * 100),
			validationPercent: t.formatPercent(100 / folds)
		});
		return html`
			<div class="field-visual">
				<div
					class="fold-matrix-scroll"
					tabindex="0"
					role="region"
					aria-labelledby="folds-matrix-caption">
					<table class="fold-matrix" aria-describedby="folds-visual-summary">
						<caption id="folds-matrix-caption">
							${t.matrixCaption}
						</caption>
						<thead>
							<tr>
								<th scope="col">${t.matrixRunHeader}</th>
								${repeat(
									numbers,
									(fold) => fold,
									(fold) => html`<th scope="col">${fold}</th>`
								)}
							</tr>
						</thead>
						<tbody>
							${repeat(
								numbers,
								(run) => run,
								(run) => html`
									<tr>
										<th scope="row">${run}</th>
										${repeat(
											numbers,
											(fold) => fold,
											(fold) => {
												const isValidation = run === fold;
												return html`
													<td
														class=${isValidation
															? 'fold-validation'
															: 'fold-training'}>
														<span aria-hidden="true"
															>${isValidation ? '✓' : '–'}</span
														>
														<span class="visually-hidden"
															>${isValidation
																? t.matrixValidationCell
																: t.matrixTrainingCell}</span
														>
													</td>
												`;
											}
										)}
									</tr>
								`
							)}
						</tbody>
					</table>
				</div>
				<p id="folds-visual-summary" class="fold-visual-summary">${summary}</p>
				<ul class="fold-legend" aria-label=${t.legendLabel}>
					<li>
						<span class="fold-legend-swatch fold-legend-swatch-train" aria-hidden="true"
							>–</span
						>${t.legendTraining}
					</li>
					<li>
						<span
							class="fold-legend-swatch fold-legend-swatch-validation"
							aria-hidden="true"
							>✓</span
						>${t.legendValidation}
					</li>
				</ul>
			</div>
		`;
	}

	private renderFolds() {
		const t = this.labels;
		return html`
			<div class="field field--folds">
				<label id="folds-label" for="folds-range" class="field-name">${t.foldsLabel}</label>
				<div
					class="field-controls field-controls--folds"
					role="group"
					aria-labelledby="folds-label">
					<input
						id="folds-range"
						type="range"
						min="2"
						max=${this.sliderMax}
						step="1"
						.value=${String(this.clampedSliderFolds)}
						?disabled=${this.controlsDisabled}
						aria-labelledby="folds-label"
						aria-describedby="folds-help folds-visual-summary"
						@input=${this.handleRangeInput} />
					<label class="visually-hidden" for="folds-number"
						>${t.foldsExactValueLabel}</label
					>
					<input
						id="folds-number"
						name="folds"
						type="number"
						min="2"
						max=${this.sliderMax}
						step="1"
						.value=${this.foldEditState?.status === 'bad-input'
							? noChange
							: live(this.displayText)}
						?disabled=${this.controlsDisabled}
						aria-invalid=${this.foldError ? 'true' : 'false'}
						aria-describedby=${this.foldError
							? 'folds-error folds-help folds-visual-summary'
							: 'folds-help folds-visual-summary'}
						@input=${this.handleNumberInput}
						@blur=${this.handleNumberBlur} />
				</div>
				<div class="field-description">
					${this.foldError
						? html`<p id="folds-error" class="field-error">${this.foldError}</p>`
						: nothing}
					<div id="folds-help"><p>${t.foldsHelp}</p></div>
				</div>
				${this.renderMatrix()}
			</div>
		`;
	}

	override render() {
		const t = this.labels;
		return html`
			<form novalidate aria-label=${t.formLabel} @submit=${this.handleSubmit}>
				${this.blockedReason
					? html`
							<div
								id="training-setup-blocked"
								class="notification notification-alert blocked-notice"
								role="alert">
								${this.blockedReason}
							</div>
						`
					: nothing}
				<div class="field">
					<label for="strategy" class="field-name">${t.strategyLabel}</label>
					<select
						id="strategy"
						name="strategy"
						class="field-control"
						aria-describedby="strategy-help"
						.value=${live(this.strategy)}
						?disabled=${this.controlsDisabled}
						@change=${this.handleStrategyChange}>
						<option value="one_shot">${t.strategyOneShot}</option>
						<option value="nested_cv">${t.strategyCrossValidation}</option>
					</select>
					<div id="strategy-help" class="field-description">
						<p>
							${t.strategyHelp}
							<a href=${t.strategyHelpHref}>${t.strategyHelpLinkText}</a>
						</p>
						${this.strategy === 'one_shot'
							? html`<p class="field-dependent">${t.oneShotNote}</p>`
							: nothing}
					</div>
				</div>
				${this.strategy === 'nested_cv' ? this.renderFolds() : nothing}
				<div class="section-actions">
					<button
						type="submit"
						class="btn btn-primary"
						?disabled=${this.controlsDisabled}
						aria-describedby=${this.blockedReason ? 'training-setup-blocked' : nothing}>
						${t.submitButton}
					</button>
				</div>
				<div class="visually-hidden" aria-live="polite">${this.liveAnnouncement}</div>
			</form>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-training-setup': AppTrainingSetup;
	}
}
