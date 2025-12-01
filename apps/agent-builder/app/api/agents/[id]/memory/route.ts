import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const container = await getContainer();
    
    const memoryService = container.structuredMemoryService;
    const content = await memoryService.readMemory(id);
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error reading memory:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read memory' },
      { status: 500 }
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
    
    if (!body.content || typeof body.content !== 'string') {
      return NextResponse.json(
        { error: 'content field is required and must be a string' },
        { status: 400 }
      );
    }
    
    const container = await getContainer();
    const memoryService = container.structuredMemoryService;
    
    await memoryService.writeMemory(id, body.content);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating memory:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update memory' },
      { status: 500 }
    );
  }
}



