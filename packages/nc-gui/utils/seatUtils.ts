import type { SeatType } from 'nocodb-sdk'

const SEAT_TYPE_RANK: Record<SeatType, number> = { free: 0, app: 1, full: 2 }

// Lists without seat_type (legacy) only know billable, which is an editor seat.
export function memberSeatType(member: { seat_type?: SeatType; billable?: boolean }): SeatType {
  return member.seat_type ?? (member.billable ? 'full' : 'free')
}

export function compareSeatTypes(a?: SeatType, b?: SeatType): number {
  return SEAT_TYPE_RANK[a ?? 'free'] - SEAT_TYPE_RANK[b ?? 'free']
}
