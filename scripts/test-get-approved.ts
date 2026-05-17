import { getApprovedClubs } from '../app/actions/club'

async function main() {
    const result = await getApprovedClubs()
    console.log('Result:', JSON.stringify(result, null, 2))
}

main().catch(console.error)
