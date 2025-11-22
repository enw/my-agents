import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Local Agent Builder API is running',
    timestamp: new Date().toISOString(),
  });
}
