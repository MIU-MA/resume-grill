import { expect, it } from 'vitest'
import { resumeSnapshotInput, resumeSnapshotSummary } from './resume-snapshot'

it('来源名称按 Unicode 字符计数，与 Go 的 512 字符限制一致', () => {
  const sourceName = '😀'.repeat(512)
  expect(resumeSnapshotInput.safeParse({ sourceName, rawText: '正文' }).success).toBe(true)
  expect(resumeSnapshotSummary.safeParse({ sourceName, id: 'a'.repeat(32), createdAt: 1 }).success).toBe(true)
  expect(resumeSnapshotInput.safeParse({ sourceName: sourceName + '字', rawText: '正文' }).success).toBe(false)
})
