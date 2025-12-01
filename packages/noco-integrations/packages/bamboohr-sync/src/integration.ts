import {
  DataObjectStream,
  SCHEMA_HRIS,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import { BambooHRFormatter } from './formatter';
import type { BambooHRAuthIntegration } from '@noco-integrations/bamboohr-auth';
import type { SyncLinkValue, SyncRecord } from '@noco-integrations/core';

export interface BambooHRSyncPayload {
  title: string;
}

const employeeFetchFields = [
  'employeeNumber',
  'firstName',
  'lastName',
  'preferredName',
  'displayName',
  'workEmail',
  'homeEmail',
  'mobilePhone',
  'employmentStatus',
  'ssn',
  'gender',
  'ethnicity',
  'maritalStatus',
  'dateOfBirth',
  'hireDate',
  'terminationDate',
  'department',
  'photoUploaded',
];
const employeeFetchFieldsCsv = employeeFetchFields.join(',');

export default class BambooHRSyncIntegration extends SyncIntegration<BambooHRSyncPayload> {
  formatter = new BambooHRFormatter();

  public getTitle() {
    return this.config.title;
  }

  public async getDestinationSchema(_auth: BambooHRAuthIntegration) {
    return SCHEMA_HRIS;
  }

  public async fetchData(
    auth: BambooHRAuthIntegration,
    args: {
      targetTables?: TARGET_TABLES[];
      targetTableIncrementalValues?: Record<TARGET_TABLES, string>;
    },
  ): Promise<DataObjectStream<SyncRecord>> {
    const stream = new DataObjectStream<SyncRecord>();

    const { targetTableIncrementalValues } = args;

    // Simplified data fetching for BambooHR employees
    void (async () => {
      try {
        this.log(
          `[BambooHR Sync] Fetching employees for company ${auth.config.companyDomain}`,
        );

        const employeeIncrementalValue =
          targetTableIncrementalValues?.[TARGET_TABLES.TICKETING_TICKET];

        const fetchAfter = employeeIncrementalValue
          ? new Date(employeeIncrementalValue).toISOString()
          : '2000-01-01T00:00:00Z';

        const { data: employeeChange } = (await auth.use(async (client) => {
          return await client.get(`/employees/changed?since=${fetchAfter}`);
        })) as {
          data: {
            latest: string;
            employees: Record<
              string,
              { id: string; action: string; lastChanged: string }
            >;
          };
        };
        for (const [id, employee] of Object.entries(employeeChange.employees)) {
          // TODO: handle deleted record
          if (employee.action.toLowerCase() === 'deleted') {
            continue;
          }
          console.log('fetch for id ' + id);
          const { data: employeeDetail } = await auth.use(async (client) => {
            return await client.get(
              `/employees/${id}?fields=${employeeFetchFieldsCsv}`,
            );
          });

          stream.push({
            recordId: `${employeeDetail.id}`,
            targetTable: TARGET_TABLES.HRIS_EMPLOYEE,
            ...this.formatData(
              TARGET_TABLES.HRIS_EMPLOYEE,
              employeeDetail,
              auth.config.companyDomain,
            ),
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
  formatData(
    targetTable: TARGET_TABLES | string,
    data: any,
    namespace?: string,
  ): { data: SyncRecord; links?: Record<string, SyncLinkValue> } {
    switch (targetTable) {
      case TARGET_TABLES.HRIS_EMPLOYEE:
        return this.formatter.formatEmployee({
          employee: data,
          namespace: namespace!,
        });
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

  public getIncrementalKey(targetTable: TARGET_TABLES) {
    switch (targetTable) {
      case TARGET_TABLES.HRIS_EMPLOYEE:
        return 'RemoteUpdatedAt';
      default:
        return 'RemoteUpdatedAt';
    }
  }
}
