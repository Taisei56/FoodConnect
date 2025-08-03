const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Basic middleware
app.use(express.static(path.join(__dirname, 'src/public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Simple routes for testing
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'FoodConnect Malaysia - Connect Restaurants with Food Influencers'
    });
});

app.get('/login', (req, res) => {
    res.render('auth/login', { 
        title: 'Login - FoodConnect Malaysia' 
    });
});

app.get('/register', (req, res) => {
    res.render('auth/register', { 
        title: 'Register - FoodConnect Malaysia' 
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'FoodConnect Malaysia API'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found - FoodConnect Malaysia' 
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        details: err.message
    });
});

app.listen(PORT, () => {
    console.log(`🚀 FoodConnect Malaysia TEST server running on port ${PORT}`);
    console.log(`🌐 Visit: http://localhost:${PORT}`);
});

module.exports = app;