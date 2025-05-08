import { IntegrationManifest, IntegrationType } from '../types';

/**
 * Create a properly configured integration manifest based on integration type
 * This ensures all integrations have the required fields for their type
 * without requiring developers to manually add them
 *
 * Example usage in an integration manifest file:
 *
 * ```typescript
 * import { createManifest, IntegrationType } from '@noco-integrations/core';
 *
 * export const manifest = createManifest(IntegrationType.Ai, {
 *   title: 'Your Integration',
 *   icon: 'your-icon',
 *   version: '0.1.0',
 *   description: 'Your integration description',
 *   author: 'Your Name'
 * });
 * ```
 */
export function createManifest(
  type: IntegrationType,
  manifest: IntegrationManifest,
): IntegrationManifest {
  switch (type) {
    case IntegrationType.Ai:
      return {
        ...manifest,
        expose: ['availableModels'],
      };
    case IntegrationType.Auth:
      return {
        ...manifest,
      };
    case IntegrationType.Sync:
      return {
        ...manifest,
      };
    default:
      return manifest as IntegrationManifest;
  }
}
