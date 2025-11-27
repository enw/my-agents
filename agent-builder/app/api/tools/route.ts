import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '../../../infrastructure/config/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const container = await getContainer();
    const useCase = container.useCases.listTools();
    const tools = await useCase.execute();
    
    return NextResponse.json(tools);
  } catch (error) {
    console.error('Error listing tools:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list tools' },
      { status: 500 }
    );
  }
}

