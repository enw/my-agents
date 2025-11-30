import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();
    const useCase = container.useCases.listAgents();
    const agents = await useCase.execute({});
    
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Error listing agents:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const container = await getContainer();
    const useCase = container.useCases.createAgent();
    
    const agent = await useCase.execute({
      name: body.name,
      description: body.description || '',
      systemPrompt: body.systemPrompt || '',
      defaultModel: body.defaultModel,
      allowedTools: body.allowedTools || [],
      tags: body.tags || [],
    });
    
    // If initial memory is provided, write it to the memory file
    if (body.initialMemory && typeof body.initialMemory === 'string' && body.initialMemory.trim()) {
      try {
        const memoryService = container.structuredMemoryService;
        await memoryService.writeMemory(agent.id, body.initialMemory.trim());
        console.log(`[AGENT API] Initial memory written for agent ${agent.id}`);
      } catch (memoryError) {
        console.error('Error writing initial memory:', memoryError);
        // Don't fail agent creation if memory write fails
      }
    }
    
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error('Error creating agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create agent' },
      { status: 400 }
    );
  }
}

