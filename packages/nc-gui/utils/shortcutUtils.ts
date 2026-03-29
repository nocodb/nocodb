export function renderAltOrOptlKey(capitalize = false) {
  return isMac() ? '⌥' : capitalize ? 'Alt' : 'ALT'
}

export function renderCmdOrCtrlKey(capitalize = false) {
  return isMac() ? '⌘' : capitalize ? 'Ctrl' : 'CTRL'
}
