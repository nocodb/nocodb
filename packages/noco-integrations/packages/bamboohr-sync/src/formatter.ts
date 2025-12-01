import { TARGET_TABLES } from '@noco-integrations/core';
import type { SyncRecord } from '@noco-integrations/core';

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
        'Date Of Birth': employee.dateOfBirth,
        'Start Date': employee.hireDate,
        'Termination Date': employee.terminationDate,
        Manager: employee.supervisor,
        Department: employee.department,
        Avatar: employee.photoUrl,
        RemoteRaw: JSON.stringify(employee),
        RemoteUpdatedAt: employee.lastChanged,
        RemoteNamespace: namespace,
      },
    } as { data: SyncRecord };
    return result;
  }
}
