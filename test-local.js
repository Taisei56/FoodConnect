// Quick test to identify deployment issues
console.log('🧪 Testing local deployment...');

// Test imports
try {
    console.log('✅ Testing basic Node.js...');
    
    console.log('🔍 Testing model imports...');
    const UserMVP = require('./src/models/UserMVP');
    console.log('✅ UserMVP imported');
    
    const Restaurant = require('./src/models/Restaurant');
    console.log('✅ Restaurant imported');
    
    const Influencer = require('./src/models/Influencer');
    console.log('✅ Influencer imported');
    
    const Campaign = require('./src/models/Campaign');
    console.log('✅ Campaign imported');
    
    console.log('🔍 Testing controller imports...');
    const RestaurantController = require('./src/controllers/restaurantController');
    console.log('✅ RestaurantController imported');
    
    const InfluencerController = require('./src/controllers/influencerController');
    console.log('✅ InfluencerController imported');
    
    const CampaignController = require('./src/controllers/campaignController');
    console.log('✅ CampaignController imported');
    
    const AuthController = require('./src/controllers/authController');
    console.log('✅ AuthController imported');
    
    console.log('🔍 Testing middleware imports...');
    const auth = require('./src/middleware/auth');
    console.log('✅ Auth middleware imported');
    
    console.log('🎉 All imports successful!');
    
    // Test basic instantiation
    const userMVP = new UserMVP();
    const restaurant = new Restaurant();
    const influencer = new Influencer();
    const campaign = new Campaign();
    
    console.log('🎉 All model instantiations successful!');
    
} catch (error) {
    console.error('❌ Import/instantiation failed:', error.message);
    console.error('📍 Stack trace:', error.stack);
}