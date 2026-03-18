import express from 'express';

const app = express();
const PORT = process.env.PORT || 10000;

const STREAM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Connection': 'keep-alive'
};

// Generic Fetch Proxy Helper for almostnode.dev
const createFetchProxy = (targetBase, customHeaders = {}, referer) => async (req, res) => {
    try {
        // req.url contains everything AFTER the app.use() mount point
        const targetUrl = `${targetBase}${req.url}`;
        
        const fetchOptions = {
            method: req.method,
            headers: { 
                ...STREAM_HEADERS,
                ...customHeaders 
            }
        };
        
        if (referer) fetchOptions.headers['Referer'] = referer;
        if (req.headers['range']) fetchOptions.headers['Range'] = req.headers['range'];

        const response = await fetch(targetUrl, fetchOptions);
        
        // Forward headers back to client for HLS.js/Shaka playback support
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Range');
        
        if (response.headers.get('content-type')) res.setHeader('Content-Type', response.headers.get('content-type'));
        if (response.headers.get('content-range')) res.setHeader('Content-Range', response.headers.get('content-range'));
        res.status(response.status);

        // Convert response and send
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
};

const createAllInOneProxy = (pathSegment, referer) => 
    createFetchProxy(`https://allinonereborn.online${pathSegment}`, {}, referer);

// 1. Allinone Proxies
app.use('/tatatv-web', createAllInOneProxy('/tatatv-web', 'https://allinonereborn.online/tatatv-web/'));
app.use('/fctest', createAllInOneProxy('/fctest', 'https://allinonereborn.online/fctest/'));
app.use('/zee5', createAllInOneProxy('/zee5', 'https://allinonereborn.online/zee5/'));
app.use('/jstrweb2', createAllInOneProxy('/jstrweb2', 'https://allinonereborn.online/jstrweb2/'));
app.use('/sony', createAllInOneProxy('/sony', 'https://allinonereborn.online/sony/'));
app.use('/livtest3', createAllInOneProxy('/livtest3', 'https://allinonereborn.online/livtest3/'));
app.use('/iptv-web', createAllInOneProxy('/iptv-web', 'https://allinonereborn.online/iptv-web/'));

// 2. Fancode Live CDN
app.use('/proxy-fancode-flive', createFetchProxy(
    'https://in-mc-flive.fancode.com', 
    { 'Origin': 'https://www.fancode.com' }, 
    'https://www.fancode.com/'
));

app.use('/proxy-fancode-fdlive', createFetchProxy(
    'https://in-mc-fdlive.fancode.com', 
    { 'Origin': 'https://www.fancode.com' }, 
    'https://www.fancode.com/'
));

app.use('/proxy-fancode-plive', createFetchProxy(
    'https://in-mc-plive.fancode.com', 
    { 'Origin': 'https://www.fancode.com' }, 
    'https://www.fancode.com/'
));

// 3. JioTV Live Proxy
app.use('/proxy-jiotv-live', createFetchProxy(
    'https://jiotvmblive.cdn.jio.com',
    { 'Origin': 'https://www.jiotv.com', 'User-Agent': '@allinone_reborn' },
    'https://www.jiotv.com/'
));

app.use('/proxy-jiotv-pllive', createFetchProxy(
    'https://jiotvpllive.cdn.jio.com',
    { 'Origin': 'https://www.jiotv.com', 'User-Agent': '@allinone_reborn' },
    'https://www.jiotv.com/'
));

// 4. Sony Akamai Proxy
app.use('/proxy-sony-akamai', createFetchProxy(
    'https://sonydaimenew.akamaized.net',
    { 'User-Agent': 'Mozilla/5.0' }
));

// 5. Sony Dish Proxy
app.use('/proxy-sony-dish', createFetchProxy(
    'https://dishmt.slivcdn.com',
    { 'User-Agent': 'Mozilla/5.0' }
));

app.listen(PORT, () => console.log(`Almostnode.dev mock proxy running on port ${PORT}`));
