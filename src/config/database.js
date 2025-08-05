// PostgreSQL database configuration for production
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'foodconnect_malaysia',
    user: process.env.PGUSER || process.env.DB_USER,
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
    process.exit(-1);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};