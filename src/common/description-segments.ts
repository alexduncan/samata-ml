/** A glossary term and the plain-English explanation shown as its `title`. */
export interface GlossaryTerm {
	/** Exact text to find in a description. */
	readonly term: string;
	/** Explanation for the `<abbr title>` attribute. */
	readonly title: string;
}

/** A run of plain text, or a glossary term to render as `<abbr>`. */
export type DescriptionSegment =
	| { readonly text: string }
	| { readonly abbr: string; readonly title: string };

/**
 * Splits a description into text and glossary-term segments so a template can render
 * `<abbr title>` without building markup strings.
 * The first exact occurrence of each term in plain text is wrapped; absent terms are ignored.
 *
 * @param text - Translated description.
 * @param terms - Translated glossary terms, in priority order.
 * @returns Segments whose concatenated text (and abbreviations) equals `text`.
 */
export function segmentDescription(
	text: string,
	terms: readonly GlossaryTerm[]
): readonly DescriptionSegment[] {
	let segments: DescriptionSegment[] = text === '' ? [] : [{ text }];
	for (const { term, title } of terms) {
		if (term === '') continue;
		const index = segments.findIndex((s) => 'text' in s && s.text.includes(term));
		if (index === -1) continue;
		const segment = segments[index] as { readonly text: string };
		const at = segment.text.indexOf(term);
		const before = segment.text.slice(0, at);
		const after = segment.text.slice(at + term.length);
		const replacement: DescriptionSegment[] = [];
		if (before !== '') replacement.push({ text: before });
		replacement.push({ abbr: term, title });
		if (after !== '') replacement.push({ text: after });
		segments = [...segments.slice(0, index), ...replacement, ...segments.slice(index + 1)];
	}
	return segments;
}
