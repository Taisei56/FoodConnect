const express = require('express');
const router = express.Router();

// Health check and database test endpoint
router.get('/db-test', async (req, res) => {
    const results = {
        timestamp: new Date().toISOString(),
        server: 'running',
        database: 'unknown',
        environment: process.env.NODE_ENV || 'development',
        databaseConfig: {
            hasConnectionString: !!process.env.DATABASE_URL,
            hasIndividualVars: !!(process.env.PGHOST && process.env.PGUSER),
            pghost: process.env.PGHOST ? 'set' : 'missing',
            pgport: process.env.PGPORT || 'not set',
            pgdatabase: process.env.PGDATABASE ? 'set' : 'missing',
            pguser: process.env.PGUSER ? 'set' : 'missing',
            pgpassword: process.env.PGPASSWORD ? 'set' : 'missing'
        },
        tests: []
    };
    
    // Test 1: Database connection
    try {
        console.log('🧪 Testing database connection...');
        const db = require('../config/database');
        
        const testQuery = await db.query('SELECT NOW() as current_time, version() as postgres_version');
        
        results.database = 'connected';
        results.tests.push({
            test: 'Database Connection',
            status: 'PASS',
            details: {
                currentTime: testQuery.rows[0].current_time,
                postgresVersion: testQuery.rows[0].postgres_version.split(' ')[0] + ' ' + testQuery.rows[0].postgres_version.split(' ')[1]
            }
        });
        
        console.log('✅ Database connection test passed');
        
    } catch (error) {
        results.database = 'failed';
        results.tests.push({
            test: 'Database Connection',
            status: 'FAIL',
            error: error.message,
            errorCode: error.code,
            errorDetails: {
                errno: error.errno,
                syscall: error.syscall,
                address: error.address,
                port: error.port
            }
        });
        
        console.log('❌ Database connection test failed:', error.message);
    }
    
    // Test 2: Check if tables exist
    if (results.database === 'connected') {
        try {
            console.log('🧪 Testing database tables...');
            const db = require('../config/database');
            
            const tableCheck = await db.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                ORDER BY table_name
            `);
            
            const tables = tableCheck.rows.map(row => row.table_name);
            
            results.tests.push({
                test: 'Database Tables',
                status: tables.length > 0 ? 'PASS' : 'EMPTY',
                details: {
                    tablesFound: tables,
                    tablesCount: tables.length,
                    expectedTables: ['users', 'restaurants', 'influencers', 'email_verifications'],
                    needsSetup: !tables.includes('users')
                }
            });
            
            console.log('✅ Database tables test completed');
            
        } catch (error) {
            results.tests.push({
                test: 'Database Tables',
                status: 'FAIL',
                error: error.message
            });
            
            console.log('❌ Database tables test failed:', error.message);
        }
    }
    
    // Test 3: Registration capability
    results.tests.push({
        test: 'Registration Mode',
        status: results.database === 'connected' ? 'FULL_MODE' : 'MVP_MODE',
        details: {
            description: results.database === 'connected' 
                ? 'Database connected - registrations will be saved permanently'
                : 'Database not available - registrations will work in MVP mode (temporary storage)'
        }
    });
    
    res.json(results);
});

// Simple ping endpoint
router.get('/ping', (req, res) => {
    res.json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        message: 'FoodConnect Malaysia server is running'
    });
});

module.exports = router;