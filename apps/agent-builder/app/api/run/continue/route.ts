import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, message, stream } = body;
    
    if (!runId || !message) {
      return NextResponse.json(
        { error: 'runId and message are required' },
        { status: 400 }
      );
    }
    
    const container = await getContainer();
    const useCase = container.useCases.continueConversation();
    
    // For now, continue conversation doesn't support streaming
    // It uses the existing run and adds a new turn
    await useCase.execute({
      runId,
      message,
    });
    
    // Return the run ID so client can fetch updated run
    return NextResponse.json({ runId, status: 'completed' });
  } catch (error) {
    console.error('Error continuing conversation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to continue conversation' },
      { status: 500 }
    );
  }
}

