import {
  buildSnapshotScheduleCron,
  SnapshotScheduleFrequency,
} from './snapshotSchedule';

describe('buildSnapshotScheduleCron', () => {
  it('builds hourly cron from minute', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.HOURLY, {
        minute: 15,
      })
    ).toBe('15 * * * *');
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.HOURLY, {})
    ).toBe('0 * * * *');
  });

  it('rejects invalid hourly minute', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.HOURLY, {
        minute: 60,
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.HOURLY, {
        minute: -1,
      })
    ).toBeNull();
  });

  it('builds daily cron from time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {
        time: '02:00',
      })
    ).toBe('0 2 * * *');
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {
        time: '23:45',
      })
    ).toBe('45 23 * * *');
  });

  it('rejects invalid daily time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {
        time: '24:00',
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.DAILY, {})
    ).toBeNull();
  });

  it('builds weekly cron from day-of-week and time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.WEEKLY, {
        time: '02:00',
        dayOfWeek: 1,
      })
    ).toBe('0 2 * * 1');
  });

  it('rejects invalid day-of-week', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.WEEKLY, {
        time: '02:00',
        dayOfWeek: 7,
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.WEEKLY, {
        time: '02:00',
      })
    ).toBeNull();
  });

  it('builds monthly cron from day-of-month and time', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.MONTHLY, {
        time: '02:00',
        dayOfMonth: 1,
      })
    ).toBe('0 2 1 * *');
  });

  it('rejects invalid day-of-month', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.MONTHLY, {
        time: '02:00',
        dayOfMonth: 0,
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.MONTHLY, {
        time: '02:00',
        dayOfMonth: 32,
      })
    ).toBeNull();
  });

  it('passes through valid 5-field custom cron', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {
        cron: '0 2 * * *',
      })
    ).toBe('0 2 * * *');
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {
        cron: '  0 2 * * 1  ',
      })
    ).toBe('0 2 * * 1');
  });

  it('rejects malformed custom cron', () => {
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {
        cron: '0 2 * *',
      })
    ).toBeNull();
    expect(
      buildSnapshotScheduleCron(SnapshotScheduleFrequency.CRON, {})
    ).toBeNull();
  });

  it('rejects unknown frequency', () => {
    expect(buildSnapshotScheduleCron('yearly' as any, {})).toBeNull();
  });
});
