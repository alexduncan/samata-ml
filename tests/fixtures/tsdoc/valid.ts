/**
 * Example valid TSDoc component class using the custom `@fires` block tag.
 *
 * @fires fixture-ready - Emitted when ready.
 * @fires fixture-change - Emitted when changed.
 */
export class ValidFixture {
	/**
	 * Formats a display label.
	 *
	 * @param label - Text to format.
	 * @returns Formatted label string.
	 */
	format(label: string): string {
		/* Ordinary block comments with @bogus and {unclosed tags are ignored. */
		// Line comments with /** @param missing hyphen */ are also ignored.
		return label.trim();
	}
}
