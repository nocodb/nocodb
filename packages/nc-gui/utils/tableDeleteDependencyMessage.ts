import { h } from 'vue'

/**
 * Build the "unable to delete table" dependency notice as a safe VNode tree.
 *
 * The dependency lines contain persisted schema metadata (column titles and
 * related-table titles). Those are attacker-controllable on an external data
 * source, so they MUST be rendered as text, never interpolated into an
 * `innerHTML` string (CWE-79). Vue escapes text children, so passing the
 * metadata strings as children — with explicit `<br>` VNodes for line breaks —
 * keeps any markup-like characters inert.
 *
 * Pass the returned VNode to the message wrapper via its `content` option:
 *   `message.info({ content: buildTableDeleteDependencyMessage(msgs) })`
 * (ncMessage treats a bare VNode as its options object, which suppresses the
 * notice — the `{ content }` form is required.)
 */
export const buildTableDeleteDependencyMessage = (dependencyMessages: string[]) =>
  h('div', { style: { padding: '10px 4px' } }, [
    'Unable to delete tables because of the following.',
    h('br'),
    h('br'),
    ...dependencyMessages.flatMap((dependencyMessage) => [dependencyMessage, h('br')]),
    h('br'),
    'Delete them & try again',
  ])
