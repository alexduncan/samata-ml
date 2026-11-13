import {
	FRAGMENT_POLICY,
	isAllowedAttribute,
	isAllowedHref,
	isAllowedImageSrc,
	isExternalHref
} from './fragment-policy';

function sanitiseElement(el: Element): void {
	const tag = el.tagName.toLowerCase();
	if (!FRAGMENT_POLICY.elements.has(tag)) {
		el.remove();
		return;
	}

	if (tag === 'a') {
		const href = el.getAttribute('href');
		if (!href || !isAllowedHref(href)) {
			el.remove();
			return;
		}
		if (isExternalHref(href)) {
			el.setAttribute('target', '_blank');
			el.setAttribute('rel', 'noopener noreferrer');
		} else {
			el.removeAttribute('target');
			el.removeAttribute('rel');
		}
	} else if (tag === 'img') {
		const src = el.getAttribute('src');
		const alt = el.getAttribute('alt')?.trim() ?? '';
		if (!src || !isAllowedImageSrc(src) || !alt) {
			el.remove();
			return;
		}
	}

	for (const attr of [...el.attributes]) {
		if (!isAllowedAttribute(tag, attr.name, attr.value)) {
			el.removeAttribute(attr.name);
		}
	}

	sanitiseChildren(el);
}

function sanitiseChildren(parent: Node): void {
	for (const child of [...parent.childNodes]) {
		if (child.nodeType === Node.ELEMENT_NODE) {
			sanitiseElement(child as Element);
		} else if (child.nodeType !== Node.TEXT_NODE) {
			child.parentNode?.removeChild(child);
		}
	}
}

/**
 * Parses an HTML fragment in an inert document, enforces {@link FRAGMENT_POLICY},
 * and moves the surviving nodes into a fresh `DocumentFragment` without re-serialising.
 *
 * @param html - Untrusted or compiled HTML fragment string.
 * @returns A sanitised `DocumentFragment` safe to append into a component template.
 */
export function sanitiseFragment(html: string): DocumentFragment {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	sanitiseChildren(doc.body);

	const fragment = document.createDocumentFragment();
	fragment.append(...doc.body.childNodes);
	return fragment;
}
