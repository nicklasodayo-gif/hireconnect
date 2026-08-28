# HireConnect API — no build step needed (server/src/*.ts run directly via
# Node's built-in TypeScript stripping + experimental sqlite flags), so the
# image just needs a Node 22.5+ base and the source copied in.
FROM node:22-slim

WORKDIR /app
COPY server/package.json ./
# No `npm ci` dependencies to install today (zero-dependency backend by
# design — see docs/ARCHITECTURE.md). Once you add real deps (Express,
# pg, etc. per the Postgres migration path), uncomment:
# RUN npm ci --omit=dev
COPY server/ .

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/hireconnect.db
VOLUME ["/data"]
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "--experimental-sqlite", "src/index.ts"]
