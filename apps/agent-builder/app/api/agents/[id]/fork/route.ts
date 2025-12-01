import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json(
        { error: 'name field is required and must be a non-empty string' },
        { status: 400 }
      );
    }
    
    const copyMemory = body.copyMemory === true;
    
    const container = await getContainer();
    
    // Get the source agent
    const getAgentUseCase = container.useCases.getAgent();
    const sourceAgent = await getAgentUseCase.execute(id);
    
    if (!sourceAgent) {
      return NextResponse.json(
        { error: 'Source agent not found' },
        { status: 404 }
      );
    }
    
    // Create new agent with copied configuration
    const createAgentUseCase = container.useCases.createAgent();
    const newAgent = await createAgentUseCase.execute({
      name: body.name.trim(),
      description: sourceAgent.description,
      systemPrompt: sourceAgent.systemPrompt,
      defaultModel: sourceAgent.defaultModel,
      allowedTools: sourceAgent.allowedTools,
      tags: sourceAgent.tags,
      settings: sourceAgent.settings,
    });
    
    // Optionally copy memory
    if (copyMemory) {
      try {
        const memoryService = container.structuredMemoryService;
        const sourceMemory = await memoryService.readMemory(id);
        
        if (sourceMemory) {
          await memoryService.writeMemory(newAgent.id, sourceMemory);
          console.log(`[FORK AGENT] Copied memory from agent ${id} to ${newAgent.id}`);
        }
      } catch (memoryError) {
        console.error('Error copying memory during fork:', memoryError);
        // Don't fail fork if memory copy fails
      }
    }
    
    return NextResponse.json(newAgent, { status: 201 });
  } catch (error) {
    console.error('Error forking agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fork agent' },
      { status: 500 }
    );
  }
}



