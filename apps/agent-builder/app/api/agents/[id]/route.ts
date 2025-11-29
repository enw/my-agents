import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const container = await getContainer();
    const useCase = container.useCases.getAgent();
    const agent = await useCase.execute(id);
    
    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error getting agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Agent not found' },
      { status: 404 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const container = await getContainer();
    const useCase = container.useCases.updateAgent();
    
    const agent = await useCase.execute(id, {
      name: body.name,
      description: body.description,
      systemPrompt: body.systemPrompt,
      commitMessage: body.commitMessage,
      defaultModel: body.defaultModel,
      allowedTools: body.allowedTools,
      tags: body.tags,
    });
    
    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error updating agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update agent' },
      { status: 400 }
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
    const useCase = container.useCases.deleteAgent();
    await useCase.execute(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete agent' },
      { status: 400 }
    );
  }
}

