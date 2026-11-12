import m from 'mithril';

export const SelectModelView: m.Component = {
	view() {
		return m('section#select-model', [
			// TODO: Generate a list of models to select from.
			// Each model will have a tile with a brief description.
			// A learn more button.
			// A select button.
			// The select button will add the model to the pipeline and route to the configure model view.
		]);
	}
};
