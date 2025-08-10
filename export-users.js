#!/usr/bin/env node

/**
 * User Data Export Utility
 * 
 * This script exports all registered user data from the MVP for migration
 * to the production system when it launches in September 2025.
 */

const { _data } = require('./src/config/simple-db');

function exportUserData() {
    const exportData = {
        exportDate: new Date().toISOString(),
        mvpVersion: '1.0.0',
        totalUsers: _data.users.length,
        users: _data.users.map(user => ({
            id: user.id,
            email: user.email,
            user_type: user.user_type,
            status: user.status,
            registered_at: user.created_at,
            // Don't export password hashes for security - production system will generate new passwords
            needs_password_reset: true
        })),
        restaurants: _data.restaurants.map(restaurant => ({
            user_id: restaurant.user_id,
            business_name: restaurant.business_name,
            location: restaurant.location,
            cuisine_type: restaurant.cuisine_type,
            phone: restaurant.phone,
            description: restaurant.description,
            profile_image: restaurant.profile_image,
            registered_at: restaurant.created_at
        })),
        influencers: _data.influencers.map(influencer => ({
            user_id: influencer.user_id,
            display_name: influencer.display_name,
            instagram_handle: influencer.instagram_handle,
            follower_count: influencer.follower_count,
            location: influencer.location,
            bio: influencer.bio,
            profile_image: influencer.profile_image,
            portfolio_images: influencer.portfolio_images,
            registered_at: influencer.created_at
        })),
        summary: {
            restaurant_users: _data.users.filter(u => u.user_type === 'restaurant').length,
            influencer_users: _data.users.filter(u => u.user_type === 'influencer').length,
            pending_users: _data.users.filter(u => u.status === 'pending').length,
            approved_users: _data.users.filter(u => u.status === 'approved').length
        }
    };

    return exportData;
}

// If run directly from command line
if (require.main === module) {
    const data = exportUserData();
    console.log('='.repeat(60));
    console.log('📊 FoodConnect Malaysia MVP - User Export');
    console.log('='.repeat(60));
    console.log(`Export Date: ${data.exportDate}`);
    console.log(`Total Registered Users: ${data.totalUsers}`);
    console.log(`└─ Restaurant Owners: ${data.summary.restaurant_users}`);
    console.log(`└─ Food Influencers: ${data.summary.influencer_users}`);
    console.log(`└─ Pending Status: ${data.summary.pending_users}`);
    console.log(`└─ Approved Status: ${data.summary.approved_users}`);
    console.log('='.repeat(60));
    
    // Write to JSON file
    const fs = require('fs');
    const filename = `user-export-${new Date().toISOString().split('T')[0]}.json`;
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
    console.log(`✅ Data exported to: ${filename}`);
    console.log('📧 This file can be used to migrate users to production system');
    console.log('='.repeat(60));
}

module.exports = { exportUserData };