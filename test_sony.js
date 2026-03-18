// Using native fetch

const TATATV_JSON_PROXY = 'https://allinonereborn.online/tatatv-web/xchannels.json';
const channelId = 'sony-ten-5-hd';

async function test() {
    try {
        const fetchUrl = `https://allinonereborn.online/sony/ptest.php?id=${channelId}`;
        console.log(`[Sony Debug] fetchUrl: ${fetchUrl}`);
        const res = await fetch(fetchUrl).catch(() => null);
        
        if (res?.ok) {
            const htmlPage = await res.text();
            const urlRegex = /const\s+videoUrl\s*=\s*"([^"]+)"/i;
            const urlMatch = urlRegex.exec(htmlPage);
            
            if (urlMatch && urlMatch[1]) {
                 console.log(`[Sony Debug] Found videoUrl: ${urlMatch[1]}`);
            } else {
                 console.log(`[Sony Debug] Regex failed to find videoUrl string layoutayout payout layouts !!`);
                 console.log(`HTML Peak: ${htmlPage.slice(htmlPage.indexOf('Passing PHP'), htmlPage.indexOf('Pass PHP') + 300)}`);
            }
        } else {
             console.log(`Fetch failed with status: ${res?.status}`);
        }
    } catch (e) {
         console.log(`Error: ${e.message}`);
    }
}

test();
