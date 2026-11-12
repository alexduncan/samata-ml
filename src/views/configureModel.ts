import m from 'mithril';

export const ConfigureModelView: m.Component = {
	view() {
		if (DEBUG) console.log('ConfigureModelView');

		return m('section#configure-model', [
			// TODO: Get model selection from pipeline state
			// TODO: Get list of configurable parameters from model config
			// TODO: Handle hyperparameter inputs (sliders, number inputs, etc.)
			// TODO: Validate parameter ranges and user inputs
			// TODO: Save model configuration to pipeline state
			// TODO: On click "start training" navigate to /train-model
		]);
	}
};
