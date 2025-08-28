-- Restaurant-Influencer Marketplace MVP Database Schema
-- Complete schema for production-ready marketplace

-- Create ENUM types
CREATE TYPE user_type_enum AS ENUM ('restaurant', 'influencer', 'admin');
CREATE TYPE user_status_enum AS ENUM ('pending', 'approved', 'rejected', 'suspended', 'active');
CREATE TYPE campaign_status_enum AS ENUM ('draft', 'published', 'applications_open', 'in_progress', 'completed', 'paid');
CREATE TYPE application_status_enum AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE payment_status_enum AS ENUM ('pending', 'received', 'held', 'released', 'cancelled');
CREATE TYPE influencer_tier_enum AS ENUM ('emerging', 'growing', 'established', 'large', 'major', 'mega');
CREATE TYPE dietary_category_enum AS ENUM ('halal_certified', 'halal_friendly', 'non_halal', 'vegetarian', 'vegan', 'no_beef', 'no_pork');
CREATE TYPE content_status_enum AS ENUM ('pending', 'submitted', 'approved', 'rejected', 'posted');
CREATE TYPE message_status_enum AS ENUM ('sent', 'delivered', 'read');
CREATE TYPE ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- Users table (shared for restaurants, influencers, and admin)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    user_type user_type_enum NOT NULL,
    status user_status_enum DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restaurant profiles
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    business_name VARCHAR(255) NOT NULL,
    description TEXT,
    phone VARCHAR(20),
    address TEXT NOT NULL,
    google_maps_link TEXT,
    dietary_categories dietary_category_enum[] DEFAULT ARRAY[]::dietary_category_enum[],
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    profile_image VARCHAR(255),
    business_hours JSONB,
    website VARCHAR(255),
    admin_notes TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Influencer profiles with social media integration
CREATE TABLE influencers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    bio TEXT,
    location VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    instagram_username VARCHAR(100),
    instagram_link VARCHAR(255),
    instagram_followers INTEGER DEFAULT 0,
    tiktok_username VARCHAR(100),
    tiktok_link VARCHAR(255),
    tiktok_followers INTEGER DEFAULT 0,
    xhs_username VARCHAR(100),
    xhs_link VARCHAR(255),
    xhs_followers INTEGER DEFAULT 0,
    youtube_channel VARCHAR(255),
    youtube_followers INTEGER DEFAULT 0,
    tier influencer_tier_enum,
    profile_image VARCHAR(255),
    portfolio_images TEXT[],
    admin_notes TEXT,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Follower count update requests
CREATE TABLE follower_updates (
    id SERIAL PRIMARY KEY,
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- 'instagram', 'tiktok', 'xhs', 'youtube'
    current_count INTEGER NOT NULL,
    requested_count INTEGER NOT NULL,
    evidence_url TEXT,
    status user_status_enum DEFAULT 'pending',
    admin_notes TEXT,
    processed_by INTEGER REFERENCES users(id),
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    brief TEXT NOT NULL, -- Detailed campaign requirements
    total_budget DECIMAL(10,2) NOT NULL,
    deadline DATE,
    location VARCHAR(255) NOT NULL,
    dietary_categories dietary_category_enum[] DEFAULT ARRAY[]::dietary_category_enum[],
    target_tiers influencer_tier_enum[] DEFAULT ARRAY[]::influencer_tier_enum[],
    max_influencers INTEGER DEFAULT 5,
    status campaign_status_enum DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign budget allocation by tier
CREATE TABLE campaign_budgets (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    tier influencer_tier_enum NOT NULL,
    budget_per_influencer DECIMAL(10,2) NOT NULL,
    max_influencers INTEGER NOT NULL,
    allocated_count INTEGER DEFAULT 0,
    UNIQUE(campaign_id, tier)
);

-- Applications
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    status application_status_enum DEFAULT 'pending',
    message TEXT,
    proposed_timeline TEXT,
    portfolio_examples TEXT[],
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, influencer_id)
);

-- Content production workflow
CREATE TABLE content_submissions (
    id SERIAL PRIMARY KEY,
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    video_url VARCHAR(255) NOT NULL,
    description TEXT,
    platforms VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[], -- platforms where posted
    status content_status_enum DEFAULT 'pending',
    restaurant_feedback TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP,
    approved_at TIMESTAMP,
    posted_at TIMESTAMP
);

-- Messages/Chat system
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    attachment_url VARCHAR(255),
    status message_status_enum DEFAULT 'sent',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- Payment management
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    influencer_id INTEGER REFERENCES influencers(id) ON DELETE CASCADE,
    application_id INTEGER REFERENCES applications(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    platform_fee DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    status payment_status_enum DEFAULT 'pending',
    transaction_reference VARCHAR(100),
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support tickets
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    category VARCHAR(50) DEFAULT 'general',
    priority VARCHAR(20) DEFAULT 'normal',
    status ticket_status_enum DEFAULT 'open',
    assigned_to INTEGER REFERENCES users(id),
    admin_response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform settings
CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit trail
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_verification_token ON users(email_verification_token);

CREATE INDEX idx_restaurants_user_id ON restaurants(user_id);
CREATE INDEX idx_restaurants_city ON restaurants(city);
CREATE INDEX idx_restaurants_state ON restaurants(state);
CREATE INDEX idx_restaurants_status ON restaurants(user_id) WHERE (SELECT status FROM users WHERE id = user_id) = 'approved';

CREATE INDEX idx_influencers_user_id ON influencers(user_id);
CREATE INDEX idx_influencers_tier ON influencers(tier);
CREATE INDEX idx_influencers_city ON influencers(city);
CREATE INDEX idx_influencers_state ON influencers(state);

CREATE INDEX idx_campaigns_restaurant_id ON campaigns(restaurant_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_deadline ON campaigns(deadline);
CREATE INDEX idx_campaigns_tiers ON campaigns USING GIN(target_tiers);

CREATE INDEX idx_applications_campaign_id ON applications(campaign_id);
CREATE INDEX idx_applications_influencer_id ON applications(influencer_id);
CREATE INDEX idx_applications_status ON applications(status);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_campaign_id ON messages(campaign_id);
CREATE INDEX idx_messages_sent_at ON messages(sent_at);

CREATE INDEX idx_payments_campaign_id ON payments(campaign_id);
CREATE INDEX idx_payments_restaurant_id ON payments(restaurant_id);
CREATE INDEX idx_payments_influencer_id ON payments(influencer_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- Create trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_influencers_updated_at BEFORE UPDATE ON influencers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON support_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate influencer tier based on highest follower count
CREATE OR REPLACE FUNCTION calculate_influencer_tier(
    instagram_count INTEGER DEFAULT 0,
    tiktok_count INTEGER DEFAULT 0,
    xhs_count INTEGER DEFAULT 0,
    youtube_count INTEGER DEFAULT 0
) RETURNS influencer_tier_enum AS $$
DECLARE
    max_followers INTEGER;
BEGIN
    max_followers := GREATEST(
        COALESCE(instagram_count, 0),
        COALESCE(tiktok_count, 0),
        COALESCE(xhs_count, 0),
        COALESCE(youtube_count, 0)
    );
    
    IF max_followers >= 100000 THEN
        RETURN 'mega';
    ELSIF max_followers >= 50000 THEN
        RETURN 'major';
    ELSIF max_followers >= 20000 THEN
        RETURN 'large';
    ELSIF max_followers >= 10000 THEN
        RETURN 'established';
    ELSIF max_followers >= 5000 THEN
        RETURN 'growing';
    ELSE
        RETURN 'emerging';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate tier when follower counts change
CREATE OR REPLACE FUNCTION update_influencer_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tier = calculate_influencer_tier(
        NEW.instagram_followers,
        NEW.tiktok_followers,
        NEW.xhs_followers,
        NEW.youtube_followers
    );
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calculate_tier_on_update 
    BEFORE INSERT OR UPDATE ON influencers 
    FOR EACH ROW EXECUTE FUNCTION update_influencer_tier();

-- Insert initial platform settings
INSERT INTO platform_settings (setting_key, setting_value, description) VALUES
('platform_fee_percentage', '15.0', 'Platform fee percentage (15%)'),
('min_campaign_budget', '100.0', 'Minimum campaign budget in RM'),
('max_campaign_duration_days', '60', 'Maximum campaign duration in days'),
('auto_approve_restaurants', 'false', 'Auto-approve restaurant registrations'),
('auto_approve_influencers', 'false', 'Auto-approve influencer registrations'),
('touch_n_go_business_account', '', 'Touch n Go business account for payments'),
('admin_email', 'admin@foodconnect.my', 'Admin email for notifications'),
('site_maintenance_mode', 'false', 'Site maintenance mode toggle');

-- Insert default admin user (password: AdminFoodConnect2025!)
INSERT INTO users (email, password_hash, user_type, status, email_verified) VALUES 
('admin@foodconnect.my', '$2b$8$92iXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active', true);