const fs = require('fs');
const path = require('path');

async function runMVPMigration() {
    try {
        console.log('🚀 Starting Restaurant-Influencer Marketplace MVP Migration...');
        
        // Try PostgreSQL first
        try {
            const db = require('../config/database');
            const sqlPath = path.join(__dirname, 'init-mvp.sql');
            const sql = fs.readFileSync(sqlPath, 'utf8');
            
            console.log('📊 Running PostgreSQL migration...');
            await db.query(sql);
            
            console.log('✅ PostgreSQL migration completed successfully!');
            console.log('🏪 Restaurant-Influencer Marketplace database is ready');
            console.log('👤 Default admin account created: admin@foodconnect.my');
            console.log('🔑 Admin password: AdminFoodConnect2025!');
            
        } catch (dbError) {
            console.log('⚠️ PostgreSQL not available, using JSON fallback storage');
            
            // Create data directories for JSON storage
            const dataDir = path.join(__dirname, '../../data');
            const mvpDataDir = path.join(dataDir, 'mvp');
            
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            
            if (!fs.existsSync(mvpDataDir)) {
                fs.mkdirSync(mvpDataDir, { recursive: true });
            }
            
            // Initialize JSON storage files
            const jsonFiles = {
                'users.json': [],
                'restaurants.json': [],
                'influencers.json': [],
                'campaigns.json': [],
                'applications.json': [],
                'messages.json': [],
                'payments.json': [],
                'support_tickets.json': [],
                'platform_settings.json': [
                    { key: 'platform_fee_percentage', value: '15.0', description: 'Platform fee percentage (15%)' },
                    { key: 'min_campaign_budget', value: '100.0', description: 'Minimum campaign budget in RM' },
                    { key: 'max_campaign_duration_days', value: '60', description: 'Maximum campaign duration in days' },
                    { key: 'auto_approve_restaurants', value: 'false', description: 'Auto-approve restaurant registrations' },
                    { key: 'auto_approve_influencers', value: 'false', description: 'Auto-approve influencer registrations' },
                    { key: 'touch_n_go_business_account', value: '', description: 'Touch n Go business account for payments' },
                    { key: 'admin_email', value: 'admin@foodconnect.my', description: 'Admin email for notifications' },
                    { key: 'site_maintenance_mode', value: 'false', description: 'Site maintenance mode toggle' }
                ]
            };
            
            // Create initial JSON files
            for (const [filename, initialData] of Object.entries(jsonFiles)) {
                const filePath = path.join(mvpDataDir, filename);
                if (!fs.existsSync(filePath)) {
                    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
                    console.log(`📄 Created ${filename}`);
                }
            }
            
            // Create default admin user in JSON
            const usersPath = path.join(mvpDataDir, 'users.json');
            const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            
            const adminExists = users.find(u => u.email === 'admin@foodconnect.my');
            if (!adminExists) {
                const bcrypt = require('bcryptjs');
                const adminUser = {
                    id: 1,
                    email: 'admin@foodconnect.my',
                    password_hash: await bcrypt.hash('AdminFoodConnect2025!', 8),
                    user_type: 'admin',
                    status: 'active',
                    email_verified: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                
                users.push(adminUser);
                fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
                console.log('👤 Default admin account created in JSON storage');
            }
            
            console.log('✅ JSON fallback storage initialized successfully!');
            console.log('🏪 Restaurant-Influencer Marketplace is ready (JSON mode)');
            console.log('👤 Default admin account: admin@foodconnect.my');
            console.log('🔑 Admin password: AdminFoodConnect2025!');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

// Helper functions for tier calculation
function calculateInfluencerTier(instagramFollowers = 0, tiktokFollowers = 0, xhsFollowers = 0, youtubeFollowers = 0) {
    const maxFollowers = Math.max(instagramFollowers, tiktokFollowers, xhsFollowers, youtubeFollowers);
    
    if (maxFollowers >= 100000) return 'mega';
    if (maxFollowers >= 50000) return 'major';
    if (maxFollowers >= 20000) return 'large';
    if (maxFollowers >= 10000) return 'established';
    if (maxFollowers >= 5000) return 'growing';
    return 'emerging';
}

// Malaysian states and cities data
const malaysianLocations = {
    'Kuala Lumpur': ['Kuala Lumpur City', 'Cheras', 'Ampang', 'Setapak', 'Wangsa Maju'],
    'Selangor': ['Shah Alam', 'Petaling Jaya', 'Subang Jaya', 'Klang', 'Kajang', 'Puchong'],
    'Penang': ['Georgetown', 'Butterworth', 'Bayan Lepas', 'Tanjung Bungah'],
    'Johor': ['Johor Bahru', 'Skudai', 'Iskandar Puteri', 'Kluang'],
    'Perak': ['Ipoh', 'Taiping', 'Kampar', 'Teluk Intan'],
    'Kedah': ['Alor Setar', 'Sungai Petani', 'Kulim'],
    'Kelantan': ['Kota Bharu', 'Tanah Merah'],
    'Terengganu': ['Kuala Terengganu', 'Kemaman'],
    'Pahang': ['Kuantan', 'Temerloh', 'Bentong'],
    'Negeri Sembilan': ['Seremban', 'Port Dickson', 'Nilai'],
    'Melaka': ['Melaka City', 'Alor Gajah'],
    'Sarawak': ['Kuching', 'Miri', 'Sibu'],
    'Sabah': ['Kota Kinabalu', 'Sandakan', 'Tawau']
};

module.exports = {
    runMVPMigration,
    calculateInfluencerTier,
    malaysianLocations
};

// Run migration if called directly
if (require.main === module) {
    runMVPMigration()
        .then(() => {
            console.log('🎉 MVP Migration completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Migration failed:', error);
            process.exit(1);
        });
}