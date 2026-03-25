import { NextResponse } from 'next/server'

export async function GET() {
  // H3 Legacy API has been eradicated.
  return NextResponse.json(
    { error: 'Gone', message: 'Legacy H3-based query API is no longer available.' }, 
    { status: 410 }
  )
}
