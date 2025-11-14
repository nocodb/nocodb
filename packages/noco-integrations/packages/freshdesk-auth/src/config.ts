/**
 * Centralized configuration for Freshdesk Auth Integration
 */

/**
 * Helper to get API base URL from domain
 * @param domain - Freshdesk domain (e.g., "yourcompany.freshdesk.com")
 */
export const getApiBaseUrl = (domain: string): string => {
  // Ensure domain doesn't have protocol
  const cleanDomain = domain.replace(/^https?:\/\//, '');
  return `https://${cleanDomain}/api/v2`;
};
