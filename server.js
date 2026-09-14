const express = require('express');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 3000;

// Enable CORS so your Wix site can talk to this server
app.use(cors());

// Force Node.js to use Google's public DNS server
dns.setServers(['8.8.8.8', '8.8.4.4']);

// Health check route
app.get('/', (req, res) => {
    res.send('Proxy server is online and running on custom DNS!');
});

// Proxy logic
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).send('Error: Missing "url" parameter.');
    }

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

        res.send(response.data);

    } catch (error) {
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
});

app.listen(PORT, () => {
    console.log(`Proxy listening on port ${PORT}`);
});
