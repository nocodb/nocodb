/** The signed-in user's choice to show option colours from a colourblind-safe palette. Off unless set. */
export const useColorblindPalette = () => {
  const setColorblindPalette = (isOn: boolean) => useUsers().updateUserMeta({ [COLORBLIND_PALETTE_META_KEY]: isOn })

  return { isColorblindPaletteOn: readonly(isColorblindPaletteOn), setColorblindPalette }
}
