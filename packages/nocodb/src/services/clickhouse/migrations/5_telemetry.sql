CREATE TABLE IF NOT EXISTS telemetry (
    id UUID,
    timestamp DateTime,
    workspace_id String,
  	user_id String,
    project_id String,
    event String,
    url String,
    method String,
    status UInt16,
    exec_time UInt64,
    req_ipv4 IPv4,
    req_ipv6 IPv6,
    package_id String,
    client_id String,

    props Nullable(Nested)
  ) ENGINE = MergeTree
  ORDER BY timestamp;
