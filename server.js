const express = require('express');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Create an isolated DNS resolver instance
const customResolver = new dns.Resolver();

// Force it to use Google's Public DNS for testing. 
// (Later, you can put your custom DNS IP here!)
customResolver.setServers(['8.8.8.8']); 

// Intercept Node.js lookups and pass them through our resolver
const customLookup = (hostname, options, callback) => {
    customResolver.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || !addresses[0]) {
            return callback(new Error(`DNS lookup failed for ${hostname}`), null, 4);
        }
        callback(null, addresses[0], 4);
    });
};

// Bind our custom resolver directly to the connection agents
const customHttpsAgent = new https.Agent({ lookup: customLookup });
const customHttpAgent = new http.Agent({ lookup: customLookup });

app.get('/', (req, res) => {
    res.send('Proxy server is online and forcing public DNS lookups!');
});

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url parameter.');

    try {
        let cleanUrl = targetUrl.trim();
        if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        // Force Axios to fetch using our custom network agents
        const response = await axios.get(cleanUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            httpsAgent: customHttpsAgent,
            httpAgent: customHttpAgent,
            timeout: 10000 
        });

        // Strip web security headers so it displays smoothly inside the Wix canvas
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        
        res.send(response.data);

    } catch (error) {
        console.error("DNS Error:", error.message);
        res.status(500).send(`Proxy Routing Error: Could not resolve "${targetUrl}".`);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});
