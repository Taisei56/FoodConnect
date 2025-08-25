const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function migrateVerification() {
    console.log('🔄 Starting email verification migration...');
    
    try {
        // Read and execute the verification migration SQL
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, 'add-verification.sql'),
            'utf8'
        );
        
        await db.query(migrationSQL);
        
        console.log('✅ Email verification migration completed successfully!');
        console.log('');
        console.log('📊 Updated schema includes:');
        console.log('  - email_verified column in users table');
        console.log('  - email_verification_token column in users table');
        console.log('  - email_verification_expires column in users table');
        console.log('  - verification_sent_at column in users table');
        console.log('  - email_verifications table for tracking');
        console.log('  - Proper indexes for performance');
        console.log('');
        console.log('🚀 Your database is now ready for email verification!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        
        // Check if columns already exist (migration already ran)
        if (error.message.includes('already exists')) {
            console.log('ℹ️  Email verification schema already exists - no migration needed');
        } else {
            process.exit(1);
        }
    }
}

// Run if called directly
if (require.main === module) {
    migrateVerification()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Migration error:', error);
            process.exit(1);
        });
}

module.exports = migrateVerification;