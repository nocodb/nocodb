/**
 * Centralized configuration for Zendesk Auth Integration
 */

export const getTokenUri = (subdomain: string): string => {
  return `https://${subdomain}.zendesk.com/oauth/tokens`;
};
