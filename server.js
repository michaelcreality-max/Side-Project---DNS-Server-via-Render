const express = require('express');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// CRUCIAL MULTI-PARSER FIX: This allows the server to parse regular form data AND JSON text smoothly
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

const customResolver = new dns.Resolver();
customResolver.setServers(['8.8.8.8']); // Google Public DNS testing pipeline 

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

app.get('/', (req, res) => {
    res.send('Proxy server is online and listening for form streams!');
});

app.post('/proxy/', async (req, res) => {
    // Read the parameter from either a JSON body or a standard form stream body
    const targetUrl = req.body.url;
    
    if (!targetUrl) {
        return res.status(400).send('Proxy Error: Missing "url" property in request body.');
    }

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

        // Strip constraints so Wix can embed the content
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('X-Frame-Options', 'ALLOWALL'); 
        res.setHeader('Content-Security-Policy', "frame-ancestors *");
        
        res.send(response.data);

    } catch (error) {
        res.status(500).send(`Proxy Error: Could not resolve "${targetUrl}". Details: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy active on port ${PORT}`);
});
