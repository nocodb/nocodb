--
-- PostgreSQL database cluster dump
--

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

ALTER ROLE postgres WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;

--
-- Database creation
--

CREATE DATABASE meta_v2_2022_06_13 WITH TEMPLATE = template0 OWNER = postgres;
REVOKE CONNECT,TEMPORARY ON DATABASE template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE template1 TO PUBLIC;


\connect meta_v2_2022_06_13

SET default_transaction_read_only = off;

--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.24
-- Dumped by pg_dump version 9.6.24

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: nc_acl; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_acl (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    tn character varying(255),
    acl text,
    type character varying(255) DEFAULT 'table'::character varying,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_acl OWNER TO postgres;

--
-- Name: nc_acl_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_acl_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_acl_id_seq OWNER TO postgres;

--
-- Name: nc_acl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_acl_id_seq OWNED BY public.nc_acl.id;


--
-- Name: nc_api_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_api_tokens (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255),
    description character varying(255),
    permissions text,
    token text,
    expiry character varying(255),
    enabled boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_api_tokens OWNER TO postgres;

--
-- Name: nc_api_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_api_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_api_tokens_id_seq OWNER TO postgres;

--
-- Name: nc_api_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_api_tokens_id_seq OWNED BY public.nc_api_tokens.id;


--
-- Name: nc_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_audit (
    id integer NOT NULL,
    "user" character varying(255),
    ip character varying(255),
    project_id character varying(255),
    db_alias character varying(255),
    model_name character varying(100),
    model_id character varying(100),
    op_type character varying(255),
    op_sub_type character varying(255),
    status character varying(255),
    description text,
    details text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_audit OWNER TO postgres;

--
-- Name: nc_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_audit_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_audit_id_seq OWNER TO postgres;

--
-- Name: nc_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_audit_id_seq OWNED BY public.nc_audit.id;


--
-- Name: nc_audit_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_audit_v2 (
    id character varying(20) NOT NULL,
    "user" character varying(255),
    ip character varying(255),
    base_id character varying(20),
    project_id character varying(128),
    fk_model_id character varying(20),
    row_id character varying(255),
    op_type character varying(255),
    op_sub_type character varying(255),
    status character varying(255),
    description text,
    details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_audit_v2 OWNER TO postgres;

--
-- Name: nc_bases_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_bases_v2 (
    id character varying(20) NOT NULL,
    project_id character varying(128),
    alias character varying(255),
    config text,
    meta text,
    is_meta boolean,
    type character varying(255),
    inflection_column character varying(255),
    inflection_table character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_bases_v2 OWNER TO postgres;

--
-- Name: nc_col_formula_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_col_formula_v2 (
    id character varying(20) NOT NULL,
    fk_column_id character varying(20),
    formula text NOT NULL,
    formula_raw text,
    error text,
    deleted boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_col_formula_v2 OWNER TO postgres;

--
-- Name: nc_col_lookup_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_col_lookup_v2 (
    id character varying(20) NOT NULL,
    fk_column_id character varying(20),
    fk_relation_column_id character varying(20),
    fk_lookup_column_id character varying(20),
    deleted boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_col_lookup_v2 OWNER TO postgres;

--
-- Name: nc_col_relations_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_col_relations_v2 (
    id character varying(20) NOT NULL,
    ref_db_alias character varying(255),
    type character varying(255),
    virtual boolean,
    db_type character varying(255),
    fk_column_id character varying(20),
    fk_related_model_id character varying(20),
    fk_child_column_id character varying(20),
    fk_parent_column_id character varying(20),
    fk_mm_model_id character varying(20),
    fk_mm_child_column_id character varying(20),
    fk_mm_parent_column_id character varying(20),
    ur character varying(255),
    dr character varying(255),
    fk_index_name character varying(255),
    deleted boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_col_relations_v2 OWNER TO postgres;

--
-- Name: nc_col_rollup_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_col_rollup_v2 (
    id character varying(20) NOT NULL,
    fk_column_id character varying(20),
    fk_relation_column_id character varying(20),
    fk_rollup_column_id character varying(20),
    rollup_function character varying(255),
    deleted boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_col_rollup_v2 OWNER TO postgres;

--
-- Name: nc_col_select_options_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_col_select_options_v2 (
    id character varying(20) NOT NULL,
    fk_column_id character varying(20),
    title character varying(255),
    color character varying(255),
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_col_select_options_v2 OWNER TO postgres;

--
-- Name: nc_columns_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_columns_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_model_id character varying(20),
    title character varying(255),
    column_name character varying(255),
    uidt character varying(255),
    dt character varying(255),
    np character varying(255),
    ns character varying(255),
    clen character varying(255),
    cop character varying(255),
    pk boolean,
    pv boolean,
    rqd boolean,
    un boolean,
    ct text,
    ai boolean,
    "unique" boolean,
    cdf text,
    cc text,
    csn character varying(255),
    dtx character varying(255),
    dtxp text,
    dtxs character varying(255),
    au boolean,
    validate text,
    virtual boolean,
    deleted boolean,
    system boolean DEFAULT false,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meta text
);


ALTER TABLE public.nc_columns_v2 OWNER TO postgres;

--
-- Name: nc_cron; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_cron (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    description character varying(255),
    env character varying(255),
    pattern character varying(255),
    webhook character varying(255),
    timezone character varying(255) DEFAULT 'America/Los_Angeles'::character varying,
    active boolean DEFAULT true,
    cron_handler text,
    payload text,
    headers text,
    retries integer DEFAULT 0,
    retry_interval integer DEFAULT 60000,
    timeout integer DEFAULT 60000,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_cron OWNER TO postgres;

--
-- Name: nc_cron_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_cron_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_cron_id_seq OWNER TO postgres;

--
-- Name: nc_cron_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_cron_id_seq OWNED BY public.nc_cron.id;


--
-- Name: nc_disabled_models_for_role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_disabled_models_for_role (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(45),
    title character varying(45),
    type character varying(45),
    role character varying(45),
    disabled boolean DEFAULT true,
    tn character varying(255),
    rtn character varying(255),
    cn character varying(255),
    rcn character varying(255),
    relation_type character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent_model_title character varying(255)
);


ALTER TABLE public.nc_disabled_models_for_role OWNER TO postgres;

--
-- Name: nc_disabled_models_for_role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_disabled_models_for_role_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_disabled_models_for_role_id_seq OWNER TO postgres;

--
-- Name: nc_disabled_models_for_role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_disabled_models_for_role_id_seq OWNED BY public.nc_disabled_models_for_role.id;


--
-- Name: nc_disabled_models_for_role_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_disabled_models_for_role_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20),
    role character varying(45),
    disabled boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_disabled_models_for_role_v2 OWNER TO postgres;

--
-- Name: nc_evolutions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_evolutions (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    "titleDown" character varying(255),
    description character varying(255),
    batch integer,
    checksum character varying(255),
    status integer,
    created timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_evolutions OWNER TO postgres;

--
-- Name: nc_evolutions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_evolutions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_evolutions_id_seq OWNER TO postgres;

--
-- Name: nc_evolutions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_evolutions_id_seq OWNED BY public.nc_evolutions.id;


--
-- Name: nc_filter_exp_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_filter_exp_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20),
    fk_hook_id character varying(20),
    fk_column_id character varying(20),
    fk_parent_id character varying(20),
    logical_op character varying(255),
    comparison_op character varying(255),
    value character varying(255),
    is_group boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_filter_exp_v2 OWNER TO postgres;

--
-- Name: nc_form_view_columns_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_form_view_columns_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20),
    fk_column_id character varying(20),
    uuid character varying(255),
    label character varying(255),
    help character varying(255),
    description text,
    required boolean,
    show boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_form_view_columns_v2 OWNER TO postgres;

--
-- Name: nc_form_view_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_form_view_v2 (
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20) NOT NULL,
    heading character varying(255),
    subheading character varying(255),
    success_msg text,
    redirect_url text,
    redirect_after_secs character varying(255),
    email character varying(255),
    submit_another_form boolean,
    show_blank_form boolean,
    uuid character varying(255),
    banner_image_url text,
    logo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_form_view_v2 OWNER TO postgres;

--
-- Name: nc_gallery_view_columns_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_gallery_view_columns_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20),
    fk_column_id character varying(20),
    uuid character varying(255),
    label character varying(255),
    help character varying(255),
    show boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_gallery_view_columns_v2 OWNER TO postgres;

--
-- Name: nc_gallery_view_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_gallery_view_v2 (
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20) NOT NULL,
    next_enabled boolean,
    prev_enabled boolean,
    cover_image_idx integer,
    fk_cover_image_col_id character varying(20),
    cover_image character varying(255),
    restrict_types character varying(255),
    restrict_size character varying(255),
    restrict_number character varying(255),
    public boolean,
    dimensions character varying(255),
    responsive_columns character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_gallery_view_v2 OWNER TO postgres;

--
-- Name: nc_grid_view_columns_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_grid_view_columns_v2 (
    id character varying(20) NOT NULL,
    fk_view_id character varying(20),
    fk_column_id character varying(20),
    base_id character varying(20),
    project_id character varying(128),
    uuid character varying(255),
    label character varying(255),
    help character varying(255),
    width character varying(255) DEFAULT '200px'::character varying,
    show boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_grid_view_columns_v2 OWNER TO postgres;

--
-- Name: nc_grid_view_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_grid_view_v2 (
    fk_view_id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    uuid character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_grid_view_v2 OWNER TO postgres;

--
-- Name: nc_hblt___Actor; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."nc_hblt___Actor" (
    "Name" text,
    "Notes" text,
    "Attachments" text,
    "Status" text,
    "ncRecordId" character varying NOT NULL,
    "ncRecordHash" character varying
);


ALTER TABLE public."nc_hblt___Actor" OWNER TO postgres;

--
-- Name: nc_hblt___Film; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."nc_hblt___Film" (
    "Name" text,
    "Notes" text,
    "Attachments" text,
    "Status" text,
    "Done" boolean,
    "Tags" text,
    "Date" date,
    "Phone" character varying,
    "Email" text,
    "URL" text,
    "Number" numeric,
    "Value" numeric,
    "Percent" double precision,
    "Duration" bigint,
    "Rating" smallint,
    "ncRecordId" character varying NOT NULL,
    "ncRecordHash" character varying
);


ALTER TABLE public."nc_hblt___Film" OWNER TO postgres;

--
-- Name: nc_hblt___Producer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."nc_hblt___Producer" (
    "Name" text,
    "Notes" text,
    "Attachments" text,
    "Status" text,
    "ncRecordId" character varying NOT NULL,
    "ncRecordHash" character varying,
    "nc_hblt___Film_id" character varying
);


ALTER TABLE public."nc_hblt___Producer" OWNER TO postgres;

--
-- Name: nc_hblt___nc_m2m__9oevq0x2z; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_hblt___nc_m2m__9oevq0x2z (
    table2_id character varying NOT NULL,
    table1_id character varying NOT NULL
);


ALTER TABLE public.nc_hblt___nc_m2m__9oevq0x2z OWNER TO postgres;

--
-- Name: nc_hook_logs_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_hook_logs_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_hook_id character varying(20),
    type character varying(255),
    event character varying(255),
    operation character varying(255),
    test_call boolean DEFAULT true,
    payload text,
    conditions text,
    notification text,
    error_code character varying(255),
    error_message character varying(255),
    error text,
    execution_time integer,
    response character varying(255),
    triggered_by character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_hook_logs_v2 OWNER TO postgres;

--
-- Name: nc_hooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_hooks (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    description character varying(255),
    env character varying(255) DEFAULT 'all'::character varying,
    tn character varying(255),
    type character varying(255),
    event character varying(255),
    operation character varying(255),
    async boolean DEFAULT false,
    payload boolean DEFAULT true,
    url text,
    headers text,
    condition text,
    notification text,
    retries integer DEFAULT 0,
    retry_interval integer DEFAULT 60000,
    timeout integer DEFAULT 60000,
    active boolean DEFAULT true,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_hooks OWNER TO postgres;

--
-- Name: nc_hooks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_hooks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_hooks_id_seq OWNER TO postgres;

--
-- Name: nc_hooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_hooks_id_seq OWNED BY public.nc_hooks.id;


--
-- Name: nc_hooks_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_hooks_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_model_id character varying(20),
    title character varying(255),
    description character varying(255),
    env character varying(255) DEFAULT 'all'::character varying,
    type character varying(255),
    event character varying(255),
    operation character varying(255),
    async boolean DEFAULT false,
    payload boolean DEFAULT true,
    url text,
    headers text,
    condition boolean DEFAULT false,
    notification text,
    retries integer DEFAULT 0,
    retry_interval integer DEFAULT 60000,
    timeout integer DEFAULT 60000,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_hooks_v2 OWNER TO postgres;

--
-- Name: nc_kanban_view_columns_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_kanban_view_columns_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20),
    fk_column_id character varying(20),
    uuid character varying(255),
    label character varying(255),
    help character varying(255),
    show boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_kanban_view_columns_v2 OWNER TO postgres;

--
-- Name: nc_kanban_view_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_kanban_view_v2 (
    fk_view_id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    show boolean,
    "order" real,
    uuid character varying(255),
    title character varying(255),
    public boolean,
    password character varying(255),
    show_all_fields boolean,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_kanban_view_v2 OWNER TO postgres;

--
-- Name: nc_loaders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_loaders (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    parent character varying(255),
    child character varying(255),
    relation character varying(255),
    resolver character varying(255),
    functions text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_loaders OWNER TO postgres;

--
-- Name: nc_loaders_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_loaders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_loaders_id_seq OWNER TO postgres;

--
-- Name: nc_loaders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_loaders_id_seq OWNED BY public.nc_loaders.id;


--
-- Name: nc_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_migrations (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255),
    up text,
    down text,
    title character varying(255) NOT NULL,
    title_down character varying(255),
    description character varying(255),
    batch integer,
    checksum character varying(255),
    status integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_migrations OWNER TO postgres;

--
-- Name: nc_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_migrations_id_seq OWNER TO postgres;

--
-- Name: nc_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_migrations_id_seq OWNED BY public.nc_migrations.id;


--
-- Name: nc_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_models (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    alias character varying(255),
    type character varying(255) DEFAULT 'table'::character varying,
    meta text,
    schema text,
    schema_previous text,
    services text,
    messages text,
    enabled boolean DEFAULT true,
    parent_model_title character varying(255),
    show_as character varying(255) DEFAULT 'table'::character varying,
    query_params text,
    list_idx integer,
    tags character varying(255),
    pinned boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    mm integer,
    m_to_m_meta text,
    "order" real,
    view_order real
);


ALTER TABLE public.nc_models OWNER TO postgres;

--
-- Name: nc_models_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_models_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_models_id_seq OWNER TO postgres;

--
-- Name: nc_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_models_id_seq OWNED BY public.nc_models.id;


--
-- Name: nc_models_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_models_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    table_name character varying(255),
    title character varying(255),
    type character varying(255) DEFAULT 'table'::character varying,
    meta text,
    schema text,
    enabled boolean DEFAULT true,
    mm boolean DEFAULT false,
    tags character varying(255),
    pinned boolean,
    deleted boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_models_v2 OWNER TO postgres;

--
-- Name: nc_orgs_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_orgs_v2 (
    id character varying(20) NOT NULL,
    title character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_orgs_v2 OWNER TO postgres;

--
-- Name: nc_plugins; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_plugins (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255),
    title character varying(45),
    description text,
    active boolean DEFAULT false,
    rating real,
    version character varying(255),
    docs character varying(255),
    status character varying(255) DEFAULT 'install'::character varying,
    status_details character varying(255),
    logo character varying(255),
    icon character varying(255),
    tags character varying(255),
    category character varying(255),
    input_schema text,
    input text,
    creator character varying(255),
    creator_website character varying(255),
    price character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_plugins OWNER TO postgres;

--
-- Name: nc_plugins_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_plugins_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_plugins_id_seq OWNER TO postgres;

--
-- Name: nc_plugins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_plugins_id_seq OWNED BY public.nc_plugins.id;


--
-- Name: nc_plugins_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_plugins_v2 (
    id character varying(20) NOT NULL,
    title character varying(45),
    description text,
    active boolean DEFAULT false,
    rating real,
    version character varying(255),
    docs character varying(255),
    status character varying(255) DEFAULT 'install'::character varying,
    status_details character varying(255),
    logo character varying(255),
    icon character varying(255),
    tags character varying(255),
    category character varying(255),
    input_schema text,
    input text,
    creator character varying(255),
    creator_website character varying(255),
    price character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_plugins_v2 OWNER TO postgres;

--
-- Name: nc_project_users_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_project_users_v2 (
    project_id character varying(128),
    fk_user_id character varying(20),
    roles text,
    starred boolean,
    pinned boolean,
    "group" character varying(255),
    color character varying(255),
    "order" real,
    hidden real,
    opened_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_project_users_v2 OWNER TO postgres;

--
-- Name: nc_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_projects (
    id character varying(128) NOT NULL,
    title character varying(255),
    status character varying(255),
    description text,
    config text,
    meta text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_projects OWNER TO postgres;

--
-- Name: nc_projects_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_projects_users (
    project_id character varying(255),
    user_id integer,
    roles text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_projects_users OWNER TO postgres;

--
-- Name: nc_projects_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_projects_v2 (
    id character varying(128) NOT NULL,
    title character varying(255),
    prefix character varying(255),
    status character varying(255),
    description text,
    meta text,
    color character varying(255),
    uuid character varying(255),
    password character varying(255),
    roles character varying(255),
    deleted boolean DEFAULT false,
    is_meta boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_projects_v2 OWNER TO postgres;

--
-- Name: nc_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_relations (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255),
    tn character varying(255),
    rtn character varying(255),
    _tn character varying(255),
    _rtn character varying(255),
    cn character varying(255),
    rcn character varying(255),
    _cn character varying(255),
    _rcn character varying(255),
    referenced_db_alias character varying(255),
    type character varying(255),
    db_type character varying(255),
    ur character varying(255),
    dr character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    fkn character varying(255)
);


ALTER TABLE public.nc_relations OWNER TO postgres;

--
-- Name: nc_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_relations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_relations_id_seq OWNER TO postgres;

--
-- Name: nc_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_relations_id_seq OWNED BY public.nc_relations.id;


--
-- Name: nc_resolvers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_resolvers (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    resolver text,
    type character varying(255),
    acl text,
    functions text,
    handler_type integer DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_resolvers OWNER TO postgres;

--
-- Name: nc_resolvers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_resolvers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_resolvers_id_seq OWNER TO postgres;

--
-- Name: nc_resolvers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_resolvers_id_seq OWNED BY public.nc_resolvers.id;


--
-- Name: nc_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_roles (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    type character varying(255) DEFAULT 'CUSTOM'::character varying,
    description character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_roles OWNER TO postgres;

--
-- Name: nc_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_roles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_roles_id_seq OWNER TO postgres;

--
-- Name: nc_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_roles_id_seq OWNED BY public.nc_roles.id;


--
-- Name: nc_routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_routes (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    tn character varying(255),
    tnp character varying(255),
    tnc character varying(255),
    relation_type character varying(255),
    path text,
    type character varying(255),
    handler text,
    acl text,
    "order" integer,
    functions text,
    handler_type integer DEFAULT 1,
    is_custom boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_routes OWNER TO postgres;

--
-- Name: nc_routes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_routes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_routes_id_seq OWNER TO postgres;

--
-- Name: nc_routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_routes_id_seq OWNED BY public.nc_routes.id;


--
-- Name: nc_rpc; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_rpc (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    title character varying(255),
    tn character varying(255),
    service text,
    tnp character varying(255),
    tnc character varying(255),
    relation_type character varying(255),
    "order" integer,
    type character varying(255),
    acl text,
    functions text,
    handler_type integer DEFAULT 1,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_rpc OWNER TO postgres;

--
-- Name: nc_rpc_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_rpc_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_rpc_id_seq OWNER TO postgres;

--
-- Name: nc_rpc_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_rpc_id_seq OWNED BY public.nc_rpc.id;


--
-- Name: nc_shared_bases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_shared_bases (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255),
    roles character varying(255) DEFAULT 'viewer'::character varying,
    shared_base_id character varying(255),
    enabled boolean DEFAULT true,
    password character varying(255),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_shared_bases OWNER TO postgres;

--
-- Name: nc_shared_bases_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_shared_bases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_shared_bases_id_seq OWNER TO postgres;

--
-- Name: nc_shared_bases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_shared_bases_id_seq OWNED BY public.nc_shared_bases.id;


--
-- Name: nc_shared_views; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_shared_views (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255),
    model_name character varying(255),
    meta text,
    query_params text,
    view_id character varying(255),
    show_all_fields boolean,
    allow_copy boolean,
    password character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    view_type character varying(255),
    view_name character varying(255)
);


ALTER TABLE public.nc_shared_views OWNER TO postgres;

--
-- Name: nc_shared_views_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_shared_views_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_shared_views_id_seq OWNER TO postgres;

--
-- Name: nc_shared_views_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_shared_views_id_seq OWNED BY public.nc_shared_views.id;


--
-- Name: nc_shared_views_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_shared_views_v2 (
    id character varying(20) NOT NULL,
    fk_view_id character varying(20),
    meta text,
    query_params text,
    view_id character varying(255),
    show_all_fields boolean,
    allow_copy boolean,
    password character varying(255),
    deleted boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_shared_views_v2 OWNER TO postgres;

--
-- Name: nc_sort_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_sort_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_view_id character varying(20),
    fk_column_id character varying(20),
    direction character varying(255) DEFAULT 'false'::character varying,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_sort_v2 OWNER TO postgres;

--
-- Name: nc_store; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_store (
    id integer NOT NULL,
    project_id character varying(255),
    db_alias character varying(255) DEFAULT 'db'::character varying,
    key character varying(255),
    value text,
    type character varying(255),
    env character varying(255),
    tag character varying(255),
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.nc_store OWNER TO postgres;

--
-- Name: nc_store_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nc_store_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.nc_store_id_seq OWNER TO postgres;

--
-- Name: nc_store_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nc_store_id_seq OWNED BY public.nc_store.id;


--
-- Name: nc_sync_logs_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_sync_logs_v2 (
    id character varying(20) NOT NULL,
    project_id character varying(128),
    fk_sync_source_id character varying(20),
    time_taken integer,
    status character varying(255),
    status_details text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_sync_logs_v2 OWNER TO postgres;

--
-- Name: nc_sync_source_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_sync_source_v2 (
    id character varying(20) NOT NULL,
    title character varying(255),
    type character varying(255),
    details text,
    deleted boolean,
    enabled boolean DEFAULT true,
    "order" real,
    project_id character varying(128),
    fk_user_id character varying(128),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_sync_source_v2 OWNER TO postgres;

--
-- Name: nc_team_users_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_team_users_v2 (
    org_id character varying(20),
    user_id character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_team_users_v2 OWNER TO postgres;

--
-- Name: nc_teams_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_teams_v2 (
    id character varying(20) NOT NULL,
    title character varying(255),
    org_id character varying(20),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_teams_v2 OWNER TO postgres;

--
-- Name: nc_users_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_users_v2 (
    id character varying(20) NOT NULL,
    email character varying(255),
    password character varying(255),
    salt character varying(255),
    firstname character varying(255),
    lastname character varying(255),
    username character varying(255),
    refresh_token character varying(255),
    invite_token character varying(255),
    invite_token_expires character varying(255),
    reset_password_expires timestamp with time zone,
    reset_password_token character varying(255),
    email_verification_token character varying(255),
    email_verified boolean,
    roles character varying(255) DEFAULT 'editor'::character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_users_v2 OWNER TO postgres;

--
-- Name: nc_views_v2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nc_views_v2 (
    id character varying(20) NOT NULL,
    base_id character varying(20),
    project_id character varying(128),
    fk_model_id character varying(20),
    title character varying(255),
    type integer,
    is_default boolean,
    show_system_fields boolean,
    lock_type character varying(255) DEFAULT 'collaborative'::character varying,
    uuid character varying(255),
    password character varying(255),
    show boolean,
    "order" real,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.nc_views_v2 OWNER TO postgres;

--
-- Name: xc_knex_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xc_knex_migrations (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


ALTER TABLE public.xc_knex_migrations OWNER TO postgres;

--
-- Name: xc_knex_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.xc_knex_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.xc_knex_migrations_id_seq OWNER TO postgres;

--
-- Name: xc_knex_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.xc_knex_migrations_id_seq OWNED BY public.xc_knex_migrations.id;


--
-- Name: xc_knex_migrations_lock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xc_knex_migrations_lock (
    index integer NOT NULL,
    is_locked integer
);


ALTER TABLE public.xc_knex_migrations_lock OWNER TO postgres;

--
-- Name: xc_knex_migrations_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.xc_knex_migrations_lock_index_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.xc_knex_migrations_lock_index_seq OWNER TO postgres;

--
-- Name: xc_knex_migrations_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.xc_knex_migrations_lock_index_seq OWNED BY public.xc_knex_migrations_lock.index;


--
-- Name: xc_knex_migrationsv2; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xc_knex_migrationsv2 (
    id integer NOT NULL,
    name character varying(255),
    batch integer,
    migration_time timestamp with time zone
);


ALTER TABLE public.xc_knex_migrationsv2 OWNER TO postgres;

--
-- Name: xc_knex_migrationsv2_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.xc_knex_migrationsv2_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.xc_knex_migrationsv2_id_seq OWNER TO postgres;

--
-- Name: xc_knex_migrationsv2_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.xc_knex_migrationsv2_id_seq OWNED BY public.xc_knex_migrationsv2.id;


--
-- Name: xc_knex_migrationsv2_lock; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.xc_knex_migrationsv2_lock (
    index integer NOT NULL,
    is_locked integer
);


ALTER TABLE public.xc_knex_migrationsv2_lock OWNER TO postgres;

--
-- Name: xc_knex_migrationsv2_lock_index_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.xc_knex_migrationsv2_lock_index_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.xc_knex_migrationsv2_lock_index_seq OWNER TO postgres;

--
-- Name: xc_knex_migrationsv2_lock_index_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.xc_knex_migrationsv2_lock_index_seq OWNED BY public.xc_knex_migrationsv2_lock.index;


--
-- Name: nc_acl id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_acl ALTER COLUMN id SET DEFAULT nextval('public.nc_acl_id_seq'::regclass);


--
-- Name: nc_api_tokens id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_api_tokens ALTER COLUMN id SET DEFAULT nextval('public.nc_api_tokens_id_seq'::regclass);


--
-- Name: nc_audit id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_audit ALTER COLUMN id SET DEFAULT nextval('public.nc_audit_id_seq'::regclass);


--
-- Name: nc_cron id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_cron ALTER COLUMN id SET DEFAULT nextval('public.nc_cron_id_seq'::regclass);


--
-- Name: nc_disabled_models_for_role id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_disabled_models_for_role ALTER COLUMN id SET DEFAULT nextval('public.nc_disabled_models_for_role_id_seq'::regclass);


--
-- Name: nc_evolutions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_evolutions ALTER COLUMN id SET DEFAULT nextval('public.nc_evolutions_id_seq'::regclass);


--
-- Name: nc_hooks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hooks ALTER COLUMN id SET DEFAULT nextval('public.nc_hooks_id_seq'::regclass);


--
-- Name: nc_loaders id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_loaders ALTER COLUMN id SET DEFAULT nextval('public.nc_loaders_id_seq'::regclass);


--
-- Name: nc_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_migrations ALTER COLUMN id SET DEFAULT nextval('public.nc_migrations_id_seq'::regclass);


--
-- Name: nc_models id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_models ALTER COLUMN id SET DEFAULT nextval('public.nc_models_id_seq'::regclass);


--
-- Name: nc_plugins id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_plugins ALTER COLUMN id SET DEFAULT nextval('public.nc_plugins_id_seq'::regclass);


--
-- Name: nc_relations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_relations ALTER COLUMN id SET DEFAULT nextval('public.nc_relations_id_seq'::regclass);


--
-- Name: nc_resolvers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_resolvers ALTER COLUMN id SET DEFAULT nextval('public.nc_resolvers_id_seq'::regclass);


--
-- Name: nc_roles id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_roles ALTER COLUMN id SET DEFAULT nextval('public.nc_roles_id_seq'::regclass);


--
-- Name: nc_routes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_routes ALTER COLUMN id SET DEFAULT nextval('public.nc_routes_id_seq'::regclass);


--
-- Name: nc_rpc id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_rpc ALTER COLUMN id SET DEFAULT nextval('public.nc_rpc_id_seq'::regclass);


--
-- Name: nc_shared_bases id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_shared_bases ALTER COLUMN id SET DEFAULT nextval('public.nc_shared_bases_id_seq'::regclass);


--
-- Name: nc_shared_views id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_shared_views ALTER COLUMN id SET DEFAULT nextval('public.nc_shared_views_id_seq'::regclass);


--
-- Name: nc_store id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_store ALTER COLUMN id SET DEFAULT nextval('public.nc_store_id_seq'::regclass);


--
-- Name: xc_knex_migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrations ALTER COLUMN id SET DEFAULT nextval('public.xc_knex_migrations_id_seq'::regclass);


--
-- Name: xc_knex_migrations_lock index; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrations_lock ALTER COLUMN index SET DEFAULT nextval('public.xc_knex_migrations_lock_index_seq'::regclass);


--
-- Name: xc_knex_migrationsv2 id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrationsv2 ALTER COLUMN id SET DEFAULT nextval('public.xc_knex_migrationsv2_id_seq'::regclass);


--
-- Name: xc_knex_migrationsv2_lock index; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrationsv2_lock ALTER COLUMN index SET DEFAULT nextval('public.xc_knex_migrationsv2_lock_index_seq'::regclass);


--
-- Data for Name: nc_acl; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_acl (id, project_id, db_alias, tn, acl, type, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_acl_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_acl_id_seq', 1, false);


--
-- Data for Name: nc_api_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_api_tokens (id, project_id, db_alias, description, permissions, token, expiry, enabled, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_api_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_api_tokens_id_seq', 1, false);


--
-- Data for Name: nc_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_audit (id, "user", ip, project_id, db_alias, model_name, model_id, op_type, op_sub_type, status, description, details, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_audit_id_seq', 1, false);


--
-- Data for Name: nc_audit_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_audit_v2 (id, "user", ip, base_id, project_id, fk_model_id, row_id, op_type, op_sub_type, status, description, details, created_at, updated_at) FROM stdin;
adt_v5waji0khmfgba	user@nocodb.com	::1	\N	\N	\N	\N	AUTHENTICATION	SIGNUP	\N	signed up 	\N	2022-06-13 07:00:15.9225+00	2022-06-13 07:00:15.9225+00
adt_sfg8mbyzkp24k5	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	TABLE	CREATED	\N	created table nc_hblt___Film with alias Film  	\N	2022-06-13 07:00:46.465699+00	2022-06-13 07:00:46.465699+00
adt_w3jc9jajn2w0e1	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	TABLE	CREATED	\N	created table nc_hblt___Actor with alias Actor  	\N	2022-06-13 07:00:46.75746+00	2022-06-13 07:00:46.75746+00
adt_4sd982cktz71y1	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	TABLE	CREATED	\N	created table nc_hblt___Producer with alias Producer  	\N	2022-06-13 07:00:46.878618+00	2022-06-13 07:00:46.878618+00
adt_5y0l9swcmnf71j	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	TABLE_COLUMN	CREATED	\N	created column Actor with alias Actor from table nc_hblt___Film	\N	2022-06-13 07:00:47.101199+00	2022-06-13 07:00:47.101199+00
adt_deset50120k2mb	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	TABLE_COLUMN	UPDATED	\N	updated column null with alias ActorMMList from table nc_hblt___Actor	\N	2022-06-13 07:00:47.118773+00	2022-06-13 07:00:47.118773+00
adt_nmhmxmf2tz09ta	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	TABLE_COLUMN	CREATED	\N	created column Status_from_Actor_ with alias Status (from Actor) from table nc_hblt___Film	\N	2022-06-13 07:00:47.138869+00	2022-06-13 07:00:47.138869+00
adt_gyu32oew8ys4gt	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	AUTHENTICATION	INVITE	\N	invited raju.us@gmail.com to p_99s02mvqpc2j14 project 	\N	2022-06-13 07:00:47.185359+00	2022-06-13 07:00:47.185359+00
adt_nnlk3y4njb5i5r	user@nocodb.com	::ffff:127.0.0.1	\N	p_99s02mvqpc2j14	\N	\N	AUTHENTICATION	INVITE	\N	invited sivadstala@gmail.com to p_99s02mvqpc2j14 project 	\N	2022-06-13 07:00:47.185628+00	2022-06-13 07:00:47.185628+00
adt_2paadwym0m71wt	user@nocodb.com	::1	\N	p_99s02mvqpc2j14	\N	\N	TABLE_COLUMN	CREATED	\N	created column undefined with alias Producer from table nc_hblt___Film	\N	2022-06-13 07:03:47.605045+00	2022-06-13 07:03:47.605045+00
adt_u1f6tm5zee2io2	user@nocodb.com	::ffff:127.0.0.1	\N	\N	\N	\N	AUTHENTICATION	SIGNIN	\N	signed in	\N	2022-06-13 07:07:13.707056+00	2022-06-13 07:07:13.707056+00
adt_pkglidap0qs03a	user@nocodb.com	::1	\N	p_99s02mvqpc2j14	\N	\N	TABLE_COLUMN	CREATED	\N	created column undefined with alias RollUp from table nc_hblt___Film	\N	2022-06-13 07:12:16.764517+00	2022-06-13 07:12:16.764517+00
adt_9rvo9igddeph9z	user@nocodb.com	::1	\N	\N	\N	\N	AUTHENTICATION	SIGNIN	\N	signed in	\N	2022-06-13 07:17:35.308386+00	2022-06-13 07:17:35.308386+00
adt_ac9rhai3qyu5lv	user@nocodb.com	::1	\N	p_99s02mvqpc2j14	\N	\N	TABLE_COLUMN	CREATED	\N	created column undefined with alias Computation from table nc_hblt___Film	\N	2022-06-13 07:18:06.454646+00	2022-06-13 07:18:06.454646+00
adt_104tk1g0hskxt4	user@nocodb.com	::ffff:127.0.0.1	\N	\N	\N	\N	AUTHENTICATION	SIGNIN	\N	signed in	\N	2022-06-13 07:19:45.966163+00	2022-06-13 07:19:45.966163+00
\.


--
-- Data for Name: nc_bases_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_bases_v2 (id, project_id, alias, config, meta, is_meta, type, inflection_column, inflection_table, created_at, updated_at) FROM stdin;
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	U2FsdGVkX1/+hnc/aEFWo55Jj1S6TZ9OFUF+g/2FONQ=	\N	t	pg	camelize	camelize	2022-06-13 07:00:19.416618+00	2022-06-13 07:00:19.416618+00
\.


--
-- Data for Name: nc_col_formula_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_col_formula_v2 (id, fk_column_id, formula, formula_raw, error, deleted, "order", created_at, updated_at) FROM stdin;
fm_q5ayma8om5h9ey	cl_cvxw412ltg7f82	((ADD({{cl_qgvbuwq5wlbkha}}, {{cl_bysnatbas68gpj}}) * 100) / 25)	((ADD({Number}, {Percent}) * 100) / 25)	\N	\N	\N	2022-06-13 07:18:06.417753+00	2022-06-13 07:18:06.417753+00
\.


--
-- Data for Name: nc_col_lookup_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_col_lookup_v2 (id, fk_column_id, fk_relation_column_id, fk_lookup_column_id, deleted, created_at, updated_at) FROM stdin;
lk_66wkopfigs6pl3	cl_pwko7vmwjem98l	cl_rwe408zcovemvg	cl_wryamwhwnbigwz	\N	2022-06-13 07:00:47.129247+00	2022-06-13 07:00:47.129247+00
\.


--
-- Data for Name: nc_col_relations_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_col_relations_v2 (id, ref_db_alias, type, virtual, db_type, fk_column_id, fk_related_model_id, fk_child_column_id, fk_parent_column_id, fk_mm_model_id, fk_mm_child_column_id, fk_mm_parent_column_id, ur, dr, fk_index_name, deleted, created_at, updated_at) FROM stdin;
ln_gi7jvurojf01oc	\N	bt	f	\N	cl_5n7rh5cu5i9a94	md_lh3bakzk8scz7r	cl_z8snfz1ltrtflk	cl_0fhoikbhmibfic	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:47.031022+00	2022-06-13 07:00:47.031022+00
ln_cvtqcvena4oue7	\N	hm	f	\N	cl_vyl6nn9uu4rniw	md_affo9e0j69frre	cl_z8snfz1ltrtflk	cl_0fhoikbhmibfic	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:47.042462+00	2022-06-13 07:00:47.042462+00
ln_gyg6gipe1wfmv2	\N	bt	f	\N	cl_6zk113zuqps6am	md_w4bsfg7gtmqque	cl_47if01uivdzzr1	cl_6lcfkyhon35cvg	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:47.05616+00	2022-06-13 07:00:47.05616+00
ln_qx9xncbtyuhmkp	\N	hm	f	\N	cl_9rp6davhp63srs	md_affo9e0j69frre	cl_47if01uivdzzr1	cl_6lcfkyhon35cvg	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:47.06587+00	2022-06-13 07:00:47.06587+00
ln_hkfniks8q62nyr	\N	mm	\N	\N	cl_dqsqpoma8kd32h	md_w4bsfg7gtmqque	cl_0fhoikbhmibfic	cl_6lcfkyhon35cvg	md_affo9e0j69frre	cl_z8snfz1ltrtflk	cl_47if01uivdzzr1	\N	\N	\N	\N	2022-06-13 07:00:47.077011+00	2022-06-13 07:00:47.077011+00
ln_hrsdgt2lkyqhzw	\N	mm	\N	\N	cl_rwe408zcovemvg	md_lh3bakzk8scz7r	cl_6lcfkyhon35cvg	cl_0fhoikbhmibfic	md_affo9e0j69frre	cl_47if01uivdzzr1	cl_z8snfz1ltrtflk	\N	\N	\N	\N	2022-06-13 07:00:47.088114+00	2022-06-13 07:00:47.088114+00
ln_81momy9qn7rcz0	\N	bt	f	\N	cl_0xvph5t8e5b667	md_w4bsfg7gtmqque	cl_6ipbhm6pdd136g	cl_6lcfkyhon35cvg	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:03:47.466028+00	2022-06-13 07:03:47.466028+00
ln_734ihvz5jkzpig	\N	hm	f	\N	cl_bmar4762fidxnd	md_ud292ppq36mp14	cl_6ipbhm6pdd136g	cl_6lcfkyhon35cvg	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:03:47.577368+00	2022-06-13 07:03:47.577368+00
\.


--
-- Data for Name: nc_col_rollup_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_col_rollup_v2 (id, fk_column_id, fk_relation_column_id, fk_rollup_column_id, rollup_function, deleted, created_at, updated_at) FROM stdin;
rl_kdfr6q45sl92wh	cl_tm7ltwcixu34qm	cl_rwe408zcovemvg	cl_6h7ixf3wm93jl1	count	\N	2022-06-13 07:12:16.736907+00	2022-06-13 07:12:16.736907+00
\.


--
-- Data for Name: nc_col_select_options_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_col_select_options_v2 (id, fk_column_id, title, color, "order", created_at, updated_at) FROM stdin;
sl_ffxoxb89s2rzx8	cl_vjlucu8q3zjj79	'Todo'	\N	\N	2022-06-13 07:00:46.518181+00	2022-06-13 07:00:46.518181+00
sl_q5rpl9dpig9eim	cl_vjlucu8q3zjj79	'In progress'	\N	\N	2022-06-13 07:00:46.520627+00	2022-06-13 07:00:46.520627+00
sl_1k4wjfoocx7knp	cl_vjlucu8q3zjj79	'Done'	\N	\N	2022-06-13 07:00:46.523057+00	2022-06-13 07:00:46.523057+00
sl_t3pawrta4itxy6	cl_2qmjsmw5ilkjb1	'Jan'	\N	\N	2022-06-13 07:00:46.542304+00	2022-06-13 07:00:46.542304+00
sl_uxtvjlk02bkocs	cl_2qmjsmw5ilkjb1	'Feb'	\N	\N	2022-06-13 07:00:46.545152+00	2022-06-13 07:00:46.545152+00
sl_6x6kr7uk21wefj	cl_2qmjsmw5ilkjb1	'Mar'	\N	\N	2022-06-13 07:00:46.547407+00	2022-06-13 07:00:46.547407+00
sl_c0meuqo34mklof	cl_2qmjsmw5ilkjb1	'Apr'	\N	\N	2022-06-13 07:00:46.550584+00	2022-06-13 07:00:46.550584+00
sl_8s310kjh2haafi	cl_2qmjsmw5ilkjb1	'May'	\N	\N	2022-06-13 07:00:46.555255+00	2022-06-13 07:00:46.555255+00
sl_n5s3thxynn01m0	cl_2qmjsmw5ilkjb1	'Jun'	\N	\N	2022-06-13 07:00:46.55856+00	2022-06-13 07:00:46.55856+00
sl_xcrv4uxat4ks13	cl_2qmjsmw5ilkjb1	'Jul'	\N	\N	2022-06-13 07:00:46.561484+00	2022-06-13 07:00:46.561484+00
sl_xdyr2y0lgwhbc3	cl_2qmjsmw5ilkjb1	'Aug'	\N	\N	2022-06-13 07:00:46.564004+00	2022-06-13 07:00:46.564004+00
sl_3ifag4o5utixc1	cl_2qmjsmw5ilkjb1	'Sep'	\N	\N	2022-06-13 07:00:46.566475+00	2022-06-13 07:00:46.566475+00
sl_raaxgtwx37tkx5	cl_2qmjsmw5ilkjb1	'Oct'	\N	\N	2022-06-13 07:00:46.569129+00	2022-06-13 07:00:46.569129+00
sl_oynfjuccyxxzfg	cl_2qmjsmw5ilkjb1	'Nov'	\N	\N	2022-06-13 07:00:46.574885+00	2022-06-13 07:00:46.574885+00
sl_0q2zhedvohxwku	cl_2qmjsmw5ilkjb1	'Dec'	\N	\N	2022-06-13 07:00:46.577529+00	2022-06-13 07:00:46.577529+00
sl_wcddtslvkrcu0n	cl_wryamwhwnbigwz	'Todo'	\N	\N	2022-06-13 07:00:46.804292+00	2022-06-13 07:00:46.804292+00
sl_9n2u1pdfpjwydl	cl_wryamwhwnbigwz	'In progress'	\N	\N	2022-06-13 07:00:46.807194+00	2022-06-13 07:00:46.807194+00
sl_c8roqi0mfwtrly	cl_wryamwhwnbigwz	'Done'	\N	\N	2022-06-13 07:00:46.812018+00	2022-06-13 07:00:46.812018+00
sl_yc769l76r6331c	cl_9nxx6uy4779nio	'Todo'	\N	\N	2022-06-13 07:00:46.926807+00	2022-06-13 07:00:46.926807+00
sl_71lywcglalllza	cl_9nxx6uy4779nio	'In progress'	\N	\N	2022-06-13 07:00:46.92914+00	2022-06-13 07:00:46.92914+00
sl_e5zng07rdpnuhc	cl_9nxx6uy4779nio	'Done'	\N	\N	2022-06-13 07:00:46.93313+00	2022-06-13 07:00:46.93313+00
\.


--
-- Data for Name: nc_columns_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_columns_v2 (id, base_id, project_id, fk_model_id, title, column_name, uidt, dt, np, ns, clen, cop, pk, pv, rqd, un, ct, ai, "unique", cdf, cc, csn, dtx, dtxp, dtxs, au, validate, virtual, deleted, system, "order", created_at, updated_at, meta) FROM stdin;
cl_4af04om9pttcix	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Notes	Notes	LongText	text	\N	\N	\N	2	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	2	2022-06-13 07:00:46.499583+00	2022-06-13 07:00:46.499583+00	\N
cl_wsoajtyx4w8f2h	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Attachments	Attachments	Attachment	text	\N	\N	\N	3	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	3	2022-06-13 07:00:46.506918+00	2022-06-13 07:00:46.506918+00	\N
cl_vjlucu8q3zjj79	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Status	Status	SingleSelect	text	\N	\N	\N	4	f	\N	f	f	\N	f	\N	\N	\N	\N	text	'Todo','In progress','Done'	\N	f	\N	\N	\N	f	4	2022-06-13 07:00:46.514644+00	2022-06-13 07:00:46.514644+00	\N
cl_lfjck1f7baljji	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Done	Done	Checkbox	boolean	\N	\N	\N	5	f	\N	f	f	\N	f	\N	\N	\N	\N	boolean	\N	\N	f	\N	\N	\N	f	5	2022-06-13 07:00:46.530229+00	2022-06-13 07:00:46.530229+00	\N
cl_2qmjsmw5ilkjb1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Tags	Tags	MultiSelect	text	\N	\N	\N	6	f	\N	f	f	\N	f	\N	\N	\N	\N	text	'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'	\N	f	\N	\N	\N	f	6	2022-06-13 07:00:46.538277+00	2022-06-13 07:00:46.538277+00	\N
cl_xa33l1z0bwzc1q	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Date	Date	Date	date	\N	\N	\N	7	f	\N	f	f	\N	f	\N	\N	\N	\N	date	0	\N	f	\N	\N	\N	f	7	2022-06-13 07:00:46.584997+00	2022-06-13 07:00:46.584997+00	\N
cl_hxgith4h183u4z	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Phone	Phone	PhoneNumber	character varying	\N	\N	\N	8	f	\N	f	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	{"func":["isMobilePhone"],"args":[""],"msg":["Validation failed : isMobilePhone"]}	\N	\N	f	8	2022-06-13 07:00:46.594926+00	2022-06-13 07:00:46.594926+00	\N
cl_ogjv6btikkgvms	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Email	Email	Email	text	\N	\N	\N	9	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	{"func":["isEmail"],"args":[""],"msg":["Validation failed : isEmail"]}	\N	\N	f	9	2022-06-13 07:00:46.604383+00	2022-06-13 07:00:46.604383+00	\N
cl_kzny6gvq67kmm5	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	URL	URL	URL	text	\N	\N	\N	10	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	{"func":["isURL"],"args":[""],"msg":["Validation failed : isURL"]}	\N	\N	f	10	2022-06-13 07:00:46.61452+00	2022-06-13 07:00:46.61452+00	\N
cl_qgvbuwq5wlbkha	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Number	Number	Decimal	numeric	\N	\N	\N	11	f	\N	f	f	\N	f	\N	\N	\N	\N	numeric	\N	\N	f	\N	\N	\N	f	11	2022-06-13 07:00:46.624567+00	2022-06-13 07:00:46.624567+00	\N
cl_fxv6wvzts1cuqr	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Value	Value	Currency	numeric	\N	\N	\N	12	f	\N	f	f	\N	f	\N	\N	\N	\N	numeric	\N	\N	f	{"func":["isCurrency"],"args":[""],"msg":["Validation failed : isCurrency"]}	\N	\N	f	12	2022-06-13 07:00:46.632458+00	2022-06-13 07:00:46.632458+00	\N
cl_bysnatbas68gpj	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Percent	Percent	Percent	double precision	53	\N	\N	13	f	\N	f	f	\N	f	\N	\N	\N	\N	double precision	53	\N	f	\N	\N	\N	f	13	2022-06-13 07:00:46.642566+00	2022-06-13 07:00:46.642566+00	\N
cl_la6r8q0u9bvyv3	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Duration	Duration	Duration	bigint	64	0	\N	14	f	\N	f	f	\N	f	\N	\N	\N	\N	bigint	64	0	f	\N	\N	\N	f	14	2022-06-13 07:00:46.649838+00	2022-06-13 07:00:46.649838+00	\N
cl_7h4paqlpvotx4b	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Rating	Rating	Rating	smallint	16	0	\N	15	f	\N	f	f	\N	f	\N	\N	\N	\N	smallint	16	0	f	\N	\N	\N	f	15	2022-06-13 07:00:46.660274+00	2022-06-13 07:00:46.660274+00	\N
cl_6lcfkyhon35cvg	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	ncRecordId	ncRecordId	ID	character varying	\N	\N	\N	16	t	\N	t	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	\N	\N	\N	f	16	2022-06-13 07:00:46.668049+00	2022-06-13 07:00:46.668049+00	{"ag":"nc"}
cl_n54t3vwjrtcn21	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Notes	Notes	LongText	text	\N	\N	\N	2	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	2	2022-06-13 07:00:46.780418+00	2022-06-13 07:00:46.780418+00	\N
cl_c7daqht9ool1vw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Attachments	Attachments	Attachment	text	\N	\N	\N	3	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	3	2022-06-13 07:00:46.791223+00	2022-06-13 07:00:46.791223+00	\N
cl_wryamwhwnbigwz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Status	Status	SingleSelect	text	\N	\N	\N	4	f	\N	f	f	\N	f	\N	\N	\N	\N	text	'Todo','In progress','Done'	\N	f	\N	\N	\N	f	4	2022-06-13 07:00:46.799559+00	2022-06-13 07:00:46.799559+00	\N
cl_0fhoikbhmibfic	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	ncRecordId	ncRecordId	ID	character varying	\N	\N	\N	5	t	\N	t	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	\N	\N	\N	f	5	2022-06-13 07:00:46.82097+00	2022-06-13 07:00:46.82097+00	{"ag":"nc"}
cl_n4b1fuefgpulaz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Notes	Notes	LongText	text	\N	\N	\N	2	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	2	2022-06-13 07:00:46.904484+00	2022-06-13 07:00:46.904484+00	\N
cl_ww1mtv3m2ni2vk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Attachments	Attachments	Attachment	text	\N	\N	\N	3	f	\N	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	3	2022-06-13 07:00:46.914975+00	2022-06-13 07:00:46.914975+00	\N
cl_9nxx6uy4779nio	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Status	Status	SingleSelect	text	\N	\N	\N	4	f	\N	f	f	\N	f	\N	\N	\N	\N	text	'Todo','In progress','Done'	\N	f	\N	\N	\N	f	4	2022-06-13 07:00:46.922998+00	2022-06-13 07:00:46.922998+00	\N
cl_g3q85k2zcg6hel	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	ncRecordId	ncRecordId	ID	character varying	\N	\N	\N	5	t	\N	t	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	\N	\N	\N	f	5	2022-06-13 07:00:46.940008+00	2022-06-13 07:00:46.940008+00	{"ag":"nc"}
cl_z8snfz1ltrtflk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_affo9e0j69frre	table2_id	table2_id	ForeignKey	character varying	\N	\N	\N	\N	t	\N	t	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:00:47.008263+00	2022-06-13 07:00:47.008263+00	\N
cl_47if01uivdzzr1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_affo9e0j69frre	table1_id	table1_id	ForeignKey	character varying	\N	\N	\N	\N	t	\N	t	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:00:47.017259+00	2022-06-13 07:00:47.017259+00	\N
cl_5n7rh5cu5i9a94	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_affo9e0j69frre	ActorRead	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	2022-06-13 07:00:47.027375+00	2022-06-13 07:00:47.027375+00	\N
cl_vyl6nn9uu4rniw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	nc_hblt___nc_m2m__9oevq0x2zList	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	2022-06-13 07:00:47.038157+00	2022-06-13 07:00:47.038157+00	\N
cl_6zk113zuqps6am	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_affo9e0j69frre	FilmRead	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	2022-06-13 07:00:47.053446+00	2022-06-13 07:00:47.053446+00	\N
cl_9rp6davhp63srs	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	nc_hblt___nc_m2m__9oevq0x2zList	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	t	\N	2022-06-13 07:00:47.06279+00	2022-06-13 07:00:47.06279+00	\N
cl_rwe408zcovemvg	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Actor	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:00:47.083649+00	2022-06-13 07:00:47.083649+00	\N
cl_dqsqpoma8kd32h	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Film	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:00:47.074089+00	2022-06-13 07:00:47.117106+00	\N
cl_pwko7vmwjem98l	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Status (from Actor)	Status_from_Actor_	Lookup	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:00:47.126046+00	2022-06-13 07:00:47.126046+00	\N
cl_f3v90bgeqa2goi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	ncRecordHash	ncRecordHash	SingleLineText	character varying	\N	\N	\N	17	f	f	f	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	\N	\N	\N	t	17	2022-06-13 07:00:46.677926+00	2022-06-13 07:00:47.145779+00	\N
cl_hlsdaymegaxfcd	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Name	Name	SingleLineText	text	\N	\N	\N	1	f	t	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	1	2022-06-13 07:00:46.489087+00	2022-06-13 07:00:47.147295+00	\N
cl_bhwzl5btwsdxee	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	ncRecordHash	ncRecordHash	SingleLineText	character varying	\N	\N	\N	6	f	f	f	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	\N	\N	\N	t	6	2022-06-13 07:00:46.82836+00	2022-06-13 07:00:47.155857+00	\N
cl_6h7ixf3wm93jl1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Name	Name	SingleLineText	text	\N	\N	\N	1	f	t	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	1	2022-06-13 07:00:46.77067+00	2022-06-13 07:00:47.157289+00	\N
cl_b2e2n1x0i8lom1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	ncRecordHash	ncRecordHash	SingleLineText	character varying	\N	\N	\N	6	f	f	f	f	\N	f	\N	\N	\N	\N	character varying	\N	\N	f	\N	\N	\N	t	6	2022-06-13 07:00:46.951073+00	2022-06-13 07:00:47.16632+00	\N
cl_k1r4k8c2etb6pi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Name	Name	SingleLineText	text	\N	\N	\N	1	f	t	f	f	\N	f	\N	\N	\N	\N	text	\N	\N	f	\N	\N	\N	f	1	2022-06-13 07:00:46.894884+00	2022-06-13 07:00:47.167507+00	\N
cl_6ipbhm6pdd136g	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	nc_hblt___Film_id	nc_hblt___Film_id	ForeignKey	character varying	\N	\N	\N	\N	f	\N	f	f	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:03:47.360055+00	2022-06-13 07:03:47.360055+00	\N
cl_0xvph5t8e5b667	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	FilmRead	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:03:47.456767+00	2022-06-13 07:03:47.456767+00	\N
cl_bmar4762fidxnd	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Producer	\N	LinkToAnotherRecord	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:03:47.567198+00	2022-06-13 07:03:47.567198+00	\N
cl_tm7ltwcixu34qm	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	RollUp	\N	Rollup	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:12:16.715538+00	2022-06-13 07:12:16.715538+00	\N
cl_cvxw412ltg7f82	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Computation	\N	Formula	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2022-06-13 07:18:06.399472+00	2022-06-13 07:18:06.399472+00	\N
\.


--
-- Data for Name: nc_cron; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_cron (id, project_id, db_alias, title, description, env, pattern, webhook, timezone, active, cron_handler, payload, headers, retries, retry_interval, timeout, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_cron_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_cron_id_seq', 1, false);


--
-- Data for Name: nc_disabled_models_for_role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_disabled_models_for_role (id, project_id, db_alias, title, type, role, disabled, tn, rtn, cn, rcn, relation_type, created_at, updated_at, parent_model_title) FROM stdin;
\.


--
-- Name: nc_disabled_models_for_role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_disabled_models_for_role_id_seq', 1, false);


--
-- Data for Name: nc_disabled_models_for_role_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_disabled_models_for_role_v2 (id, base_id, project_id, fk_view_id, role, disabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_evolutions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_evolutions (id, title, "titleDown", description, batch, checksum, status, created, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_evolutions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_evolutions_id_seq', 1, false);


--
-- Data for Name: nc_filter_exp_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_filter_exp_v2 (id, base_id, project_id, fk_view_id, fk_hook_id, fk_column_id, fk_parent_id, logical_op, comparison_op, value, is_group, "order", created_at, updated_at) FROM stdin;
fi_t6nxj5j347512m	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_yv75dsa7wwvj3u	\N	cl_6h7ixf3wm93jl1	\N	or	like	1	\N	1	2022-06-13 07:00:50.970914+00	2022-06-13 07:00:50.970914+00
fi_qm5cawmskdby4t	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_yv75dsa7wwvj3u	\N	cl_6h7ixf3wm93jl1	\N	or	like	2	\N	2	2022-06-13 07:00:50.976278+00	2022-06-13 07:00:50.976278+00
\.


--
-- Data for Name: nc_form_view_columns_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_form_view_columns_v2 (id, base_id, project_id, fk_view_id, fk_column_id, uuid, label, help, description, required, show, "order", created_at, updated_at) FROM stdin;
fvc_u2ojuq1vnqw4pk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_9rp6davhp63srs	\N	\N	\N	\N	\N	f	18	2022-06-13 07:00:56.594514+00	2022-06-13 07:00:56.594514+00
fvc_rmv6v987gceq17	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_6lcfkyhon35cvg	\N	\N	\N	\N	\N	f	20	2022-06-13 07:00:56.578148+00	2022-06-13 07:00:56.64852+00
fvc_qy20qetwvcg9m5	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_f3v90bgeqa2goi	\N	\N	\N	\N	\N	f	21	2022-06-13 07:00:56.585404+00	2022-06-13 07:00:56.659778+00
fvc_6v6hvl1v7cunao	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_2qmjsmw5ilkjb1	\N	\N	\N	\N	\N	f	1	2022-06-13 07:00:56.489087+00	2022-06-13 07:00:56.673885+00
fvc_mv3qhbkblitu5c	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_lfjck1f7baljji	\N	\N	\N	\N	\N	f	2	2022-06-13 07:00:56.479824+00	2022-06-13 07:00:56.683156+00
fvc_nbned912aqydu8	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	t	3	2022-06-13 07:00:58.071582+00	2022-06-13 07:00:58.157964+00
fvc_ddrlkegji82bg9	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_hlsdaymegaxfcd	\N	DisplayName	\N	HelpText	t	t	3	2022-06-13 07:00:56.442415+00	2022-06-13 07:00:56.69921+00
fvc_rfnw6u3h0ysngt	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_4af04om9pttcix	\N	\N	\N	\N	\N	f	4	2022-06-13 07:00:56.454183+00	2022-06-13 07:00:56.708975+00
fvc_kemy0jqhodqz2q	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_wsoajtyx4w8f2h	\N	\N	\N	\N	\N	f	5	2022-06-13 07:00:56.462909+00	2022-06-13 07:00:56.729472+00
fvc_6je7jby6ykiao2	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_vjlucu8q3zjj79	\N	\N	\N	\N	\N	f	6	2022-06-13 07:00:56.471636+00	2022-06-13 07:00:56.739344+00
fvc_ipqvfuv5g5851d	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_xa33l1z0bwzc1q	\N	\N	\N	\N	\N	f	7	2022-06-13 07:00:56.4986+00	2022-06-13 07:00:56.74851+00
fvc_xez2nnv38cd2uv	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_hxgith4h183u4z	\N	\N	\N	\N	\N	f	8	2022-06-13 07:00:56.507946+00	2022-06-13 07:00:56.757545+00
fvc_zxgkovq7xgbe3b	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_ogjv6btikkgvms	\N	\N	\N	\N	\N	t	9	2022-06-13 07:00:56.516876+00	2022-06-13 07:00:56.767001+00
fvc_1q1zdoyemlqz01	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_kzny6gvq67kmm5	\N	\N	\N	\N	\N	f	10	2022-06-13 07:00:56.527542+00	2022-06-13 07:00:56.778631+00
fvc_dh4bm6cto4miwn	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_qgvbuwq5wlbkha	\N	\N	\N	\N	\N	f	11	2022-06-13 07:00:56.537408+00	2022-06-13 07:00:56.821372+00
fvc_67ijek7zh8uco3	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_fxv6wvzts1cuqr	\N	\N	\N	\N	\N	f	12	2022-06-13 07:00:56.545791+00	2022-06-13 07:00:56.831132+00
fvc_94r5bs44yamzdr	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_bysnatbas68gpj	\N	\N	\N	\N	\N	f	13	2022-06-13 07:00:56.55431+00	2022-06-13 07:00:56.842614+00
fvc_nvyfzx4qnjcjy7	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_la6r8q0u9bvyv3	\N	\N	\N	\N	\N	f	14	2022-06-13 07:00:56.561896+00	2022-06-13 07:00:56.855275+00
fvc_v8bm5kh3swns0a	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_7h4paqlpvotx4b	\N	\N	\N	\N	\N	f	15	2022-06-13 07:00:56.569879+00	2022-06-13 07:00:56.86635+00
fvc_4xjebszr5nqvt9	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_rwe408zcovemvg	\N	\N	\N	\N	\N	f	17	2022-06-13 07:00:56.602071+00	2022-06-13 07:00:56.882392+00
fvc_cg1t2inp7oytk9	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	cl_pwko7vmwjem98l	\N	\N	\N	\N	\N	f	18	2022-06-13 07:00:56.610126+00	2022-06-13 07:00:56.909285+00
fvc_5c0og7xxjhi6pc	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	cl_g3q85k2zcg6hel	\N	\N	\N	\N	\N	f	5	2022-06-13 07:00:58.090482+00	2022-06-13 07:00:58.117047+00
fvc_bkmt8out4sameo	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	cl_b2e2n1x0i8lom1	\N	\N	\N	\N	\N	f	6	2022-06-13 07:00:58.094685+00	2022-06-13 07:00:58.125297+00
fvc_2357ces50d9u2b	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	cl_k1r4k8c2etb6pi	\N	\N	\N	\N	\N	t	1	2022-06-13 07:00:58.040599+00	2022-06-13 07:00:58.141501+00
fvc_rkix5hk7feythi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	cl_n4b1fuefgpulaz	\N	\N	\N	\N	\N	t	2	2022-06-13 07:00:58.060906+00	2022-06-13 07:00:58.152124+00
fvc_hu4umv8zfmr5j0	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	cl_9nxx6uy4779nio	\N	\N	\N	\N	\N	t	4	2022-06-13 07:00:58.08333+00	2022-06-13 07:00:58.165944+00
fvc_k6pv5z95foolhh	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	cl_g3q85k2zcg6hel	\N	\N	\N	\N	\N	f	5	2022-06-13 07:00:59.188438+00	2022-06-13 07:00:59.244551+00
fvc_mxplayg4mcbzhw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	cl_b2e2n1x0i8lom1	\N	\N	\N	\N	\N	f	6	2022-06-13 07:00:59.206948+00	2022-06-13 07:00:59.254236+00
fvc_ecc23xqy1s1wry	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	cl_k1r4k8c2etb6pi	\N	\N	\N	\N	\N	t	1	2022-06-13 07:00:59.135908+00	2022-06-13 07:00:59.271778+00
fvc_ahssgauqm8oyb0	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	cl_n4b1fuefgpulaz	\N	\N	\N	\N	\N	t	2	2022-06-13 07:00:59.148509+00	2022-06-13 07:00:59.288347+00
fvc_3jthqyt2ddvn79	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	t	3	2022-06-13 07:00:59.160501+00	2022-06-13 07:00:59.308228+00
fvc_mmezmkxhuzjmqu	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	cl_9nxx6uy4779nio	\N	\N	\N	\N	\N	t	4	2022-06-13 07:00:59.17426+00	2022-06-13 07:00:59.317478+00
fvc_q7hzhwdld40t3i	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	cl_g3q85k2zcg6hel	\N	\N	\N	\N	\N	f	5	2022-06-13 07:01:00.150868+00	2022-06-13 07:01:00.198795+00
fvc_qrn3f6ddmfblxz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	cl_b2e2n1x0i8lom1	\N	\N	\N	\N	\N	f	6	2022-06-13 07:01:00.164468+00	2022-06-13 07:01:00.206965+00
fvc_ihxjavs9h1bkvu	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	cl_k1r4k8c2etb6pi	\N	\N	\N	\N	\N	t	1	2022-06-13 07:01:00.089175+00	2022-06-13 07:01:00.213093+00
fvc_jmh75r615prjv1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	cl_n4b1fuefgpulaz	\N	\N	\N	\N	\N	t	2	2022-06-13 07:01:00.102895+00	2022-06-13 07:01:00.222971+00
fvc_oyufsnfzqmlm4n	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	t	3	2022-06-13 07:01:00.117207+00	2022-06-13 07:01:00.231264+00
fvc_rk6yivlqdfpcq0	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	cl_9nxx6uy4779nio	\N	\N	\N	\N	\N	t	4	2022-06-13 07:01:00.134384+00	2022-06-13 07:01:00.237726+00
fvc_c3y0ue9cdhv971	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	cl_g3q85k2zcg6hel	\N	\N	\N	\N	\N	f	5	2022-06-13 07:01:01.380491+00	2022-06-13 07:01:01.421152+00
fvc_gi3m78htruuxwq	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	cl_b2e2n1x0i8lom1	\N	\N	\N	\N	\N	f	6	2022-06-13 07:01:01.391478+00	2022-06-13 07:01:01.440479+00
fvc_d1i5ctitaq00fe	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	cl_k1r4k8c2etb6pi	\N	\N	\N	\N	\N	t	1	2022-06-13 07:01:01.334552+00	2022-06-13 07:01:01.451123+00
fvc_anjrum7zbmjg7t	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	cl_n4b1fuefgpulaz	\N	\N	\N	\N	\N	t	2	2022-06-13 07:01:01.343935+00	2022-06-13 07:01:01.462423+00
fvc_3k1wv3ye870cfi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	t	3	2022-06-13 07:01:01.354956+00	2022-06-13 07:01:01.472925+00
fvc_2lrffqqpiif5af	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	cl_9nxx6uy4779nio	\N	\N	\N	\N	\N	t	4	2022-06-13 07:01:01.366783+00	2022-06-13 07:01:01.482545+00
\.


--
-- Data for Name: nc_form_view_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_form_view_v2 (base_id, project_id, fk_view_id, heading, subheading, success_msg, redirect_url, redirect_after_secs, email, submit_another_form, show_blank_form, uuid, banner_image_url, logo_url, created_at, updated_at) FROM stdin;
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ubm72q5tlmccvu	FormTitle	FormDescription	Thank you for submitting the form!	\N	\N	\N	t	t	\N	\N	\N	2022-06-13 07:00:56.408087+00	2022-06-13 07:00:56.408087+00
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_wbbiahyr1io2nq	Form		Thank you for submitting the form!	\N	\N	\N	f	f	\N	\N	\N	2022-06-13 07:00:58.024167+00	2022-06-13 07:00:58.024167+00
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8sgx53tn88hkfh	Form 2		Thank you for submitting the form!	\N	\N	\N	f	f	\N	\N	\N	2022-06-13 07:00:59.116324+00	2022-06-13 07:00:59.116324+00
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_a71vtm0kxaoh6r	Form 3		Thank you for submitting the form!	\N	\N	\N	f	f	\N	\N	\N	2022-06-13 07:01:00.073996+00	2022-06-13 07:01:00.073996+00
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_8fky8viw54t7tk	Form 4		Thank you for submitting the form!	\N	\N	\N	f	f	\N	\N	\N	2022-06-13 07:01:01.318722+00	2022-06-13 07:01:01.318722+00
\.


--
-- Data for Name: nc_gallery_view_columns_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_gallery_view_columns_v2 (id, base_id, project_id, fk_view_id, fk_column_id, uuid, label, help, show, "order", created_at, updated_at) FROM stdin;
gvc_fdf5sq085oyhke	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_k1r4k8c2etb6pi	\N	\N	\N	t	1	2022-06-13 07:01:02.634002+00	2022-06-13 07:01:02.634002+00
gvc_npisvpy5je6crr	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_n4b1fuefgpulaz	\N	\N	\N	t	2	2022-06-13 07:01:02.644045+00	2022-06-13 07:01:02.644045+00
gvc_bos72nyrk2fdgu	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_ww1mtv3m2ni2vk	\N	\N	\N	t	3	2022-06-13 07:01:02.65299+00	2022-06-13 07:01:02.65299+00
gvc_gx4ng411g2rsru	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_9nxx6uy4779nio	\N	\N	\N	t	4	2022-06-13 07:01:02.660355+00	2022-06-13 07:01:02.660355+00
gvc_ki8zxf4e4a38bp	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_g3q85k2zcg6hel	\N	\N	\N	f	5	2022-06-13 07:01:02.666371+00	2022-06-13 07:01:02.666371+00
gvc_qjpace90y1t495	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_b2e2n1x0i8lom1	\N	\N	\N	f	6	2022-06-13 07:01:02.672824+00	2022-06-13 07:01:02.672824+00
gvc_ozhbn65l9970kp	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_k1r4k8c2etb6pi	\N	\N	\N	t	1	2022-06-13 07:01:03.552121+00	2022-06-13 07:01:03.552121+00
gvc_kb4nnalshf8jga	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_n4b1fuefgpulaz	\N	\N	\N	t	2	2022-06-13 07:01:03.565355+00	2022-06-13 07:01:03.565355+00
gvc_xgtpvrge7wl8my	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_ww1mtv3m2ni2vk	\N	\N	\N	t	3	2022-06-13 07:01:03.579307+00	2022-06-13 07:01:03.579307+00
gvc_d542ixr95oz4v7	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_9nxx6uy4779nio	\N	\N	\N	t	4	2022-06-13 07:01:03.596485+00	2022-06-13 07:01:03.596485+00
gvc_0b91hc70t5uxxu	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_g3q85k2zcg6hel	\N	\N	\N	f	5	2022-06-13 07:01:03.611141+00	2022-06-13 07:01:03.611141+00
gvc_tbv5dfz7wkogi1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_b2e2n1x0i8lom1	\N	\N	\N	f	6	2022-06-13 07:01:03.623722+00	2022-06-13 07:01:03.623722+00
gvc_4x012uwduoea0d	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_k1r4k8c2etb6pi	\N	\N	\N	t	1	2022-06-13 07:01:04.560034+00	2022-06-13 07:01:04.560034+00
gvc_qb0nzrjf9uslxo	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_n4b1fuefgpulaz	\N	\N	\N	t	2	2022-06-13 07:01:04.583622+00	2022-06-13 07:01:04.583622+00
gvc_jk1emk7ck66dlg	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_ww1mtv3m2ni2vk	\N	\N	\N	t	3	2022-06-13 07:01:04.599055+00	2022-06-13 07:01:04.599055+00
gvc_ayooq0861rapkc	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_9nxx6uy4779nio	\N	\N	\N	t	4	2022-06-13 07:01:04.614846+00	2022-06-13 07:01:04.614846+00
gvc_wy3wm9b1s0t1yp	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_g3q85k2zcg6hel	\N	\N	\N	f	5	2022-06-13 07:01:04.632162+00	2022-06-13 07:01:04.632162+00
gvc_48p65fs27ujlcc	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_b2e2n1x0i8lom1	\N	\N	\N	f	6	2022-06-13 07:01:04.644409+00	2022-06-13 07:01:04.644409+00
gvc_n34nspi8774yd1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_6ipbhm6pdd136g	\N	\N	\N	t	7	2022-06-13 07:03:47.413463+00	2022-06-13 07:03:47.413463+00
gvc_cu45kmof915l1h	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_6ipbhm6pdd136g	\N	\N	\N	t	7	2022-06-13 07:03:47.426389+00	2022-06-13 07:03:47.426389+00
gvc_e5thbg68iyv9w0	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_6ipbhm6pdd136g	\N	\N	\N	t	7	2022-06-13 07:03:47.434642+00	2022-06-13 07:03:47.434642+00
gvc_f4jmr4fciclbf8	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	cl_0xvph5t8e5b667	\N	\N	\N	t	8	2022-06-13 07:03:47.534593+00	2022-06-13 07:03:47.534593+00
gvc_o6wlma7btrzrsi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	cl_0xvph5t8e5b667	\N	\N	\N	t	8	2022-06-13 07:03:47.546265+00	2022-06-13 07:03:47.546265+00
gvc_gepq7oz4ml4ifc	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	cl_0xvph5t8e5b667	\N	\N	\N	t	8	2022-06-13 07:03:47.554271+00	2022-06-13 07:03:47.554271+00
\.


--
-- Data for Name: nc_gallery_view_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_gallery_view_v2 (base_id, project_id, fk_view_id, next_enabled, prev_enabled, cover_image_idx, fk_cover_image_col_id, cover_image, restrict_types, restrict_size, restrict_number, public, dimensions, responsive_columns, created_at, updated_at) FROM stdin;
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_ordkcxhwg8pg88	\N	\N	\N	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:01:02.612706+00	2022-06-13 07:01:02.612706+00
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_p28ldcq3zy32b9	\N	\N	\N	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:01:03.534093+00	2022-06-13 07:01:03.534093+00
ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_clfkzvyypltmto	\N	\N	\N	cl_ww1mtv3m2ni2vk	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:01:04.542404+00	2022-06-13 07:01:04.542404+00
\.


--
-- Data for Name: nc_grid_view_columns_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_grid_view_columns_v2 (id, fk_view_id, fk_column_id, base_id, project_id, uuid, label, help, width, show, "order", created_at, updated_at) FROM stdin;
nc_p3036vdor71tcg	vw_0lwyv8ap72h0by	cl_z8snfz1ltrtflk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:47.014311+00	2022-06-13 07:00:47.014311+00
nc_rtwcpmh94zn5jb	vw_0lwyv8ap72h0by	cl_47if01uivdzzr1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:47.020636+00	2022-06-13 07:00:47.020636+00
nc_wjnvcpc1ehvicv	vw_0lwyv8ap72h0by	cl_5n7rh5cu5i9a94	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	3	2022-06-13 07:00:47.034186+00	2022-06-13 07:00:47.034186+00
nc_mnrp1m0pusbu6w	vw_mwyhnlv1f3g99f	cl_vyl6nn9uu4rniw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	7	2022-06-13 07:00:47.046469+00	2022-06-13 07:00:47.046469+00
nc_xycjz311tzd9wq	vw_0lwyv8ap72h0by	cl_6zk113zuqps6am	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:47.058994+00	2022-06-13 07:00:47.058994+00
nc_pfm1g8kctevft5	vw_9msmfh7uv5mfwz	cl_9rp6davhp63srs	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	18	2022-06-13 07:00:47.070158+00	2022-06-13 07:00:47.070158+00
nc_yysch0oeic3pko	vw_9msmfh7uv5mfwz	cl_6lcfkyhon35cvg	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	20	2022-06-13 07:00:46.674522+00	2022-06-13 07:00:48.330465+00
nc_r5gg8fmrn411hz	vw_9msmfh7uv5mfwz	cl_f3v90bgeqa2goi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	21	2022-06-13 07:00:46.68307+00	2022-06-13 07:00:48.336253+00
nc_kemi9uxkynpw2d	vw_9msmfh7uv5mfwz	cl_hlsdaymegaxfcd	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:46.494327+00	2022-06-13 07:00:48.342454+00
nc_es29o569ixz3ju	vw_9msmfh7uv5mfwz	cl_4af04om9pttcix	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:46.504369+00	2022-06-13 07:00:48.348779+00
nc_oy46yoxa98vyaa	vw_9msmfh7uv5mfwz	cl_wsoajtyx4w8f2h	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	3	2022-06-13 07:00:46.510689+00	2022-06-13 07:00:48.355208+00
nc_t3zagifwcb2tmf	vw_9msmfh7uv5mfwz	cl_vjlucu8q3zjj79	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:46.52765+00	2022-06-13 07:00:48.363461+00
nc_m3snwp55wj6m25	vw_9msmfh7uv5mfwz	cl_2qmjsmw5ilkjb1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	5	2022-06-13 07:00:46.581745+00	2022-06-13 07:00:48.369173+00
nc_7d3ksxo06g9gwv	vw_9msmfh7uv5mfwz	cl_lfjck1f7baljji	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	6	2022-06-13 07:00:46.533604+00	2022-06-13 07:00:48.377504+00
nc_q490kj229bt3w9	vw_9msmfh7uv5mfwz	cl_xa33l1z0bwzc1q	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	7	2022-06-13 07:00:46.591898+00	2022-06-13 07:00:48.383496+00
nc_6wtsnglud7zwat	vw_9msmfh7uv5mfwz	cl_hxgith4h183u4z	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	8	2022-06-13 07:00:46.600116+00	2022-06-13 07:00:48.390999+00
nc_928jmp9ucgln1x	vw_9msmfh7uv5mfwz	cl_ogjv6btikkgvms	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	9	2022-06-13 07:00:46.611941+00	2022-06-13 07:00:48.396348+00
nc_xhejzoxgux94f4	vw_9msmfh7uv5mfwz	cl_kzny6gvq67kmm5	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	10	2022-06-13 07:00:46.61952+00	2022-06-13 07:00:48.405051+00
nc_r9czm157e6wob0	vw_9msmfh7uv5mfwz	cl_qgvbuwq5wlbkha	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	11	2022-06-13 07:00:46.629416+00	2022-06-13 07:00:48.415004+00
nc_no4atef7iup9jn	vw_9msmfh7uv5mfwz	cl_fxv6wvzts1cuqr	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	12	2022-06-13 07:00:46.63671+00	2022-06-13 07:00:48.42308+00
nc_k8wf4onr34olbi	vw_9msmfh7uv5mfwz	cl_bysnatbas68gpj	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	13	2022-06-13 07:00:46.646679+00	2022-06-13 07:00:48.43115+00
nc_jpiglrf93lwhs5	vw_9msmfh7uv5mfwz	cl_la6r8q0u9bvyv3	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	14	2022-06-13 07:00:46.658065+00	2022-06-13 07:00:48.43928+00
nc_b4mif9fhi150g5	vw_9msmfh7uv5mfwz	cl_7h4paqlpvotx4b	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	15	2022-06-13 07:00:46.664603+00	2022-06-13 07:00:48.450075+00
nc_ffwwtetdeztsp0	vw_9msmfh7uv5mfwz	cl_rwe408zcovemvg	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	17	2022-06-13 07:00:47.09128+00	2022-06-13 07:00:48.46182+00
nc_q8b0ds8gsmx6yg	vw_9msmfh7uv5mfwz	cl_pwko7vmwjem98l	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	18	2022-06-13 07:00:47.132759+00	2022-06-13 07:00:48.468008+00
nc_bb28y20xyzv7yb	vw_mwyhnlv1f3g99f	cl_0fhoikbhmibfic	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	6	2022-06-13 07:00:46.823943+00	2022-06-13 07:00:49.622023+00
nc_v50zqijtrtxg3e	vw_mwyhnlv1f3g99f	cl_bhwzl5btwsdxee	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	7	2022-06-13 07:00:46.832863+00	2022-06-13 07:00:49.630902+00
nc_js5mz2dpk8oa0b	vw_mwyhnlv1f3g99f	cl_6h7ixf3wm93jl1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:46.777204+00	2022-06-13 07:00:49.641962+00
nc_lh45wsaagxhkmq	vw_mwyhnlv1f3g99f	cl_n54t3vwjrtcn21	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:46.788319+00	2022-06-13 07:00:49.651499+00
nc_cdo3scwiya6tu7	vw_mwyhnlv1f3g99f	cl_wryamwhwnbigwz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:46.816421+00	2022-06-13 07:00:49.67104+00
nc_ypqcyf5r1hwf6a	vw_mwyhnlv1f3g99f	cl_dqsqpoma8kd32h	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	5	2022-06-13 07:00:47.080157+00	2022-06-13 07:00:49.681008+00
nc_97rp3yjzljzwze	vw_yv75dsa7wwvj3u	cl_vyl6nn9uu4rniw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	7	2022-06-13 07:00:50.893952+00	2022-06-13 07:00:50.893952+00
nc_jnoncpm79y181g	vw_yv75dsa7wwvj3u	cl_0fhoikbhmibfic	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	6	2022-06-13 07:00:50.882205+00	2022-06-13 07:00:50.924296+00
nc_juhz25rlcq70wo	vw_yv75dsa7wwvj3u	cl_bhwzl5btwsdxee	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	7	2022-06-13 07:00:50.887551+00	2022-06-13 07:00:50.929452+00
nc_311i0srvhhwyxn	vw_yv75dsa7wwvj3u	cl_6h7ixf3wm93jl1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:50.851704+00	2022-06-13 07:00:50.944848+00
nc_cpau26wsrp8rou	vw_yv75dsa7wwvj3u	cl_n54t3vwjrtcn21	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:50.860357+00	2022-06-13 07:00:50.953764+00
nc_7ofrlb572531ym	vw_yv75dsa7wwvj3u	cl_c7daqht9ool1vw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	3	2022-06-13 07:00:50.869214+00	2022-06-13 07:00:50.958269+00
nc_q3o41o0evbbbgo	vw_yv75dsa7wwvj3u	cl_wryamwhwnbigwz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:50.875272+00	2022-06-13 07:00:50.962747+00
nc_jkjgs2dwulw8ec	vw_yv75dsa7wwvj3u	cl_dqsqpoma8kd32h	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	5	2022-06-13 07:00:50.901517+00	2022-06-13 07:00:50.966954+00
nc_6ci3gpelc9tpcn	vw_3lc5xx7fjg3zfp	cl_g3q85k2zcg6hel	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	5	2022-06-13 07:00:46.947821+00	2022-06-13 07:00:52.294507+00
nc_r5fcm9vik7ctlk	vw_3lc5xx7fjg3zfp	cl_b2e2n1x0i8lom1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	6	2022-06-13 07:00:46.955471+00	2022-06-13 07:00:52.30456+00
nc_kxda0trjrwjbxe	vw_3lc5xx7fjg3zfp	cl_k1r4k8c2etb6pi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:46.9007+00	2022-06-13 07:00:52.319725+00
nc_594s1wzkrnn5f3	vw_3lc5xx7fjg3zfp	cl_n4b1fuefgpulaz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:46.909751+00	2022-06-13 07:00:52.335168+00
nc_5g3mn9mmj6x2yc	vw_3lc5xx7fjg3zfp	cl_ww1mtv3m2ni2vk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	3	2022-06-13 07:00:46.919814+00	2022-06-13 07:00:52.342989+00
nc_02izvt5imuh74m	vw_3lc5xx7fjg3zfp	cl_9nxx6uy4779nio	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:46.937166+00	2022-06-13 07:00:52.351127+00
nc_3ognn8p7pkpplu	vw_4awlw6zujst2vm	cl_k1r4k8c2etb6pi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:53.186997+00	2022-06-13 07:00:53.31388+00
nc_decmrf3kdjggii	vw_4awlw6zujst2vm	cl_n4b1fuefgpulaz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:53.198842+00	2022-06-13 07:00:53.325195+00
nc_9ksakiegy3i011	vw_4awlw6zujst2vm	cl_ww1mtv3m2ni2vk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	3	2022-06-13 07:00:53.210687+00	2022-06-13 07:00:53.334357+00
nc_j8sla3zlzg3t35	vw_4awlw6zujst2vm	cl_9nxx6uy4779nio	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:53.227058+00	2022-06-13 07:00:53.343182+00
nc_iw3itivmurdpzf	vw_mwyhnlv1f3g99f	cl_c7daqht9ool1vw	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	3	2022-06-13 07:00:46.795294+00	2022-06-13 07:18:25.131701+00
nc_zapsj1o1mi5l8s	vw_4awlw6zujst2vm	cl_g3q85k2zcg6hel	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	5	2022-06-13 07:00:53.242246+00	2022-06-13 07:00:53.29495+00
nc_qav1hj6k4vzxwt	vw_4awlw6zujst2vm	cl_b2e2n1x0i8lom1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	6	2022-06-13 07:00:53.251619+00	2022-06-13 07:00:53.304144+00
nc_dxrnz33mq361o0	vw_xov4el1bqpsgy8	cl_g3q85k2zcg6hel	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	5	2022-06-13 07:00:54.171865+00	2022-06-13 07:00:54.219929+00
nc_z28vgsvqdxb5ik	vw_xov4el1bqpsgy8	cl_b2e2n1x0i8lom1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	6	2022-06-13 07:00:54.181926+00	2022-06-13 07:00:54.229079+00
nc_a4x1p4779ojlmy	vw_xov4el1bqpsgy8	cl_k1r4k8c2etb6pi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:54.127622+00	2022-06-13 07:00:54.241707+00
nc_1rqc8t4hotxgum	vw_xov4el1bqpsgy8	cl_n4b1fuefgpulaz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:54.141353+00	2022-06-13 07:00:54.250471+00
nc_738hspkw1h5uwj	vw_xov4el1bqpsgy8	cl_ww1mtv3m2ni2vk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	3	2022-06-13 07:00:54.153028+00	2022-06-13 07:00:54.261186+00
nc_tl1g0fzdc2x2xv	vw_xov4el1bqpsgy8	cl_9nxx6uy4779nio	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:54.163307+00	2022-06-13 07:00:54.270846+00
nc_n1dmcjoydwhlbz	vw_vdsb71p2zbuors	cl_g3q85k2zcg6hel	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	5	2022-06-13 07:00:55.257986+00	2022-06-13 07:00:55.318598+00
nc_flzfanfhx5f6ki	vw_vdsb71p2zbuors	cl_b2e2n1x0i8lom1	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	f	6	2022-06-13 07:00:55.274398+00	2022-06-13 07:00:55.331246+00
nc_oytaoy426c9xlz	vw_vdsb71p2zbuors	cl_k1r4k8c2etb6pi	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	1	2022-06-13 07:00:55.205131+00	2022-06-13 07:00:55.346505+00
nc_vo5nq6y911991x	vw_vdsb71p2zbuors	cl_n4b1fuefgpulaz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	2	2022-06-13 07:00:55.218442+00	2022-06-13 07:00:55.360259+00
nc_iptfnph9g8od2y	vw_vdsb71p2zbuors	cl_ww1mtv3m2ni2vk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	3	2022-06-13 07:00:55.231002+00	2022-06-13 07:00:55.374222+00
nc_583xt72pp8wuh3	vw_vdsb71p2zbuors	cl_9nxx6uy4779nio	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	4	2022-06-13 07:00:55.243037+00	2022-06-13 07:00:55.38442+00
nc_dyhd79zccw82vz	vw_3lc5xx7fjg3zfp	cl_6ipbhm6pdd136g	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	7	2022-06-13 07:03:47.370665+00	2022-06-13 07:03:47.370665+00
nc_7xg07yeusl8m4l	vw_4awlw6zujst2vm	cl_6ipbhm6pdd136g	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	7	2022-06-13 07:03:47.379454+00	2022-06-13 07:03:47.379454+00
nc_frfckt9vjzd4yj	vw_xov4el1bqpsgy8	cl_6ipbhm6pdd136g	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	7	2022-06-13 07:03:47.389186+00	2022-06-13 07:03:47.389186+00
nc_um0df010uwl7kc	vw_vdsb71p2zbuors	cl_6ipbhm6pdd136g	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	7	2022-06-13 07:03:47.401703+00	2022-06-13 07:03:47.401703+00
nc_htsm0dnoexwj9n	vw_3lc5xx7fjg3zfp	cl_0xvph5t8e5b667	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	8	2022-06-13 07:03:47.473203+00	2022-06-13 07:03:47.473203+00
nc_ypoy7r91p0rhqj	vw_4awlw6zujst2vm	cl_0xvph5t8e5b667	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	8	2022-06-13 07:03:47.480713+00	2022-06-13 07:03:47.480713+00
nc_o76u11wp2bm3ev	vw_xov4el1bqpsgy8	cl_0xvph5t8e5b667	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	8	2022-06-13 07:03:47.487842+00	2022-06-13 07:03:47.487842+00
nc_1m8ktkoebndee0	vw_vdsb71p2zbuors	cl_0xvph5t8e5b667	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	8	2022-06-13 07:03:47.527298+00	2022-06-13 07:03:47.527298+00
nc_vliqjg6nitvx6a	vw_9msmfh7uv5mfwz	cl_bmar4762fidxnd	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	22	2022-06-13 07:03:47.588481+00	2022-06-13 07:03:47.588481+00
nc_zxfe8l4opfbz99	vw_9msmfh7uv5mfwz	cl_tm7ltwcixu34qm	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	23	2022-06-13 07:12:16.746968+00	2022-06-13 07:12:16.746968+00
nc_pb69judn9ql502	vw_9msmfh7uv5mfwz	cl_cvxw412ltg7f82	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	\N	\N	200px	t	24	2022-06-13 07:18:06.434415+00	2022-06-13 07:18:06.434415+00
\.


--
-- Data for Name: nc_grid_view_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_grid_view_v2 (fk_view_id, base_id, project_id, uuid, created_at, updated_at) FROM stdin;
vw_9msmfh7uv5mfwz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:46.482769+00	2022-06-13 07:00:46.482769+00
vw_mwyhnlv1f3g99f	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:46.76622+00	2022-06-13 07:00:46.76622+00
vw_3lc5xx7fjg3zfp	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:46.889278+00	2022-06-13 07:00:46.889278+00
vw_0lwyv8ap72h0by	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:47.005135+00	2022-06-13 07:00:47.005135+00
vw_yv75dsa7wwvj3u	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:50.84102+00	2022-06-13 07:00:50.84102+00
vw_4awlw6zujst2vm	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:53.172817+00	2022-06-13 07:00:53.172817+00
vw_xov4el1bqpsgy8	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:54.112375+00	2022-06-13 07:00:54.112375+00
vw_vdsb71p2zbuors	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	\N	2022-06-13 07:00:55.190126+00	2022-06-13 07:00:55.190126+00
\.


--
-- Data for Name: nc_hblt___Actor; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."nc_hblt___Actor" ("Name", "Notes", "Attachments", "Status", "ncRecordId", "ncRecordHash") FROM stdin;
Actor3	Actor notes 3	\N	Done	rec0FvoEXWLmQUFAw	058bb253c4061e61203caa7d5be2a696f2b26c65
Actor1	Actor notes 1	\N	Todo	rec0V0zxSBZ0MseyB	88e9dd595a659d42ac88a4a868540ad6abb44c2d
Actor1	Actor notes 1	\N	Todo	rec0ZeKT9G0JoSoPc	3491d871797e6695951b97bf0f20fcbc27f6375a
Actor2	Actor notes 2	\N	In progress	rec0uSfHFyj6vrEL5	67481454232e5b93130eba12735fe165c0a6b1cd
Actor1	Actor notes 1	\N	Todo	rec1D7aLIRKRzyPoB	aca2736d52d28f91363fbd0a77d014db7e1ec76d
Actor1	Actor notes 1	\N	Todo	rec2ITS9u00D1ElOe	4b2b33e5078e827f4aa7cf4e3e75a23f1d882cf5
Actor1	Actor notes 1	\N	Todo	rec2bJf0FfXrXxb1o	883b4e7d1da4e41e37f526b4cdecf4d9ab9951bc
Actor2	Actor notes 2	\N	In progress	rec3111PeL24b09un	1fb78873df922f54de155b3095e318ad549f5108
Actor2	Actor notes 2	\N	In progress	rec39XBA2rhY86qEV	85fafac434bf334a9f27451413ab3b7069658187
Actor3	Actor notes 3	\N	Done	rec3Gz7qVmxyg5QZB	e6b4ad34e8a91b58ae14871e122a35191a13530d
Actor3	Actor notes 3	\N	Done	rec3fFOH2yOHyVHpy	23f42119752c015053a71b12f3e324a3e6ceb14a
Actor1	Actor notes 1	\N	Todo	rec46CYu3d27LO97h	7fc7d80e7822ef346d056f8945457e194fe1bc90
Actor3	Actor notes 3	\N	Done	rec49QGAIoBcKGnYR	6dee403f64cdaa512b1d0cd3fb2daf75bb58d18c
Actor3	Actor notes 3	\N	Done	rec4RFUjLxRxCH81i	3dcfcd09d56e715c1510a22e65d41f9b05d39dd8
Actor3	Actor notes 3	\N	Done	rec4W05E1cVl4ZFr9	2d9074b9c4523b24a0df362ca8e37f94a275fd5b
Actor2	Actor notes 2	\N	In progress	rec4cOht1jqTABdYJ	045e7a6369fc64807abb4fbfeae4a6c03a34ec42
Actor1	Actor notes 1	\N	Todo	rec4uWuyNJpCy95FU	5cf3b7a7ff63bf9a7fb12163c2c7102e54f9a8ba
Actor3	Actor notes 3	\N	Done	rec4yoBrJZstoKQU2	5763c55802c5421431f1d4f9ceb8a0b6ad1dd434
Actor2	Actor notes 2	\N	In progress	rec56o1YrJM3J0DBy	96a4258f186f276df6f5b0f369b142bfb77bc33c
Actor2	Actor notes 2	\N	In progress	rec5dpMRWMCOpLAMi	78135255e07ff9cd956d4d2ad848b8f201b67e35
Actor1	Actor notes 1	\N	Todo	rec5i2JENrmFxXTyi	a6ba6c6e0f381c88923cb8a449212f10922ca559
Actor1	Actor notes 1	\N	Todo	rec5yvzC9lLtw0KJX	4cc499379c7828fa6bef5d620b02875a5bad6834
Actor2	Actor notes 2	\N	In progress	rec64hkgWxUM9PkAA	29c4d12a91059895b415144bef39e5edfc890f17
Actor1	Actor notes 1	\N	Todo	rec6BwSzdAs2NA0mM	647f5343a4ada287d081c7916030fb4e7c4b2a72
Actor3	Actor notes 3	\N	Done	rec6YDus4TCCdIhtP	e6599fca8c04badbd960c22a8eeb37b19b0297d7
Actor2	Actor notes 2	\N	In progress	rec7u1bgQ7deGqDBJ	e15c1fc411306dfc84e022a403cb8edbf0270890
Actor2	Actor notes 2	\N	In progress	rec8GtDGX0r0aSUmZ	eaa80ad884e53fe365bc2078f7e6b45852b9ac1c
Actor2	Actor notes 2	\N	In progress	rec8HHJRlguTmyZmr	02ef1f7e6c6a5288584df60593f888d0cf79d748
Actor3	Actor notes 3	\N	Done	rec8kCifIZcU2GCPq	11b2d968a4bfd649d9a9bd55d924ae5ad4367c99
Actor3	Actor notes 3	\N	Done	rec96jCh0XHHKgBC2	ba47eb8751dfb9ee554592452754e75f9c71bfbf
Actor1	Actor notes 1	\N	Todo	rec9J0VShrSuDvMxW	d66b02424401ec489a951a84a82abd9f73baa1b0
Actor3	Actor notes 3	\N	Done	rec9ZogzXciL93exN	7f98c427ff6a880354d044d69e667efe2615c6f1
Actor2	Actor notes 2	\N	In progress	recAGJ1QI0dmDGjSE	331bdc34a1fdf629754b0529bcdf01125115b274
Actor2	Actor notes 2	\N	In progress	recAUh1LXvf9YBKT8	2dc2537b8b0a702fd0e2e341d7ffb131f3cf8d68
Actor1	Actor notes 1	\N	Todo	recArWjtWwaH4TqHT	d1e5a3db8b02f785a762f61e6ef0fa41f859c5a9
Actor3	Actor notes 3	\N	Done	recAz1AskwK05sL3O	3142c26eefadde35e0fa9d7ffd694f106e2cbd61
Actor3	Actor notes 3	\N	Done	recBDYZwxZuHlba8N	cd1b37751b3151424ad29e89a20cc292c4c74bf7
Actor2	Actor notes 2	\N	In progress	recC5DAUejwpPydmg	f5e66277fed9e9b91e6933ba9c31c677cf5d6a46
Actor3	Actor notes 3	\N	Done	recCIOJeHew0T6Iy9	41208f987604803f82e6cae9cef309644af1781a
Actor2	Actor notes 2	\N	In progress	recCNh8VtGFBgvaRz	1e915ed9da5d5d98ac6e543a96e516ef6abb2c49
Actor3	Actor notes 3	\N	Done	recCQozCSDbuWDBtS	95604128bb919b443fb73a7d2cf656b454011506
Actor1	Actor notes 1	\N	Todo	recCRzc9ECwbehYvX	b48509ffeb133032607938016ea2ee0a7a193a59
Actor3	Actor notes 3	\N	Done	recCTKCKBT1qeibP1	eb672f38940525a8d113cf5220cc13a0f4f3b2fd
Actor2	Actor notes 2	\N	In progress	recCnI7OZM6WQd055	055cfa5af65ca46c6b89b2b796c858e96ff0a755
Actor1	Actor notes 1	\N	Todo	recCnUhOCubTxxqN3	6d6ac028cbd8165b7b2dfc00d9d288044d6d42d9
Actor3	Actor notes 3	\N	Done	recCr0Ffe1MeHNneQ	82d08de7a35093dfb63485c0fc4ef6e6c8982adc
Actor2	Actor notes 2	\N	In progress	recCt3k3j45MNu8jo	c7dfcbd2c72a6f87adf2958dfa7342acc4cf9df3
Actor3	Actor notes 3	\N	Done	recCt4jqAZvzphPoY	47fe0bca203b5cc9e22de1da1f1fc13e70df55bb
Actor2	Actor notes 2	\N	In progress	recD8sJe7mGqfWAIy	69dff8c1f2c9f25f6b8f914aa4ee681a795e5e15
Actor2	Actor notes 2	\N	In progress	recDeTFYDBvc2Z7uA	4e9934c2ded5ceca7a4cc3495c6e2324d064f4f0
Actor2	Actor notes 2	\N	In progress	recEAH1Tt9UmzEn4g	6e2962d748cd286249827a02954caa436f4c6a91
Actor3	Actor notes 3	\N	Done	recERARHbh0c9Ky1K	9e76d6ebf64d54176bcb4e557d70202a207e0bbf
Actor2	Actor notes 2	\N	In progress	recEn3Jt0Q3jUkrnA	47a90b7a138806cbc1db5aa0a01fcd9fc343941e
Actor1	Actor notes 1	\N	Todo	recErHa5t2ObPb7WG	e5f124b1ef260234d903b47ddba2321a263b4020
Actor1	Actor notes 1	\N	Todo	recFgM5lSLMJ3TeQJ	ad90e5f9de986f59c49d6846042c6379fbeb47c7
Actor3	Actor notes 3	\N	Done	recG57T4qX2yQjeZ3	6ee6dd0582aac9f50cdc36fe6b27459d225703c2
Actor2	Actor notes 2	\N	In progress	recGFnlB5Gil5Rko7	e0fe39dd966d51b4a7ad6b0bbcbfe3dd8fcbbf4c
Actor1	Actor notes 1	\N	Todo	recHYPx1nffn7ixpu	a8e4160e46f8322c85b7d77810fa04b443cbb760
Actor2	Actor notes 2	\N	In progress	recHfp3CsU6nD0aZB	5eb23a841d8413cdfe610f436d24af94b5e720db
Actor2	Actor notes 2	\N	In progress	recICTNunnjH1nGhQ	0e11af149f76a94a4826ac15cfb6bd8946484bcf
Actor1	Actor notes 1	\N	Todo	recIDKRGK5eUjvPJ5	a313de822c6ae5cf647b9238d8a232c708be7164
Actor3	Actor notes 3	\N	Done	recINXG0bzWvS2OoD	8a0973f0fd171a9d97a8cd2cb37f7ee3a307af7f
Actor3	Actor notes 3	\N	Done	recIk7tXHdmSDNG6Z	e780ff3f7936cf9bc21724877f01aaca886df365
Actor1	Actor notes 1	\N	Todo	recIulEH9NzmIIxJF	2c64b8375705d76073c0d563171a4b35db7f421d
Actor1	Actor notes 1	\N	Todo	recJP30B8nKbRkIt1	fb83834d9c1079c7c1cd50b3201faa298639f43c
Actor1	Actor notes 1	\N	Todo	recJYqnnmSykWqStj	999edf5546ef602c5e286b33be37ec1deb5b382c
Actor2	Actor notes 2	\N	In progress	recJcm8KkP9vkWi3I	1c3f780dff314f9fa77046e59fe33fba3bcab98e
Actor3	Actor notes 3	\N	Done	recJhuHnRcZZG5fEZ	bd3513caaca13a753392edce91f2cd190e5466a3
Actor1	Actor notes 1	\N	Todo	recK6mxq2iZr3RXSq	add789db424f595f29d772f7ad3b048aac14f31a
Actor2	Actor notes 2	\N	In progress	recKFJhZ9ODiymkuR	ba627982d23449d54aea92ee9b709ce0d0ea19b7
Actor3	Actor notes 3	\N	Done	recKZL5MowA1NsVvn	ab55e3a4275b912ae7fe498977c23e82a31b4e3f
Actor1	Actor notes 1	\N	Todo	recKljYPAGWceTBNH	06c9190218171fd72ee88d22164aaa7f5ba53f75
Actor2	Actor notes 2	\N	In progress	recLBrOWsUpp7qvgE	bfb0c6cd66d987f3ce305275d0c23bdc87017dad
Actor3	Actor notes 3	\N	Done	recLDPN7Vgngo2dTh	d304b1dc6911ba907c677812e8693120c0c21dab
Actor3	Actor notes 3	\N	Done	recLFWbi4c8yTLx80	d737ad6a553fc58961c4fd6c15b2449d5052a531
Actor1	Actor notes 1	\N	Todo	recNJ4JrkGtqZOhAv	0df01f7529c666d82137b292a4f5b20b778fe3dd
Actor3	Actor notes 3	\N	Done	recNPYtn6vUiM6okR	cad941be6e82787eda1d1ee9c246703fb10cd595
Actor3	Actor notes 3	\N	Done	recNTncuKqBYo7LrU	d9fc4d7913303b4ff97d63d3299b2096bd8d54f2
Actor3	Actor notes 3	\N	Done	recOJsmmUudeE29Ue	cf8744390d10e9e8a32680fbefba9665a848c779
Actor3	Actor notes 3	\N	Done	recOLB1WhYHqK74SS	157d15d261ec52caeb45fe159b7cfb4d88083658
Actor3	Actor notes 3	\N	Done	recOW86Ggx66FXwjB	1f8bf8fbf1e39750eb523238df6cefb65229f001
Actor1	Actor notes 1	\N	Todo	recOjAGiJssXRCa30	c54aefcbbb62a7185610fc831880e29ae9f524c1
Actor1	Actor notes 1	\N	Todo	recPGC8odDltpgn0K	c6036aeee51d2e17bb25747631b821798e6ef359
Actor2	Actor notes 2	\N	In progress	recPtflCrx455S5KC	40270e6f138e5bf33c97ca8a30d03cd73d0d31f7
Actor2	Actor notes 2	\N	In progress	recPyraZijpepka2B	d012e5eedc44fb86a360c83878a5168a137b6b54
Actor3	Actor notes 3	\N	Done	recQISAKx6ORHIMQI	aa7bacc3da5dfe82b9a9bc1407f86726dc10e043
Actor3	Actor notes 3	\N	Done	recQP6oFkH9QgcYas	fa0ef0e1a544eb885de79c9630f35772588dd69e
Actor1	Actor notes 1	\N	Todo	recQYa4q7XITVWSIT	d6c16968bb8eef7d5cb9f3c3902fb20eed32fcad
Actor2	Actor notes 2	\N	In progress	recQx3pvlloMsgm7L	86318d3e52989e5f9444510d37ef5dabfd34ad28
Actor3	Actor notes 3	\N	Done	recRSI64PotYR9Z1R	0d6bb0822c495628ba1d177b33d29e3b8432b38b
Actor2	Actor notes 2	\N	In progress	recS9KDaJX1TkM6gq	4133390311d064fdd5fe804d4ee0ed286fdc64b6
Actor3	Actor notes 3	\N	Done	recSHxVFYgRQNNC8D	6c8b6be653a00ce33d62928577b3f10bb7267384
Actor3	Actor notes 3	\N	Done	recSPhxiW2u3a3ttq	5550907c3ae21e6d64f3321a937d2bbbf7b3cdfb
Actor2	Actor notes 2	\N	In progress	recSPiaENCOQQY0m6	f663601678916339c90c021e956b82ebf110a707
Actor1	Actor notes 1	\N	Todo	recSbLn19Qx3lMwni	d71dd3c8177c05dc389d119c7f30f2160461c3c5
Actor1	Actor notes 1	\N	Todo	recT9ZiEFiG9Z7ua8	8996d22b9e8fd3fbf204bd22ee983d8b0f798318
Actor1	Actor notes 1	\N	Todo	recUECi299uqoK0Zz	801d041657c1bb972eeee47281cebb0b77a0331d
Actor1	Actor notes 1	\N	Todo	recUPTKkNb3LiSVuR	0173b41f1e69de36f32ae3ec4b6321aa435c6e4e
Actor1	Actor notes 1	\N	Todo	recUsM3jmCQy4hJXQ	385626a1122213ae913c47e2c21adb3ba75265a5
Actor2	Actor notes 2	\N	In progress	recWcY0kwgD1A9pY3	8cecbadcb5adef97991fbb923c5d69cfed990824
Actor3	Actor notes 3	\N	Done	recWdQAq8LMoTYUu9	444bbb5a19f6ea8ad087284e1488dfccec5c076b
Actor2	Actor notes 2	\N	In progress	recWkViRzF3Vr9J5m	ffb440873a8204453408aeb628445921a0c39f82
Actor2	Actor notes 2	\N	In progress	recWnCqL6DwQBGtLh	797cfe0e9b282e58afc724f87579818cfbe3b633
Actor3	Actor notes 3	\N	Done	recWyQV30cBEitbjS	c8ba611666ea8e88f6de4b81b3cb74238c1d71cb
Actor1	Actor notes 1	\N	Todo	recWyzzFcRGXCcSyY	000542675e8fd7cb1926493a2e1aca0e091e2537
Actor1	Actor notes 1	\N	Todo	recX9a4u4mohTxYLR	9529662eb3e150c486a2ee08f97fc2d2b1cbe509
Actor2	Actor notes 2	\N	In progress	recXcDldaYwCEGl2b	b8012790bbff8b4d7916eae1b97ce4ac42b95ef5
Actor2	Actor notes 2	\N	In progress	recXudVaHPdAA7yc7	3c69735bcdc6d2fd8e10745e120b04006e637bca
Actor3	Actor notes 3	\N	Done	recYoEC4c9kUjtfyh	9eda4483eae2ccaccfca8a34cecd06537d731659
Actor3	Actor notes 3	\N	Done	recZ8HtJANS20fPqg	00871b9e689a4af2b7d5aea038c2923c6d680cf6
Actor2	Actor notes 2	\N	In progress	recZGBOu8Zz56WkIw	ea35fdc9213928864f4d280b2fda257296056f28
Actor2	Actor notes 2	\N	In progress	recZXsFDWO9bF9M4Y	ebb40e01b970126ce6e4ede61519b3de62552efe
Actor2	Actor notes 2	\N	In progress	recZivinZmr88QP7E	2625bf1a077b88100fee09e5ad4a033a5483af95
Actor3	Actor notes 3	\N	Done	reca4j92PDccvFa3d	9436aa84e01f2a6791645de34dca33d329e4d59f
Actor1	Actor notes 1	\N	Todo	reca9StujGi0tq48Q	59056a186e2d4bd458b52c0f84ed6ab8e2b90b1a
Actor1	Actor notes 1	\N	Todo	recaGNVrylKrsffqb	d81cd9de6b03749c53caeec4e5c744f6044807df
Actor2	Actor notes 2	\N	In progress	recaYgxn0yRHtntmz	fd1daf59072ad952c35f7d99114b069551c9df65
Actor2	Actor notes 2	\N	In progress	recan3MvhgoEUXzy8	40b9a4f34a80ccc2da7412b0efd0e7a17728833a
Actor3	Actor notes 3	\N	Done	recb93c35fh70MBJw	24efb2d9fa05d7f0a76e19ebe35ff60f6facc80e
Actor2	Actor notes 2	\N	In progress	recbFS86I0RGUVZue	ba28f96906b5fa8f8573d8a5fa442d23788b2442
Actor1	Actor notes 1	\N	Todo	recbc04ZlvL1HAdAC	d04b4480a574daba1be27595df7ce2bb6ab6900c
Actor1	Actor notes 1	\N	Todo	recbcPHkstaDfQGXM	85f056b889108db5599fdce1a7bd87786330ac71
Actor2	Actor notes 2	\N	In progress	recbmSsPcZQsjcNfl	1ff46b705c8fd26cea0388e848a80efc1df29b77
Actor1	Actor notes 1	\N	Todo	recbqXXj7FkoEtMq1	69b87453f1e53a813015a671f88696855d7f7d8a
Actor1	Actor notes 1	\N	Todo	reccBNoimgzxU5BMp	9eb4f0e6921a39f88c7be8b276558b16b3b7b536
Actor3	Actor notes 3	\N	Done	recdGwEzLXf74Ow8f	c25af565b642f65279f3c014a4410ecee9f1aa16
Actor3	Actor notes 3	\N	Done	rece7uNeWPW2xbhSO	ba98c5a19ef65da57b5fc13c7c56db9d99ff2334
Actor1	Actor notes 1	\N	Todo	receD9xa1dVv5BcDQ	b1eb95c7746ec42aeebb0977af85f14e3d07d175
Actor1	Actor notes 1	\N	Todo	receSHjagBxYQovYI	3f4606c99c312fa85d23bbd45ae33af5f5131e20
Actor1	Actor notes 1	\N	Todo	recfAHXC33ItgftrL	e315472c67c993e4046d1c9ff04c7e3ac6607611
Actor1	Actor notes 1	\N	Todo	recfzdCeC2VlNh52u	067f3e95be61be4ad4fa5dbf4c4b518bcfbfc5f0
Actor1	Actor notes 1	\N	Todo	recgbtBaHkGDi4bQf	262fd820597e15836864a2ad919f1b59c9bfabd0
Actor2	Actor notes 2	\N	In progress	rechKDdlD52WiD7NK	b742f285137fcacf2c6c2fb582edc3297a49c6fa
Actor3	Actor notes 3	\N	Done	rechbcF8A0tzQa586	090ae5bba3144bcb8cfceb1be6ada0aa051183c8
Actor3	Actor notes 3	\N	Done	rechmjOCelOZxbmBa	c8057b7a0c2cd37e771e92ba1258ab19cdc44c11
Actor2	Actor notes 2	\N	In progress	rechp0RG7K6hewA1M	41f00dfc6e7b1f94d7f29d89d1f37e070ea07a97
Actor3	Actor notes 3	\N	Done	reciK4etiDU9J0UOx	b0c7e938e8997f6792465f6545c2bcb8a1680881
Actor2	Actor notes 2	\N	In progress	reciOPJPGCJ5MxtfZ	d4e5751ef9fe546c94d812a6644f1a02c6051d29
Actor2	Actor notes 2	\N	In progress	recicPEOZLwBH8v5U	7a749de9e3496567d1e86ea51769e6914819a40d
Actor1	Actor notes 1	\N	Todo	recikRIhnQY1yaPcm	0d9d61437bbe91bd49498d4ea84395e52222caef
Actor3	Actor notes 3	\N	Done	recimhgHAFy7JLLp7	374b05f13280d9b6e6f5335ccf3fe09562785d84
Actor1	Actor notes 1	\N	Todo	recir7x2WnraYjfnG	b6cecfc3c938b1525a26cdfc8ede58da8de3ba3b
Actor2	Actor notes 2	\N	In progress	recj7StYCiuEnegHE	f42a895be8b865b8a6a6593ac27a044feb1b9f2b
Actor3	Actor notes 3	\N	Done	recjeEEkNsL9f6MMD	da23661a2e1f026c319fd57ad38c4e66128ae6b3
Actor3	Actor notes 3	\N	Done	recjhbevn3JGMfI2r	1d4def7893b31f41426092667dac365080a07cc1
Actor2	Actor notes 2	\N	In progress	recjio09ePRyCB7KN	354d9484ab72063bbf24561cf71e78632f6c43fb
Actor1	Actor notes 1	\N	Todo	recjjiGCVNJAkw9wd	403f867962a05498e29601a47c1973d9b0564f02
Actor1	Actor notes 1	\N	Todo	reckn0Pqft1m6j82h	aa1f53206218872e6b7f2881035d60938c8a61c0
Actor2	Actor notes 2	\N	In progress	reckvinBkqakWxGb1	1d97f3572fac9bb47fa76dab371d4fa00245f460
Actor1	Actor notes 1	\N	Todo	reclss5s1jQ40XVKk	ae36ad2fecc654070424ae92d639aa2aef5f4359
Actor3	Actor notes 3	\N	Done	reclvjByuuqrNdfGh	8056375d11076fb1176fdfddc4a73689a03dd7a0
Actor2	Actor notes 2	\N	In progress	reclzPtDX6s7zo4vM	e32ef2917df59069f95b4de8481252fa65bad7ab
Actor1	Actor notes 1	\N	Todo	recmWFFXkDP69clX0	ee5a57e2eb6c786b9156c6a86655c8ceb76fdd02
Actor3	Actor notes 3	\N	Done	recn5BqtUsXeFC2Mu	8f76e2ae38ec3be06fad721a00014c9d4ccf0e3f
Actor1	Actor notes 1	\N	Todo	recnMjD7cSuhoAPUC	7fad1f7fdfce028668ea2c26a25e3a50ca868e3a
Actor1	Actor notes 1	\N	Todo	recndbLBIOryTTdCZ	49b5f94fdc25e6fce8c6782161522ab56e1a25f7
Actor1	Actor notes 1	\N	Todo	recnvEu1dZcDEsVKB	9cd646a1fb7858a6ba5dc3af1a03c852590ba9b5
Actor2	Actor notes 2	\N	In progress	recoOVjRguYLbXZ1v	1cab16d7071432d9ae2c1e67ef2c47fcf85b008b
Actor2	Actor notes 2	\N	In progress	recozu4rnA68IjD0C	2f9ce260e07fa9875816e4e946b56c5a254596dc
Actor3	Actor notes 3	\N	Done	recpMXkMYXYJnso57	ce00d1632867e3ed6b8962fec5e7998ed0e6b1a2
Actor2	Actor notes 2	\N	In progress	recpZV0AkuEzIvSLO	21450d9a00c5a76a2b26577ae8644aeb80c6e889
Actor2	Actor notes 2	\N	In progress	recpzXPCWJ6UVY1nw	4cc87d312634e435df6b8a4447db73923455c456
Actor3	Actor notes 3	\N	Done	recq3EYAwBxE0hfBk	a9884fb0843e61e4fd150e378f0a94b1db596470
Actor2	Actor notes 2	\N	In progress	recqSX39ycFt5cbit	810a535e5aba4c8c17c114206c4f376dcf03933f
Actor1	Actor notes 1	\N	Todo	recqaG9faPOCSAQZP	c8d8e40b7c61962f2eedfb52f5f2ac6f66788dba
Actor2	Actor notes 2	\N	In progress	recr4e6NJe2H6QOti	f1e3cf7200af94d6910e636bd24a0c955dd3ca61
Actor1	Actor notes 1	\N	Todo	recrG4A7Saf74DYLq	f074887dfcf130d5669791e2a5247768a41ecad3
Actor1	Actor notes 1	\N	Todo	recrHsizoUnUaqQH9	1708be8fc90b69d650b1dc46f56eced962721124
Actor1	Actor notes 1	\N	Todo	recrUlQn7h6awkiMh	d87fcae7ffd8a31e75e8c52ac0cc21df5e889c74
Actor3	Actor notes 3	\N	Done	recrZVyF0LSasmjxA	f21d096d65ef3a610cc167a965bf311f541e1d3a
Actor3	Actor notes 3	\N	Done	recrsbYvD0QEaxLSn	4fc12f532f235f9c62aabac5b5f73c37c02d9c76
Actor2	Actor notes 2	\N	In progress	recsF28VvaV0LJoJ7	71559c328d8fb4f0dd6830f4a7937cb3986b283c
Actor3	Actor notes 3	\N	Done	recsfO9R7mIhCQCTT	360a31ed08adea1b5fdf55b6be7325b22dde6f0b
Actor3	Actor notes 3	\N	Done	recsp4bBpryR5mo3a	ee525da5969b6aeb3f1c254064c4fb1145871268
Actor1	Actor notes 1	\N	Todo	rectGhRfa80hvIwMX	882ab92eb70f9556d8d81fccb4a08b06d3796605
Actor2	Actor notes 2	\N	In progress	rectZsMm3HDl3xzay	4f013e27265e7a7880721005adc78d73f2761355
Actor3	Actor notes 3	\N	Done	recvN8nBybJ7T53mI	27b7fc2fc1881f106c026da0ab7bf8ee08125adb
Actor1	Actor notes 1	\N	Todo	recvVDqzflqs1D877	5464eef4e79e57479e68020f939806c049d25016
Actor2	Actor notes 2	\N	In progress	recvhfGjuAZJd3T8N	ae852f40a44af9542b8ea70e19811718fe0cbcfd
Actor2	Actor notes 2	\N	In progress	recvpeQ9dN4MsllMP	7d935b964decf6f24aa0c77da9624e49e1dc678f
Actor1	Actor notes 1	\N	Todo	recw76j0sxOeMdlzw	decd4583a545ce2ad9984a0fe8e1614f13ab3ccb
Actor3	Actor notes 3	\N	Done	recw92Q2wm4jcjaeU	7bf80bfb3acadad04632d660a26676bdb4e6d7b4
Actor3	Actor notes 3	\N	Done	recxb3F5weFRUGfLN	dfec1b52065657193911aa3218ddf200608c8951
Actor2	Actor notes 2	\N	In progress	recxvxbuW60sljjYs	b1d2dd82b4766221b724a7945605e714acd883f3
Actor2	Actor notes 2	\N	In progress	recyLD3N4GWjrCE66	d15b32c94b5d249c94feab53d20bac4be275559d
Actor1	Actor notes 1	\N	Todo	recySw7jDQymHVrHb	45da7c3bfc42a9de2b295ec6680ae8e7ecde00b9
Actor1	Actor notes 1	\N	Todo	recyW7mXxCyYF8PlO	d270d37ff43631f69fc1387cf1f8f91976745fff
Actor1	Actor notes 1	\N	Todo	recyYBlsEY2RKbI9y	d7831472963f4fe47de95e02cdb13f150cfd508a
Actor3	Actor notes 3	\N	Done	recyehnr9372Y3ZS2	97a0693d66b294b7090d89e4bf19faece3008a43
Actor2	Actor notes 2	\N	In progress	reczSGYrzGziNwNnI	938586ff04b462290f18550d15788ef5dde0f7c7
Actor3	Actor notes 3	\N	Done	reczUvQqDCSFTiPGi	6a149e24a7081288e909c5972accc31339d8ca28
Actor3	Actor notes 3	\N	Done	reczcAe4o99yVsr6Y	956a8a0acd8e21fe5580164f4bfe96e5553b57d4
\.


--
-- Data for Name: nc_hblt___Film; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."nc_hblt___Film" ("Name", "Notes", "Attachments", "Status", "Done", "Tags", "Date", "Phone", "Email", "URL", "Number", "Value", "Percent", "Duration", "Rating", "ncRecordId", "ncRecordHash") FROM stdin;
Movie-1	Good	\N	Todo	t	Jan	2022-05-31	123123123	a@b.com	www.a.com	1	1.00	0.0100000000000000002	60	1	recVZbncEgT9VOzxR	040f240b631f9a0ac489fc879403c8b3e6d39a4c
Movie-3	Ugly	\N	Done	t	Apr,May,Jun	2022-06-02	456456456	c@b.com	www.c.com	3	3.00	0.0299999999999999989	180	3	recnrlGC3AHbYQRh8	44e83c594d7f2ad6244e3b5b3722cf4bc72c5743
Movie-2	Bad	\N	In progress	\N	Feb,Mar	2022-06-01	234234234	b@b.com	www.b.com	2	2.00	0.0200000000000000004	120	2	recxxtP9pVtsCoGzo	8750d52276273d72d6ba09c88c1c687c3ea07ef3
\.


--
-- Data for Name: nc_hblt___Producer; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."nc_hblt___Producer" ("Name", "Notes", "Attachments", "Status", "ncRecordId", "ncRecordHash", "nc_hblt___Film_id") FROM stdin;
P1	Notes of P1	\N	Todo	recQI4iMKMH2yLG0g	5b416c9c1b9469ae47ac75895a67bf53b9fdc924	recVZbncEgT9VOzxR
P3	Notes of P3	\N	Done	recU3dmwXgYNNyiyx	c46146d9e5124d1a769409469b009d9063e6fc71	recnrlGC3AHbYQRh8
P2	Notes of P2	\N	In progress	recur5QvQMadDopIk	e4e5ba3c7e106d3b503ded219aaddfab03a9e554	recVZbncEgT9VOzxR
\.


--
-- Data for Name: nc_hblt___nc_m2m__9oevq0x2z; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_hblt___nc_m2m__9oevq0x2z (table2_id, table1_id) FROM stdin;
rec4uWuyNJpCy95FU	recVZbncEgT9VOzxR
recqSX39ycFt5cbit	recVZbncEgT9VOzxR
recnvEu1dZcDEsVKB	recVZbncEgT9VOzxR
recD8sJe7mGqfWAIy	recVZbncEgT9VOzxR
recir7x2WnraYjfnG	recVZbncEgT9VOzxR
recEn3Jt0Q3jUkrnA	recVZbncEgT9VOzxR
rec2ITS9u00D1ElOe	recVZbncEgT9VOzxR
recWkViRzF3Vr9J5m	recVZbncEgT9VOzxR
recmWFFXkDP69clX0	recVZbncEgT9VOzxR
reciOPJPGCJ5MxtfZ	recVZbncEgT9VOzxR
recbcPHkstaDfQGXM	recVZbncEgT9VOzxR
rec39XBA2rhY86qEV	recVZbncEgT9VOzxR
rec5i2JENrmFxXTyi	recVZbncEgT9VOzxR
recZXsFDWO9bF9M4Y	recVZbncEgT9VOzxR
recbqXXj7FkoEtMq1	recVZbncEgT9VOzxR
rec4cOht1jqTABdYJ	recVZbncEgT9VOzxR
rectGhRfa80hvIwMX	recVZbncEgT9VOzxR
rec8GtDGX0r0aSUmZ	recVZbncEgT9VOzxR
recWyzzFcRGXCcSyY	recVZbncEgT9VOzxR
recQx3pvlloMsgm7L	recVZbncEgT9VOzxR
recfAHXC33ItgftrL	recVZbncEgT9VOzxR
recJcm8KkP9vkWi3I	recVZbncEgT9VOzxR
recgbtBaHkGDi4bQf	recVZbncEgT9VOzxR
recKFJhZ9ODiymkuR	recVZbncEgT9VOzxR
recX9a4u4mohTxYLR	recVZbncEgT9VOzxR
recvpeQ9dN4MsllMP	recVZbncEgT9VOzxR
recCRzc9ECwbehYvX	recVZbncEgT9VOzxR
recr4e6NJe2H6QOti	recVZbncEgT9VOzxR
recOjAGiJssXRCa30	recVZbncEgT9VOzxR
recsF28VvaV0LJoJ7	recVZbncEgT9VOzxR
recySw7jDQymHVrHb	recVZbncEgT9VOzxR
recAUh1LXvf9YBKT8	recVZbncEgT9VOzxR
recHYPx1nffn7ixpu	recVZbncEgT9VOzxR
reckvinBkqakWxGb1	recVZbncEgT9VOzxR
recrG4A7Saf74DYLq	recVZbncEgT9VOzxR
recozu4rnA68IjD0C	recVZbncEgT9VOzxR
recUPTKkNb3LiSVuR	recVZbncEgT9VOzxR
recEAH1Tt9UmzEn4g	recVZbncEgT9VOzxR
recUsM3jmCQy4hJXQ	recVZbncEgT9VOzxR
rechp0RG7K6hewA1M	recVZbncEgT9VOzxR
recnMjD7cSuhoAPUC	recVZbncEgT9VOzxR
recj7StYCiuEnegHE	recVZbncEgT9VOzxR
recJP30B8nKbRkIt1	recVZbncEgT9VOzxR
recxvxbuW60sljjYs	recVZbncEgT9VOzxR
recIulEH9NzmIIxJF	recVZbncEgT9VOzxR
recGFnlB5Gil5Rko7	recVZbncEgT9VOzxR
receD9xa1dVv5BcDQ	recVZbncEgT9VOzxR
recicPEOZLwBH8v5U	recVZbncEgT9VOzxR
recndbLBIOryTTdCZ	recVZbncEgT9VOzxR
recLBrOWsUpp7qvgE	recVZbncEgT9VOzxR
recIDKRGK5eUjvPJ5	recVZbncEgT9VOzxR
recaYgxn0yRHtntmz	recVZbncEgT9VOzxR
rec6BwSzdAs2NA0mM	recVZbncEgT9VOzxR
recCt3k3j45MNu8jo	recVZbncEgT9VOzxR
recbc04ZlvL1HAdAC	recVZbncEgT9VOzxR
recvhfGjuAZJd3T8N	recVZbncEgT9VOzxR
recaGNVrylKrsffqb	recVZbncEgT9VOzxR
recpZV0AkuEzIvSLO	recVZbncEgT9VOzxR
reclss5s1jQ40XVKk	recVZbncEgT9VOzxR
recpzXPCWJ6UVY1nw	recVZbncEgT9VOzxR
recrHsizoUnUaqQH9	recVZbncEgT9VOzxR
recHfp3CsU6nD0aZB	recVZbncEgT9VOzxR
rec9J0VShrSuDvMxW	recVZbncEgT9VOzxR
recoOVjRguYLbXZ1v	recVZbncEgT9VOzxR
reca9StujGi0tq48Q	recVZbncEgT9VOzxR
rechKDdlD52WiD7NK	recVZbncEgT9VOzxR
rec46CYu3d27LO97h	recVZbncEgT9VOzxR
recXcDldaYwCEGl2b	recVZbncEgT9VOzxR
recvVDqzflqs1D877	recVZbncEgT9VOzxR
recZivinZmr88QP7E	recVZbncEgT9VOzxR
recUECi299uqoK0Zz	recVZbncEgT9VOzxR
recPyraZijpepka2B	recVZbncEgT9VOzxR
rec2bJf0FfXrXxb1o	recVZbncEgT9VOzxR
recAGJ1QI0dmDGjSE	recVZbncEgT9VOzxR
recJYqnnmSykWqStj	recVZbncEgT9VOzxR
recyLD3N4GWjrCE66	recVZbncEgT9VOzxR
recT9ZiEFiG9Z7ua8	recVZbncEgT9VOzxR
rec3111PeL24b09un	recVZbncEgT9VOzxR
rec0ZeKT9G0JoSoPc	recVZbncEgT9VOzxR
recbmSsPcZQsjcNfl	recVZbncEgT9VOzxR
recK6mxq2iZr3RXSq	recVZbncEgT9VOzxR
recPtflCrx455S5KC	recVZbncEgT9VOzxR
recErHa5t2ObPb7WG	recVZbncEgT9VOzxR
rec7u1bgQ7deGqDBJ	recVZbncEgT9VOzxR
recjjiGCVNJAkw9wd	recVZbncEgT9VOzxR
recCnI7OZM6WQd055	recVZbncEgT9VOzxR
recKljYPAGWceTBNH	recVZbncEgT9VOzxR
recWcY0kwgD1A9pY3	recVZbncEgT9VOzxR
rec5yvzC9lLtw0KJX	recVZbncEgT9VOzxR
recDeTFYDBvc2Z7uA	recVZbncEgT9VOzxR
recSbLn19Qx3lMwni	recVZbncEgT9VOzxR
recjio09ePRyCB7KN	recVZbncEgT9VOzxR
reccBNoimgzxU5BMp	recVZbncEgT9VOzxR
recSPiaENCOQQY0m6	recVZbncEgT9VOzxR
recyW7mXxCyYF8PlO	recVZbncEgT9VOzxR
recICTNunnjH1nGhQ	recVZbncEgT9VOzxR
recPGC8odDltpgn0K	recVZbncEgT9VOzxR
recS9KDaJX1TkM6gq	recVZbncEgT9VOzxR
receSHjagBxYQovYI	recVZbncEgT9VOzxR
recC5DAUejwpPydmg	recVZbncEgT9VOzxR
recqaG9faPOCSAQZP	recVZbncEgT9VOzxR
rec0uSfHFyj6vrEL5	recVZbncEgT9VOzxR
recQYa4q7XITVWSIT	recVZbncEgT9VOzxR
recXudVaHPdAA7yc7	recVZbncEgT9VOzxR
rec1D7aLIRKRzyPoB	recVZbncEgT9VOzxR
rec64hkgWxUM9PkAA	recVZbncEgT9VOzxR
reckn0Pqft1m6j82h	recVZbncEgT9VOzxR
reclzPtDX6s7zo4vM	recVZbncEgT9VOzxR
recFgM5lSLMJ3TeQJ	recVZbncEgT9VOzxR
reczSGYrzGziNwNnI	recVZbncEgT9VOzxR
recCnUhOCubTxxqN3	recVZbncEgT9VOzxR
rec56o1YrJM3J0DBy	recVZbncEgT9VOzxR
rec0V0zxSBZ0MseyB	recVZbncEgT9VOzxR
recWnCqL6DwQBGtLh	recVZbncEgT9VOzxR
recikRIhnQY1yaPcm	recVZbncEgT9VOzxR
rec8HHJRlguTmyZmr	recVZbncEgT9VOzxR
recfzdCeC2VlNh52u	recVZbncEgT9VOzxR
recCNh8VtGFBgvaRz	recVZbncEgT9VOzxR
recNJ4JrkGtqZOhAv	recVZbncEgT9VOzxR
recan3MvhgoEUXzy8	recVZbncEgT9VOzxR
recrUlQn7h6awkiMh	recVZbncEgT9VOzxR
rec5dpMRWMCOpLAMi	recVZbncEgT9VOzxR
recyYBlsEY2RKbI9y	recVZbncEgT9VOzxR
recZGBOu8Zz56WkIw	recVZbncEgT9VOzxR
recw76j0sxOeMdlzw	recVZbncEgT9VOzxR
rectZsMm3HDl3xzay	recVZbncEgT9VOzxR
recArWjtWwaH4TqHT	recVZbncEgT9VOzxR
recbFS86I0RGUVZue	recVZbncEgT9VOzxR
recAz1AskwK05sL3O	recnrlGC3AHbYQRh8
rec4uWuyNJpCy95FU	recnrlGC3AHbYQRh8
recnvEu1dZcDEsVKB	recnrlGC3AHbYQRh8
reca4j92PDccvFa3d	recnrlGC3AHbYQRh8
recir7x2WnraYjfnG	recnrlGC3AHbYQRh8
rec4RFUjLxRxCH81i	recnrlGC3AHbYQRh8
rec2ITS9u00D1ElOe	recnrlGC3AHbYQRh8
recq3EYAwBxE0hfBk	recnrlGC3AHbYQRh8
recmWFFXkDP69clX0	recnrlGC3AHbYQRh8
recCTKCKBT1qeibP1	recnrlGC3AHbYQRh8
recbcPHkstaDfQGXM	recnrlGC3AHbYQRh8
recrsbYvD0QEaxLSn	recnrlGC3AHbYQRh8
rec5i2JENrmFxXTyi	recnrlGC3AHbYQRh8
recOW86Ggx66FXwjB	recnrlGC3AHbYQRh8
recbqXXj7FkoEtMq1	recnrlGC3AHbYQRh8
recYoEC4c9kUjtfyh	recnrlGC3AHbYQRh8
rectGhRfa80hvIwMX	recnrlGC3AHbYQRh8
recNTncuKqBYo7LrU	recnrlGC3AHbYQRh8
recWyzzFcRGXCcSyY	recnrlGC3AHbYQRh8
rechmjOCelOZxbmBa	recnrlGC3AHbYQRh8
recfAHXC33ItgftrL	recnrlGC3AHbYQRh8
recNPYtn6vUiM6okR	recnrlGC3AHbYQRh8
recgbtBaHkGDi4bQf	recnrlGC3AHbYQRh8
recCt4jqAZvzphPoY	recnrlGC3AHbYQRh8
recX9a4u4mohTxYLR	recnrlGC3AHbYQRh8
reclvjByuuqrNdfGh	recnrlGC3AHbYQRh8
recCRzc9ECwbehYvX	recnrlGC3AHbYQRh8
recG57T4qX2yQjeZ3	recnrlGC3AHbYQRh8
recOjAGiJssXRCa30	recnrlGC3AHbYQRh8
rechbcF8A0tzQa586	recnrlGC3AHbYQRh8
recySw7jDQymHVrHb	recnrlGC3AHbYQRh8
recdGwEzLXf74Ow8f	recnrlGC3AHbYQRh8
recHYPx1nffn7ixpu	recnrlGC3AHbYQRh8
recRSI64PotYR9Z1R	recnrlGC3AHbYQRh8
recrG4A7Saf74DYLq	recnrlGC3AHbYQRh8
reczcAe4o99yVsr6Y	recnrlGC3AHbYQRh8
recUPTKkNb3LiSVuR	recnrlGC3AHbYQRh8
recOJsmmUudeE29Ue	recnrlGC3AHbYQRh8
recUsM3jmCQy4hJXQ	recnrlGC3AHbYQRh8
recERARHbh0c9Ky1K	recnrlGC3AHbYQRh8
recnMjD7cSuhoAPUC	recnrlGC3AHbYQRh8
reciK4etiDU9J0UOx	recnrlGC3AHbYQRh8
recJP30B8nKbRkIt1	recnrlGC3AHbYQRh8
recZ8HtJANS20fPqg	recnrlGC3AHbYQRh8
recIulEH9NzmIIxJF	recnrlGC3AHbYQRh8
rec0FvoEXWLmQUFAw	recnrlGC3AHbYQRh8
receD9xa1dVv5BcDQ	recnrlGC3AHbYQRh8
recSHxVFYgRQNNC8D	recnrlGC3AHbYQRh8
recndbLBIOryTTdCZ	recnrlGC3AHbYQRh8
rec3fFOH2yOHyVHpy	recnrlGC3AHbYQRh8
recIDKRGK5eUjvPJ5	recnrlGC3AHbYQRh8
recjhbevn3JGMfI2r	recnrlGC3AHbYQRh8
rec6BwSzdAs2NA0mM	recnrlGC3AHbYQRh8
recCQozCSDbuWDBtS	recnrlGC3AHbYQRh8
recbc04ZlvL1HAdAC	recnrlGC3AHbYQRh8
rec9ZogzXciL93exN	recnrlGC3AHbYQRh8
recaGNVrylKrsffqb	recnrlGC3AHbYQRh8
recINXG0bzWvS2OoD	recnrlGC3AHbYQRh8
reclss5s1jQ40XVKk	recnrlGC3AHbYQRh8
recWdQAq8LMoTYUu9	recnrlGC3AHbYQRh8
recrHsizoUnUaqQH9	recnrlGC3AHbYQRh8
recb93c35fh70MBJw	recnrlGC3AHbYQRh8
rec9J0VShrSuDvMxW	recnrlGC3AHbYQRh8
rec3Gz7qVmxyg5QZB	recnrlGC3AHbYQRh8
reca9StujGi0tq48Q	recnrlGC3AHbYQRh8
recJhuHnRcZZG5fEZ	recnrlGC3AHbYQRh8
rec46CYu3d27LO97h	recnrlGC3AHbYQRh8
recvN8nBybJ7T53mI	recnrlGC3AHbYQRh8
recvVDqzflqs1D877	recnrlGC3AHbYQRh8
recsfO9R7mIhCQCTT	recnrlGC3AHbYQRh8
recUECi299uqoK0Zz	recnrlGC3AHbYQRh8
recxb3F5weFRUGfLN	recnrlGC3AHbYQRh8
rec2bJf0FfXrXxb1o	recnrlGC3AHbYQRh8
recCIOJeHew0T6Iy9	recnrlGC3AHbYQRh8
recJYqnnmSykWqStj	recnrlGC3AHbYQRh8
recn5BqtUsXeFC2Mu	recnrlGC3AHbYQRh8
recT9ZiEFiG9Z7ua8	recnrlGC3AHbYQRh8
rec6YDus4TCCdIhtP	recnrlGC3AHbYQRh8
rec0ZeKT9G0JoSoPc	recnrlGC3AHbYQRh8
recLDPN7Vgngo2dTh	recnrlGC3AHbYQRh8
recK6mxq2iZr3RXSq	recnrlGC3AHbYQRh8
recjeEEkNsL9f6MMD	recnrlGC3AHbYQRh8
recErHa5t2ObPb7WG	recnrlGC3AHbYQRh8
rec8kCifIZcU2GCPq	recnrlGC3AHbYQRh8
recjjiGCVNJAkw9wd	recnrlGC3AHbYQRh8
recQISAKx6ORHIMQI	recnrlGC3AHbYQRh8
recKljYPAGWceTBNH	recnrlGC3AHbYQRh8
rec4W05E1cVl4ZFr9	recnrlGC3AHbYQRh8
rec5yvzC9lLtw0KJX	recnrlGC3AHbYQRh8
recpMXkMYXYJnso57	recnrlGC3AHbYQRh8
recSbLn19Qx3lMwni	recnrlGC3AHbYQRh8
recSPhxiW2u3a3ttq	recnrlGC3AHbYQRh8
reccBNoimgzxU5BMp	recnrlGC3AHbYQRh8
recBDYZwxZuHlba8N	recnrlGC3AHbYQRh8
recyW7mXxCyYF8PlO	recnrlGC3AHbYQRh8
recw92Q2wm4jcjaeU	recnrlGC3AHbYQRh8
recPGC8odDltpgn0K	recnrlGC3AHbYQRh8
recQP6oFkH9QgcYas	recnrlGC3AHbYQRh8
receSHjagBxYQovYI	recnrlGC3AHbYQRh8
recCr0Ffe1MeHNneQ	recnrlGC3AHbYQRh8
recqaG9faPOCSAQZP	recnrlGC3AHbYQRh8
recyehnr9372Y3ZS2	recnrlGC3AHbYQRh8
recQYa4q7XITVWSIT	recnrlGC3AHbYQRh8
recLFWbi4c8yTLx80	recnrlGC3AHbYQRh8
rec1D7aLIRKRzyPoB	recnrlGC3AHbYQRh8
recrZVyF0LSasmjxA	recnrlGC3AHbYQRh8
reckn0Pqft1m6j82h	recnrlGC3AHbYQRh8
recIk7tXHdmSDNG6Z	recnrlGC3AHbYQRh8
recFgM5lSLMJ3TeQJ	recnrlGC3AHbYQRh8
recOLB1WhYHqK74SS	recnrlGC3AHbYQRh8
recCnUhOCubTxxqN3	recnrlGC3AHbYQRh8
recKZL5MowA1NsVvn	recnrlGC3AHbYQRh8
rec0V0zxSBZ0MseyB	recnrlGC3AHbYQRh8
rec4yoBrJZstoKQU2	recnrlGC3AHbYQRh8
recikRIhnQY1yaPcm	recnrlGC3AHbYQRh8
rec96jCh0XHHKgBC2	recnrlGC3AHbYQRh8
recfzdCeC2VlNh52u	recnrlGC3AHbYQRh8
recWyQV30cBEitbjS	recnrlGC3AHbYQRh8
recNJ4JrkGtqZOhAv	recnrlGC3AHbYQRh8
recimhgHAFy7JLLp7	recnrlGC3AHbYQRh8
recrUlQn7h6awkiMh	recnrlGC3AHbYQRh8
rece7uNeWPW2xbhSO	recnrlGC3AHbYQRh8
recyYBlsEY2RKbI9y	recnrlGC3AHbYQRh8
recsp4bBpryR5mo3a	recnrlGC3AHbYQRh8
recw76j0sxOeMdlzw	recnrlGC3AHbYQRh8
reczUvQqDCSFTiPGi	recnrlGC3AHbYQRh8
recArWjtWwaH4TqHT	recnrlGC3AHbYQRh8
rec49QGAIoBcKGnYR	recnrlGC3AHbYQRh8
recqSX39ycFt5cbit	recxxtP9pVtsCoGzo
recAz1AskwK05sL3O	recxxtP9pVtsCoGzo
recD8sJe7mGqfWAIy	recxxtP9pVtsCoGzo
reca4j92PDccvFa3d	recxxtP9pVtsCoGzo
recEn3Jt0Q3jUkrnA	recxxtP9pVtsCoGzo
rec4RFUjLxRxCH81i	recxxtP9pVtsCoGzo
recWkViRzF3Vr9J5m	recxxtP9pVtsCoGzo
recq3EYAwBxE0hfBk	recxxtP9pVtsCoGzo
reciOPJPGCJ5MxtfZ	recxxtP9pVtsCoGzo
recCTKCKBT1qeibP1	recxxtP9pVtsCoGzo
rec39XBA2rhY86qEV	recxxtP9pVtsCoGzo
recrsbYvD0QEaxLSn	recxxtP9pVtsCoGzo
recZXsFDWO9bF9M4Y	recxxtP9pVtsCoGzo
recOW86Ggx66FXwjB	recxxtP9pVtsCoGzo
rec4cOht1jqTABdYJ	recxxtP9pVtsCoGzo
recYoEC4c9kUjtfyh	recxxtP9pVtsCoGzo
rec8GtDGX0r0aSUmZ	recxxtP9pVtsCoGzo
recNTncuKqBYo7LrU	recxxtP9pVtsCoGzo
recQx3pvlloMsgm7L	recxxtP9pVtsCoGzo
rechmjOCelOZxbmBa	recxxtP9pVtsCoGzo
recJcm8KkP9vkWi3I	recxxtP9pVtsCoGzo
recNPYtn6vUiM6okR	recxxtP9pVtsCoGzo
recKFJhZ9ODiymkuR	recxxtP9pVtsCoGzo
recCt4jqAZvzphPoY	recxxtP9pVtsCoGzo
recvpeQ9dN4MsllMP	recxxtP9pVtsCoGzo
reclvjByuuqrNdfGh	recxxtP9pVtsCoGzo
recr4e6NJe2H6QOti	recxxtP9pVtsCoGzo
recG57T4qX2yQjeZ3	recxxtP9pVtsCoGzo
recsF28VvaV0LJoJ7	recxxtP9pVtsCoGzo
rechbcF8A0tzQa586	recxxtP9pVtsCoGzo
recAUh1LXvf9YBKT8	recxxtP9pVtsCoGzo
recdGwEzLXf74Ow8f	recxxtP9pVtsCoGzo
reckvinBkqakWxGb1	recxxtP9pVtsCoGzo
recRSI64PotYR9Z1R	recxxtP9pVtsCoGzo
recozu4rnA68IjD0C	recxxtP9pVtsCoGzo
reczcAe4o99yVsr6Y	recxxtP9pVtsCoGzo
recEAH1Tt9UmzEn4g	recxxtP9pVtsCoGzo
recOJsmmUudeE29Ue	recxxtP9pVtsCoGzo
rechp0RG7K6hewA1M	recxxtP9pVtsCoGzo
recERARHbh0c9Ky1K	recxxtP9pVtsCoGzo
recj7StYCiuEnegHE	recxxtP9pVtsCoGzo
reciK4etiDU9J0UOx	recxxtP9pVtsCoGzo
recxvxbuW60sljjYs	recxxtP9pVtsCoGzo
recZ8HtJANS20fPqg	recxxtP9pVtsCoGzo
recGFnlB5Gil5Rko7	recxxtP9pVtsCoGzo
rec0FvoEXWLmQUFAw	recxxtP9pVtsCoGzo
recicPEOZLwBH8v5U	recxxtP9pVtsCoGzo
recSHxVFYgRQNNC8D	recxxtP9pVtsCoGzo
recLBrOWsUpp7qvgE	recxxtP9pVtsCoGzo
rec3fFOH2yOHyVHpy	recxxtP9pVtsCoGzo
recaYgxn0yRHtntmz	recxxtP9pVtsCoGzo
recjhbevn3JGMfI2r	recxxtP9pVtsCoGzo
recCt3k3j45MNu8jo	recxxtP9pVtsCoGzo
recCQozCSDbuWDBtS	recxxtP9pVtsCoGzo
recvhfGjuAZJd3T8N	recxxtP9pVtsCoGzo
rec9ZogzXciL93exN	recxxtP9pVtsCoGzo
recpZV0AkuEzIvSLO	recxxtP9pVtsCoGzo
recINXG0bzWvS2OoD	recxxtP9pVtsCoGzo
recpzXPCWJ6UVY1nw	recxxtP9pVtsCoGzo
recWdQAq8LMoTYUu9	recxxtP9pVtsCoGzo
recHfp3CsU6nD0aZB	recxxtP9pVtsCoGzo
recb93c35fh70MBJw	recxxtP9pVtsCoGzo
recoOVjRguYLbXZ1v	recxxtP9pVtsCoGzo
rec3Gz7qVmxyg5QZB	recxxtP9pVtsCoGzo
rechKDdlD52WiD7NK	recxxtP9pVtsCoGzo
recJhuHnRcZZG5fEZ	recxxtP9pVtsCoGzo
recXcDldaYwCEGl2b	recxxtP9pVtsCoGzo
recvN8nBybJ7T53mI	recxxtP9pVtsCoGzo
recZivinZmr88QP7E	recxxtP9pVtsCoGzo
recsfO9R7mIhCQCTT	recxxtP9pVtsCoGzo
recPyraZijpepka2B	recxxtP9pVtsCoGzo
recxb3F5weFRUGfLN	recxxtP9pVtsCoGzo
recAGJ1QI0dmDGjSE	recxxtP9pVtsCoGzo
recCIOJeHew0T6Iy9	recxxtP9pVtsCoGzo
recyLD3N4GWjrCE66	recxxtP9pVtsCoGzo
recn5BqtUsXeFC2Mu	recxxtP9pVtsCoGzo
rec3111PeL24b09un	recxxtP9pVtsCoGzo
rec6YDus4TCCdIhtP	recxxtP9pVtsCoGzo
recbmSsPcZQsjcNfl	recxxtP9pVtsCoGzo
recLDPN7Vgngo2dTh	recxxtP9pVtsCoGzo
recPtflCrx455S5KC	recxxtP9pVtsCoGzo
recjeEEkNsL9f6MMD	recxxtP9pVtsCoGzo
rec7u1bgQ7deGqDBJ	recxxtP9pVtsCoGzo
rec8kCifIZcU2GCPq	recxxtP9pVtsCoGzo
recCnI7OZM6WQd055	recxxtP9pVtsCoGzo
recQISAKx6ORHIMQI	recxxtP9pVtsCoGzo
recWcY0kwgD1A9pY3	recxxtP9pVtsCoGzo
rec4W05E1cVl4ZFr9	recxxtP9pVtsCoGzo
recDeTFYDBvc2Z7uA	recxxtP9pVtsCoGzo
recpMXkMYXYJnso57	recxxtP9pVtsCoGzo
recjio09ePRyCB7KN	recxxtP9pVtsCoGzo
recSPhxiW2u3a3ttq	recxxtP9pVtsCoGzo
recSPiaENCOQQY0m6	recxxtP9pVtsCoGzo
recBDYZwxZuHlba8N	recxxtP9pVtsCoGzo
recICTNunnjH1nGhQ	recxxtP9pVtsCoGzo
recw92Q2wm4jcjaeU	recxxtP9pVtsCoGzo
recS9KDaJX1TkM6gq	recxxtP9pVtsCoGzo
recQP6oFkH9QgcYas	recxxtP9pVtsCoGzo
recC5DAUejwpPydmg	recxxtP9pVtsCoGzo
recCr0Ffe1MeHNneQ	recxxtP9pVtsCoGzo
rec0uSfHFyj6vrEL5	recxxtP9pVtsCoGzo
recyehnr9372Y3ZS2	recxxtP9pVtsCoGzo
recXudVaHPdAA7yc7	recxxtP9pVtsCoGzo
recLFWbi4c8yTLx80	recxxtP9pVtsCoGzo
rec64hkgWxUM9PkAA	recxxtP9pVtsCoGzo
recrZVyF0LSasmjxA	recxxtP9pVtsCoGzo
reclzPtDX6s7zo4vM	recxxtP9pVtsCoGzo
recIk7tXHdmSDNG6Z	recxxtP9pVtsCoGzo
reczSGYrzGziNwNnI	recxxtP9pVtsCoGzo
recOLB1WhYHqK74SS	recxxtP9pVtsCoGzo
rec56o1YrJM3J0DBy	recxxtP9pVtsCoGzo
recKZL5MowA1NsVvn	recxxtP9pVtsCoGzo
recWnCqL6DwQBGtLh	recxxtP9pVtsCoGzo
rec4yoBrJZstoKQU2	recxxtP9pVtsCoGzo
rec8HHJRlguTmyZmr	recxxtP9pVtsCoGzo
rec96jCh0XHHKgBC2	recxxtP9pVtsCoGzo
recCNh8VtGFBgvaRz	recxxtP9pVtsCoGzo
recWyQV30cBEitbjS	recxxtP9pVtsCoGzo
recan3MvhgoEUXzy8	recxxtP9pVtsCoGzo
recimhgHAFy7JLLp7	recxxtP9pVtsCoGzo
rec5dpMRWMCOpLAMi	recxxtP9pVtsCoGzo
rece7uNeWPW2xbhSO	recxxtP9pVtsCoGzo
recZGBOu8Zz56WkIw	recxxtP9pVtsCoGzo
recsp4bBpryR5mo3a	recxxtP9pVtsCoGzo
rectZsMm3HDl3xzay	recxxtP9pVtsCoGzo
reczUvQqDCSFTiPGi	recxxtP9pVtsCoGzo
recbFS86I0RGUVZue	recxxtP9pVtsCoGzo
rec49QGAIoBcKGnYR	recxxtP9pVtsCoGzo
\.


--
-- Data for Name: nc_hook_logs_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_hook_logs_v2 (id, base_id, project_id, fk_hook_id, type, event, operation, test_call, payload, conditions, notification, error_code, error_message, error, execution_time, response, triggered_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_hooks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_hooks (id, project_id, db_alias, title, description, env, tn, type, event, operation, async, payload, url, headers, condition, notification, retries, retry_interval, timeout, active, created_at, updated_at) FROM stdin;
1	\N	db	\N	\N	all	\N	AUTH_MIDDLEWARE	\N	\N	f	t	\N	\N	\N	\N	0	60000	60000	t	\N	\N
\.


--
-- Name: nc_hooks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_hooks_id_seq', 1, true);


--
-- Data for Name: nc_hooks_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_hooks_v2 (id, base_id, project_id, fk_model_id, title, description, env, type, event, operation, async, payload, url, headers, condition, notification, retries, retry_interval, timeout, active, created_at, updated_at) FROM stdin;
hk_cbdg91nbcvl3yp	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Webhook-1	\N	all	\N	after	insert	f	f	\N	\N	f	{"type":"URL","payload":{"method":"POST","body":"{{ json data }}","path":"http://localhost:9090/hook"}}	0	60000	60000	t	2022-06-13 07:19:02.703457+00	2022-06-13 07:19:02.703457+00
hk_ehmnjeaqlau31j	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Webhook-2	\N	all	\N	after	update	f	f	\N	\N	f	{"type":"URL","payload":{"method":"POST","body":"{{ json data }}","path":"http://localhost:9090/hook"}}	0	60000	60000	t	2022-06-13 07:19:14.716389+00	2022-06-13 07:19:14.716389+00
hk_cr03i3db3y94t9	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Webhook-3	\N	all	\N	after	delete	f	f	\N	\N	f	{"type":"URL","payload":{"method":"POST","body":"{{ json data }}","path":"http://localhost:9090/hook"}}	0	60000	60000	t	2022-06-13 07:19:25.520937+00	2022-06-13 07:19:25.520937+00
\.


--
-- Data for Name: nc_kanban_view_columns_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_kanban_view_columns_v2 (id, base_id, project_id, fk_view_id, fk_column_id, uuid, label, help, show, "order", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_kanban_view_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_kanban_view_v2 (fk_view_id, base_id, project_id, show, "order", uuid, title, public, password, show_all_fields, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_loaders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_loaders (id, project_id, db_alias, title, parent, child, relation, resolver, functions, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_loaders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_loaders_id_seq', 1, false);


--
-- Data for Name: nc_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_migrations (id, project_id, db_alias, up, down, title, title_down, description, batch, checksum, status, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_migrations_id_seq', 1, false);


--
-- Data for Name: nc_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_models (id, project_id, db_alias, title, alias, type, meta, schema, schema_previous, services, messages, enabled, parent_model_title, show_as, query_params, list_idx, tags, pinned, created_at, updated_at, mm, m_to_m_meta, "order", view_order) FROM stdin;
\.


--
-- Name: nc_models_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_models_id_seq', 1, false);


--
-- Data for Name: nc_models_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_models_v2 (id, base_id, project_id, table_name, title, type, meta, schema, enabled, mm, tags, pinned, deleted, "order", created_at, updated_at) FROM stdin;
md_w4bsfg7gtmqque	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	nc_hblt___Film	Film	table	\N	\N	t	f	\N	\N	\N	1	2022-06-13 07:00:46.465781+00	2022-06-13 07:00:46.465781+00
md_lh3bakzk8scz7r	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	nc_hblt___Actor	Actor	table	\N	\N	t	f	\N	\N	\N	2	2022-06-13 07:00:46.757762+00	2022-06-13 07:00:46.757762+00
md_ud292ppq36mp14	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	nc_hblt___Producer	Producer	table	\N	\N	t	f	\N	\N	\N	3	2022-06-13 07:00:46.878627+00	2022-06-13 07:00:46.878627+00
md_affo9e0j69frre	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	nc_hblt___nc_m2m__9oevq0x2z	nc_hblt___nc_m2m__9oevq0x2z	table	\N	\N	t	t	\N	\N	\N	1	2022-06-13 07:00:46.999127+00	2022-06-13 07:00:46.999127+00
\.


--
-- Data for Name: nc_orgs_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_orgs_v2 (id, title, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_plugins; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_plugins (id, project_id, db_alias, title, description, active, rating, version, docs, status, status_details, logo, icon, tags, category, input_schema, input, creator, creator_website, price, created_at, updated_at) FROM stdin;
1	\N	\N	Google	Google OAuth2 login.	f	\N	0.0.1	\N	install	\N	plugins/google.png	\N	Authentication	Google	{"title":"Configure Google Auth","items":[{"key":"client_id","label":"Client ID","placeholder":"Client ID","type":"SingleLineText","required":true},{"key":"client_secret","label":"Client Secret","placeholder":"Client Secret","type":"Password","required":true},{"key":"redirect_url","label":"Redirect URL","placeholder":"Redirect URL","type":"SingleLineText","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and configured Google Authentication, restart NocoDB","msgOnUninstall":""}	\N	\N	\N	Free	\N	\N
3	\N	\N	Metadata LRU Cache	A cache object that deletes the least-recently-used items.	t	\N	0.0.1	\N	install	\N	plugins/xgene.png	\N	Cache	Cache	{"title":"Configure Metadata LRU Cache","items":[{"key":"max","label":"Maximum Size","placeholder":"Maximum Size","type":"SingleLineText","required":true},{"key":"maxAge","label":"Maximum Age(in ms)","placeholder":"Maximum Age(in ms)","type":"SingleLineText","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully updated LRU cache options.","msgOnUninstall":""}	{"max":500,"maxAge":86400000}	\N	\N	Free	\N	\N
\.


--
-- Name: nc_plugins_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_plugins_id_seq', 3, true);


--
-- Data for Name: nc_plugins_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_plugins_v2 (id, title, description, active, rating, version, docs, status, status_details, logo, icon, tags, category, input_schema, input, creator, creator_website, price, created_at, updated_at) FROM stdin;
nc_ue47dz5lnghqq4	Slack	Slack brings team communication and collaboration into one place so you can get more work done, whether you belong to a large enterprise or a small business. 	f	\N	0.0.1	\N	install	\N	plugins/slack.webp	\N	Chat	Chat	{"title":"Configure Slack","array":true,"items":[{"key":"channel","label":"Channel Name","placeholder":"Channel Name","type":"SingleLineText","required":true},{"key":"webhook_url","label":"Webhook URL","placeholder":"Webhook URL","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and Slack is enabled for notification.","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.577959+00	2022-06-13 07:00:02.577959+00
nc_2enis5bzipn39y	Microsoft Teams	Microsoft Teams is for everyone · Instantly go from group chat to video call with the touch of a button.	f	\N	0.0.1	\N	install	\N	plugins/teams.ico	\N	Chat	Chat	{"title":"Configure Microsoft Teams","array":true,"items":[{"key":"channel","label":"Channel Name","placeholder":"Channel Name","type":"SingleLineText","required":true},{"key":"webhook_url","label":"Webhook URL","placeholder":"Webhook URL","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and Microsoft Teams is enabled for notification.","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.580437+00	2022-06-13 07:00:02.580437+00
nc_wl4r0wn8ui6czq	Discord	Discord is the easiest way to talk over voice, video, and text. Talk, chat, hang out, and stay close with your friends and communities.	f	\N	0.0.1	\N	install	\N	plugins/discord.png	\N	Chat	Chat	{"title":"Configure Discord","array":true,"items":[{"key":"channel","label":"Channel Name","placeholder":"Channel Name","type":"SingleLineText","required":true},{"key":"webhook_url","label":"Webhook URL","type":"Password","placeholder":"Webhook URL","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and Discord is enabled for notification.","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.582583+00	2022-06-13 07:00:02.582583+00
nc_o0cyb86587fx2p	Whatsapp Twilio	With Twilio, unite communications and strengthen customer relationships across your business – from marketing and sales to customer service and operations.	f	\N	0.0.1	\N	install	\N	plugins/whatsapp.png	\N	Chat	Twilio	{"title":"Configure Twilio","items":[{"key":"sid","label":"Account SID","placeholder":"Account SID","type":"SingleLineText","required":true},{"key":"token","label":"Auth Token","placeholder":"Auth Token","type":"Password","required":true},{"key":"from","label":"From Phone Number","placeholder":"From Phone Number","type":"SingleLineText","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and Whatsapp Twilio is enabled for notification.","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.584397+00	2022-06-13 07:00:02.584397+00
nc_6zhcewe1rgii7s	Twilio	With Twilio, unite communications and strengthen customer relationships across your business – from marketing and sales to customer service and operations.	f	\N	0.0.1	\N	install	\N	plugins/twilio.png	\N	Chat	Twilio	{"title":"Configure Twilio","items":[{"key":"sid","label":"Account SID","placeholder":"Account SID","type":"SingleLineText","required":true},{"key":"token","label":"Auth Token","placeholder":"Auth Token","type":"Password","required":true},{"key":"from","label":"From Phone Number","placeholder":"From Phone Number","type":"SingleLineText","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and Twilio is enabled for notification.","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.586326+00	2022-06-13 07:00:02.586326+00
nc_z6zkc3aqd0t0x9	S3	Amazon Simple Storage Service (Amazon S3) is an object storage service that offers industry-leading scalability, data availability, security, and performance.	f	\N	0.0.1	\N	install	\N	plugins/s3.png	\N	Storage	Storage	{"title":"Configure Amazon S3","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"region","label":"Region","placeholder":"Region","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in AWS S3","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.58839+00	2022-06-13 07:00:02.58839+00
nc_kx9hp5fmld1m1v	Minio	MinIO is a High Performance Object Storage released under Apache License v2.0. It is API compatible with Amazon S3 cloud storage service.	f	\N	0.0.1	\N	install	\N	plugins/minio.png	\N	Storage	Storage	{"title":"Configure Minio","items":[{"key":"endPoint","label":"Minio Endpoint","placeholder":"Minio Endpoint","type":"SingleLineText","required":true},{"key":"port","label":"Port","placeholder":"Port","type":"Number","required":true},{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true},{"key":"useSSL","label":"Use SSL","placeholder":"Use SSL","type":"Checkbox","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in Minio","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.590598+00	2022-06-13 07:00:02.590598+00
nc_vatp4ktlx399ns	GCS	Google Cloud Storage is a RESTful online file storage web service for storing and accessing data on Google Cloud Platform infrastructure.	f	\N	0.0.2	\N	install	\N	plugins/gcs.png	\N	Storage	Storage	{"title":"Configure Google Cloud Storage","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"client_email","label":"Client Email","placeholder":"Client Email","type":"SingleLineText","required":true},{"key":"private_key","label":"Private Key","placeholder":"Private Key","type":"Password","required":true},{"key":"project_id","label":"Project ID","placeholder":"Project ID","type":"SingleLineText","required":false}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in Google Cloud Storage","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.59276+00	2022-06-13 07:00:02.59276+00
nc_3mzqbwr0746lef	Mattermost	Mattermost brings all your team communication into one place, making it searchable and accessible anywhere.	f	\N	0.0.1	\N	install	\N	plugins/mattermost.png	\N	Chat	Chat	{"title":"Configure Mattermost","array":true,"items":[{"key":"channel","label":"Channel Name","placeholder":"Channel Name","type":"SingleLineText","required":true},{"key":"webhook_url","label":"Webhook URL","placeholder":"Webhook URL","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and Mattermost is enabled for notification.","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.59478+00	2022-06-13 07:00:02.59478+00
nc_bdt98lalossz1t	Spaces	Store & deliver vast amounts of content with a simple architecture.	f	\N	0.0.1	\N	install	\N	plugins/spaces.png	\N	Storage	Storage	{"title":"DigitalOcean Spaces","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"region","label":"Region","placeholder":"Region","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in DigitalOcean Spaces","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.597091+00	2022-06-13 07:00:02.597091+00
nc_f0iy05qtnwniu4	Backblaze B2	Backblaze B2 is enterprise-grade, S3 compatible storage that companies around the world use to store and serve data while improving their cloud OpEx vs. Amazon S3 and others.	f	\N	0.0.1	\N	install	\N	plugins/backblaze.jpeg	\N	Storage	Storage	{"title":"Configure Backblaze B2","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"region","label":"Region","placeholder":"Region","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in Backblaze B2","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.599397+00	2022-06-13 07:00:02.599397+00
nc_iyhlectialukbv	Vultr Object Storage	Using Vultr Object Storage can give flexibility and cloud storage that allows applications greater flexibility and access worldwide.	f	\N	0.0.1	\N	install	\N	plugins/vultr.png	\N	Storage	Storage	{"title":"Configure Vultr Object Storage","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in Vultr Object Storage","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.60139+00	2022-06-13 07:00:02.60139+00
nc_lr8pcvg64g5bho	OvhCloud Object Storage	Upload your files to a space that you can access via HTTPS using the OpenStack Swift API, or the S3 API. 	f	\N	0.0.1	\N	install	\N	plugins/ovhCloud.png	\N	Storage	Storage	{"title":"Configure OvhCloud Object Storage","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"region","label":"Region","placeholder":"Region","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in OvhCloud Object Storage","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.60416+00	2022-06-13 07:00:02.60416+00
nc_3f19m6v5iyudty	Linode Object Storage	S3-compatible Linode Object Storage makes it easy and more affordable to manage unstructured data such as content assets, as well as sophisticated and data-intensive storage challenges around artificial intelligence and machine learning.	f	\N	0.0.1	\N	install	\N	plugins/linode.svg	\N	Storage	Storage	{"title":"Configure Linode Object Storage","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"region","label":"Region","placeholder":"Region","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in Linode Object Storage","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.606391+00	2022-06-13 07:00:02.606391+00
nc_ikemr7ajwzfcr3	UpCloud Object Storage	The perfect home for your data. Thanks to the S3-compatible programmable interface,\nyou have a host of options for existing tools and code implementations.\n	f	\N	0.0.1	\N	install	\N	plugins/upcloud.png	\N	Storage	Storage	{"title":"Configure UpCloud Object Storage","items":[{"key":"bucket","label":"Bucket Name","placeholder":"Bucket Name","type":"SingleLineText","required":true},{"key":"endpoint","label":"Endpoint","placeholder":"Endpoint","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and attachment will be stored in UpCloud Object Storage","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.6085+00	2022-06-13 07:00:02.6085+00
nc_tv5fgn17fgvcwh	SMTP	SMTP email client	f	\N	0.0.1	\N	install	\N	\N	\N	Email	Email	{"title":"Configure Email SMTP","items":[{"key":"from","label":"From","placeholder":"eg: admin@run.com","type":"SingleLineText","required":true},{"key":"host","label":"Host","placeholder":"eg: smtp.run.com","type":"SingleLineText","required":true},{"key":"port","label":"Port","placeholder":"Port","type":"SingleLineText","required":true},{"key":"secure","label":"Secure","placeholder":"Secure","type":"Checkbox","required":false},{"key":"ignoreTLS","label":"Ignore TLS","placeholder":"Ignore TLS","type":"Checkbox","required":false},{"key":"username","label":"Username","placeholder":"Username","type":"SingleLineText","required":false},{"key":"password","label":"Password","placeholder":"Password","type":"Password","required":false}],"actions":[{"label":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and email notification will use SMTP configuration","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.61079+00	2022-06-13 07:00:02.61079+00
nc_hcnsq71s0tr8um	MailerSend	MailerSend email client	f	\N	0.0.1	\N	install	\N	plugins/mailersend.svg	\N	Email	Email	{"title":"Configure MailerSend","items":[{"key":"api_key","label":"API KEy","placeholder":"eg: ***************","type":"Password","required":true},{"key":"from","label":"From","placeholder":"eg: admin@run.com","type":"SingleLineText","required":true},{"key":"from_name","label":"From Name","placeholder":"eg: Adam","type":"SingleLineText","required":true}],"actions":[{"label":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and email notification will use MailerSend configuration","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.612874+00	2022-06-13 07:00:02.612874+00
nc_z2zas0qdy0cz7e	Scaleway Object Storage	Scaleway Object Storage is an S3-compatible object store from Scaleway Cloud Platform.	f	\N	0.0.1	\N	install	\N	plugins/scaleway.png	\N	Storage	Storage	{"title":"Setup Scaleway","items":[{"key":"bucket","label":"Bucket name","placeholder":"Bucket name","type":"SingleLineText","required":true},{"key":"region","label":"Region of bucket","placeholder":"Region of bucket","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed Scaleway Object Storage","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.61482+00	2022-06-13 07:00:02.61482+00
nc_96vkc0jdyw7los	SES	Amazon Simple Email Service (SES) is a cost-effective, flexible, and scalable email service that enables developers to send mail from within any application.	f	\N	0.0.1	\N	install	\N	plugins/aws.png	\N	Email	Email	{"title":"Configure Amazon Simple Email Service (SES)","items":[{"key":"from","label":"From","placeholder":"From","type":"SingleLineText","required":true},{"key":"region","label":"Region","placeholder":"Region","type":"SingleLineText","required":true},{"key":"access_key","label":"Access Key","placeholder":"Access Key","type":"SingleLineText","required":true},{"key":"access_secret","label":"Access Secret","placeholder":"Access Secret","type":"Password","required":true}],"actions":[{"label":"Test","placeholder":"Test","key":"test","actionType":"TEST","type":"Button"},{"label":"Save","placeholder":"Save","key":"save","actionType":"SUBMIT","type":"Button"}],"msgOnInstall":"Successfully installed and email notification will use Amazon SES","msgOnUninstall":""}	\N	\N	\N	\N	2022-06-13 07:00:02.617114+00	2022-06-13 07:00:02.617114+00
\.


--
-- Data for Name: nc_project_users_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_project_users_v2 (project_id, fk_user_id, roles, starred, pinned, "group", color, "order", hidden, opened_date, created_at, updated_at) FROM stdin;
p_99s02mvqpc2j14	us_rpuib1longhhqj	owner	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:19.43059+00	2022-06-13 07:00:19.43059+00
p_99s02mvqpc2j14	us_yqik4gzwara2jg	owner	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:47.180148+00	2022-06-13 07:00:47.180148+00
p_99s02mvqpc2j14	us_vwibm9djmu2f8l	creator	\N	\N	\N	\N	\N	\N	\N	2022-06-13 07:00:47.181008+00	2022-06-13 07:00:47.181008+00
\.


--
-- Data for Name: nc_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_projects (id, title, status, description, config, meta, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_projects_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_projects_users (project_id, user_id, roles, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_projects_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_projects_v2 (id, title, prefix, status, description, meta, color, uuid, password, roles, deleted, is_meta, "order", created_at, updated_at) FROM stdin;
p_99s02mvqpc2j14	sample	nc_hblt__	\N	\N	\N	\N	\N	\N	\N	f	t	\N	2022-06-13 07:00:19.405417+00	2022-06-13 07:00:19.405417+00
\.


--
-- Data for Name: nc_relations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_relations (id, project_id, db_alias, tn, rtn, _tn, _rtn, cn, rcn, _cn, _rcn, referenced_db_alias, type, db_type, ur, dr, created_at, updated_at, fkn) FROM stdin;
\.


--
-- Name: nc_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_relations_id_seq', 1, false);


--
-- Data for Name: nc_resolvers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_resolvers (id, project_id, db_alias, title, resolver, type, acl, functions, handler_type, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_resolvers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_resolvers_id_seq', 1, false);


--
-- Data for Name: nc_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_roles (id, project_id, db_alias, title, type, description, created_at, updated_at) FROM stdin;
1			owner	SYSTEM	Can add/remove creators. And full edit database structures & fields.	\N	\N
2			creator	SYSTEM	Can fully edit database structure & values	\N	\N
3			editor	SYSTEM	Can edit records but cannot change structure of database/fields	\N	\N
4			commenter	SYSTEM	Can view and comment the records but cannot edit anything	\N	\N
5			viewer	SYSTEM	Can view the records but cannot edit anything	\N	\N
\.


--
-- Name: nc_roles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_roles_id_seq', 5, true);


--
-- Data for Name: nc_routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_routes (id, project_id, db_alias, title, tn, tnp, tnc, relation_type, path, type, handler, acl, "order", functions, handler_type, is_custom, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_routes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_routes_id_seq', 1, false);


--
-- Data for Name: nc_rpc; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_rpc (id, project_id, db_alias, title, tn, service, tnp, tnc, relation_type, "order", type, acl, functions, handler_type, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_rpc_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_rpc_id_seq', 1, false);


--
-- Data for Name: nc_shared_bases; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_shared_bases (id, project_id, db_alias, roles, shared_base_id, enabled, password, created_at, updated_at) FROM stdin;
\.


--
-- Name: nc_shared_bases_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_shared_bases_id_seq', 1, false);


--
-- Data for Name: nc_shared_views; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_shared_views (id, project_id, db_alias, model_name, meta, query_params, view_id, show_all_fields, allow_copy, password, created_at, updated_at, view_type, view_name) FROM stdin;
\.


--
-- Name: nc_shared_views_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_shared_views_id_seq', 1, false);


--
-- Data for Name: nc_shared_views_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_shared_views_v2 (id, fk_view_id, meta, query_params, view_id, show_all_fields, allow_copy, password, deleted, "order", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_sort_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_sort_v2 (id, base_id, project_id, fk_view_id, fk_column_id, direction, "order", created_at, updated_at) FROM stdin;
so_z0dmgqwd9vqdxm	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	vw_yv75dsa7wwvj3u	cl_6h7ixf3wm93jl1	asc	1	2022-06-13 07:00:50.981854+00	2022-06-13 07:00:50.981854+00
\.


--
-- Data for Name: nc_store; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_store (id, project_id, db_alias, key, value, type, env, tag, created_at, updated_at) FROM stdin;
1	\N		NC_DEBUG	{"nc:app":false,"nc:api:rest":false,"nc:api:base":false,"nc:api:gql":false,"nc:api:grpc":false,"nc:migrator":false,"nc:datamapper":false}	\N	\N	\N	\N	\N
2	\N		NC_PROJECT_COUNT	0	\N	\N	\N	\N	\N
3			nc_auth_jwt_secret	ffde7080-2a87-46db-a37a-c63362ee65c9	\N	\N	\N	2022-06-13 07:00:02.423767+00	2022-06-13 07:00:02.423767+00
4			nc_server_id	6f06d97c2c27dd051c8dbb7dac19e082d64b4c0ebe8cb0487c473ad81f5f573e	\N	\N	\N	2022-06-13 07:00:02.482361+00	2022-06-13 07:00:02.482361+00
5			NC_CONFIG_MAIN	{"version":"0090000"}	\N	\N	\N	2022-06-13 07:00:02.484129+00	2022-06-13 07:00:02.484129+00
\.


--
-- Name: nc_store_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.nc_store_id_seq', 5, true);


--
-- Data for Name: nc_sync_logs_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_sync_logs_v2 (id, project_id, fk_sync_source_id, time_taken, status, status_details, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_sync_source_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_sync_source_v2 (id, title, type, details, deleted, enabled, "order", project_id, fk_user_id, created_at, updated_at) FROM stdin;
nc_gp23ourzjej6mj	\N	Airtable	{"syncInterval":"15mins","syncDirection":"Airtable to NocoDB","syncRetryCount":1,"apiKey":"keyeZla3k0desT8fU","shareId":"shrkqTr5EkTe6kHAm","options":{"syncViews":true,"syncData":true,"syncRollup":false,"syncLookup":true,"syncFormula":false,"syncAttachment":true}}	\N	t	\N	p_99s02mvqpc2j14	us_rpuib1longhhqj	2022-06-13 07:00:42.881757+00	2022-06-13 07:00:42.881757+00
\.


--
-- Data for Name: nc_team_users_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_team_users_v2 (org_id, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_teams_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_teams_v2 (id, title, org_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: nc_users_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_users_v2 (id, email, password, salt, firstname, lastname, username, refresh_token, invite_token, invite_token_expires, reset_password_expires, reset_password_token, email_verification_token, email_verified, roles, created_at, updated_at) FROM stdin;
us_yqik4gzwara2jg	sivadstala@gmail.com	\N	\N	\N	\N	\N	\N	6fadaef0-20c2-4f47-8570-c36aa641e789	2022-06-14T12:30:47.176+05:30	\N	\N	\N	\N	user	2022-06-13 07:00:47.177377+00	2022-06-13 07:00:47.177377+00
us_vwibm9djmu2f8l	raju.us@gmail.com	\N	\N	\N	\N	\N	\N	00a1d74e-1663-44d5-819b-edce7fb6960f	2022-06-14T12:30:47.176+05:30	\N	\N	\N	\N	user	2022-06-13 07:00:47.177478+00	2022-06-13 07:00:47.177478+00
us_rpuib1longhhqj	user@nocodb.com	$2a$10$kI0kbvmKcrCWW5zlYcXiQ.ALvCHp4LLmiSnVJX.ao3B31e/.NcT8y	$2a$10$kI0kbvmKcrCWW5zlYcXiQ.	\N	\N	\N	1f1eb855e6434cb9b79e3250fa27d90c53e4091a207405c83754a22415542ad60ee4d2cfd2a7a7e9	\N	\N	\N	\N	846e5159-c2a1-45d0-9856-f593f8608b5f	\N	user,super	2022-06-13 07:00:15.899208+00	2022-06-13 07:19:45.959386+00
\.


--
-- Data for Name: nc_views_v2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.nc_views_v2 (id, base_id, project_id, fk_model_id, title, type, is_default, show_system_fields, lock_type, uuid, password, show, "order", created_at, updated_at) FROM stdin;
vw_9msmfh7uv5mfwz	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	Grid view	3	t	\N	collaborative	\N	\N	t	1	2022-06-13 07:00:46.476133+00	2022-06-13 07:00:46.699194+00
vw_mwyhnlv1f3g99f	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Grid view	3	t	\N	collaborative	\N	\N	t	1	2022-06-13 07:00:46.763434+00	2022-06-13 07:00:46.849242+00
vw_3lc5xx7fjg3zfp	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Grid view	3	t	\N	collaborative	\N	\N	t	1	2022-06-13 07:00:46.886599+00	2022-06-13 07:00:46.969902+00
vw_0lwyv8ap72h0by	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_affo9e0j69frre	nc_hblt___nc_m2m__9oevq0x2z	3	t	\N	collaborative	\N	\N	t	1	2022-06-13 07:00:47.002934+00	2022-06-13 07:00:47.002934+00
vw_yv75dsa7wwvj3u	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_lh3bakzk8scz7r	Filter&Sort	3	\N	\N	collaborative	\N	\N	t	2	2022-06-13 07:00:50.835063+00	2022-06-13 07:00:50.835063+00
vw_4awlw6zujst2vm	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Grid 2	3	\N	\N	collaborative	\N	\N	t	2	2022-06-13 07:00:53.164488+00	2022-06-13 07:00:53.164488+00
vw_xov4el1bqpsgy8	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Grid 3	3	\N	\N	collaborative	\N	\N	t	3	2022-06-13 07:00:54.104331+00	2022-06-13 07:00:54.104331+00
vw_vdsb71p2zbuors	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Grid 4	3	\N	\N	collaborative	\N	\N	t	4	2022-06-13 07:00:55.182985+00	2022-06-13 07:00:55.182985+00
vw_ubm72q5tlmccvu	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_w4bsfg7gtmqque	FormTitle	1	\N	\N	collaborative	\N	\N	t	2	2022-06-13 07:00:56.395165+00	2022-06-13 07:00:56.395165+00
vw_wbbiahyr1io2nq	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Form	1	\N	\N	collaborative	\N	\N	t	5	2022-06-13 07:00:58.013574+00	2022-06-13 07:00:58.013574+00
vw_8sgx53tn88hkfh	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Form 2	1	\N	\N	collaborative	\N	\N	t	6	2022-06-13 07:00:59.108789+00	2022-06-13 07:00:59.108789+00
vw_a71vtm0kxaoh6r	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Form 3	1	\N	\N	collaborative	\N	\N	t	7	2022-06-13 07:01:00.066022+00	2022-06-13 07:01:00.066022+00
vw_8fky8viw54t7tk	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Form 4	1	\N	\N	collaborative	\N	\N	t	8	2022-06-13 07:01:01.310305+00	2022-06-13 07:01:01.310305+00
vw_ordkcxhwg8pg88	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Gallery	2	\N	\N	collaborative	\N	\N	t	9	2022-06-13 07:01:02.598404+00	2022-06-13 07:01:02.598404+00
vw_p28ldcq3zy32b9	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Gallery 2	2	\N	\N	collaborative	\N	\N	t	10	2022-06-13 07:01:03.519443+00	2022-06-13 07:01:03.519443+00
vw_clfkzvyypltmto	ds_b5zy5nbvnbxowl	p_99s02mvqpc2j14	md_ud292ppq36mp14	Gallery 3	2	\N	\N	collaborative	\N	\N	t	11	2022-06-13 07:01:04.528674+00	2022-06-13 07:01:04.528674+00
\.


--
-- Data for Name: xc_knex_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.xc_knex_migrations (id, name, batch, migration_time) FROM stdin;
1	project	1	2022-06-13 07:00:02.162+00
2	m2m	1	2022-06-13 07:00:02.165+00
3	fkn	1	2022-06-13 07:00:02.167+00
4	viewType	1	2022-06-13 07:00:02.169+00
5	viewName	1	2022-06-13 07:00:02.17+00
6	nc_006_alter_nc_shared_views	1	2022-06-13 07:00:02.173+00
7	nc_007_alter_nc_shared_views_1	1	2022-06-13 07:00:02.175+00
8	nc_008_add_nc_shared_bases	1	2022-06-13 07:00:02.18+00
9	nc_009_add_model_order	1	2022-06-13 07:00:02.185+00
10	nc_010_add_parent_title_column	1	2022-06-13 07:00:02.187+00
11	nc_011_remove_old_ses_plugin	1	2022-06-13 07:00:02.189+00
\.


--
-- Name: xc_knex_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.xc_knex_migrations_id_seq', 11, true);


--
-- Data for Name: xc_knex_migrations_lock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.xc_knex_migrations_lock (index, is_locked) FROM stdin;
1	0
\.


--
-- Name: xc_knex_migrations_lock_index_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.xc_knex_migrations_lock_index_seq', 1, true);


--
-- Data for Name: xc_knex_migrationsv2; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.xc_knex_migrationsv2 (id, name, batch, migration_time) FROM stdin;
1	nc_011	1	2022-06-13 07:00:02.374+00
2	nc_012_alter_column_data_types	1	2022-06-13 07:00:02.384+00
3	nc_013_sync_source	1	2022-06-13 07:00:02.395+00
4	nc_014_alter_column_data_types	1	2022-06-13 07:00:02.406+00
5	nc_015_add_meta_col_in_column_table	1	2022-06-13 07:00:02.409+00
6	nc_016_alter_hooklog_payload_types	1	2022-06-13 07:00:02.416+00
\.


--
-- Name: xc_knex_migrationsv2_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.xc_knex_migrationsv2_id_seq', 6, true);


--
-- Data for Name: xc_knex_migrationsv2_lock; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.xc_knex_migrationsv2_lock (index, is_locked) FROM stdin;
1	0
\.


--
-- Name: xc_knex_migrationsv2_lock_index_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.xc_knex_migrationsv2_lock_index_seq', 1, true);


--
-- Name: nc_acl nc_acl_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_acl
    ADD CONSTRAINT nc_acl_pkey PRIMARY KEY (id);


--
-- Name: nc_api_tokens nc_api_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_api_tokens
    ADD CONSTRAINT nc_api_tokens_pkey PRIMARY KEY (id);


--
-- Name: nc_audit nc_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_audit
    ADD CONSTRAINT nc_audit_pkey PRIMARY KEY (id);


--
-- Name: nc_audit_v2 nc_audit_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_audit_v2
    ADD CONSTRAINT nc_audit_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_bases_v2 nc_bases_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_bases_v2
    ADD CONSTRAINT nc_bases_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_col_formula_v2 nc_col_formula_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_formula_v2
    ADD CONSTRAINT nc_col_formula_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_col_lookup_v2 nc_col_lookup_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_lookup_v2
    ADD CONSTRAINT nc_col_lookup_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_col_rollup_v2 nc_col_rollup_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_rollup_v2
    ADD CONSTRAINT nc_col_rollup_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_col_select_options_v2 nc_col_select_options_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_select_options_v2
    ADD CONSTRAINT nc_col_select_options_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_columns_v2 nc_columns_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_columns_v2
    ADD CONSTRAINT nc_columns_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_cron nc_cron_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_cron
    ADD CONSTRAINT nc_cron_pkey PRIMARY KEY (id);


--
-- Name: nc_disabled_models_for_role nc_disabled_models_for_role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_disabled_models_for_role
    ADD CONSTRAINT nc_disabled_models_for_role_pkey PRIMARY KEY (id);


--
-- Name: nc_disabled_models_for_role_v2 nc_disabled_models_for_role_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_disabled_models_for_role_v2
    ADD CONSTRAINT nc_disabled_models_for_role_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_evolutions nc_evolutions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_evolutions
    ADD CONSTRAINT nc_evolutions_pkey PRIMARY KEY (id);


--
-- Name: nc_filter_exp_v2 nc_filter_exp_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_filter_exp_v2
    ADD CONSTRAINT nc_filter_exp_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_form_view_columns_v2 nc_form_view_columns_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_form_view_columns_v2
    ADD CONSTRAINT nc_form_view_columns_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_form_view_v2 nc_form_view_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_form_view_v2
    ADD CONSTRAINT nc_form_view_v2_pkey PRIMARY KEY (fk_view_id);


--
-- Name: nc_gallery_view_columns_v2 nc_gallery_view_columns_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_gallery_view_columns_v2
    ADD CONSTRAINT nc_gallery_view_columns_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_gallery_view_v2 nc_gallery_view_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_gallery_view_v2
    ADD CONSTRAINT nc_gallery_view_v2_pkey PRIMARY KEY (fk_view_id);


--
-- Name: nc_grid_view_columns_v2 nc_grid_view_columns_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_grid_view_columns_v2
    ADD CONSTRAINT nc_grid_view_columns_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_grid_view_v2 nc_grid_view_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_grid_view_v2
    ADD CONSTRAINT nc_grid_view_v2_pkey PRIMARY KEY (fk_view_id);


--
-- Name: nc_hblt___Actor nc_hblt___Actor_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."nc_hblt___Actor"
    ADD CONSTRAINT "nc_hblt___Actor_pkey" PRIMARY KEY ("ncRecordId");


--
-- Name: nc_hblt___Film nc_hblt___Film_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."nc_hblt___Film"
    ADD CONSTRAINT "nc_hblt___Film_pkey" PRIMARY KEY ("ncRecordId");


--
-- Name: nc_hblt___Producer nc_hblt___Producer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."nc_hblt___Producer"
    ADD CONSTRAINT "nc_hblt___Producer_pkey" PRIMARY KEY ("ncRecordId");


--
-- Name: nc_hblt___nc_m2m__9oevq0x2z nc_hblt___nc_m2m__9oevq0x2z_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hblt___nc_m2m__9oevq0x2z
    ADD CONSTRAINT nc_hblt___nc_m2m__9oevq0x2z_pkey PRIMARY KEY (table2_id, table1_id);


--
-- Name: nc_hook_logs_v2 nc_hook_logs_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hook_logs_v2
    ADD CONSTRAINT nc_hook_logs_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_hooks nc_hooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hooks
    ADD CONSTRAINT nc_hooks_pkey PRIMARY KEY (id);


--
-- Name: nc_hooks_v2 nc_hooks_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hooks_v2
    ADD CONSTRAINT nc_hooks_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_kanban_view_columns_v2 nc_kanban_view_columns_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_kanban_view_columns_v2
    ADD CONSTRAINT nc_kanban_view_columns_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_kanban_view_v2 nc_kanban_view_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_kanban_view_v2
    ADD CONSTRAINT nc_kanban_view_v2_pkey PRIMARY KEY (fk_view_id);


--
-- Name: nc_loaders nc_loaders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_loaders
    ADD CONSTRAINT nc_loaders_pkey PRIMARY KEY (id);


--
-- Name: nc_migrations nc_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_migrations
    ADD CONSTRAINT nc_migrations_pkey PRIMARY KEY (id);


--
-- Name: nc_models nc_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_models
    ADD CONSTRAINT nc_models_pkey PRIMARY KEY (id);


--
-- Name: nc_models_v2 nc_models_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_models_v2
    ADD CONSTRAINT nc_models_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_orgs_v2 nc_orgs_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_orgs_v2
    ADD CONSTRAINT nc_orgs_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_plugins nc_plugins_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_plugins
    ADD CONSTRAINT nc_plugins_pkey PRIMARY KEY (id);


--
-- Name: nc_plugins_v2 nc_plugins_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_plugins_v2
    ADD CONSTRAINT nc_plugins_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_projects nc_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_projects
    ADD CONSTRAINT nc_projects_pkey PRIMARY KEY (id);


--
-- Name: nc_projects_v2 nc_projects_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_projects_v2
    ADD CONSTRAINT nc_projects_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_relations nc_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_relations
    ADD CONSTRAINT nc_relations_pkey PRIMARY KEY (id);


--
-- Name: nc_resolvers nc_resolvers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_resolvers
    ADD CONSTRAINT nc_resolvers_pkey PRIMARY KEY (id);


--
-- Name: nc_roles nc_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_roles
    ADD CONSTRAINT nc_roles_pkey PRIMARY KEY (id);


--
-- Name: nc_routes nc_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_routes
    ADD CONSTRAINT nc_routes_pkey PRIMARY KEY (id);


--
-- Name: nc_rpc nc_rpc_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_rpc
    ADD CONSTRAINT nc_rpc_pkey PRIMARY KEY (id);


--
-- Name: nc_shared_bases nc_shared_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_shared_bases
    ADD CONSTRAINT nc_shared_bases_pkey PRIMARY KEY (id);


--
-- Name: nc_shared_views nc_shared_views_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_shared_views
    ADD CONSTRAINT nc_shared_views_pkey PRIMARY KEY (id);


--
-- Name: nc_shared_views_v2 nc_shared_views_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_shared_views_v2
    ADD CONSTRAINT nc_shared_views_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_sort_v2 nc_sort_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sort_v2
    ADD CONSTRAINT nc_sort_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_store nc_store_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_store
    ADD CONSTRAINT nc_store_pkey PRIMARY KEY (id);


--
-- Name: nc_sync_logs_v2 nc_sync_logs_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sync_logs_v2
    ADD CONSTRAINT nc_sync_logs_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_sync_source_v2 nc_sync_source_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sync_source_v2
    ADD CONSTRAINT nc_sync_source_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_teams_v2 nc_teams_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_teams_v2
    ADD CONSTRAINT nc_teams_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_users_v2 nc_users_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_users_v2
    ADD CONSTRAINT nc_users_v2_pkey PRIMARY KEY (id);


--
-- Name: nc_views_v2 nc_views_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_views_v2
    ADD CONSTRAINT nc_views_v2_pkey PRIMARY KEY (id);


--
-- Name: xc_knex_migrations_lock xc_knex_migrations_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrations_lock
    ADD CONSTRAINT xc_knex_migrations_lock_pkey PRIMARY KEY (index);


--
-- Name: xc_knex_migrations xc_knex_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrations
    ADD CONSTRAINT xc_knex_migrations_pkey PRIMARY KEY (id);


--
-- Name: xc_knex_migrationsv2_lock xc_knex_migrationsv2_lock_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrationsv2_lock
    ADD CONSTRAINT xc_knex_migrationsv2_lock_pkey PRIMARY KEY (index);


--
-- Name: xc_knex_migrationsv2 xc_knex_migrationsv2_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.xc_knex_migrationsv2
    ADD CONSTRAINT xc_knex_migrationsv2_pkey PRIMARY KEY (id);


--
-- Name: `nc_audit_index`; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "`nc_audit_index`" ON public.nc_audit USING btree (db_alias, project_id, model_name, model_id);


--
-- Name: nc_audit_v2_row_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_audit_v2_row_id_index ON public.nc_audit_v2 USING btree (row_id);


--
-- Name: nc_hblt___nc_m2m__9oevq0x2z_table1_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_hblt___nc_m2m__9oevq0x2z_table1_id_index ON public.nc_hblt___nc_m2m__9oevq0x2z USING btree (table1_id);


--
-- Name: nc_hblt___nc_m2m__9oevq0x2z_table2_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_hblt___nc_m2m__9oevq0x2z_table2_id_index ON public.nc_hblt___nc_m2m__9oevq0x2z USING btree (table2_id);


--
-- Name: nc_hblt___producer_nc_hblt___film_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_hblt___producer_nc_hblt___film_id_index ON public."nc_hblt___Producer" USING btree ("nc_hblt___Film_id");


--
-- Name: nc_models_db_alias_title_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_models_db_alias_title_index ON public.nc_models USING btree (db_alias, title);


--
-- Name: nc_models_order_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_models_order_index ON public.nc_models USING btree ("order");


--
-- Name: nc_models_view_order_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_models_view_order_index ON public.nc_models USING btree (view_order);


--
-- Name: nc_projects_users_project_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_projects_users_project_id_index ON public.nc_projects_users USING btree (project_id);


--
-- Name: nc_projects_users_user_id_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_projects_users_user_id_index ON public.nc_projects_users USING btree (user_id);


--
-- Name: nc_relations_db_alias_tn_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_relations_db_alias_tn_index ON public.nc_relations USING btree (db_alias, tn);


--
-- Name: nc_routes_db_alias_title_tn_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_routes_db_alias_title_tn_index ON public.nc_routes USING btree (db_alias, title, tn);


--
-- Name: nc_store_key_index; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX nc_store_key_index ON public.nc_store USING btree (key);


--
-- Name: xc_disabled124_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX xc_disabled124_idx ON public.nc_disabled_models_for_role USING btree (project_id, db_alias, title, type, role);


--
-- Name: nc_audit_v2 nc_audit_v2_base_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_audit_v2
    ADD CONSTRAINT nc_audit_v2_base_id_foreign FOREIGN KEY (base_id) REFERENCES public.nc_bases_v2(id);


--
-- Name: nc_audit_v2 nc_audit_v2_fk_model_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_audit_v2
    ADD CONSTRAINT nc_audit_v2_fk_model_id_foreign FOREIGN KEY (fk_model_id) REFERENCES public.nc_models_v2(id);


--
-- Name: nc_audit_v2 nc_audit_v2_project_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_audit_v2
    ADD CONSTRAINT nc_audit_v2_project_id_foreign FOREIGN KEY (project_id) REFERENCES public.nc_projects_v2(id);


--
-- Name: nc_bases_v2 nc_bases_v2_project_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_bases_v2
    ADD CONSTRAINT nc_bases_v2_project_id_foreign FOREIGN KEY (project_id) REFERENCES public.nc_projects_v2(id);


--
-- Name: nc_col_formula_v2 nc_col_formula_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_formula_v2
    ADD CONSTRAINT nc_col_formula_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_lookup_v2 nc_col_lookup_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_lookup_v2
    ADD CONSTRAINT nc_col_lookup_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_lookup_v2 nc_col_lookup_v2_fk_lookup_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_lookup_v2
    ADD CONSTRAINT nc_col_lookup_v2_fk_lookup_column_id_foreign FOREIGN KEY (fk_lookup_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_lookup_v2 nc_col_lookup_v2_fk_relation_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_lookup_v2
    ADD CONSTRAINT nc_col_lookup_v2_fk_relation_column_id_foreign FOREIGN KEY (fk_relation_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_child_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_child_column_id_foreign FOREIGN KEY (fk_child_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_mm_child_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_mm_child_column_id_foreign FOREIGN KEY (fk_mm_child_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_mm_model_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_mm_model_id_foreign FOREIGN KEY (fk_mm_model_id) REFERENCES public.nc_models_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_mm_parent_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_mm_parent_column_id_foreign FOREIGN KEY (fk_mm_parent_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_parent_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_parent_column_id_foreign FOREIGN KEY (fk_parent_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_relations_v2 nc_col_relations_v2_fk_related_model_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_relations_v2
    ADD CONSTRAINT nc_col_relations_v2_fk_related_model_id_foreign FOREIGN KEY (fk_related_model_id) REFERENCES public.nc_models_v2(id);


--
-- Name: nc_col_rollup_v2 nc_col_rollup_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_rollup_v2
    ADD CONSTRAINT nc_col_rollup_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_rollup_v2 nc_col_rollup_v2_fk_relation_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_rollup_v2
    ADD CONSTRAINT nc_col_rollup_v2_fk_relation_column_id_foreign FOREIGN KEY (fk_relation_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_rollup_v2 nc_col_rollup_v2_fk_rollup_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_rollup_v2
    ADD CONSTRAINT nc_col_rollup_v2_fk_rollup_column_id_foreign FOREIGN KEY (fk_rollup_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_col_select_options_v2 nc_col_select_options_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_col_select_options_v2
    ADD CONSTRAINT nc_col_select_options_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_columns_v2 nc_columns_v2_fk_model_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_columns_v2
    ADD CONSTRAINT nc_columns_v2_fk_model_id_foreign FOREIGN KEY (fk_model_id) REFERENCES public.nc_models_v2(id);


--
-- Name: nc_disabled_models_for_role_v2 nc_disabled_models_for_role_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_disabled_models_for_role_v2
    ADD CONSTRAINT nc_disabled_models_for_role_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_filter_exp_v2 nc_filter_exp_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_filter_exp_v2
    ADD CONSTRAINT nc_filter_exp_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_filter_exp_v2 nc_filter_exp_v2_fk_hook_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_filter_exp_v2
    ADD CONSTRAINT nc_filter_exp_v2_fk_hook_id_foreign FOREIGN KEY (fk_hook_id) REFERENCES public.nc_hooks_v2(id);


--
-- Name: nc_filter_exp_v2 nc_filter_exp_v2_fk_parent_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_filter_exp_v2
    ADD CONSTRAINT nc_filter_exp_v2_fk_parent_id_foreign FOREIGN KEY (fk_parent_id) REFERENCES public.nc_filter_exp_v2(id);


--
-- Name: nc_filter_exp_v2 nc_filter_exp_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_filter_exp_v2
    ADD CONSTRAINT nc_filter_exp_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_form_view_columns_v2 nc_form_view_columns_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_form_view_columns_v2
    ADD CONSTRAINT nc_form_view_columns_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_form_view_columns_v2 nc_form_view_columns_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_form_view_columns_v2
    ADD CONSTRAINT nc_form_view_columns_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_form_view_v2(fk_view_id);


--
-- Name: nc_form_view_v2 nc_form_view_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_form_view_v2
    ADD CONSTRAINT nc_form_view_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_gallery_view_columns_v2 nc_gallery_view_columns_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_gallery_view_columns_v2
    ADD CONSTRAINT nc_gallery_view_columns_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_gallery_view_columns_v2 nc_gallery_view_columns_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_gallery_view_columns_v2
    ADD CONSTRAINT nc_gallery_view_columns_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_gallery_view_v2(fk_view_id);


--
-- Name: nc_gallery_view_v2 nc_gallery_view_v2_fk_cover_image_col_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_gallery_view_v2
    ADD CONSTRAINT nc_gallery_view_v2_fk_cover_image_col_id_foreign FOREIGN KEY (fk_cover_image_col_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_gallery_view_v2 nc_gallery_view_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_gallery_view_v2
    ADD CONSTRAINT nc_gallery_view_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_grid_view_columns_v2 nc_grid_view_columns_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_grid_view_columns_v2
    ADD CONSTRAINT nc_grid_view_columns_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_grid_view_columns_v2 nc_grid_view_columns_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_grid_view_columns_v2
    ADD CONSTRAINT nc_grid_view_columns_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_grid_view_v2(fk_view_id);


--
-- Name: nc_grid_view_v2 nc_grid_view_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_grid_view_v2
    ADD CONSTRAINT nc_grid_view_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_hblt___nc_m2m__9oevq0x2z nc_hblt___nc_m2m__9oevq0x2z_table1_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hblt___nc_m2m__9oevq0x2z
    ADD CONSTRAINT nc_hblt___nc_m2m__9oevq0x2z_table1_id_foreign FOREIGN KEY (table1_id) REFERENCES public."nc_hblt___Film"("ncRecordId");


--
-- Name: nc_hblt___nc_m2m__9oevq0x2z nc_hblt___nc_m2m__9oevq0x2z_table2_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hblt___nc_m2m__9oevq0x2z
    ADD CONSTRAINT nc_hblt___nc_m2m__9oevq0x2z_table2_id_foreign FOREIGN KEY (table2_id) REFERENCES public."nc_hblt___Actor"("ncRecordId");


--
-- Name: nc_hblt___Producer nc_hblt___producer_nc_hblt___film_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."nc_hblt___Producer"
    ADD CONSTRAINT nc_hblt___producer_nc_hblt___film_id_foreign FOREIGN KEY ("nc_hblt___Film_id") REFERENCES public."nc_hblt___Film"("ncRecordId");


--
-- Name: nc_hooks_v2 nc_hooks_v2_fk_model_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_hooks_v2
    ADD CONSTRAINT nc_hooks_v2_fk_model_id_foreign FOREIGN KEY (fk_model_id) REFERENCES public.nc_models_v2(id);


--
-- Name: nc_kanban_view_columns_v2 nc_kanban_view_columns_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_kanban_view_columns_v2
    ADD CONSTRAINT nc_kanban_view_columns_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_kanban_view_columns_v2 nc_kanban_view_columns_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_kanban_view_columns_v2
    ADD CONSTRAINT nc_kanban_view_columns_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_kanban_view_v2(fk_view_id);


--
-- Name: nc_kanban_view_v2 nc_kanban_view_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_kanban_view_v2
    ADD CONSTRAINT nc_kanban_view_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_models_v2 nc_models_v2_base_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_models_v2
    ADD CONSTRAINT nc_models_v2_base_id_foreign FOREIGN KEY (base_id) REFERENCES public.nc_bases_v2(id);


--
-- Name: nc_models_v2 nc_models_v2_project_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_models_v2
    ADD CONSTRAINT nc_models_v2_project_id_foreign FOREIGN KEY (project_id) REFERENCES public.nc_projects_v2(id);


--
-- Name: nc_project_users_v2 nc_project_users_v2_fk_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_project_users_v2
    ADD CONSTRAINT nc_project_users_v2_fk_user_id_foreign FOREIGN KEY (fk_user_id) REFERENCES public.nc_users_v2(id);


--
-- Name: nc_project_users_v2 nc_project_users_v2_project_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_project_users_v2
    ADD CONSTRAINT nc_project_users_v2_project_id_foreign FOREIGN KEY (project_id) REFERENCES public.nc_projects_v2(id);


--
-- Name: nc_shared_views_v2 nc_shared_views_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_shared_views_v2
    ADD CONSTRAINT nc_shared_views_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_sort_v2 nc_sort_v2_fk_column_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sort_v2
    ADD CONSTRAINT nc_sort_v2_fk_column_id_foreign FOREIGN KEY (fk_column_id) REFERENCES public.nc_columns_v2(id);


--
-- Name: nc_sort_v2 nc_sort_v2_fk_view_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sort_v2
    ADD CONSTRAINT nc_sort_v2_fk_view_id_foreign FOREIGN KEY (fk_view_id) REFERENCES public.nc_views_v2(id);


--
-- Name: nc_sync_source_v2 nc_sync_source_v2_fk_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sync_source_v2
    ADD CONSTRAINT nc_sync_source_v2_fk_user_id_foreign FOREIGN KEY (fk_user_id) REFERENCES public.nc_users_v2(id);


--
-- Name: nc_sync_source_v2 nc_sync_source_v2_project_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_sync_source_v2
    ADD CONSTRAINT nc_sync_source_v2_project_id_foreign FOREIGN KEY (project_id) REFERENCES public.nc_projects_v2(id);


--
-- Name: nc_team_users_v2 nc_team_users_v2_org_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_team_users_v2
    ADD CONSTRAINT nc_team_users_v2_org_id_foreign FOREIGN KEY (org_id) REFERENCES public.nc_orgs_v2(id);


--
-- Name: nc_team_users_v2 nc_team_users_v2_user_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_team_users_v2
    ADD CONSTRAINT nc_team_users_v2_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.nc_users_v2(id);


--
-- Name: nc_teams_v2 nc_teams_v2_org_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_teams_v2
    ADD CONSTRAINT nc_teams_v2_org_id_foreign FOREIGN KEY (org_id) REFERENCES public.nc_orgs_v2(id);


--
-- Name: nc_views_v2 nc_views_v2_fk_model_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nc_views_v2
    ADD CONSTRAINT nc_views_v2_fk_model_id_foreign FOREIGN KEY (fk_model_id) REFERENCES public.nc_models_v2(id);


--
-- PostgreSQL database dump complete
--

\connect postgres

SET default_transaction_read_only = off;

--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.24
-- Dumped by pg_dump version 9.6.24

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE postgres; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE postgres IS 'default administrative connection database';


--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- PostgreSQL database dump complete
--

\connect template1

SET default_transaction_read_only = off;

--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.24
-- Dumped by pg_dump version 9.6.24

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: DATABASE template1; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON DATABASE template1 IS 'default template for new databases';


--
-- Name: plpgsql; Type: EXTENSION; Schema: -; Owner:
--

CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION plpgsql; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';


--
-- PostgreSQL database dump complete
--

--
-- PostgreSQL database cluster dump complete
--

