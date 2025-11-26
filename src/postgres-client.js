const { Client: PostgresClient } = require('pg');
const config = require('./config.js');
const { logInfo, logWarn, logError } = require('./utils.js');

const { host: DB_HOST, port: DB_PORT, name: DB_NAME, user: DB_USER, pass: DB_PASS } = config.db;

let postgresClientInstance;

/**
 * Get the postgres client instance
 * @returns {Promise<PostgresClient> | undefined} The postgres client instance
 */
async function getPostgresClient(dbHost = DB_HOST, dbPort = DB_PORT, dbName = DB_NAME, dbUser = DB_USER, dbPass = DB_PASS) {
    if (!postgresClientInstance) {
        logInfo('Creating postgres client instance');
        postgresClientInstance = new PostgresClient({
            user: dbUser,
            host: dbHost,
            database: dbName,
            password: dbPass,
            port: dbPort,
        });

        try {
            await postgresClientInstance.connect();
            logInfo('Connected to postgres');
        } catch (err) {
            logError(err);
            logError('Failed to connect to postgres');
            postgresClientInstance = undefined;
        }
    }
    return postgresClientInstance;
}

module.exports = {
    getPostgresClient
}
