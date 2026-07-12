#!/bin/sh
set -eu
until pg_isready -d "$DATABASE_URL"; do sleep 1; done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /migrations/001_initial.sql
