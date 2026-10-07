import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const label = path => relative(root, path).split(sep).join('/')
const issues = []
const graph = new Map()

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name)
    return entry.isDirectory() ? files(path) : /\.(?:ts|tsx|mjs)$/.test(entry.name) ? [path] : []
  })
}

function imports(source) {
  const result = []
  const add = (node, specifier, typeOnly = false) => {
    if (specifier && ts.isStringLiteral(specifier)) result.push({
      specifier: specifier.text,
      typeOnly,
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    })
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause
      const bindings = clause?.namedBindings
      const namedTypes = !clause?.name && bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0 && bindings.elements.every(item => item.isTypeOnly)
      add(node, node.moduleSpecifier, !!clause?.isTypeOnly || !!namedTypes)
    } else if (ts.isExportDeclaration(node)) {
      const namedTypes = node.exportClause && ts.isNamedExports(node.exportClause)
        && node.exportClause.elements.length > 0 && node.exportClause.elements.every(item => item.isTypeOnly)
      add(node, node.moduleSpecifier, node.isTypeOnly || !!namedTypes)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node, node.argument.literal, true)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      add(node, node.arguments[0])
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return result
}

function resolveImport(file, specifier) {
  const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2))
    : specifier.startsWith('.') ? resolve(dirname(file), specifier) : null
  if (!base) return null
  return [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, resolve(base, 'index.ts'), resolve(base, 'index.tsx')]
    .find(candidate => existsSync(candidate) && statSync(candidate).isFile()) ?? false
}

for (const file of ['app', 'src', 'scripts'].flatMap(folder => files(resolve(root, folder)))) {
  const from = label(file)
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  const test = /\.test\.[cm]?[jt]sx?$/.test(from)
  graph.set(file, [])
  for (const entry of imports(source)) {
    const target = resolveImport(file, entry.specifier)
    const fail = reason => issues.push(`${from}:${entry.line} ${reason} (${entry.specifier})`)
    if (target === false) { fail('本地导入不存在'); continue }
    if (test) continue
    const to = target ? label(target) : entry.specifier
    if (!entry.typeOnly && target && /\.[cm]?[jt]sx?$/.test(to)) graph.get(file).push(target)
    if (from.startsWith('src/domain/') && (
      /^(src\/(application|features|lib|providers|mail-agent|hooks|components)\/|app\/)/.test(to)
      || /^(react(?:\/|$)|next(?:\/|$)|idb-keyval$|node:)/.test(to)
    )) fail('domain 只能依赖领域契约和纯规则')
    if (from.startsWith('src/lib/') && /^(src\/(features|application)\/|app\/)/.test(to)) fail('共享基础设施不得反向依赖业务或应用')
    if (/^src\/(hooks\/|components\/ui\/)/.test(from) && /^src\/(features|application)\//.test(to)) fail('通用交互不得依赖业务或应用')
    if (from.startsWith('src/features/') && to.startsWith('src/application/') && !entry.typeOnly) fail('业务模块不得在运行时依赖应用编排')
    if (/^src\/(features|components|hooks|application)\//.test(from) && (to.startsWith('src/mail-agent/') || to.startsWith('node:'))) fail('浏览器层不得依赖本机执行器或 Node 实现')
    if (from.startsWith('src/mail-agent/') && /^src\/(features|application|components|hooks)\//.test(to)) fail('执行器不得依赖浏览器业务实现')
  }
}

const visited = new Set()
const active = new Set()
function visit(file, path = []) {
  if (active.has(file)) {
    issues.push(`运行时循环依赖：${[...path.slice(path.indexOf(file)), file].map(label).join(' -> ')}`)
    return
  }
  if (visited.has(file)) return
  active.add(file)
  for (const target of graph.get(file) ?? []) visit(target, [...path, file])
  active.delete(file)
  visited.add(file)
}
for (const file of graph.keys()) visit(file)
if (issues.length) {
  process.stderr.write(`${issues.join('\n')}\n`)
  process.exitCode = 1
} else {
  process.stdout.write(`目录依赖检查通过（${graph.size} 个源文件）。\n`)
}
