const express = require('express');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

const customResolver = new dns.Resolver();
customResolver.setServers(['8.8.8.8']); 

const customLookup = (hostname, options, callback) => {
    customResolver.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || !addresses[0]) {
            return callback(new Error(`DNS lookup failed for ${hostname}`), null, 4);
        }
        callback(null, addresses, 4);
    });
};

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

        const response = await axios.get(cleanUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            httpsAgent: customHttpsAgent,
            httpAgent: customHttpAgent,
            timeout: 10000 
        });

        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        
        res.send(response.data);

    } catch (error) {
        console.error("DNS Error:", error.message);
        res.status(500).send(`Proxy Routing Error: Could not resolve "${targetUrl}".`);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});
