import { expect, it } from 'vitest'
import { resumeVersionRows } from './resume-version-tree'
import type { ResumeDocument } from './resume-library'
const doc = (id: string, revisionOf?: string) => ({ id, revisionOf, updatedAt: id === 'root' ? 10 : 1 } as ResumeDocument)
it('父版本总在子版本之前，孤立或循环旧数据不丢失且不死循环', () => {
  const input = [doc('child', 'root'), doc('root'), doc('orphan', 'deleted'), doc('cycle1', 'cycle2'), doc('cycle2', 'cycle1')]
  const rows = resumeVersionRows(input)
  expect(rows).toHaveLength(input.length)
  expect(rows.findIndex(row => row.document.id === 'root')).toBeLessThan(rows.findIndex(row => row.document.id === 'child'))
  expect(rows.find(row => row.document.id === 'child')?.depth).toBe(1)
  expect(new Set(rows.map(row => row.document.id)).size).toBe(input.length)
})
