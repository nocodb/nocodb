/**
 * Returns GCP credentials config for GoogleAuth / PubSub clients.
 *
 * Supports two modes:
 *   1. NC_GCP_MARKETPLACE_CREDENTIALS — inline JSON string of the service account key
 *   2. GOOGLE_APPLICATION_CREDENTIALS  — file path (standard GCP default, no code needed)
 *
 * When NC_GCP_MARKETPLACE_CREDENTIALS is set, it takes priority and passes
 * the parsed credentials directly so no key file is needed on disk.
 */
export function getGcpCredentials(): { credentials?: Record<string, any> } {
  const inline = process.env.NC_GCP_MARKETPLACE_CREDENTIALS;
  if (!inline) return {};

  return { credentials: JSON.parse(inline) };
}
