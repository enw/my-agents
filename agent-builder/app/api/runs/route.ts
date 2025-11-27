import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '../../../infrastructure/config/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    const container = await getContainer();
    const useCase = container.useCases.listRuns();
    const runs = await useCase.execute({
      agentId: agentId || undefined,
      limit,
      offset,
    });
    
    return NextResponse.json(runs);
  } catch (error) {
    console.error('Error listing runs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list runs' },
      { status: 500 }
    );
  }
}

