/**
 * Format property name for display
 */
export function formatPropertyLabel(propertyName: string): string {
  return propertyName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

/**
 * Parse comma-separated values into array
 */
export function parseCommaSeparated(value: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Build HubSpot API error message
 */
export function buildErrorMessage(error: unknown): string {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        errors?: Array<{ message: string }>;
      };
    };
    message?: string;
  };

  if (err.response?.data?.message) {
    return err.response.data.message;
  }

  if (err.response?.data?.errors?.length) {
    return err.response.data.errors.map((e) => e.message).join('; ');
  }

  if (err.message) {
    return err.message;
  }

  return 'An unknown error occurred';
}
