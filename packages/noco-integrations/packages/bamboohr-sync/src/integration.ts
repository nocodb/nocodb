import {
  DataObjectStream,
  SCHEMA_HRIS,
  SyncIntegration,
  TARGET_TABLES,
} from '@noco-integrations/core';
import { AxiosError } from 'axios';
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
  'homePhone',
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
  // location-related
  'location',
  'address1',
  'address2',
  'city',
  'state',
  'zipcode',
  'country',
  // employment-related
  'employmentHistoryStatus',
];
const employeeFetchFieldsCsv = employeeFetchFields.join(',');

export default class BambooHRSyncIntegration extends SyncIntegration<BambooHRSyncPayload> {
  formatter = new BambooHRFormatter();

  public getTitle() {
    return this.config.title;
  }

  get batchSize(): number {
    return 25;
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
        for (const employee of Object.values(employeeChange.employees).sort(
          (a, b) => a.lastChanged.localeCompare(b.lastChanged),
        )) {
          const { id } = employee;
          // TODO: handle deleted record
          if (employee.action.toLowerCase() === 'deleted') {
            continue;
          }
          try {
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

            stream.push({
              recordId: `${employeeDetail.id}`,
              targetTable: TARGET_TABLES.HRIS_LOCATION,
              ...this.formatData(
                TARGET_TABLES.HRIS_LOCATION,
                employeeDetail,
                auth.config.companyDomain,
              ),
            });
          } catch (ex) {
            if (ex instanceof AxiosError) {
              if (ex.response?.status === 404) {
                // do nothing
                // somehow in tests data, some employee id is not found when calling get api
              } else {
                throw ex;
              }
            } else {
              throw ex;
            }
          }
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
      case TARGET_TABLES.HRIS_LOCATION:
        return this.formatter.formatHomeLocation({
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
