/**
 * Fixture with deliberate TSDoc issues.
 *
 * @param value missing hyphen before description.
 * @unknownCustomTag unsupported tag name.
 */
export function malformedFixture(value: string): string {
	return value;
}

/**
 * Second comment checking {unescaped} inline brace handling.
 */
export function secondMalformedFixture(): string {
	return 'ok';
}
