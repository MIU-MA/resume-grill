import { describe, expect, it } from 'vitest'
import { reconstructPdfPage } from './pdf'

describe('reconstructPdfPage', () => {
  it('restores visual lines and separates distant columns', () => {
    const text = reconstructPdfPage([
      { str: '工作经历', width: 48, height: 12, transform: [12, 0, 0, 12, 20, 700] },
      { str: '示例科技', width: 48, height: 12, transform: [12, 0, 0, 12, 20, 670] },
      { str: '2021-2024', width: 60, height: 12, transform: [12, 0, 0, 12, 360, 670] },
      { str: '- 负责会员产品规划', width: 120, height: 12, transform: [12, 0, 0, 12, 20, 640] },
      { str: '推动三个版本上线', width: 96, height: 12, transform: [12, 0, 0, 12, 145, 640] },
    ])

    expect(text.split('\n')).toEqual([
      '工作经历',
      '示例科技',
      '2021-2024',
      '- 负责会员产品规划推动三个版本上线',
    ])
  })

  it('joins wrapped skill and nested project bullets into complete statements', () => {
    const text = reconstructPdfPage([
      { str: '技术能力', width: 48, height: 12, transform: [12, 0, 0, 12, 50, 700] },
      { str: '•', width: 5, height: 11, transform: [11, 0, 0, 11, 60, 675] },
      { str: '语言与基础：熟悉 TypeScript，具备组件化、模块化、异步编', width: 330, height: 11, transform: [11, 0, 0, 11, 70, 675] },
      { str: '程和数据结构与算法基础。', width: 130, height: 11, transform: [11, 0, 0, 11, 70, 663] },
      { str: '项目经历', width: 48, height: 12, transform: [12, 0, 0, 12, 50, 630] },
      { str: 'o', width: 5, height: 11, transform: [11, 0, 0, 11, 90, 605] },
      { str: '实现安全预览与版本管理；每次生成自动保存版', width: 260, height: 11, transform: [11, 0, 0, 11, 101, 605] },
      { str: '本，支持预览、恢复、重命名和删除。', width: 190, height: 11, transform: [11, 0, 0, 11, 101, 593] },
    ])

    expect(text.split('\n')).toEqual([
      '技术能力',
      '- 语言与基础：熟悉 TypeScript，具备组件化、模块化、异步编程和数据结构与算法基础。',
      '项目经历',
      '- 实现安全预览与版本管理；每次生成自动保存版本，支持预览、恢复、重命名和删除。',
    ])
  })
})
