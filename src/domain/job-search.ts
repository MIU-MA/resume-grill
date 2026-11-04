const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[\s_‐‑–—-]/g, '')
const fullStackNames = ['全栈', '全端', 'Full Stack']
const aliases = [
  fullStackNames, ['前端', 'Frontend', 'Front-end'], ['后端', '服务端', 'Backend', 'Back-end'],
  ['产品经理', 'Product Manager'], ['产品运营', 'Product Operations'],
  ['运营', 'Operations'], ['财务', 'Finance'], ['会计', 'Accountant', 'Accounting'],
  ['人力资源', '人事', 'HR', 'Human Resources'], ['招聘', 'Recruiter', 'Recruitment'],
  ['测试', '测试开发', 'QA', 'Quality Assurance'], ['运维', 'DevOps', 'SRE'],
  ['数据分析', 'Data Analyst'], ['数据科学', 'Data Scientist'],
  ['算法', 'Algorithm'], ['机器学习', 'Machine Learning'],
  ['交互设计', 'Interaction Designer', 'UX Designer'], ['视觉设计', 'Visual Designer', 'UI Designer'],
  ['平面设计', 'Graphic Designer'], ['设计', 'Designer'],
  ['市场', 'Marketing'], ['销售', 'Sales'], ['客服', 'Customer Service'],
  ['法务', 'Legal Counsel'], ['律师', 'Lawyer'], ['护士', 'Nurse'], ['教师', 'Teacher'],
  ['机械', 'Mechanical'], ['电气', 'Electrical'], ['嵌入式', 'Embedded'],
  ['采购', 'Purchasing', 'Procurement'], ['供应链', 'Supply Chain'],
  ['视频剪辑', 'Video Editor'], ['游戏策划', 'Game Designer'],
]
function aliasGroup(term: string) {
  const name = normalize(term).replace(/^(高级|资深|初级|中级|senior|junior)/, '').replace(/(?:开发工程师|研发工程师|工程师|开发岗|岗位|开发|engineer|developer|specialist)$/, '')
  return aliases.find(group => group.some(alias => normalize(alias) === name))
}

/** Literal terms remain valid for any occupation; aliases never replace the requested direction. */
export function searchKeywords(keywords: string[]) {
  const terms = keywords.map(term => term.trim()).filter(Boolean)
  for (const term of [...terms]) terms.push(...(aliasGroup(term) ?? []))
  return [...new Map(terms.map(term => [normalize(term), term])).values()]
}

/** Keep different requested occupations ahead of extra aliases for one occupation. */
export function searchQueries(keywords: string[], limit = 6) {
  const groups = keywords.map(term => searchKeywords([term]))
  const result = new Map<string, string>()
  for (let index = 0; index < Math.max(0, ...groups.map(group => group.length)); index++) {
    for (const group of groups) {
      const term = group[index]
      if (term && !result.has(normalize(term))) result.set(normalize(term), term)
      if (result.size >= limit) return [...result.values()]
    }
  }
  return [...result.values()]
}

export function matchesJobTitle(title: string, keywords: string[]) {
  const value = normalize(title)
  return searchKeywords(keywords).some(term => {
    if (/前端|frontend/.test(normalize(term)) && /芯片|集成电路|RTL|ASIC|\bSoC\b/i.test(title)) return false
    if (!value.includes(normalize(term))) return false
    // Short Latin names such as HR, QA and Go must be words, not substrings.
    if (/^[a-z]{1,3}$/i.test(term)) return new RegExp(`(?:^|[^a-z0-9])${term}(?:$|[^a-z0-9])`, 'i').test(title)
    return true
  })
}

/** Only vague job titles may borrow direction from their own job description. */
export function isGenericJobTitle(title: string) {
  return /^(?:(?:高级|资深|初级|中级|实习|校招|社招|软件|技术|研发|开发|senior|junior|software|graduate|intern)\s*)*(?:工程师|开发人员|研发人员|engineer|developer)[\s（(]*$/i.test(title.trim())
}
export function matchesJob(title: string, description: string, keywords: string[]) {
  return matchesJobTitle(title, keywords) || (isGenericJobTitle(title) && matchesJobTitle(description, keywords))
}
