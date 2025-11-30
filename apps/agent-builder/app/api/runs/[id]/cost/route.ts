import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const container = await getContainer();
    const tracePort = container.adapters.tracePort;
    
    const cost = await tracePort.calculateRunCost(id);
    
    return NextResponse.json({ cost });
  } catch (error) {
    console.error('Error calculating run cost:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate cost' },
      { status: 500 }
    );
  }
}

