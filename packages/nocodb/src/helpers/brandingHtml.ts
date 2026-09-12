import type { Request } from 'express';

/**
 * CE stub — white-label is an EE feature, so the community build serves the
 * SPA shell unchanged. The EE override (`src/ee/helpers/brandingHtml.ts`)
 * rewrites the document <head> (title, og:*, twitter:*, theme-color, favicon)
 * from the instance white-label config so link unfurlers / crawlers — which
 * never run our JS — see the configured brand instead of the build-time NocoDB
 * defaults. Resolved automatically via the `~/` build overlay.
 */
export async function injectBrandingMeta(
  html: string,
  _req: Request,
): Promise<string> {
  return html;
}
