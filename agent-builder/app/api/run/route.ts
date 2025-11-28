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
      // Create SSE stream
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // Create streaming session and register the controller
            const streamSessionId = await container.streamingPort.createSession();
            (container.streamingPort as any).registerSession(streamSessionId, {
              write: (data: string) => {
                controller.enqueue(encoder.encode(data));
              },
              end: () => {
                controller.close();
              },
            });

            // Start execution with the same session ID (runs in background)
            const useCase = container.useCases.executeAgentStream();
            useCase.execute({
              agentId,
              message,
              modelOverride,
              streamSessionId, // Pass the session ID so chunks go to the right place
            }).catch((error) => {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
              );
              controller.close();
            });

            // The execution service will stream chunks via the streaming port
            // We'll complete when the stream is done (handled by adapter)
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
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

