import { syncBadges } from '../app/actions/badge'
import * as dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  console.log('Starting badge synchronization...')
  try {
    const result = await syncBadges(true)
    if (result.success) {
      console.log(`Successfully synced ${result.count} badges.`)
    } else {
      console.error('Failed to sync badges:', result.error)
    }
  } catch (error) {
    console.error('Unexpected error during sync:', error)
  }
}

main()
