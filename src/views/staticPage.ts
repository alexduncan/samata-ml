import m from 'mithril';
export interface StaticPageData {
	title: string;
	short_title: string;
	html: string;
	url: string;
}

interface StaticPageViewAttrs {
	pageData: StaticPageData;
}

/**
 * A Mithril component that displays a static page within an HTMLDialogElement.
 */
export const StaticPageView: m.Component<StaticPageViewAttrs> = {
	view: (vnode) => {
		const { pageData } = vnode.attrs;

		return m(
			'dialog',
			{
				oncreate: (vnode: m.VnodeDOM) => {
					const dialog = vnode.dom as HTMLDialogElement;
					if (!dialog.open) {
						dialog.showModal();
					}
				},
				onclose: () => {
					// Navigate back when the dialog is closed (e.g. by pressing Esc or clicking close)
					window.history.back();
				}
			},
			[
				m('article', [
					m('header', [
						m(
							'button',
							{
								'aria-label': 'Close',
								rel: 'prev',
								onclick: (e: Event) => {
									const button = e.target as HTMLElement;
									const dialog = button.closest('dialog');
									dialog?.close();
								}
							},
							'Close'
						)
					]),
					m('div', m.trust(pageData.html))
				])
			]
		);
	}
};
