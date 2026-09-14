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
// Hardcoded to Google's public resolver for baseline connection testing
customResolver.setServers(['8.8.8.8']); 

// Route lookups strictly through our custom DNS resolver instance
const customLookup = (hostname, options, callback) => {
    customResolver.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || !addresses.length) {
            return callback(new Error(`DNS lookup failed for ${hostname}`), null, 4);
        }
        callback(null, addresses, 4);
    });
};

const customHttpsAgent = new https.Agent({ lookup: customLookup });
const customHttpAgent = new http.Agent({ lookup: customLookup });

// Root route 
app.get('/', (req, res) => {
    res.send('Proxy server is online and forcing custom DNS lookups!');
});

// Explicit Proxy Route
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    
    if (!targetUrl) {
        return res.status(400).send('Proxy Error: Missing "url" parameter.');
    }

    try {
        let cleanUrl = targetUrl.trim();
        if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        // Fetch using the custom DNS resolver agents
        const response = await axios.get(cleanUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            httpsAgent: customHttpsAgent,
            httpAgent: customHttpAgent,
            timeout: 10000 
        });

        // Clear layout iframe blocking rules
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        
        res.send(response.data);

    } catch (error) {
        console.error("Internal Proxy Error Logged:", error.message);
        res.status(500).send(`Proxy Error: Could not resolve or parse "${targetUrl}". Details: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server listening on port ${PORT}`);
});
