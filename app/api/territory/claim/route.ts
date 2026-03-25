import { NextResponse } from 'next/server'

export async function POST() {
  // H3 Legacy API has been eradicated. 
  // Please use the new Polygon-based settlement logic instead.
  return NextResponse.json(
    { error: 'Gone', message: 'Legacy H3-based claim API is no longer available.' }, 
    { status: 410 }
  )
}
