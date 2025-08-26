// PostgreSQL database configuration for Railway
const { Pool } = require('pg');

// Railway provides DATABASE_URL, but we can also use individual variables
const connectionConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
} : {
    host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
    port: process.env.PGPORT || process.env.DB_PORT || 5432,
    database: process.env.PGDATABASE || process.env.DB_NAME || 'foodconnect_malaysia',
    user: process.env.PGUSER || process.env.DB_USER,
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

const pool = new Pool({
    ...connectionConfig,
    max: 10, // Reduced connection pool size for Railway
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased timeout
    acquireTimeoutMillis: 10000,
});

pool.on('connect', (client) => {
    console.log('🗄️  Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('⚠️  PostgreSQL pool error:', err.message);
    // Don't exit the process - let it retry
    console.log('🔄 Database will attempt to reconnect...');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down database pool...');
    await pool.end();
});

process.on('SIGINT', async () => {
    console.log('🛑 Shutting down database pool...');
    await pool.end();
    process.exit(0);
});

module.exports = {
    pool,
    query: (text, params) => pool.query(text, params),
};