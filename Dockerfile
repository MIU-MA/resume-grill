# ── 依赖安装阶段 ────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# 先只复制依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci

# ── 构建阶段 ────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 模型配置在运行时经环境变量注入，构建期不传密钥
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 运行阶段 ────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非 root 用户，降低容器内提权风险
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# 只复制构建产物（standalone 已包含最小依赖）
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
