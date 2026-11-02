import { expect, it } from 'vitest'
import { cn } from './cn'

it('语义字号不会被文字颜色覆盖，颜色也不吞掉字号', () => {
  expect(cn('text-body', 'text-text-primary')).toBe('text-body text-text-primary')
  expect(cn('text-text-secondary', 'text-label')).toBe('text-text-secondary text-label')
})
it('调用方能覆盖组件的默认字号，并保留颜色和响应式字号', () => {
  expect(cn('text-label text-text-secondary', 'text-body md:text-title')).toBe('text-text-secondary text-body md:text-title')
  expect(cn('text-body md:text-section', 'md:text-title')).toBe('text-body md:text-title')
})
