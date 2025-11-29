import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const container = await getContainer();
    const agentPort = (container as any).agentPort;
    
    const versions = await agentPort.getPromptVersions(id);
    
    return NextResponse.json(versions);
  } catch (error) {
    console.error('Error getting prompt versions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get prompt versions' },
      { status: 500 }
    );
  }
}

