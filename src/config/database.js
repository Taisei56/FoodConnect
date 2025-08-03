// Use simple in-memory database for easy launch
// For production, switch back to PostgreSQL by uncommenting the code below

const { pool, query } = require('./simple-db');

module.exports = {
    pool,
    query,
};

/* PostgreSQL version (uncomment for production):
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'foodconnect_malaysia',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
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
*/