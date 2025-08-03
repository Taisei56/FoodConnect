-- FoodConnect Malaysia Database Schema
-- This script creates all necessary tables and relationships

-- Create database (run manually if needed)
-- CREATE DATABASE foodconnect_malaysia;

-- Connect to the database
-- \c foodconnect_malaysia;

-- Create ENUM types
CREATE TYPE user_type_enum AS ENUM ('restaurant', 'influencer');
CREATE TYPE user_status_enum AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE campaign_status_enum AS ENUM ('active', 'closed', 'completed');
CREATE TYPE application_status_enum AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE commission_status_enum AS ENUM ('pending', 'invoiced', 'paid');

-- Users table (shared for restaurants and influencers)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type user_type_enum NOT NULL,
    status user_status_enum DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurant profiles
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    business_name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    cuisine_type VARCHAR(100),
    phone VARCHAR(20),
    description TEXT,
    profile_image VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Influencer profiles
CREATE TABLE influencers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    instagram_handle VARCHAR(100),
    follower_count INTEGER,
    location VARCHAR(255) NOT NULL,
    bio TEXT,
    profile_image VARCHAR(255),
    portfolio_images TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    budget_per_influencer DECIMAL(10,2) NOT NULL,
    meal_value DECIMAL(10,2) DEFAULT 0,
    max_influencers INTEGER DEFAULT 1,
    requirements TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    deadline DATE,
    status campaign_status_enum DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Applications
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    status application_status_enum DEFAULT 'pending',
    message TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, influencer_id)
);

-- Commission tracking
CREATE TABLE commissions (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    campaign_amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 15.00,
    commission_amount DECIMAL(10,2) NOT NULL,
    status commission_status_enum DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX idx_influencers_user_id ON influencers(user_id);
CREATE INDEX idx_campaigns_restaurant_id ON campaigns(restaurant_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_applications_campaign_id ON applications(campaign_id);
CREATE INDEX idx_applications_influencer_id ON applications(influencer_id);
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_commissions_campaign_id ON commissions(campaign_id);
CREATE INDEX idx_commissions_status ON commissions(status);

-- Create trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at 
    BEFORE UPDATE ON restaurants 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_influencers_updated_at 
    BEFORE UPDATE ON influencers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at 
    BEFORE UPDATE ON applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commissions_updated_at 
    BEFORE UPDATE ON commissions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();