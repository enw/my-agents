import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '../../../infrastructure/config/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();
    const useCase = container.useCases.listModels();
    const models = await useCase.execute({});
    
    return NextResponse.json(models);
  } catch (error) {
    console.error('Error listing models:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list models' },
      { status: 500 }
    );
  }
}

