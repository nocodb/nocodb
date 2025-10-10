/**
 * Utility functions for tests
 */

/**
 * Check if running in Enterprise Edition mode
 * @returns {boolean} true if EE mode is enabled
 */
export const isEE = (): boolean => process.env.EE === 'true';
