export type DiffSentenceKind = 'same' | 'changed' | 'added' | 'removed'

export type DiffSentence = {
  text: string
  kind: DiffSentenceKind
}

export type RewriteDiff = {
  original: DiffSentence[]
  suggestion: DiffSentence[]
}

/** 视为同一句的最低声似度；低于 CHANGED_MIN 视为新增/删除 */
const SAME_MIN = 0.72
/** 能匹配上（算改过）的最低声似度；低于此视为全新内容 */
const CHANGED_MIN = 0.35

export function diffRewrite(original: string, suggestion: string): RewriteDiff {
  const orig = splitSentences(original)
  const sugg = splitSentences(suggestion)

  if (orig.length === 0 && sugg.length === 0) {
    return { original: [], suggestion: [] }
  }

  const sim: number[][] = orig.map((a) =>
    sugg.map((b) => similarity(bigramSet(a), bigramSet(b))),
  )

  const origKind: DiffSentenceKind[] = orig.map(() => 'removed')
  const suggKind: DiffSentenceKind[] = sugg.map(() => 'added')
  const used = new Set<number>()

  for (let j = 0; j < sugg.length; j++) {
    let best = -1
    let bestSim = -1
    for (let i = 0; i < orig.length; i++) {
      if (used.has(i)) continue
      if (sim[i][j] > bestSim) {
        best = i
        bestSim = sim[i][j]
      }
    }
    if (best >= 0 && bestSim >= CHANGED_MIN) {
      used.add(best)
      const kind = bestSim >= SAME_MIN ? 'same' : 'changed'
      origKind[best] = bestSim >= SAME_MIN ? 'same' : 'changed'
      suggKind[j] = kind
    }
  }

  return {
    original: orig.map((text, i) => ({ text, kind: origKind[i] })),
    suggestion: sugg.map((text, j) => ({ text, kind: suggKind[j] })),
  }
}

function splitSentences(text: string): string[] {
  const protectedText = text.replace(/(\d)\.(\d)/g, '$1·$2')
  return protectedText
    .split(/[。；！？；!?;]+|\.(?=\s|$)/)
    .map((s) => s.replace(/·/g, '.').trim())
    .filter(Boolean)
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').toLowerCase()
}

function bigramSet(value: string): Set<string> {
  const s = normalize(value)
  const out = new Set<string>()
  if (s.length === 0) return out
  if (s.length === 1) {
    out.add(s)
    return out
  }
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2))
  return out
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const gram of a) {
    if (b.has(gram)) intersection++
  }
  return (2 * intersection) / (a.size + b.size)
}