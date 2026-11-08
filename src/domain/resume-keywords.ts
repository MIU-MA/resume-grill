const skills = {
  前端: ['React', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'Vite', 'Webpack', 'Next.js'],
  后端: ['Java', 'Python', 'Golang|Go', 'C++', 'Node.js', 'Spring', 'Django', 'Gin', 'Rust', '.NET'],
  数据: ['SQL', 'MySQL', 'PostgreSQL', 'Redis', 'MongoDB', 'Kafka', 'Elasticsearch', 'Spark', 'Hadoop'],
  工程: ['Docker', 'Kubernetes|K8s', 'Linux', 'Git', 'CI/CD', 'Jenkins', 'Nginx', 'Terraform'],
  智能: ['RAG', 'LLM', 'PyTorch', 'TensorFlow', 'LangChain', '机器学习', '深度学习', '向量检索'],
  设计测试: ['Figma', 'Sketch', 'Playwright', 'Cypress', 'Jest', 'Vitest', 'Selenium', 'JUnit'],
}
function contains(text: string, aliases: string) {
  return aliases.split('|').some(term => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(?:^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(text.normalize('NFKC'))
  })
}
export function resumeKeywordCoverage(resume: string, jd: string) {
  return Object.entries(skills).map(([category, words]) => {
    const required = words.filter(word => contains(jd, word)), matched = required.filter(word => contains(resume, word))
    return { category, required: required.map(word => word.split('|')[0]), matched: matched.map(word => word.split('|')[0]), missing: required.filter(word => !matched.includes(word)).map(word => word.split('|')[0]), coverage: required.length ? Math.round(matched.length / required.length * 100) : null }
  })
}
export function resumeMetricQuestions(text: string) {
  return text.split('\n').map((line, index) => ({ line, index })).filter(({ line }) => /负责|优化|改善|提升|降低|搭建|实现|推动/.test(line) && !/\d/.test(line) && line.length >= 8 && line.length < 400).slice(0, 8)
}
