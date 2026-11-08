import postgres from 'postgres'

type QueryResult<Row> = { rows: Row[]; rowCount: number }
type DbClient = {
  query<Row = Record<string, unknown>>(text: string, values?: unknown[]): Promise<QueryResult<Row>>
}
type SqlExecutor = { unsafe: (query: string, parameters?: any[]) => Promise<unknown> }

let sql: ReturnType<typeof postgres> | undefined
let client: DbClient | undefined

function adapt(executor: SqlExecutor): DbClient {
  return {
    async query<Row>(text: string, values: unknown[] = []) {
      const result = await executor.unsafe(text, values as any[]) as { count?: number } & Iterable<Row>
      const rows = Array.from(result)
      return { rows, rowCount: result.count ?? rows.length }
    },
  }
}

/**
 * Driver usado exclusivamente no servidor. A URL nunca é importada pelo bundle do browser.
 * max=1 e prepare=false funcionam melhor com ambientes serverless e transaction poolers.
 */
export function getPool(): DbClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não está configurada no ambiente do servidor.')

  let parsed: URL
  try { parsed = new URL(connectionString) } catch {
    throw new Error('DATABASE_URL não contém uma URL PostgreSQL válida.')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL deve usar postgres:// ou postgresql://.')
  }

  if (!sql) {
    sql = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: { rejectUnauthorized: true },
      connection: { application_name: 'qualimix-crm' },
    })
    client = adapt(sql)
  }
  return client!
}

export async function withTransaction<T>(work: (client: DbClient) => Promise<T>): Promise<T> {
  getPool()
  return sql!.begin(async (transaction) => work(adapt(transaction)))
}
