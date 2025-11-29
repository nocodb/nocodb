import {
  DataObjectStream,
  SCHEMA_HRIS,
  SyncIntegration,
  TARGET_TABLES,
  type HrisBankInfoRecord,
  type HrisBenefitRecord,
  type HrisCompanyRecord,
  type HrisDependentRecord,
  type HrisEmployeePayrollRunRecord,
  type HrisEmployeeRecord,
  type HrisEmploymentRecord,
  type HrisGroupRecord,
  type HrisLocationRecord,
  type HrisPayGroupRecord,
  type HrisPayrollRunRecord,
  type HrisTimeOffBalanceRecord,
  type HrisTimeOffRecord,
  type HrisTimesheetEntryRecord,
} from '@noco-integrations/core';
import type { BambooHRAuthIntegration } from '@noco-integrations/bamboohr-auth';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';

export interface BambooHRSyncPayload {
  domain: string;
}

export default class BambooHRSyncIntegration extends SyncIntegration<BambooHRSyncPayload> {
  public getTitle() {
    return this.config.domain;
  }

  public async getDestinationSchema(_auth: BambooHRAuthIntegration) {
    return SCHEMA_HRIS;
  }

  public async fetchData(
    auth: BambooHRAuthIntegration,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: {
        [key: string]: Record<TARGET_TABLES, string>;
      };
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    const { domain } = this.config;

    // Simplified data fetching for BambooHR employees
    void (async () => {
      try {
        this.log(`[BambooHR Sync] Fetching employees for domain ${domain}`);

        const { data: employees } = await auth.use(async (client) => {
          return await client.get(
            `/employees/directory`,
          );
        });

        for (const employee of employees.employees) {
          stream.push({
            recordId: employee.id,
            targetTable: TARGET_TABLES.HRIS_EMPLOYEE,
            ...this.formatData(TARGET_TABLES.HRIS_EMPLOYEE, employee),
          });
        }

        stream.push(null);
      } catch (error) {
        console.error('[BambooHR Sync] Error fetching data:', error);
        stream.destroy(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();

    return stream;
  }

  public formatData(
    targetTable: TARGET_TABLES,
    data: any,
    namespace?: string,
  ): {
    data: SyncRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    switch (targetTable) {
      case TARGET_TABLES.HRIS_EMPLOYEE:
        return this.formatEmployee(data, namespace);
      default: {
        return {
          data: {
            RemoteRaw: JSON.stringify(data),
            RemoteNamespace: namespace,
          },
        };
      }
    }
  }

  private formatEmployee(
    employee: any,
    namespace?: string,
  ): {
    data: HrisEmployeeRecord;
    links?: Record<string, SyncLinkValue>;
  } {
    const employeeData: HrisEmployeeRecord = {
      RemoteId: employee.id,
      'First Name': employee.firstName,
      'Last Name': employee.lastName,
      'Display Full Name': employee.displayName,
      'Work Email': employee.workEmail,
      'Mobile Phone Number': employee.mobilePhone,
      'Hire Date': employee.hireDate,
      'Employment Status': employee.employmentStatus,
      'Remote Created At': employee.created,
      RemoteUpdatedAt: employee.lastChanged,
      RemoteRaw: JSON.stringify(employee),
      RemoteNamespace: namespace,
    };

    const links: Record<string, SyncLinkValue> = {};

    return {
      data: employeeData,
      links: Object.keys(links).length > 0 ? links : undefined,
    };
  }

  public getIncrementalKey(targetTable: TARGET_TABLES) {
    switch (targetTable) {
      case TARGET_TABLES.HRIS_EMPLOYEE:
        return 'RemoteUpdatedAt';
      default:
        return 'RemoteUpdatedAt';
    }
  }

  public getNamespaces(): string[] {
    return [this.config.domain];
  }

  public async fetchOptions(
    auth: BambooHRAuthIntegration,
    key: string,
  ): Promise<{
    label: string;
    value: string;
  }[]> {
    // BambooHR does not have dynamic options like Bitbucket repositories
    // This method can be expanded if there are specific lists to fetch (e.g., custom fields)
    return [];
  }
}
