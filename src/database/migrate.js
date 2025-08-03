const { pool } = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
    const client = await pool.connect();
    
    try {
        console.log('🔄 Starting database migration...');
        
        const sqlContent = await fs.readFile(
            path.join(__dirname, 'init.sql'), 
            'utf8'
        );
        
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.toLowerCase().includes('create database') || 
                statement.startsWith('\\c')) {
                console.log('⚠️  Skipping database creation statement (run manually if needed)');
                continue;
            }
            
            try {
                await client.query(statement);
                console.log('✅ Executed:', statement.substring(0, 50) + '...');
            } catch (error) {
                if (error.message.includes('already exists')) {
                    console.log('⚠️  Already exists:', statement.substring(0, 50) + '...');
                } else {
                    throw error;
                }
            }
        }
        
        console.log('🎉 Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function seedTestData() {
    const client = await pool.connect();
    
    try {
        console.log('🌱 Seeding test data...');
        
        await client.query('BEGIN');
        
        const testUsers = [
            {
                email: 'restaurant@test.com',
                password: '$2a$10$example.hash.for.testing',
                type: 'restaurant'
            },
            {
                email: 'influencer@test.com', 
                password: '$2a$10$example.hash.for.testing',
                type: 'influencer'
            }
        ];
        
        for (const user of testUsers) {
            const result = await client.query(
                `INSERT INTO users (email, password_hash, user_type, status) 
                 VALUES ($1, $2, $3, 'approved') 
                 ON CONFLICT (email) DO NOTHING 
                 RETURNING id`,
                [user.email, user.password, user.type]
            );
            
            if (result.rows.length > 0) {
                console.log(`✅ Created test ${user.type}: ${user.email}`);
            }
        }
        
        await client.query('COMMIT');
        console.log('🎉 Test data seeded successfully!');
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seeding failed:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

if (require.main === module) {
    (async () => {
        try {
            await runMigration();
            
            if (process.argv.includes('--seed')) {
                await seedTestData();
            }
            
            process.exit(0);
        } catch (error) {
            console.error('Migration script failed:', error);
            process.exit(1);
        }
    })();
}

module.exports = { runMigration, seedTestData };