import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * Resolve the database URL.
 *
 * Production environments should export DATABASE_URL (postgresql://...).
 * Some sandbox hosts export a legacy DATABASE_URL (e.g. file:...) globally;
 * in that case we fall back to the canonical value from the repo .env file.
 */
function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && /^postgres(ql)?:\/\//.test(envUrl)) return envUrl
  try {
    const raw = readFileSync(path.join(process.cwd(), '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL=(.+)\s*$/)
      if (m && /^postgres(ql)?:\/\//.test(m[1].trim())) return m[1].trim()
    }
  } catch {
    /* ignore */
  }
  return envUrl ?? ''
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
