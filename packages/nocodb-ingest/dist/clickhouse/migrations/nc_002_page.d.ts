import type { ClickHouse } from 'clickhouse';
declare function up(client: ClickHouse, config: {
    database?: string;
}): Promise<void>;
declare function down(client: ClickHouse): Promise<void>;
export { up, down };
