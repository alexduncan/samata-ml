/**
 * Shared element and attribute allow-list policy for compiled Markdown fragments.
 * Enforced both at build time over rendered HTML and at runtime by the fragment sanitiser.
 */
export interface FragmentPolicy {
	/** Lowercase HTML tag names permitted inside a compiled fragment. */
	readonly elements: ReadonlySet<string>;
	/** Map from lowercase tag name to the set of permitted lowercase attribute names. */
	readonly attributes: Readonly<Record<string, ReadonlySet<string>>>;
}

const HEADING_ATTRS: ReadonlySet<string> = new Set(['id']);
const CODE_CLASS_PATTERN = /^language-[a-z0-9-]+$/;

/** Canonical element and attribute allow-list for first-party Markdown fragments. */
export const FRAGMENT_POLICY: FragmentPolicy = {
	elements: new Set([
		'p',
		'h2',
		'h3',
		'h4',
		'h5',
		'h6',
		'ul',
		'ol',
		'li',
		'a',
		'strong',
		'em',
		'del',
		'code',
		'pre',
		'blockquote',
		'hr',
		'br',
		'table',
		'thead',
		'tbody',
		'tr',
		'th',
		'td',
		'img'
	]),
	attributes: {
		h2: HEADING_ATTRS,
		h3: HEADING_ATTRS,
		h4: HEADING_ATTRS,
		h5: HEADING_ATTRS,
		h6: HEADING_ATTRS,
		a: new Set(['href', 'title', 'target', 'rel']),
		img: new Set(['src', 'alt', 'title']),
		code: new Set(['class']),
		ol: new Set(['start'])
	}
};

/**
 * Checks whether an `href` value is an external HTTP(S) URL.
 *
 * @param href - Candidate hyperlink URL.
 * @returns True when `href` parses as an `http:` or `https:` URL.
 */
export function isExternalHref(href: string): boolean {
	const trimmed = href.trim();
	if (!trimmed) {
		return false;
	}
	try {
		const url = new URL(trimmed);
		return url.protocol === 'https:' || url.protocol === 'http:';
	} catch {
		return false;
	}
}

/**
 * Checks whether an `href` value is permitted in content fragments.
 * Permits `https:`, `http:`, `mailto:`, and same-fragment `#<id>` anchors only.
 *
 * @param href - Candidate hyperlink target.
 * @returns True if the scheme or anchor format is allowed.
 */
export function isAllowedHref(href: string): boolean {
	const trimmed = href.trim();
	if (!trimmed) {
		return false;
	}
	if (isExternalHref(trimmed)) {
		return true;
	}
	if (/^#[^\s]+$/.test(trimmed)) {
		return true;
	}
	try {
		const url = new URL(trimmed);
		return url.protocol === 'mailto:' && url.pathname.length > 0 && !/\s/.test(trimmed);
	} catch {
		return false;
	}
}

/**
 * Checks whether an image `src` is a safe root-absolute path (starting with `/` but not `//` or `/\`).
 *
 * @param src - Candidate image source path.
 * @returns True when `src` is a valid root-absolute same-origin path.
 */
export function isAllowedImageSrc(src: string): boolean {
	const trimmed = src.trim();
	return (
		trimmed.length > 1 &&
		trimmed.startsWith('/') &&
		!trimmed.startsWith('//') &&
		!trimmed.startsWith('/\\') &&
		!/[\r\n\t]/.test(trimmed)
	);
}

/**
 * Checks whether an attribute and its value are permitted on the given HTML element.
 *
 * @param element - Tag name (case-insensitive).
 * @param name - Attribute name (case-insensitive).
 * @param value - Attribute string value.
 * @returns True if both the element and attribute (including value constraints) are allowed.
 */
export function isAllowedAttribute(element: string, name: string, value: string): boolean {
	const tag = element.toLowerCase();
	const attr = name.toLowerCase();

	if (!FRAGMENT_POLICY.elements.has(tag) || !Object.hasOwn(FRAGMENT_POLICY.attributes, tag)) {
		return false;
	}

	const allowedAttrs = FRAGMENT_POLICY.attributes[tag];
	if (!allowedAttrs || !allowedAttrs.has(attr)) {
		return false;
	}

	if (tag === 'code' && attr === 'class') {
		return CODE_CLASS_PATTERN.test(value);
	}
	if (tag === 'a' && attr === 'href') {
		return isAllowedHref(value);
	}
	if (tag === 'a' && attr === 'target') {
		return value === '_blank';
	}
	if (tag === 'a' && attr === 'rel') {
		return value === 'noopener noreferrer';
	}
	if (tag === 'img' && attr === 'src') {
		return isAllowedImageSrc(value);
	}
	if (tag === 'ol' && attr === 'start') {
		return /^-?\d+$/.test(value);
	}

	return true;
}
