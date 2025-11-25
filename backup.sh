#!/bin/bash

PG_USER=$DB_USER
PG_DB=$DB_NAME
PG_HOST=database
PG_PASSWORD=$DB_PASSWORD
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/backups/${PG_DB}_${TIMESTAMP}.sql"

echo "Creating database dump of $PG_DB to $BACKUP_FILE"

export PGPASSWORD=$PG_PASSWORD

pg_dump -h $PG_HOST -U $PG_USER -d $PG_DB > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo "Dump successful : $BACKUP_FILE"
else
    echo "Error while dumping database"
    exit 1
fi
