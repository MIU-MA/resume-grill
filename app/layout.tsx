import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'Resume Grill · 求职工作台',
  description: '检查简历、整理官网邮箱投递、准备面试回答。',
  icons: { icon: '/favicon.svg?v=2' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
