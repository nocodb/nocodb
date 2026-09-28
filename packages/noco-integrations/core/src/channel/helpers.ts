/**
 * The message with the bot's own mention taken out.
 *
 * Removing it from mid-sentence would otherwise leave the spaces that sat on
 * either side of it, so the run is collapsed rather than just deleted.
 */
export function stripMention(text: string, mention: RegExp | null): string {
  return (mention ? text.replace(mention, ' ') : text)
    .replace(/\s+/g, ' ')
    .trim();
}
