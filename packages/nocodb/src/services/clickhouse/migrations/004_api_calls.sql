CREATE TABLE IF NOT EXISTS usage_api_calls (
    timestamp DateTime,
    workspace_id String(20),
  	user_id String(20),
    project_id String(120),
    url String,
    method String(10),
    status UInt16,
    exec_time UInt64,
    req_ipv4 IPv4,
    req_ipv6 IPv6
  ) ENGINE = MergeTree
  ORDER BY timestamp;
