/**
 * Backend ProseMirror ↔ Markdown conversion utilities.
 *
 * The implementation currently lives under ai/chat/tools/docs/ for
 * historical reasons (first consumer was the AI doc tools). This module
 * is the canonical import path for non-AI consumers like SmartText.
 *
 * Future cleanup: move the implementation into this file and update the
 * AI tools to import from here. Kept as a re-export shim for now to
 * avoid a large file-move diff inside this PR.
 */

export {
  prosemirrorToMarkdown,
  markdownToProseMirror,
} from '~/ee/integrations/ai/chat/tools/docs/prosemirror-utils';
