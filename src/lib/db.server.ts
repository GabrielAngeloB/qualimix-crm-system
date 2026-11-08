import postgres from 'postgres'

type QueryResult<T> = { rows: T[]; rowCount: number }
type Queryable = {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<T>>
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

/**
 * Mantém a API de consultas pequena e sempre parametrizada.
 * O executor é o cliente postgres ou uma transação postgres.js.
 */
function wrap(executor: any): Queryable {
  return {
    async query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
      const result = await executor.unsafe(text, values) as T[] & { count?: number }
      return {
        rows: result,
        rowCount: typeof result.count === 'number' ? result.count : result.length,
      }
    },
  }
}

export function getPool(): Queryable {
  return wrap(getSql())
}

export async function withTransaction<T>(work: (client: Queryable) => Promise<T>): Promise<T> {
  const result = await getSql().begin(async (transaction) => work(wrap(transaction)))
  return result as unknown as T
}
