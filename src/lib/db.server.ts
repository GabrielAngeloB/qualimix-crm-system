import postgres from 'postgres'

type QueryResult<T> = { rows: T[]; rowCount: number }
type Queryable = {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>
}

type UnsafeSql = {
  unsafe<T extends readonly unknown[]>(query: string, parameters?: unknown[]): Promise<T>
}

let sql: ReturnType<typeof postgres> | undefined

function getSql(): ReturnType<typeof postgres> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL não está configurada no ambiente do servidor.')
  }

  let parsed: URL
  try {
    parsed = new URL(connectionString)
  } catch {
    throw new Error('DATABASE_URL não contém uma URL PostgreSQL válida.')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL deve usar postgres:// ou postgresql://.')
  }

  if (!sql) {
    sql = postgres(connectionString, {
      max: 1,
      idle_timeout: 10,
      connect_timeout: 10,
      ssl: 'verify-full',
      prepare: false,
      fetch_types: false,
      connection: { application_name: 'qualimix-crm' },
      onnotice: () => undefined,
    })
  }

  return sql
}

function wrap(executor: UnsafeSql): Queryable {
  return {
    async query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
      const rows = await executor.unsafe<T[]>(text, values)
      const result = rows as T[] & { count?: number }
      return { rows: result, rowCount: typeof result.count === 'number' ? result.count : result.length }
    },
  }
}

export function getPool(): Queryable {
  return wrap(getSql())
}

export async function withTransaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
  return getSql().begin(async (transaction) => work(wrap(transaction))) as Promise<T>
}
