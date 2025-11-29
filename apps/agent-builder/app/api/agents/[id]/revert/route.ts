import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { version } = body;
    
    if (typeof version !== 'number') {
      return NextResponse.json(
        { error: 'Version number is required' },
        { status: 400 }
      );
    }
    
    const container = await getContainer();
    const agentPort = (container as any).agentPort;
    
    const agent = await agentPort.revertToPromptVersion(id, version);
    
    return NextResponse.json(agent);
  } catch (error) {
    console.error('Error reverting prompt version:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to revert prompt version' },
      { status: 400 }
    );
  }
}

