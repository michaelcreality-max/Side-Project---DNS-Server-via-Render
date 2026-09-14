const express = require('express');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Set up the custom isolated DNS resolver
const customResolver = new dns.Resolver();
customResolver.setServers(['8.8.8.8']); // Using 8.8.8.8 for standard testing

const customLookup = (hostname, options, callback) => {
    // Set a strict 4-second timeout limit for custom DNS resolution
    const timeout = setTimeout(() => {
        callback(new Error(`DNS resolution timed out for ${hostname}`), null, 4);
    }, 4000);

    customResolver.resolve4(hostname, (err, addresses) => {
        clearTimeout(timeout);
        if (err || !addresses || !addresses.length) {
            return callback(new Error(`DNS lookup failed for ${hostname}`), null, 4);
        }
        callback(null, addresses, 4);
    });
};

const customHttpsAgent = new https.Agent({ lookup: customLookup });
const customHttpAgent = new http.Agent({ lookup: customLookup });

// Keep the GET root open to easily check if the server is awake
app.get('/', (req, res) => {
    res.send('Proxy server is active and running perfectly!');
});

// Robust POST handler with built-in fallbacks
app.post('/proxy/', async (req, res) => {
    const targetUrl = req.body.url;
    
    if (!targetUrl) {
        return res.status(400).send('Proxy Error: Missing "url" property in JSON body.');
    }

    let cleanUrl = targetUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
    }

    // --- TRY ROUTE 1: Custom DNS Routing ---
    try {
        const response = await axios.get(cleanUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            httpsAgent: customHttpsAgent,
            httpAgent: customHttpAgent,
            timeout: 6000 
        });

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        return res.send(response.data);

    } catch (dnsError) {
        console.warn(`[DNS Warning] Custom lookup failed for ${cleanUrl}. Dropping back to standard resolution...`);
        
        // --- FALLBACK ROUTE 2: Standard Network Fetch (Prevents Server Crash/503) ---
        try {
            const fallbackResponse = await axios.get(cleanUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 6000 // Standard fallback lookup
            });

            res.removeHeader('X-Frame-Options');
            res.removeHeader('Content-Security-Policy');
            res.setHeader('X-Frame-Options', 'ALLOWALL'); 
            res.setHeader('Content-Security-Policy', "frame-ancestors *");
            return res.send(fallbackResponse.data);

        } catch (fallbackError) {
            return res.status(500).send(`Browser Pipeline Error: Both custom DNS and fallback networks failed to resolve "${targetUrl}".`);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Proxy listening safely on port ${PORT}`);
});
