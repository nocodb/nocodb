// Share routes must stay framable — every share dialog offers an "Embed in your
// site" iframe snippet, and snippets already published in the wild must keep
// working. Everything else from the SPA shell is the authenticated app and is
// frame-locked to same-origin.
//
// MUST stay in sync with the share-link builders, or the missed route's embeds
// break with "refused to connect": SharePage, ShareBase, ShareDashboard,
// ShareInterface, SharePageDoc.
//
// The `nc/base` and `nc/p` alternatives are the pre-v2 shared-base forms, still
// listed as embeddable by extensions/url-preview-ee/utils.ts and still served by
// the dummy redirect page at pages/index/[typeOrId]/base/[baseId].vue.
const EMBEDDABLE_SHARE_ROUTE =
  /^\/(?:nc\/(?:view|form|grid|gallery|kanban|calendar|map|list|timeline|gantt|dashboard|interface|base|p)|base|doc)\/[^/]+/;

// `/p/<customPath>` 302s to a share route. Browsers check frame ancestors on
// redirect responses too, so this hop must stay header-free as well.
function isCustomUrlRedirect(path: string): boolean {
  return /^\/p\/[^/]+/.test(path);
}

// Legacy hash-fragment embeds put the share route in the FRAGMENT, which is
// never sent to the server: `/dashboard/#/nc/view/<uuid>` and `/#/nc/view/<uuid>`
// (both still listed by extensions/url-preview-ee/utils.ts) arrive here as plain
// `GET /dashboard/` and `GET /`. plugins/hashRedirect.client.ts rewrites them to
// the clean URL, but only once the document is allowed to load at all — so
// frame-locking the bare shell silently breaks every embed published before the
// clean-URL migration, with no server-side way to tell it apart from a real
// dashboard load.
//
// These two paths therefore carry no frame header. The boundary is still
// enforced, one layer up: nc-gui's middleware/02.security.global.ts throws 403
// for any framed route that is not a share route, and it re-runs on every
// navigation — so a framed shell can only ever resolve to a share view. Keep
// that middleware and this exemption in sync.
//
// Planned: once embeds are canonicalised onto a dedicated `/embed/` prefix, the
// frame policy becomes unambiguous server-side and this exemption (along with its
// dependency on client-side enforcement) can be dropped — both paths go back to
// being hard-locked.
function isLegacyHashShell(path: string): boolean {
  return /^\/(?:dashboard\/?)?$/.test(path);
}

// Public shared-view/base API prefixes — the data behind the embeds.
function isPublicShareApi(path: string): boolean {
  return (
    path.startsWith('/api/v2/public/') || path.startsWith('/api/v1/db/public/')
  );
}

function isEmbeddablePath(path: string): boolean {
  return (
    EMBEDDABLE_SHARE_ROUTE.test(path) ||
    isCustomUrlRedirect(path) ||
    isLegacyHashShell(path) ||
    isPublicShareApi(path)
  );
}

/**
 * Frame-lock the response to same-origin unless it targets an embeddable share
 * route. Exempt paths get neither header — X-Frame-Options has no path notion.
 */
export function setFrameGuardHeaders(
  req: { path?: string },
  res: { setHeader: (name: string, value: string) => void },
): void {
  const path = typeof req.path === 'string' ? req.path : '';
  if (isEmbeddablePath(path)) {
    return;
  }
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
}
