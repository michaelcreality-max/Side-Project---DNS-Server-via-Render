const express = require('express');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(cors());

// Force Node.js to use your custom DNS server
dns.setServers(['8.8.8.8']); // Put your custom DNS IP here

app.get('/', (req, res) => {
    res.send('Proxy server is online!');
});

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url.');

    try {
        let cleanUrl = targetUrl;
        if (!/^https?:\/\//i.test(cleanUrl)) {
            cleanUrl = 'https://' + cleanUrl;
        }

        const response = await axios.get(cleanUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' 
            },
            timeout: 10000 
        });

        // REMOVE THE FRAMING RESTRICTIONS:
        // We strip headers that prevent embedding, allowing sites like Google/Example to show inside Wix
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        
        res.send(response.data);

    } catch (error) {
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy listening on port ${PORT}`);
});
