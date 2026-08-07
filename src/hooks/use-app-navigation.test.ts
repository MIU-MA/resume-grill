import { describe, expect, it } from 'vitest'
import { buildAppPath, parseAppPath } from './use-app-navigation'

describe('app navigation paths', () => {
  it('maps application state to clean routes', () => {
    expect(buildAppPath('upload')).toBe('/')
    expect(buildAppPath('review')).toBe('/review')
    expect(buildAppPath('workspace', 'audit')).toBe('/audit')
    expect(buildAppPath('workspace', 'interview')).toBe('/interview')
    expect(buildAppPath('workspace', 'report')).toBe('/report')
  })

  it('derives application state from routes', () => {
    expect(parseAppPath('/review')).toEqual({ phase: 'review', mode: 'audit' })
    expect(parseAppPath('/interview')).toEqual({ phase: 'workspace', mode: 'interview' })
    expect(parseAppPath('/unknown')).toEqual({ phase: 'upload', mode: 'audit' })
  })
})
