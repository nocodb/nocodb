SET allow_experimental_object_type = 1;

CREATE TABLE IF NOT EXISTS telemetry (
    id UUID,
    timestamp DateTime,
    event String,

    url String,
    workspace_id String,
  	user_id String,
    project_id String,

    req_ipv4 IPv4,
    req_ipv6 IPv6,
    package_id String,
    client_id String,

    properties JSON,

    PRIMARY KEY (id)
  ) ENGINE = MergeTree;
