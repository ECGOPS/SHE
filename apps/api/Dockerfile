FROM node:20-alpine AS builder
WORKDIR /workspace

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace=@ecg-she/shared \
 && npm run build --workspace=@ecg-she/api

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /workspace
RUN apk add --no-cache tini

COPY --from=builder /workspace/node_modules ./node_modules
COPY --from=builder /workspace/packages/shared ./packages/shared
COPY --from=builder /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=builder /workspace/apps/api/dist ./apps/api/dist

EXPOSE 4000
WORKDIR /workspace/apps/api
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
