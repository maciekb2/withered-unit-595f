#!/bin/sh
set -eu
until pg_isready -d "$DATABASE_URL"; do sleep 1; done
for migration in /migrations/*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$migration"
done
