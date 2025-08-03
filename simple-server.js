const http = require('http');

const PORT = 8080; // Different port

const server = http.createServer((req, res) => {
    console.log(`Request: ${req.method} ${req.url}`);
    
    res.writeHead(200, { 
        'Content-Type': 'text/html'
    });
    
    res.end(`
        <html>
            <head>
                <title>FoodConnect Malaysia - Working!</title>
                <style>
                    body { font-family: Arial; padding: 40px; background: #f8f9fa; }
                    .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    h1 { color: #0d6efd; }
                    .success { color: #198754; font-size: 18px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🎉 FoodConnect Malaysia</h1>
                    <p class="success">✅ Server is working perfectly!</p>
                    <p><strong>Port:</strong> ${PORT}</p>
                    <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                    
                    <h3>🧪 Test Results:</h3>
                    <ul>
                        <li>✅ Node.js server running</li>
                        <li>✅ HTTP requests working</li>
                        <li>✅ HTML rendering working</li>
                        <li>✅ Ready for full application</li>
                    </ul>
                    
                    <h3>🌐 URLs to test:</h3>
                    <ul>
                        <li><a href="http://localhost:${PORT}/">Homepage</a></li>
                        <li><a href="http://localhost:${PORT}/test">Test page</a></li>
                    </ul>
                </div>
            </body>
        </html>
    `);
});

server.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('🚀 FoodConnect Malaysia Server Started!');
    console.log('='.repeat(50));
    console.log(`🌐 Visit: http://localhost:${PORT}`);
    console.log(`📅 Started: ${new Date().toLocaleString()}`);
    console.log('✅ Server ready for testing!');
    console.log('='.repeat(50));
});

// Handle server errors
server.on('error', (err) => {
    console.error('❌ Server error:', err.message);
});