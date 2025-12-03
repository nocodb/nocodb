export interface CompensationRecord {
  employeeId?: string;
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
