# Auto-upstall installer tests

Automated tests for `noco.sh`, the NocoDB auto-upstall install wizard.

The installer's file generation is decoupled from its OS/Docker/port preflight via
the internal `NOCO_SKIP_PREFLIGHT` env var, so the whole fast suite runs on **any OS,
with no Docker and no network**.

## What's covered

| File | What it checks | Docker |
|------|----------------|--------|
| `install/generate.bats` | Golden-file snapshot of the generated `docker-compose.yml` per scenario (local, production-ip, production-ssl, external-redis, external-pg ×3, fully-external), plus `db.json` / `docker.env` / file-permission / supporting-file checks. | No |
| `install/validation.bats` | Non-interactive flag validation — missing/incompatible flags fail with a clear message; `--help` succeeds. | No |
| `install/examples.bats` | Generated external-Postgres `db.json` stays structurally in sync (jq-normalized) with the documented `docker-compose/examples/`. | No (needs `jq`) |
| `install/interactive.bats` | UX guard for the interactive wizard, driven by `expect`. Gated. | No |

## Running

```bash
# from this directory (docker-compose/1_Auto_Upstall/tests)
bats install/                       # full fast suite
bats install/generate.bats          # a single file

TEST_DOCKER=1      bats install/generate.bats      # also run `docker compose config`
TEST_INTERACTIVE=1 bats install/interactive.bats   # run the expect-driven wizard test
```

Requires `bats`, and `jq` for `examples.bats` (and `expect` for the gated interactive test).

## Golden files

`golden/<scenario>/docker-compose.yml` are committed expected outputs. The random
bundled Postgres password is normalized to `__PASSWORD__` before diffing. When a golden
test fails, the bats output shows a unified diff of exactly what changed.

After an **intentional** change to `noco.sh`'s compose generation, regenerate and review:

```bash
./lib/regen-golden.sh
git diff golden/        # confirm the change is what you expect, then commit
```
