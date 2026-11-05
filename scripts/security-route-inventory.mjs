import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export function routeInventory() {
  const parse = file => ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true)
  const index = parse('server/index.ts')
  const imports = new Map()
  for (const stmt of index.statements) {
    if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
      for (const el of stmt.importClause?.namedBindings?.elements || []) imports.set(el.name.text, stmt.moduleSpecifier.text)
    }
  }
  const rows = []
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(index) === 'app' && node.expression.name.text === 'use') {
      const [prefix, router] = node.arguments
      const source = router && imports.get(router.getText(index))
      if (prefix && ts.isStringLiteral(prefix) && source?.startsWith('./routes/')) {
        const file = `server/${source.slice(2).replace(/\.js$/, '.ts')}`
        const ast = parse(file)
        let inherited = []
        for (const statement of ast.statements) {
          if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue
          const call = statement.expression
          if (!ts.isPropertyAccessExpression(call.expression) || call.expression.expression.getText(ast) !== 'router') continue
          const method = call.expression.name.text
          const guards = args => args.filter(arg => !ts.isArrowFunction(arg) && !ts.isFunctionExpression(arg)).map(arg => arg.getText(ast))
          if (method === 'use') inherited.push(...guards(call.arguments))
          if (!['get', 'post', 'put', 'patch', 'delete'].includes(method) || !ts.isStringLiteral(call.arguments[0])) continue
          const suffix = call.arguments[0].text
          rows.push({ method: method.toUpperCase(), path: prefix.text + (suffix === '/' ? '' : suffix), source: file, guards: [...inherited, ...guards(call.arguments.slice(1))] })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(index)
  rows.push({ method: 'GET', path: '/api/health', source: 'server/index.ts', guards: [] })
  return rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(routeInventory(), null, 2))
