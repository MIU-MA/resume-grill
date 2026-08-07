import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  title: 'resume-grill',
  description: '对简历里的项目成果做一次深度排查，提前暴露还没讲透的盲区。',
  icons: { icon: '/favicon.svg?v=2' },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
