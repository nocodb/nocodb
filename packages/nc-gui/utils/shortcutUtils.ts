export const renderAltOrOptlKey = () => {
  return isMac() ? '⌥' : 'ALT'
}

export const renderCmdOrCtrlKey = () => {
  return isMac() ? '⌘' : 'CTRL'
}
