/** The rail's top items in the order saved in this browser; items it hasn't saved follow in their default order. */
export function sortRailItems<T extends { key: string }>(items: T[], order: string[]): T[] {
  const rank = (key: string) => (order.includes(key) ? order.indexOf(key) : order.length)

  return [...items].sort((a, b) => rank(a.key) - rank(b.key))
}

/** The saved order after a drag among the shown items; hidden ones (another workspace's plan) keep their slots. */
export function moveRailItem(order: string[], shownKeys: string[], from: number, to: number): string[] {
  const moved = [...shownKeys]
  moved.splice(to, 0, ...moved.splice(from, 1))

  const shown = new Set(shownKeys)
  let next = 0

  return [...order, ...shownKeys.filter((key) => !order.includes(key))].map((key) => (shown.has(key) ? moved[next++]! : key))
}
