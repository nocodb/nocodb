export interface JobInfoRecord {
  employeeId?: string;
  lastChanged: string;
  rows: {
    date: string;
    location: string;
    department: 'Human Resources';
    division: 'North America';
    jobTitle: 'Associate HR Administrator';
    reportsTo: 'Jennifer Caldwell';
    teams: null;
  }[];
}
