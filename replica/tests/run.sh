#!/usr/bin/env bash
# Teste les migrations de supabase/migrations sur un Postgres 16 local jetable, avec l'imitation de Supabase du dépôt.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
STUB="$HERE/supabase_stub.sql"
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || echo /usr/lib/postgresql/16/bin/pg_ctl)")}"
DATA="$(mktemp -d)"; PORT="${PORT:-54331}"
"$PGBIN/initdb" -D "$DATA" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/log" start >/dev/null
trap '"$PGBIN/pg_ctl" -D "$DATA" stop -m fast >/dev/null; rm -rf "$DATA"' EXIT
PSQL=(psql -h "$DATA" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$STUB"
# Comme Supabase : droits par défaut sur les tables créées ensuite
"${PSQL[@]}" -c "grant usage on schema public to authenticated, anon; alter default privileges in schema public grant all on tables to authenticated, anon;"
for f in "$HERE"/../../supabase/migrations/*.sql; do "${PSQL[@]}" -f "$f"; done
"${PSQL[@]}" -f "$HERE/schema_test.sql"
"${PSQL[@]}" -f "$HERE/admin_test.sql"
"${PSQL[@]}" -f "$HERE/search_test.sql"
"${PSQL[@]}" -f "$HERE/automation_test.sql"
"${PSQL[@]}" -f "$HERE/visibilite_ia_test.sql"
"${PSQL[@]}" -f "$HERE/gardien_test.sql"
"${PSQL[@]}" -f "$HERE/positions_test.sql"
"${PSQL[@]}" -f "$HERE/agence_test.sql"
