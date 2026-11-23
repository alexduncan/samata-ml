export default {
	globs: ['src/**/*.ts'],
	exclude: ['src/**/*.stories.ts'],
	litelement: true,
	outdir: '.',
	plugins: [
		{
			name: 'preserve-typed-custom-event-generics',
			analyzePhase({ ts, node, moduleDoc }) {
				if (!ts.isClassDeclaration(node) || !node.name) return;
				const classDoc = moduleDoc.declarations?.find(
					(decl) => decl.kind === 'class' && decl.name === node.name.text
				);
				if (!classDoc?.events?.length) return;

				function visit(current) {
					if (
						ts.isCallExpression(current) &&
						ts.isPropertyAccessExpression(current.expression) &&
						current.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
						current.expression.name.text === 'dispatchEvent' &&
						current.arguments.length > 0
					) {
						const arg = current.arguments[0];
						if (
							ts.isNewExpression(arg) &&
							ts.isIdentifier(arg.expression) &&
							arg.expression.text === 'CustomEvent' &&
							arg.typeArguments?.length &&
							arg.arguments?.length &&
							ts.isStringLiteralLike(arg.arguments[0])
						) {
							const eventName = arg.arguments[0].text;
							const eventDoc = classDoc.events.find(
								(event) => event.name === eventName
							);
							if (
								eventDoc &&
								(!eventDoc.type || eventDoc.type.text === 'CustomEvent')
							) {
								const genericText = arg.typeArguments
									.map((t) => t.getText())
									.join(', ');
								eventDoc.type = { text: `CustomEvent<${genericText}>` };
							}
						}
					}
					ts.forEachChild(current, visit);
				}

				visit(node);
			}
		}
	]
};
