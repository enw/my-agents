import { NextRequest, NextResponse } from 'next/server';
import { getContainer } from '@/lib/bootstrap';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const provider = searchParams.get('provider') || 'openrouter';
    const forceUpdate = searchParams.get('forceUpdate') === 'true';

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    const container = await getContainer();
    const tracePort = container.adapters.tracePort;
    
    const pricing = await tracePort.getModelPricing(modelId, provider, forceUpdate);
    
    if (!pricing) {
      return NextResponse.json(
        { error: 'Pricing not available for this model' },
        { status: 404 }
      );
    }

    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Error fetching model pricing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch pricing' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, provider = 'openrouter' } = body;

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    const container = await getContainer();
    const tracePort = container.adapters.tracePort;
    
    // Force update pricing from OpenRouter
    const pricing = await tracePort.getModelPricing(modelId, provider, true);
    
    if (!pricing) {
      return NextResponse.json(
        { error: 'Failed to fetch pricing from provider' },
        { status: 404 }
      );
    }

    return NextResponse.json(pricing);
  } catch (error) {
    console.error('Error updating model pricing:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update pricing' },
      { status: 500 }
    );
  }
}

