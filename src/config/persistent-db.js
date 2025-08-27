// Persistent file-based database for MVP mode
// This stores user data in JSON files to persist across server restarts

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

let nextId = 1000; // Start with 1000 to avoid conflicts
const generateId = () => nextId++;

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Load data from files
async function loadData() {
    await ensureDataDir();
    
    let users = [];
    
    try {
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        users = JSON.parse(usersData);
        
        // Update nextId to avoid conflicts
        if (users.length > 0) {
            const maxId = Math.max(...users.map(u => u.id));
            nextId = Math.max(nextId, maxId + 1);
        }
    } catch (error) {
        console.log('📝 No existing user data found, starting fresh');
        // File doesn't exist or is corrupt, start with empty array
        users = [];
    }
    
    return { users };
}

// Save data to files
async function saveData(data) {
    await ensureDataDir();
    await fs.writeFile(USERS_FILE, JSON.stringify(data.users, null, 2), 'utf8');
}

// In-memory cache
let dataCache = null;

// Initialize data cache
async function initializeData() {
    if (!dataCache) {
        dataCache = await loadData();
        console.log('📂 Loaded persistent data:', {
            users: dataCache.users.length,
            nextId
        });
    }
    return dataCache;
}

// Helper function to find records
const findRecord = (table, predicate) => {
    return dataCache[table].find(predicate);
};

const findRecords = (table, predicate) => {
    return predicate ? dataCache[table].filter(predicate) : dataCache[table];
};

// Mock query function that mimics PostgreSQL responses with persistent storage
const query = async (text, params = []) => {
    // Ensure data is loaded
    await initializeData();
    
    const lowerText = text.toLowerCase().trim();
    
    try {
        // Handle INSERT operations
        if (lowerText.startsWith('insert into users')) {
            const [email, password_hash, user_type, verificationToken, verificationExpires] = params;
            
            // Check if email already exists
            const existingUser = dataCache.users.find(u => u.email === email);
            if (existingUser) {
                throw new Error('Email already registered');
            }
            
            const newUser = {
                id: generateId(),
                email,
                password_hash,
                user_type,
                status: 'approved',
                email_verified: false, // Start as unverified
                email_verification_token: verificationToken,
                email_verification_expires: verificationExpires,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            dataCache.users.push(newUser);
            await saveData(dataCache);
            
            console.log('✅ User created and saved:', { id: newUser.id, email: newUser.email, user_type: newUser.user_type });
            return { rows: [newUser] };
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
        
        // Handle UPDATE operations
        if (lowerText.includes('update users set email_verified = true')) {
            const [user_id] = params;
            const userIndex = dataCache.users.findIndex(u => u.id === parseInt(user_id));
            if (userIndex !== -1) {
                dataCache.users[userIndex].email_verified = true;
                dataCache.users[userIndex].email_verification_token = null;
                dataCache.users[userIndex].email_verification_expires = null;
                dataCache.users[userIndex].updated_at = new Date().toISOString();
                
                await saveData(dataCache);
                return { rows: [dataCache.users[userIndex]] };
            }
            return { rows: [] };
        }
        
        // Default empty result for unhandled queries
        console.log('Unhandled persistent query:', text, params);
        return { rows: [] };
        
    } catch (error) {
        console.error('Persistent query error:', error);
        throw error;
    }
};

// Mock pool object to replace PostgreSQL pool
const pool = {
    connect: async () => {
        await initializeData();
        return {
            query: query,
            release: () => {} // No-op for file-based storage
        };
    },
    query: query
};

module.exports = {
    pool,
    query,
    initializeData,
    // Export for debugging
    _getCache: () => dataCache
};