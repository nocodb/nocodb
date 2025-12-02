import { TARGET_TABLES } from '@noco-integrations/core';
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
}
