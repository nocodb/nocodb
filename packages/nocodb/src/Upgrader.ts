import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { Source } from '~/models';

const BATCH_SIZE = 500;

export default class Upgrader {
  private static meta_query_buffer: string[] = [];
  private static data_query_buffer: {
    context: NcContext;
    source_id: string;
    query: string[];
  }[] = [];

  public static async addMetaQuery(query: string | string[]) {
    if (Array.isArray(query)) {
      this.meta_query_buffer.push(...query);
    } else {
      this.meta_query_buffer.push(query);
    }
  }

  public static async addDataQuery(
    context: NcContext,
    source_id: string,
    query: string | string[],
  ) {
    if (Array.isArray(query)) {
      this.data_query_buffer.push({ context, source_id, query });
    } else {
      this.data_query_buffer.push({ context, source_id, query: [query] });
    }
  }

  public static async printAll() {
    console.log('Meta Queries:');
    console.log(this.meta_query_buffer.join('\n'));
    console.log('Data Queries:');
    console.log(
      this.data_query_buffer.map((d) => d.query.join('\n')).join('\n'),
    );
  }

  public static async runAll() {
    const ncMeta = Noco.ncMeta;

    const groupedDataQueries = this.data_query_buffer.reduce((acc, curr) => {
      if (!acc[curr.source_id]) {
        acc[curr.source_id] = {
          context: curr.context,
          query: [],
        };
      }
      acc[curr.source_id].query.push(...curr.query);
      return acc;
    }, {});

    // Run meta queries in batch
    while (this.meta_query_buffer.length > 0) {
      const batch = this.meta_query_buffer.splice(0, BATCH_SIZE);
      await ncMeta.knex.raw(batch.join(';'));
    }

    // Run data queries in batch
    for (const source_id in groupedDataQueries) {
      const { context, query } = groupedDataQueries[source_id];

      const source = await Source.get(context, source_id, true, ncMeta);

      const dbDriver = await NcConnectionMgrv2.get(source);

      const query_buffer = [];

      while (query.length > 0) {
        const batch = query.splice(0, BATCH_SIZE);
        query_buffer.push(dbDriver.raw(batch.join(';')));
      }
    }
  }
}
