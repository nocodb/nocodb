import { TARGET_TABLES } from '@noco-integrations/core';
import type { CompensationRecord } from './types/compensation.record';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';

const safeDateValue = (value: string) => {
  return value?.startsWith('0000') ? undefined : value;
};

export class BambooHRFormatter {
  formatEmployee({
    employee,
    namespace,
  }: {
    employee: any;
    namespace: string;
  }) {
    const result = {
      recordId: employee.id,
      targetTable: TARGET_TABLES.HRIS_EMPLOYEE,
      data: {
        'Employee Number': employee.employeeNumber,
        'First Name': employee.firstName,
        'Last Name': employee.lastName,
        'Preferred Name': employee.preferredName,
        'Display Full Name': employee.displayName,
        'Work Email': employee.workEmail,
        'Personal Email': employee.homeEmail,
        'Mobile Phone Number': employee.mobilePhone,
        'Employment Status': employee.employmentStatus,
        SSN: employee.ssn,
        Gender: employee.gender,
        Ethnicity: employee.ethnicity,
        'Marital Status': employee.maritalStatus,
        'Date Of Birth': safeDateValue(employee.dateOfBirth),
        'Start Date': safeDateValue(employee.hireDate),
        'Termination Date': safeDateValue(employee.terminationDate),
        Manager: employee.supervisor,
        Department: employee.department,
        Avatar: employee.photoUrl,
        RemoteRaw: JSON.stringify(employee),
        RemoteUpdatedAt: safeDateValue(employee.lastChanged),
        RemoteNamespace: namespace,
      },
    } as { data: SyncRecord };
    return result;
  }
  formatHomeLocation({
    employee,
    namespace,
  }: {
    employee: any;
    namespace: string;
  }) {
    const result = {
      recordId: employee.id,
      targetTable: TARGET_TABLES.HRIS_LOCATION,
      data: {
        Name: employee.location,
        'Phone Number': employee.homePhone ?? employee.mobilePhone,
        'Street 1': employee.address1,
        'Street 2': employee.address2,
        City: employee.city,
        State: employee.state,
        'Zip Code': employee.zipcode,
        Country: employee.country,
        'Location Type': 'Home',
        RemoteRaw: '',
        RemoteUpdatedAt: safeDateValue(employee.lastChanged),
        RemoteNamespace: namespace,
      },
      links: {
        'Home of Employee': [employee.id],
      },
    } as { data: SyncRecord; links: Record<string, SyncLinkValue> };
    return result;
  }
  formatEmployment({
    employee,
    compensation,
    jobInfo,
    namespace,
  }: {
    employee: any;
    jobInfo: any;
    compensation: CompensationRecord;
    namespace: string;
  }) {
    const latestCompensation = compensation.rows.sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    )[0];

    const result = {
      recordId: employee.id,
      targetTable: TARGET_TABLES.HRIS_EMPLOYMENT,
      data: {
        'Employment Type': employee.employmentHistoryStatus,
        'Job Title': jobInfo.jobTitle,
        'Pay Rate': latestCompensation.rate.split(' ')[0],
        'Pay Period': '',
        'Pay Frequency': latestCompensation.paidPer,
        'Pay Currency': latestCompensation.rate.split(' ')[1],
        'Pay Group': '',
        'Flsa Status': latestCompensation.exempt ?? '',
        'Effective Date': latestCompensation.startDate,
        RemoteRaw: JSON.stringify(jobInfo),
        RemoteUpdatedAt: safeDateValue(employee.lastChanged),
        RemoteNamespace: namespace,
      },
      links: {
        'Home of Employee': [employee.id],
      },
    } as { data: SyncRecord; links: Record<string, SyncLinkValue> };
    return result;
  }
}
