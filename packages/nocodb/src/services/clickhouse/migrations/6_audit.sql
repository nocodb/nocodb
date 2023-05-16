CREATE TABLE IF NOT EXISTS nc_audit (
    id UUID,
    timestamp DateTime,

    event String,

    email String,
    user_id String,

    req_ipv4 IPv4,
    req_ipv6 IPv6,

    base_id String,
    project_id String,

    fk_model_id String,

    row_id String,

    op_type String,
    op_sub_type String,
    status String,
    description String,
    details String,


    PRIMARY KEY (id)
  ) ENGINE = MergeTree;
