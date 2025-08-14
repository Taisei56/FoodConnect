// Simple in-memory database for development/demo purposes
// This replaces the PostgreSQL dependency to make the app launchable immediately

let nextId = 100;
const generateId = () => nextId++;

// In-memory data storage
const data = {
    users: [
        {
            id: 1,
            email: 'restaurant@demo.com',
            password_hash: '$2b$12$j5Wr6e5Pg0do5ubmAvKAL.wgB4LgeI7yggrnaeyA7oJxmgbR1gEB2', // password: 'Demo123A'
            user_type: 'restaurant',
            status: 'approved',
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01')
        },
        {
            id: 2,
            email: 'influencer@demo.com',
            password_hash: '$2b$12$j5Wr6e5Pg0do5ubmAvKAL.wgB4LgeI7yggrnaeyA7oJxmgbR1gEB2', // password: 'Demo123A'
            user_type: 'influencer',
            status: 'approved',
            created_at: new Date('2024-01-01'),
            updated_at: new Date('2024-01-01')
        }
    ],
    restaurants: [
        {
            id: 1,
            user_id: 1,
            business_name: 'Demo Restaurant',
            location: 'Kuala Lumpur',
            cuisine_type: 'Malaysian',
            phone: '+60123456789',
            description: 'Authentic Malaysian cuisine in the heart of KL',
            profile_image: null,
            created_at: new Date('2024-01-01')
        }
    ],
    influencers: [
        {
            id: 1,
            user_id: 2,
            display_name: 'Demo Influencer',
            instagram_handle: '@demo_foodie',
            follower_count: 10000,
            location: 'Kuala Lumpur',
            bio: 'Food enthusiast sharing delicious discoveries across Malaysia',
            profile_image: null,
            portfolio_images: [],
            created_at: new Date('2024-01-01')
        }
    ],
    campaigns: [
        {
            id: 1,
            restaurant_id: 1,
            title: 'New Menu Launch Campaign',
            description: 'Help us promote our exciting new fusion menu featuring traditional Malaysian flavors with modern twists.',
            budget_per_influencer: 500.00,
            meal_value: 100.00,
            max_influencers: 3,
            requirements: 'Must have 5K+ followers, create 2 posts and 1 story',
            location: 'Kuala Lumpur',
            deadline: new Date('2024-12-31'),
            status: 'active',
            created_at: new Date('2024-01-15')
        }
    ],
    applications: [],
    commissions: []
};

// Helper function to find records
const findRecord = (table, predicate) => {
    return data[table].find(predicate);
};

const findRecords = (table, predicate) => {
    return predicate ? data[table].filter(predicate) : data[table];
};

// Mock query function that mimics PostgreSQL responses
const query = async (text, params = []) => {
    // Extract table and operation from SQL-like text
    const lowerText = text.toLowerCase().trim();
    
    try {
        // Handle INSERT operations
        if (lowerText.startsWith('insert into users')) {
            const [email, password_hash, user_type] = params;
            
            // Check if email already exists
            const existingUser = data.users.find(u => u.email === email);
            if (existingUser) {
                throw new Error('Email already registered');
            }
            
            const newUser = {
                id: generateId(),
                email,
                password_hash,
                user_type,
                status: 'approved',
                created_at: new Date(),
                updated_at: new Date()
            };
            data.users.push(newUser);
            console.log('✅ User created:', { id: newUser.id, email: newUser.email, user_type: newUser.user_type });
            return { rows: [newUser] };
        }
        
        if (lowerText.startsWith('insert into restaurants')) {
            const [user_id, business_name, location, cuisine_type, phone, description, profile_image] = params;
            const newRestaurant = {
                id: generateId(),
                user_id: parseInt(user_id),
                business_name,
                location,
                cuisine_type,
                phone,
                description,
                profile_image,
                created_at: new Date(),
                updated_at: new Date()
            };
            data.restaurants.push(newRestaurant);
            return { rows: [newRestaurant] };
        }
        
        if (lowerText.startsWith('insert into influencers')) {
            const [user_id, display_name, instagram_handle, follower_count, location, bio, profile_image, portfolio_images] = params;
            const newInfluencer = {
                id: generateId(),
                user_id: parseInt(user_id),
                display_name,
                instagram_handle,
                follower_count: parseInt(follower_count) || 0,
                location,
                bio,
                profile_image,
                portfolio_images: portfolio_images || [],
                created_at: new Date(),
                updated_at: new Date()
            };
            data.influencers.push(newInfluencer);
            return { rows: [newInfluencer] };
        }
        
        if (lowerText.startsWith('insert into campaigns')) {
            const [restaurant_id, title, description, budget_per_influencer, meal_value, max_influencers, requirements, location, deadline] = params;
            const newCampaign = {
                id: generateId(),
                restaurant_id: parseInt(restaurant_id),
                title,
                description,
                budget_per_influencer: parseFloat(budget_per_influencer),
                meal_value: parseFloat(meal_value) || 0,
                max_influencers: parseInt(max_influencers) || 1,
                requirements,
                location,
                deadline: new Date(deadline),
                status: 'active',
                created_at: new Date(),
                updated_at: new Date()
            };
            data.campaigns.push(newCampaign);
            return { rows: [newCampaign] };
        }
        
        if (lowerText.startsWith('insert into applications')) {
            const [campaign_id, influencer_id, message] = params;
            const newApplication = {
                id: generateId(),
                campaign_id: parseInt(campaign_id),
                influencer_id: parseInt(influencer_id),
                status: 'pending',
                message,
                applied_at: new Date(),
                updated_at: new Date()
            };
            data.applications.push(newApplication);
            return { rows: [newApplication] };
        }
        
        // Handle SELECT operations
        if (lowerText.includes('select * from users where email =')) {
            const [email] = params;
            const user = findRecord('users', u => u.email === email);
            return { rows: user ? [user] : [] };
        }
        
        if (lowerText.includes('select * from users where id =')) {
            const [id] = params;
            const user = findRecord('users', u => u.id === parseInt(id));
            return { rows: user ? [user] : [] };
        }
        
        if (lowerText.includes('select * from restaurants where user_id =')) {
            const [user_id] = params;
            const restaurant = findRecord('restaurants', r => r.user_id === parseInt(user_id));
            return { rows: restaurant ? [restaurant] : [] };
        }
        
        if (lowerText.includes('select * from influencers where user_id =')) {
            const [user_id] = params;
            const influencer = findRecord('influencers', i => i.user_id === parseInt(user_id));
            return { rows: influencer ? [influencer] : [] };
        }
        
        // Handle campaigns with joins
        if (lowerText.includes('from campaigns c') && lowerText.includes('join restaurants r')) {
            const campaigns = data.campaigns.map(campaign => {
                const restaurant = findRecord('restaurants', r => r.id === campaign.restaurant_id);
                return {
                    ...campaign,
                    business_name: restaurant?.business_name || 'Unknown Restaurant',
                    restaurant_location: restaurant?.location || '',
                    restaurant_image: restaurant?.profile_image || null,
                    application_count: data.applications.filter(a => a.campaign_id === campaign.id).length
                };
            });
            return { rows: campaigns };
        }
        
        // Handle UPDATE operations
        if (lowerText.startsWith('update users set status =')) {
            const [status, id] = params;
            const userIndex = data.users.findIndex(u => u.id === parseInt(id));
            if (userIndex !== -1) {
                data.users[userIndex].status = status;
                data.users[userIndex].updated_at = new Date();
                return { rows: [data.users[userIndex]] };
            }
            return { rows: [] };
        }
        
        if (lowerText.startsWith('update users set password_hash =')) {
            const [password_hash, id] = params;
            const userIndex = data.users.findIndex(u => u.id === parseInt(id));
            if (userIndex !== -1) {
                data.users[userIndex].password_hash = password_hash;
                data.users[userIndex].updated_at = new Date();
                return { rows: [{ id: data.users[userIndex].id, email: data.users[userIndex].email }] };
            }
            return { rows: [] };
        }
        
        // Default empty result for unhandled queries
        console.log('Unhandled query:', text, params);
        return { rows: [] };
        
    } catch (error) {
        console.error('Query error:', error);
        throw error;
    }
};

// Mock pool object to replace PostgreSQL pool
const pool = {
    on: (event, callback) => {
        if (event === 'connect') {
            setTimeout(() => {
                console.log('🗄️  Connected to Simple In-Memory Database');
                callback();
            }, 100);
        }
    },
    query: query
};

module.exports = {
    pool,
    query,
    // Export data for debugging
    _data: data
};