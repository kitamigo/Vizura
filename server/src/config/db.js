const { Pool } = require('pg');

const databaseUrl = process.env.DATABASE_URL;
const databasePort = Number(process.env.DB_PORT || 5432);
const poolMax = Number(process.env.DB_POOL_MAX || 10);

if (!databaseUrl && (!process.env.DB_HOST || !process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD)) {
    throw new Error(
        'Database configuration is missing. Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASSWORD.'
    );
}

if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) {
    throw new Error('DB_PORT must be a valid TCP port.');
}

if (!Number.isInteger(poolMax) || poolMax < 1) {
    throw new Error('DB_POOL_MAX must be a positive integer.');
}

const pool = new Pool({
    ...(databaseUrl
        ? { connectionString: databaseUrl }
        : {
            host: process.env.DB_HOST,
            port: databasePort,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD
        }),
    // Azure Database for PostgreSQL requires TLS. Keep certificate validation enabled.
    ssl: {
        rejectUnauthorized: true
    },
    max: poolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Database connection error:', err.message);
        return;
    }

    console.log('Connected to Vizura PostgreSQL database');
    release();
});

pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err.message);
});

module.exports = pool;