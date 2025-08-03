const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    res.writeHead(200, { 
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
    });
    
    if (req.url === '/') {
        res.end(`
            <html>
                <head><title>FoodConnect Malaysia - Test</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>🎉 FoodConnect Malaysia Server is Working!</h1>
                    <p>Server is running successfully on port 3000</p>
                    <p>Time: ${new Date().toLocaleString()}</p>
                    <hr>
                    <h3>Test Links:</h3>
                    <ul>
                        <li><a href="/api/health">API Health Check</a></li>
                        <li><a href="/test">Test Page</a></li>
                    </ul>
                </body>
            </html>
        `);
    } else if (req.url === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'FoodConnect Malaysia API',
            message: 'Server is working perfectly!'
        }, null, 2));
    } else if (req.url === '/test') {
        res.end(`
            <html>
                <head><title>Test Page</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>✅ Test Page Working</h1>
                    <p>If you can see this, the server is responding correctly!</p>
                    <a href="/">← Back to Home</a>
                </body>
            </html>
        `);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end(`
            <html>
                <head><title>404 - Not Found</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h1>404 - Page Not Found</h1>
                    <p>The page you're looking for doesn't exist.</p>
                    <a href="/">← Go Home</a>
                </body>
            </html>
        `);
    }
});

const PORT = 3000;
server.listen(PORT, '127.0.0.1', () => {
    console.log('🚀 FoodConnect Malaysia MINIMAL server running');
    console.log(`🌐 Visit: http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    console.log('✅ Server is ready for testing!');
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is already in use. Please close other servers first.`);
    } else {
        console.error('❌ Server error:', err);
    }
});