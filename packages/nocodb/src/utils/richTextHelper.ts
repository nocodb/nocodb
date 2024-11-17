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
