export function getWeekdayByText(v: string) {
  return {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  }[v?.toLowerCase() || 'monday'];
}

export function getWeekdayByIndex(idx: number): string {
  return {
    0: 'monday',
    1: 'tuesday',
    2: 'wednesday',
    3: 'thursday',
    4: 'friday',
    5: 'saturday',
    6: 'sunday',
  }[idx || 0];
}
