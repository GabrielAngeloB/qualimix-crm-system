import { Pool, type PoolClient } from 'pg'

let pool: Pool | undefined

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não está configurada no ambiente do servidor.')
  let parsed: URL
  try { parsed = new URL(connectionString) } catch {
    throw new Error('DATABASE_URL não contém uma URL PostgreSQL válida.')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL deve usar postgres:// ou postgresql://.')
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      ssl: { rejectUnauthorized: true },
      application_name: 'qualimix-crm',
    })
    pool.on('error', (error) => {
      console.error('[qualimix-db] erro no pool PostgreSQL:', error.message)
    })
  }
  return pool
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch { /* preserva o erro original */ }
    throw error
  } finally {
    client.release()
  }
}
