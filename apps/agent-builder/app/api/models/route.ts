import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Default to toolsOnly=true unless explicitly set to false
    const toolsOnly = searchParams.get('toolsOnly') !== 'false';
    const allModels = searchParams.get('all') === 'true';
    
    const container = await getContainer();
    const useCase = container.useCases.listModels();
    const models = await useCase.execute({ 
      toolsOnly: allModels ? false : toolsOnly,
      provider: searchParams.get('provider') || undefined,
    });
    
    return NextResponse.json(models);
  } catch (error) {
    console.error('Error listing models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list models' },
      { status: 500 }
    );
  }
}

