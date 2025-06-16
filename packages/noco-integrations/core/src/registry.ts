import type { IntegrationEntry, IntegrationType } from './types';

export class IntegrationRegistry {
  private static instance: IntegrationRegistry;
  private plugins: Map<string, IntegrationEntry> = new Map();

  private constructor() {}

  static getInstance(): IntegrationRegistry {
    if (!IntegrationRegistry.instance) {
      IntegrationRegistry.instance = new IntegrationRegistry();
    }
    return IntegrationRegistry.instance;
  }

  register(integration: IntegrationEntry): void {
    const key = this.getKey(integration.type, integration.sub_type);
    this.plugins.set(key, integration);
  }

  get(type: IntegrationType, subType: string): IntegrationEntry | undefined {
    const key = this.getKey(type, subType);
    return this.plugins.get(key);
  }

  getAll(): IntegrationEntry[] {
    return Array.from(this.plugins.values());
  }

  private getKey(type: IntegrationType, subType: string): string {
    return `${type}-${subType}`;
  }
}

// Export a singleton instance
export const integrationRegistry = IntegrationRegistry.getInstance();
