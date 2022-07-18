export function getWeekdayByText(v: string) {
  const m = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };
  return m[v?.toLowerCase() || 'monday'];
}

export function getWeekdayByIndex(idx: number): string {
  const m = {
    0: 'monday',
    1: 'tuesday',
    2: 'wednesday',
    3: 'thursday',
    4: 'friday',
    5: 'saturday',
    6: 'sunday',
  };
  return m[idx || 0];
}
