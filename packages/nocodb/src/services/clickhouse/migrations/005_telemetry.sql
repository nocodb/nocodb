SET allow_experimental_object_type = 1;

CREATE TABLE IF NOT EXISTS usage_telemetry (
    id UUID,
    created_at DateTime,
    event String,

    url String,
    workspace_id String(20),
  	user_id String(20),
    project_id String(120),

    req_ipv4 IPv4,
    req_ipv6 IPv6,
    package_id String(255),
    client_id String(255),

    properties JSON,

    PRIMARY KEY (id)
  ) ENGINE = MergeTree;
