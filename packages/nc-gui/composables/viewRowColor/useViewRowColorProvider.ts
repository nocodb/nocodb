import { type RowColoringInfo } from 'nocodb-sdk'

export function useViewRowColorProvider(_params: { shared?: boolean }) {
  const reloadRowColorInfo = async () => {}

  return { reloadRowColorInfo }
}
