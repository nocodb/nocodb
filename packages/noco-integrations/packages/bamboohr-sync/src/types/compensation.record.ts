export interface CompensationRecord {
  id?: string;
  lastChanged: string;
  rows: {
    startDate: string;
    rate: string;
    type: string;
    exempt: string;
    reason: string;
    comment: string;
    paidPer: string;
    paySchedule: string;
    overtimeRate: string;
  }[];
}

export interface JobInfoRecord {
  id?: string;
  lastChanged: string;
  rows: {
    date: string;
    location: string;
    department: 'Human Resources';
    division: 'North America';
    jobTitle: 'Associate HR Administrator';
    reportsTo: 'Jennifer Caldwell';
    teams: null;
  };
}
