-- Add email verification functionality to existing schema
-- This script adds the necessary tables and columns for email verification

-- Add email verification columns to users table
ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN email_verification_token VARCHAR(255),
ADD COLUMN email_verification_expires TIMESTAMP,
ADD COLUMN verification_sent_at TIMESTAMP;

-- Create email verification tracking table
CREATE TABLE email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_email_verified ON users(email_verified);
CREATE INDEX idx_email_verifications_token ON email_verifications(token);
CREATE INDEX idx_email_verifications_email ON email_verifications(email);
CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);

-- Create trigger for email_verifications updated_at
CREATE TRIGGER update_email_verifications_updated_at 
    BEFORE UPDATE ON email_verifications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add some sample users for testing (optional)
-- INSERT INTO users (email, password_hash, user_type, status, email_verified) VALUES
-- ('test@restaurant.com', '$2b$10$example_hash', 'restaurant', 'pending', true),
-- ('test@influencer.com', '$2b$10$example_hash', 'influencer', 'pending', true);