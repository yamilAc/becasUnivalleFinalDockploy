FROM mysql:8.0

# MySQL ejecuta los archivos de esta carpeta solamente al inicializar un
# volumen vacío. Así quedan creados los roles y el usuario administrador.
COPY backend/scripts/schema.sql /docker-entrypoint-initdb.d/01-schema.sql
