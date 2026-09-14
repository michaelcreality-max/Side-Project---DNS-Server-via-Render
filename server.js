const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const dns = require('dns');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());

// A simple landing page text if someone visits via browser
app.get('/', (req, res) => {
    res.send('DNS Proxy WebSocket Engine is running.');
});

const server = http.createServer(app);

// Initialize a standard WebSocket server on top of our HTTP layer
const wss = new WebSocket.Server({ server });

// Custom DNS Resolver Configuration
const customResolver = new dns.Resolver();
customResolver.setServers(['8.8.8.8']); // Google Public DNS for lookup verification

const customLookup = (hostname, options, callback) => {
    customResolver.resolve4(hostname, (err, addresses) => {
        if (err || !addresses || !addresses.length) {
            return callback(new Error(`DNS lookup failed for ${hostname}`), null, 4);
        }
        callback(null, addresses, 4);
    });
};

const customHttpsAgent = new (require('https').Agent)({ lookup: customLookup });
const customHttpAgent = new http.Agent({ lookup: customLookup });

// Handle active client socket streams
wss.on('connection', (ws) => {
    console.log('Wix frontend connected via secure WebSocket channel.');

    ws.on('message', async (message) => {
        try {
            // Unpack the data coming from Wix
            const data = JSON.parse(message);
            const targetUrl = data.url;

            if (!targetUrl) {
                return ws.send(JSON.stringify({ error: 'Missing target URL parameter.' }));
            }

            let cleanUrl = targetUrl.trim();
            if (!/^https?:\/\//i.test(cleanUrl)) {
                cleanUrl = 'https://' + cleanUrl;
            }

            // Fetch the site using the forced custom DNS lookups
            const response = await axios.get(cleanUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                httpsAgent: customHttpsAgent,
                httpAgent: customHttpAgent,
                timeout: 10000
            });

            // Send the raw HTML back through the open WebSocket tunnel
            ws.send(JSON.stringify({ html: response.data }));

        } catch (error) {
            ws.send(JSON.stringify({ error: `Proxy Error: ${error.message}` }));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
