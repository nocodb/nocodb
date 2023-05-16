CREATE TABLE IF NOT EXISTS usage_api_calls (
    timestamp DateTime,
    workspace_id String,
  	user_id String,
    project_id String,
    url String,
    method String,
    status UInt16,
    exec_time UInt64,
    req_ipv4 IPv4,
    req_ipv6 IPv6
  ) ENGINE = MergeTree
  ORDER BY timestamp;
