import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

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
            console.log(`[AGENT API] ReadableStream start() called`);
            
            // Create streaming session and register the controller
            console.log(`[AGENT API] About to create session...`);
            const streamSessionId = await container.streamingPort.createSession();
            console.log(`[AGENT API] Session created: ${streamSessionId}`);
            
            console.log(`[AGENT API] Registering session...`);
            (container.streamingPort as any).registerSession(streamSessionId, {
              write: (data: string) => {
                console.log(`[STREAM] Writing data to stream (${data.length} bytes)`);
                controller.enqueue(encoder.encode(data));
              },
              end: () => {
                console.log(`[STREAM] Stream ended`);
                controller.close();
              },
            });
            console.log(`[AGENT API] Session registered`);

            // Start execution with the same session ID (runs in background)
            console.log(`[AGENT API] Starting streaming execution with sessionId: ${streamSessionId}`);
            console.log(`[AGENT API] Getting use case factory...`);
            const useCase = container.useCases.executeAgentStream();
            console.log(`[AGENT API] Use case obtained, calling execute()...`);
            
            // Fire and forget - execution happens in background
            const executionPromise = useCase.execute({
              agentId,
              message,
              modelOverride,
              streamSessionId,
            });
            
            console.log(`[AGENT API] execute() called, promise created. Setting up handlers...`);
            
            executionPromise.then(() => {
              console.log(`[AGENT API] ✅ Streaming execution completed for sessionId: ${streamSessionId}`);
            }).catch((error) => {
              console.error(`[AGENT API] ❌ Streaming execution error for sessionId ${streamSessionId}:`, error);
              console.error(`[AGENT API] Error stack:`, error instanceof Error ? error.stack : 'No stack');
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              try {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
                );
                controller.close();
              } catch (enqueueError) {
                console.error(`[AGENT API] Failed to enqueue error to stream:`, enqueueError);
              }
            });
            
            console.log(`[AGENT API] Execution promise handlers set up, returning stream response`);
          } catch (error) {
            console.error(`[AGENT API] Error in ReadableStream start():`, error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
              );
              controller.close();
            } catch (enqueueError) {
              console.error(`[AGENT API] Failed to enqueue error:`, enqueueError);
            }
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

