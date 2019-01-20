import * as ts from "typescript"
import * as Lint from "tslint"

export class Rule extends Lint.Rules.AbstractRule {
	public static FAILURE_STRING = "cannot use a captured variable in a serialized function"

	public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
		return this.applyWithWalker(new NoCaptureUseInSerializedFunction(sourceFile, this.getOptions()))
	}
}

// The walker takes care of all the work.
class NoCaptureUseInSerializedFunction extends Lint.RuleWalker {

	private getSiblings(node: ts.Node): ts.Node[] {
		const siblings: ts.Node[] = []
		if (node.parent) {
			ts.forEachChild(node.parent, (sibling: ts.Node) => {
				if (sibling !== node) {
					siblings.push(sibling)
				}
			})
		}
		return siblings
	}

	private forEachParent(node: ts.Node, iterator: (node: ts.Node) => boolean) {
		if (node.parent) {
			if (!iterator(node.parent)) {
				this.forEachParent(node.parent, iterator)
			}
		}
	}

	private isDeclaration(node: ts.Identifier): boolean {
		const kinds = [
			ts.SyntaxKind.VariableDeclaration,
			ts.SyntaxKind.VariableDeclarationList,
			ts.SyntaxKind.FunctionDeclaration,
			ts.SyntaxKind.ClassDeclaration,
			ts.SyntaxKind.InterfaceDeclaration,
			ts.SyntaxKind.TypeAliasDeclaration,
			ts.SyntaxKind.EnumDeclaration,
			ts.SyntaxKind.ModuleDeclaration,
			ts.SyntaxKind.ImportEqualsDeclaration,
			ts.SyntaxKind.ImportDeclaration,
			ts.SyntaxKind.ExportDeclaration,
		]
		return (kinds.includes(node.parent.kind))
	}

	public visitIdentifier(node: ts.Identifier) {

		if (!this.isDeclaration(node) && node.parent.kind !== ts.SyntaxKind.PropertyAccessExpression) {

			let block: ts.Block | null = null
			this.forEachParent(node, (parent) => {
				this.getSiblings(parent).forEach((sibling) => {
					if (sibling.kind === ts.SyntaxKind.ExpressionStatement) {
						const { expression } = sibling as ts.ExpressionStatement
						if (expression.kind === ts.SyntaxKind.StringLiteral) {
							const lit: ts.StringLiteral = expression as ts.StringLiteral
							if (lit.text === "serialized") {
								this.forEachParent(sibling, (directiveParent) => {
									if (directiveParent.kind === ts.SyntaxKind.Block) {
										block = directiveParent as ts.Block
										return true
									} else {
										return false
									}
								})
							}
						}
					}
				})
				return block !== null
			})

			// create a failure at the current position
			this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE_STRING))
		}

		// call the base version of this visitor to actually parse this node
		super.visitIdentifier(node)
	}
}
