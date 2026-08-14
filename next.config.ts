import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 启用 standalone 输出，产出最小化的自包含构建（适合 Docker 部署）
  output: 'standalone',
}

export default nextConfig
