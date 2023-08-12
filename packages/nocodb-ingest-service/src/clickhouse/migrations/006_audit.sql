CREATE TABLE IF NOT EXISTS nc_audit (
    id UUID,
    created_at DateTime,
    email String(255),
    user_id String(20),
    req_ipv4 IPv4,
    req_ipv6 IPv6,
    base_id String(20),
    project_id String(128),
    workspace_id String(128),
    fk_model_id String(20),
    row_id String(20),
    op_type String(20),
    op_sub_type String(20),
    status String(255),
    description Text,
    details Text,

    PRIMARY KEY (id)
  ) ENGINE = MergeTree;
