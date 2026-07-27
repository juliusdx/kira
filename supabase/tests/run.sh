#!/usr/bin/env bash
# Verify the RLS policies in supabase/migrations/ against a throwaway local
# Postgres, as an unprivileged role — so a policy hole is caught here rather
# than after the migration is pasted into the live SQL Editor.
#
#   ./supabase/tests/run.sh
#
# Requires a local postgres (brew install postgresql@16) — nothing else, and it
# never touches the live project.
set -euo pipefail

export LC_ALL=C   # PG16 on macOS refuses to start without a pinned locale
for p in /opt/homebrew/opt/postgresql@16/bin /opt/homebrew/bin; do
  [ -d "$p" ] && export PATH="$p:$PATH"
done

DB=kira_rls_test
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIG="$HERE/../migrations"

pg_isready -q || {
  echo "starting local postgres..."
  pg_ctl -D /opt/homebrew/var/postgresql@16 -l /tmp/kira-pg.log start
  sleep 3
}

dropdb --if-exists "$DB"
createdb "$DB"

psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$HERE/harness.sql"          > /dev/null
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0001_init.sql"         > /dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0002_classes.sql"      > /dev/null 2>&1
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG/0003_leaderboard.sql"  > /dev/null 2>&1

OUT=$(psql -q -d "$DB" -f "$HERE/rls_test.sql" 2>&1)

# leaderboard suite runs on its own database — its fixtures assume a clean slate
LB_DB="${DB}_lb"
dropdb --if-exists "$LB_DB"; createdb "$LB_DB"
for f in "$HERE/harness.sql" "$MIG/0001_init.sql" "$MIG/0002_classes.sql" "$MIG/0003_leaderboard.sql"; do
  psql -q -d "$LB_DB" -v ON_ERROR_STOP=1 -f "$f" > /dev/null 2>&1
done
LB=$(psql -qAt -d "$LB_DB" -f "$HERE/leaderboard_test.sql" 2>&1)
LB_FALSE=$(echo "$LB" | grep -cx 'f' || true)
LB_TRUE=$(echo "$LB" | grep -cx 't' || true)
LB_ERR=$(echo "$LB" | grep -cE 'FAIL_|ERROR' || true)
echo "--- leaderboard: $LB_TRUE assertions true, $LB_FALSE false, $LB_ERR errors"
dropdb --if-exists "$LB_DB"
if [ "$LB_FALSE" -gt 0 ] || [ "$LB_ERR" -gt 0 ]; then
  echo "$LB" | grep -E "FAIL_|ERROR"
  echo "✗ LEADERBOARD TESTS FAILED"
  dropdb --if-exists "$DB"
  exit 1
fi
echo "$OUT" | grep -E "PASS|FAIL|ERROR|^---|^====" || true

FAILS=$(echo "$OUT" | grep -c "FAIL" || true)
ERRS=$(echo "$OUT"  | grep -c "^psql.*ERROR" || true)
PASSES=$(echo "$OUT" | grep -c "PASS" || true)

echo ""
if [ "$FAILS" -gt 0 ] || [ "$ERRS" -gt 0 ]; then
  echo "✗ RLS TESTS FAILED  ($PASSES passed, $FAILS failed, $ERRS errors)"
  dropdb --if-exists "$DB"
  exit 1
fi
echo "✓ all $PASSES RLS checks passed"
dropdb --if-exists "$DB"
