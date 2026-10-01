import { prisma } from '../prisma.js'

type ColumnRow = { table_name: string; column_name: string }
type NameRow = { name: string }
type CountRow = { count: bigint }

const requiredColumns = [
  ['goals', 'company_id'],
  ['payments', 'lead_id'],
  ['payments', 'sale_id'],
  ['payments', 'sale_voided_at'],
  ['sales', 'lead_id'],
  ['sales', 'proposal_id'],
  ['sales', 'company_id'],
  ['proposals', 'treatment'],
] as const

const requiredConstraints = [
  'goals_company_id_fkey',
  'payments_lead_id_fkey',
  'payments_sale_id_fkey',
  'lead_visibility_grants_lead_id_fkey',
  'lead_visibility_grants_user_id_fkey',
  'lead_visibility_grants_company_id_fkey',
]

const requiredIndexes = [
  'goals_company_id_idx',
  'sales_company_id_confirmed_at_idx',
  'sales_lead_id_voided_at_idx',
  'sales_proposal_id_voided_at_idx',
  'payments_lead_id_idx',
  'payments_sale_id_idx',
  'lead_visibility_grants_company_user_idx',
]

async function count(sql: string) {
  const [row] = await prisma.$queryRawUnsafe<CountRow[]>(sql)
  return Number(row?.count ?? 0)
}

async function main() {
  const tables = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name IN ('lead_visibility_grants')
  `
  const missingTables = ['lead_visibility_grants'].filter(
    (table) => !tables.some((row) => row.table_name === table),
  )

  const columns = await prisma.$queryRaw<ColumnRow[]>`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('goals', 'payments', 'sales', 'proposals')
  `

  const existing = new Set(columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`))
  const missingColumns = requiredColumns
    .map(([table, column]) => `${table}.${column}`)
    .filter((column) => !existing.has(column))

  const constraints = await prisma.$queryRaw<NameRow[]>`
    SELECT conname AS name
    FROM pg_constraint
    WHERE conname IN (
      'goals_company_id_fkey',
      'payments_lead_id_fkey',
      'payments_sale_id_fkey',
      'lead_visibility_grants_lead_id_fkey',
      'lead_visibility_grants_user_id_fkey',
      'lead_visibility_grants_company_id_fkey'
    )
      AND connamespace = current_schema()::regnamespace
  `
  const constraintNames = new Set(constraints.map(({ name }) => name))
  const missingConstraints = requiredConstraints.filter((name) => !constraintNames.has(name))

  const indexes = await prisma.$queryRaw<NameRow[]>`
    SELECT indexname AS name
    FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname IN (
        'goals_company_id_idx',
        'sales_company_id_confirmed_at_idx',
        'sales_lead_id_voided_at_idx',
        'sales_proposal_id_voided_at_idx',
        'payments_lead_id_idx',
        'payments_sale_id_idx',
        'lead_visibility_grants_company_user_idx'
      )
  `
  const indexNames = new Set(indexes.map(({ name }) => name))
  const missingIndexes = requiredIndexes.filter((name) => !indexNames.has(name))

  const structureComplete = missingTables.length === 0 && missingColumns.length === 0 && missingConstraints.length === 0 && missingIndexes.length === 0

  const result: Record<string, unknown> = {
    schema: structureComplete ? 'OK' : 'INCOMPLETO',
    missingTables,
    missingColumns,
    missingConstraints,
    missingIndexes,
  }

  if (existing.has('goals.company_id')) {
    result.goalsWithoutCompany = await count('SELECT COUNT(*)::bigint AS count FROM goals WHERE company_id IS NULL')
  }

  if (existing.has('sales.company_id')) {
    result.salesWithoutCompany = await count('SELECT COUNT(*)::bigint AS count FROM sales WHERE company_id IS NULL')
    result.salesWithDifferentLeadCompany = await count(`
      SELECT COUNT(*)::bigint AS count
      FROM sales s
      JOIN leads l ON l.id = s.lead_id
      WHERE s.company_id IS DISTINCT FROM l.company_id
    `)
    result.paidLeadsWithoutHistoricalSale = await count(`
      SELECT COUNT(*)::bigint AS count
      FROM leads l
      WHERE l.is_paid = TRUE
        AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.lead_id = l.id)
    `)
    result.legacySalesWithoutProposal = await count(`
      SELECT COUNT(*)::bigint AS count
      FROM sales
      WHERE legacy_lead_id IS NOT NULL AND proposal_id IS NULL
    `)
  }

  if (existing.has('payments.sale_id') && existing.has('payments.lead_id')) {
    result.paymentsWithoutCompany = await count('SELECT COUNT(*)::bigint AS count FROM payments WHERE company_id IS NULL')
    result.paymentsNotLinkedToLeadOrSale = await count(`
      SELECT COUNT(*)::bigint AS count
      FROM payments
      WHERE lead_id IS NULL AND sale_id IS NULL
    `)
    result.paymentsWithDifferentSaleCompany = await count(`
      SELECT COUNT(*)::bigint AS count
      FROM payments p
      JOIN sales s ON s.id = p.sale_id
      WHERE p.company_id IS DISTINCT FROM s.company_id
    `)
  }

  console.log(JSON.stringify(result, null, 2))
  if (!structureComplete) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error('Falha ao verificar patches do banco:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
