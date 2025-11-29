import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const { id, version } = await params;
    const versionNum = parseInt(version, 10);
    
    if (isNaN(versionNum)) {
      return NextResponse.json(
        { error: 'Invalid version number' },
        { status: 400 }
      );
    }
    
    const container = await getContainer();
    const agentPort = (container as any).agentPort;
    
    const promptVersion = await agentPort.getPromptVersion(id, versionNum);
    
    if (!promptVersion) {
      return NextResponse.json(
        { error: 'Prompt version not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(promptVersion);
  } catch (error) {
    console.error('Error getting prompt version:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get prompt version' },
      { status: 500 }
    );
  }
}

