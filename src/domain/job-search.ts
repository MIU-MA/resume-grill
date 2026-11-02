const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s_‐‑–—-]/g, '')
const fullStackNames = ['全栈', '全端', 'Full Stack']

/** Literal terms remain valid for any occupation; aliases never replace the requested direction. */
export function searchKeywords(keywords: string[]) {
  const terms = keywords.map(term => term.trim()).filter(Boolean)
  if (terms.some(term => /全栈|全端|fullstack/.test(normalize(term)))) terms.push(...fullStackNames)
  return [...new Map(terms.map(term => [normalize(term), term])).values()]
}

export function matchesJobTitle(title: string, keywords: string[]) {
  const value = normalize(title)
  return searchKeywords(keywords).some(term => {
    if (/前端|frontend/.test(normalize(term)) && /芯片|集成电路|RTL|ASIC|\bSoC\b/i.test(title)) return false
    return value.includes(normalize(term))
  })
}
