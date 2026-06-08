import type { WhiteLabelConfig } from 'nocodb-sdk';

/**
 * Display product name for transactional emails — the white-label product name
 * when branding is enabled, otherwise the NocoDB default. Used in template body
 * copy (headings, buttons, preview text) so white-labelled emails don't say
 * "NocoDB".
 */
export const resolveProductName = (
  branding?: WhiteLabelConfig | null,
): string => (branding?.enabled && branding.productName) || 'NocoDB';
