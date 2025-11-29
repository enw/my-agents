/**
 * Application Bootstrap & Dependency Injection
 *
 * This file contains the dependency injection container and application startup logic.
 * Located in the app since it's the composition root.
 */

import { getContainer as getInfrastructureContainer } from '@my-agents/infrastructure';
import { UseCaseFactory } from '@my-agents/application';

// Re-export infrastructure container
export { getContainer as getInfrastructureContainer } from '@my-agents/infrastructure';
export type { DependencyContainer, AppConfig } from '@my-agents/infrastructure';

// Extended container with use cases
export interface AppContainer {
  useCases: UseCaseFactory;
  // Re-export all infrastructure container properties
  [key: string]: any;
}

let globalContainer: AppContainer | null = null;

export async function getContainer(): Promise<AppContainer> {
  if (!globalContainer) {
    const infraContainer = await getInfrastructureContainer();
    
    // Create use case factory
    const useCaseFactory = new UseCaseFactory({
      agentPort: infraContainer.agentPort,
      modelRegistry: infraContainer.modelRegistry,
      toolPort: infraContainer.toolPort,
      tracePort: infraContainer.tracePort,
      executionService: infraContainer.executionService,
      validationService: infraContainer.validationService,
    });

    // Instead of spreading, add useCases directly to preserve getters
    // Cast to AppContainer to add the useCases property
    (infraContainer as any).useCases = useCaseFactory;
    globalContainer = infraContainer as AppContainer;
  }
  return globalContainer;
}



