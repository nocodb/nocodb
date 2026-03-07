/**
 * Extract user IDs from mention nodes in ProseMirror JSON content.
 *
 * Mention nodes have `type: "mention"` with an `attrs.id` that is a JSON
 * string containing `{ id, email, name }`. This walks the full JSON tree
 * and collects deduplicated user IDs.
 */
export const extractMentionsFromProseMirror = (
  doc: Record<string, any> | null | undefined,
): string[] => {
  if (!doc) return [];

  const mentions: string[] = [];

  const walk = (node: Record<string, any>) => {
    if (node.type === 'mention' && node.attrs?.id) {
      try {
        const parsed =
          typeof node.attrs.id === 'string'
            ? JSON.parse(node.attrs.id)
            : node.attrs.id;
        if (parsed?.id) mentions.push(parsed.id);
      } catch {
        // attrs.id may be a plain user ID string (older format)
        if (typeof node.attrs.id === 'string') mentions.push(node.attrs.id);
      }
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  walk(doc);
  return Array.from(new Set(mentions));
};

/**
 * Extract FileReference IDs from image and fileAttachment nodes in ProseMirror JSON.
 *
 * Image nodes have `type: "image"` with `attrs.id` (FileReference ID).
 * File attachment nodes have `type: "fileAttachment"` with `attrs.id`.
 * Returns deduplicated array of FileReference IDs.
 */
export const extractFileReferenceIds = (
  doc: Record<string, any> | null | undefined,
): string[] => {
  if (!doc) return [];

  const ids: string[] = [];

  const walk = (node: Record<string, any>) => {
    if (
      (node.type === 'image' || node.type === 'fileAttachment') &&
      node.attrs?.id
    ) {
      ids.push(node.attrs.id);
    }
    if (Array.isArray(node.content)) {
      for (const child of node.content) walk(child);
    }
  };

  walk(doc);
  return Array.from(new Set(ids));
};

export const extractMentions = (richText: string) => {
  const mentions: string[] = [];

  // The Mentions are stored as follows @(userId|email|display_name) in the rich text
  // Extracts the userId from the content

  const regex = /@\(([^)]+)\)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(richText)) !== null) {
    const userId = match[1]?.split('|')[0]; // Extracts the userId part from the matched string
    if (userId) {
      mentions.push(userId);
    }
  }

  return Array.from(new Set(mentions));
};
