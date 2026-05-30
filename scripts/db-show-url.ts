import { loadEnvLocal } from './load-env-local'
import { getDatabaseConnectionInfo } from '../lib/db'

function printValue(label: string, value: unknown) {
  console.log(`${label}:`, value === null || value === undefined ? '(missing)' : value)
}

async function main() {
  loadEnvLocal({ preferLocal: true })

  const info = getDatabaseConnectionInfo()

  console.log('=== Database connection info ===')
  printValue('configured', info.configured)
  printValue('hasDatabaseUrl', info.hasDatabaseUrl)
  printValue('isNeonServerless', info.isNeonServerless)
  printValue('host', info.host)
  printValue('database', info.database)
  printValue('user', info.user)
  printValue('sslmode', info.sslmode)
  printValue('maskedConnectionString', info.maskedConnectionString)
}

main().catch((err) => {
  console.error('Error printing DB URL info:', err)
  process.exit(1)
})
