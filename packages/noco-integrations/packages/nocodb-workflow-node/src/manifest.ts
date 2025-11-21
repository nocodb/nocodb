import { type IntegrationManifest } from '@noco-integrations/core';

// For workflow nodes we still provide a manifest so they can be listed & versioned.
// This is not yet registered via IntegrationRegistry (different lifecycle) but
// keeps consistency with other integration packages.
export const manifest: IntegrationManifest = {
  title: 'NocoDB Workflow Nodes',
  icon: 'nocodb',
  version: '0.1.0',
  description: 'Core workflow nodes for building NocoDB automations',
};

export default manifest;
