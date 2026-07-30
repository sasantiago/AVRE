#!/bin/bash
# Crea los dos roles de Postgres que separan "quién migra" de "quién corre en runtime".
# Corre una sola vez, automáticamente, cuando el volumen de Postgres es nuevo
# (convención de docker-entrypoint-initdb.d de la imagen oficial de postgres).
#
# avre_migrator: owner de las tablas, corre `prisma migrate` y el seed. Puede crear objetos.
# avre_app:      rol de runtime del backend. NOBYPASSRLS explícito — sin esto, las policies
#                de Row-Level Security de la Fase 1 quedarían decorativas para este rol.
set -euo pipefail

: "${POSTGRES_APP_PASSWORD:?falta POSTGRES_APP_PASSWORD}"
: "${POSTGRES_MIGRATOR_PASSWORD:?falta POSTGRES_MIGRATOR_PASSWORD}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'avre_migrator') THEN
	    CREATE ROLE avre_migrator WITH LOGIN PASSWORD '${POSTGRES_MIGRATOR_PASSWORD}' CREATEDB;
	  END IF;

	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'avre_app') THEN
	    CREATE ROLE avre_app WITH LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}' NOBYPASSRLS;
	  END IF;
	END
	\$\$;

	ALTER DATABASE "$POSTGRES_DB" OWNER TO avre_migrator;

	GRANT CONNECT ON DATABASE "$POSTGRES_DB" TO avre_app;
	GRANT USAGE ON SCHEMA public TO avre_app;

	-- Tablas/secuencias que ya existan al momento de correr esto (normalmente ninguna, es un volumen nuevo)
	GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO avre_app;
	GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO avre_app;

	-- Tablas/secuencias futuras creadas por avre_migrator (via prisma migrate) heredan estos grants
	ALTER DEFAULT PRIVILEGES FOR ROLE avre_migrator IN SCHEMA public
	  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO avre_app;
	ALTER DEFAULT PRIVILEGES FOR ROLE avre_migrator IN SCHEMA public
	  GRANT USAGE, SELECT ON SEQUENCES TO avre_app;
EOSQL
