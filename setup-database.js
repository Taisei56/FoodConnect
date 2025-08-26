// Railway database setup script
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupDatabase() {
    console.log('🚀 Setting up FoodConnect Malaysia database...');
    
    try {
        // Test connection
        console.log('📡 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful!');
        
        // Create users table
        console.log('👥 Creating users table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                user_type VARCHAR(50) NOT NULL CHECK (user_type IN ('restaurant', 'influencer')),
                status VARCHAR(50) DEFAULT 'active',
                email_verified BOOLEAN DEFAULT FALSE,
                email_verification_token VARCHAR(255),
                email_verification_expires TIMESTAMP,
                verification_sent_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create restaurants table
        console.log('🍽️ Creating restaurants table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS restaurants (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                business_name VARCHAR(255),
                location VARCHAR(255),
                cuisine_type VARCHAR(100),
                phone VARCHAR(50),
                description TEXT,
                google_maps TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create influencers table
        console.log('📸 Creating influencers table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS influencers (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                display_name VARCHAR(255),
                instagram_handle VARCHAR(255),
                tiktok_handle VARCHAR(255),
                facebook_page TEXT,
                xiaohongshu_handle VARCHAR(255),
                follower_count INTEGER DEFAULT 0,
                location VARCHAR(255),
                bio TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create email verifications table
        console.log('📧 Creating email verifications table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS email_verifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                verified_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Create indexes for better performance
        console.log('⚡ Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_users_verification_token ON users(email_verification_token)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_restaurants_user_id ON restaurants(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_influencers_user_id ON influencers(user_id)');
        
        console.log('🎉 Database setup completed successfully!');
        console.log('');
        console.log('📊 Database Summary:');
        console.log('  ✅ users - Store user accounts');
        console.log('  ✅ restaurants - Store restaurant profiles');
        console.log('  ✅ influencers - Store influencer profiles');
        console.log('  ✅ email_verifications - Track email verifications');
        console.log('');
        console.log('🚀 Your FoodConnect Malaysia app is now ready!');
        console.log('🔗 Test registration at: https://web-production-902b.up.railway.app/register');
        
    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run setup
setupDatabase();