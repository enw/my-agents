import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '../../../../infrastructure/config/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const container = await getContainer();
    const useCase = container.useCases.getRun();
    const run = await useCase.execute(id);

    return NextResponse.json(run);
  } catch (error) {
    console.error('Error getting run:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Run not found' },
      { status: 404 }
    );
  }
}

