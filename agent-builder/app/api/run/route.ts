import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '../../../infrastructure/config/bootstrap';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, message, modelOverride, stream } = body;
    
    if (!agentId || !message) {
      return NextResponse.json(
        { error: 'agentId and message are required' },
        { status: 400 }
      );
    }
    
    const container = await getContainer();
    
    if (stream) {
      // For streaming, we'd need to set up SSE or WebSocket
      // For now, return a non-streaming response
      const useCase = container.useCases.executeAgent();
      const runId = await useCase.execute({
        agentId,
        message,
        modelOverride,
      });
      
      return NextResponse.json({ runId, status: 'completed' });
    } else {
      const useCase = container.useCases.executeAgent();
      const runId = await useCase.execute({
        agentId,
        message,
        modelOverride,
      });
      
      return NextResponse.json({ runId, status: 'completed' });
    }
  } catch (error) {
    console.error('Error executing agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute agent' },
      { status: 500 }
    );
  }
}

