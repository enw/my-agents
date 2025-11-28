import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const container = await getContainer();
    const useCase = container.useCases.deleteRun();
    await useCase.execute(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting run:', error);
    
    // Handle NotFoundError
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete run' },
      { status: 500 }
    );
  }
}

