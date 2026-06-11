export const renderAltOrOptlKey = (capitalize = false) => {
  return isMac() ? '⌥' : capitalize ? 'Alt' : 'ALT'
}

export const renderCmdOrCtrlKey = (capitalize = false) => {
  return isMac() ? '⌘' : capitalize ? 'Ctrl' : 'CTRL'
}
