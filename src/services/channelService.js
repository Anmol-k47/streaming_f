/**
 * All stream URLs go through the Vite proxy (/tatatv-web/*).
 * The Vite Node.js proxy injects the required headers (Referer, User-Agent, etc.)
 * before forwarding to allinonereborn.online — browsers can't do this, Node.js can.
 */

import staticTataTV from '../data/tatatv_channels.json';
import staticIPTV from '../data/iptv_channels.json';
import staticZee5 from '../data/zee5_channels.json';
import staticFancode from '../data/fancode_channels.json';
import staticJstr from '../data/jstr_channels.json';
import staticSony from '../data/sony_channels.json';

const PROXY_BASE = 'https://allinonereborn.store/livtest3/stream_proxy.php?url=';
const DIRECT_BASE = 'https://allinonereborn.store';

function buildApiUrl(path) {
    if (import.meta.env.PROD) {
        // Rewrite local aliases to real server paths
        let remotePath = path;
        if (path.startsWith('/tatatv-json/')) {
            remotePath = path.replace('/tatatv-json/', '/tatatv-web/');
        }
        // Return relative path so the new Express server proxies it with correct headers
        return remotePath;
    }
    return path;
}

const TATATV_JSON_PROXY = buildApiUrl('/tatatv-json/xchannels.json');
const IPTV_WEB_JSON_PROXY = buildApiUrl('/iptv-web/xchannels.json');
const ZEE5_JSON_PROXY = buildApiUrl('/zee5/channels199.json');
const FANCODE_JSON_PROXY = buildApiUrl('/fctest/json/fancode_latest.json');
const SONY_HTML_PROXY = buildApiUrl('/sony/');

/** Strip origin → proxy path ONLY for domains we proxy */
function toProxyPath(url) {
    if (!url) return url;

    // Use absolute proxy wrap ONLY for Sony since the HTML provides it explicitly
    if (url.includes('/sony-new/')) {
        return PROXY_BASE + encodeURIComponent(url);
    }

    // Leave absolute paths for /amit/ as they rely on direct cookies + have CORS open
    if (url.includes('/amit/')) {
        return url;
    }

    // Only strip origin if it points to allinonereborn servers
    if (url.includes('allinonereborn.store') || url.includes('allinonereborn.online')) {
        try {
            const u = new URL(url);
            return u.pathname + u.search;
        } catch {
            // Already a relative path
            return url;
        }
    }

    // Return external CDN links (like Cloudfront for Zee5) unchanged
    return url;
}

export async function fetchChannels() {
    const providerList = ['TataTV', 'IPTV', 'Zee5', 'Fancode', 'JioTV', 'Sony TV'];
    const dataByProvider = {};

    // Initialize provider structures
    providerList.forEach(p => {
        dataByProvider[p] = { categories: [], byCategory: {} };
    });

    const addChannel = (provider, cat, ch) => {
        if (!dataByProvider[provider].categories.includes(cat)) {
            dataByProvider[provider].categories.push(cat);
        }
        if (!dataByProvider[provider].byCategory[cat]) {
            dataByProvider[provider].byCategory[cat] = [];
        }
        dataByProvider[provider].byCategory[cat].push(ch);
    };

    try {
        // 1. Fetch TataTV
        const tataRes = await fetch(TATATV_JSON_PROXY).catch(() => null);
        let tataData = staticTataTV;
        if (tataRes?.ok) {
            try { tataData = await tataRes.json(); } catch (e) { console.warn('tata parse err', e); }
        }
        
        if (tataData) {
            Object.keys(tataData).forEach(cat => {
                tataData[cat].forEach((ch, i) => addChannel('TataTV', cat, {
                    id: `tata-${cat}-${i}`,
                    name: ch.name,
                    logo: ch.logo,
                    url: toProxyPath(ch.url),
                    category: cat,
                    drm: null
                }));
            });
        }

        // 1.5 Fetch IPTV-WEB
        const iptvRes = await fetch(IPTV_WEB_JSON_PROXY).catch(() => null);
        let iptvData = staticIPTV;
        if (iptvRes?.ok) {
            try { iptvData = await iptvRes.json(); } catch (e) { console.warn('iptv parse err', e); }
        }

        if (iptvData) {
            Object.keys(iptvData).forEach(cat => {
                iptvData[cat].forEach((ch, i) => addChannel('IPTV', cat, {
                    id: `iptv-${cat}-${i}`,
                    name: ch.name,
                    logo: ch.logo,
                    url: toProxyPath(ch.url),
                    category: cat,
                    drm: null
                }));
            });
        }

        // 2. Fetch Zee5
        const zeeRes = await fetch(ZEE5_JSON_PROXY).catch(() => null);
        let zeeData = staticZee5;
        if (zeeRes?.ok) {
            try { zeeData = await zeeRes.json(); } catch (e) { }
        }

        if (zeeData) {
            const channels = zeeData.channels || [];
            channels.forEach((ch, i) => {
                if (!ch || typeof ch !== 'object') return;

                let playableUrl = ch.mpd || ch.url || '';
                if (playableUrl.includes('%3A%2F%2F')) {
                    playableUrl = decodeURIComponent(playableUrl);
                }

                let drm = null;
                // Parse clearKey from object if it exists
                if (ch.clearkey && ch.clearkey.keyId && ch.clearkey.key) {
                    drm = {
                        keySystem: 'org.w3.clearkey',
                        clearKeys: [{ kid: ch.clearkey.keyId, key: ch.clearkey.key }]
                    };
                }
                // Or try extracting from URL if it's encoded in the string params
                else if (playableUrl.includes('keyid=')) {
                    const kidMatch = playableUrl.match(/keyid=([a-f0-9]+)/i);
                    const keyMatch = playableUrl.match(/(?:&|\?)key=([a-f0-9]+)/i);
                    if (kidMatch && keyMatch) {
                        drm = {
                            keySystem: 'org.w3.clearkey',
                            clearKeys: [{ kid: kidMatch[1], key: keyMatch[1] }]
                        };
                    }
                }

                // Strip the keys from the playable URL if they were sent as params
                if (playableUrl.includes('.mpd&keyid=')) {
                    playableUrl = playableUrl.split('&keyid=')[0];
                } else if (playableUrl.includes('.mpd?keyid=')) {
                    playableUrl = playableUrl.split('?keyid=')[0];
                }

                addChannel('Zee5', 'Zee5 Channels', {
                    id: `zee5-${i}`,
                    name: ch.name || 'Unknown Zee5',
                    logo: ch.logo || '',
                    url: toProxyPath(playableUrl),
                    category: 'Zee5 Channels',
                    drm: drm
                });
            });
        }

        // 2.5 Fetch Fancode Main List (Matches grouped by category, parsing multi-streams)
        const fcRes = await fetch(FANCODE_JSON_PROXY).catch(() => null);
        let primaryFcIds = new Set();
        let fcData = staticFancode;
        
        if (fcRes?.ok) {
            try { fcData = await fcRes.json(); } catch (e) { }
        }

        if (fcData) {
            // Try to extract matches from wherever they are in the JSON object
            let matches = Array.isArray(fcData) ? fcData : (fcData.matches || []);
            if (!Array.isArray(matches) && typeof fcData === 'string') {
                try {
                    const parsed = JSON.parse(fcData);
                    matches = Array.isArray(parsed) ? parsed : (parsed.matches || []);
                } catch (e) { }
            }

            if (Array.isArray(matches)) {
                // Group matches by match_id to handle multiple languages properly
                const groupedMatches = {};
                matches.forEach(m => {
                    const matchId = m.match_id || m.id;
                    if (!matchId) return;
                    if (!groupedMatches[matchId]) {
                        groupedMatches[matchId] = { ...m, all_streams: [] };
                    }
                    if (m.streams && Array.isArray(m.streams)) {
                        groupedMatches[matchId].all_streams.push(...m.streams);
                    }
                });

                Object.values(groupedMatches).forEach((m, matchIdx) => {
                    const matchId = m.match_id || matchIdx;
                    primaryFcIds.add(matchId);
                    
                    if (!m.all_streams || m.all_streams.length === 0) return;

                    const categoryName = `FC - ${m.category || m.tournament || 'Live'}`;

                    // Extract each stream as a separate channel
                    m.all_streams.forEach((stream, streamIdx) => {
                        const lang = stream.language || 'Unknown';
                        const streamUrl = stream.playlist_url || stream.url;
                        if (!streamUrl) return;

                        const channelName = m.all_streams.length > 1
                            ? `${m.title || `Match ${matchId}`} (${lang})`
                            : (m.title || `Match ${matchId}`);

                        addChannel('Fancode', categoryName, {
                            id: `fc-primary-${matchId}-${streamIdx}`,
                            name: channelName.trim(),
                            logo: m.image || '',
                            url: toProxyPath(streamUrl),
                            category: categoryName,
                            drm: null,
                            isFancode: true,
                            fcStatus: m.status || m.streamingStatus || 'UPCOMING'
                        });
                    });
                });
            }
        }

        // 2.6 Fetch Fancode Backup JSON
        const fcBackupRes = await fetch('https://raw.githubusercontent.com/drmlive/fancode-live-events/refs/heads/main/fancode.json').catch(() => null);
        if (fcBackupRes?.ok) {
            const data = await fcBackupRes.json();
            let matches = data.matches || [];
            
            if (Array.isArray(matches)) {
                matches.forEach((m, matchIdx) => {
                    const matchId = m.match_id || matchIdx;
                    // Skip if primary already handled this match
                    if (primaryFcIds.has(matchId)) return;

                    const streamUrl = m.adfree_url || m.dai_url;
                    if (!streamUrl) return;

                    const categoryName = `FC - ${m.event_category || 'Live'}`;
                    
                    addChannel('Fancode', categoryName, {
                        id: `fc-backup-${matchId}`,
                        name: m.title || m.match_name || `Match ${matchId}`,
                        logo: m.src || '',
                        url: streamUrl, // Backup URL is direct (no token/proxy needed)
                        category: categoryName,
                        drm: null,
                        isFancode: true,
                        fcStatus: m.status || 'UPCOMING'
                    });
                });
            }
        }

        // 2.7 Fetch JioTV
        const JIOTV_JSON_PROXY = buildApiUrl('/jstrweb2/jstr.json');
        const jioRes = await fetch(JIOTV_JSON_PROXY).catch(() => null);
        let jioData = staticJstr;
        if (jioRes?.ok) {
            try { jioData = await jioRes.json(); } catch (e) { }
        }

        if (jioData) {
            const channels = Array.isArray(jioData) ? jioData : [];
            
            channels.forEach(ch => {
                if (!ch || !ch.mpd) return;

                const categoryName = ch.category || 'JioTV Channels';
                
                // Parse the native clearKey dictionary into the format Shaka expects
                let drm = null;
                if (ch.drm && typeof ch.drm === 'object') {
                    const keys = [];
                    
                    Object.entries(ch.drm).forEach(([kidHex, keyHex]) => {
                        if (kidHex && keyHex && kidHex !== 'null' && keyHex !== 'null') {
                            keys.push({
                                kid: kidHex.toLowerCase(),
                                key: keyHex.toLowerCase()
                            });
                        }
                    });

                    if (keys.length > 0) {
                        drm = {
                            keySystem: 'org.w3.clearkey',
                            clearKeys: keys
                        };
                    }
                }

                // Construct the streaming URL
                // 1. Swap the true CDN domain with our Vite proxy
                let streamUrl = ch.mpd;
                if (streamUrl.includes('jiotvmblive.cdn.jio.com')) {
                    streamUrl = streamUrl.replace('https://jiotvmblive.cdn.jio.com', '/proxy-jiotv-live');
                }
                
                // 2. Append the required authentication token directly
                if (ch.token && ch.token !== 'null' && ch.token.trim() !== '') {
                    const separator = streamUrl.includes('?') ? '&' : '?';
                    // The token from the JSON has embedded newlines/spaces that break HMAC
                    const cleanToken = ch.token.replace(/\s+/g, '');
                    streamUrl += `${separator}${cleanToken}`;
                }

                addChannel('JioTV', categoryName, {
                    id: `jiotv-${ch.channel_id || Math.random().toString(36).substr(2, 9)}`,
                    name: ch.name || `JioTV Channel`,
                    logo: ch.logo ? ch.logo.replace('https://jiotv.catchup.cdn.jio.com', '/proxy-jiotv-catchup') : '',
                    url: toProxyPath(streamUrl), 
                    category: categoryName,
                    drm: drm
                });
            });
        }

        // 3. Fetch Sony (New HTML parsed)
        const sonyRes = await fetch(SONY_HTML_PROXY).catch(() => null);
        if (sonyRes?.ok) {
            const html = await sonyRes.text();

            // Try to find the javascript array of channels embedded in the page
            // looking for lines like: const channelData = {"id":"sony-hd", ... "m3u8": "..."};
            // Note: The user mentioned these are individual channel pages, we might be scraping the directory
            // which links to `ptest.php?id=...`. If we are scanning the directory, we need to extract the ID and build the m3u8.
            // Allinone usually formats these as `http://allinonereborn.store/sony-new/playlists/{id}.m3u8` based on user's hint.

            const cardRegex = /<a[^>]+href="(?:ptest\.php\?id=)?([^"]+)"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>[\s\S]*?<div[^>]+class="title"[^>]*>([^<]+)<\/div>[\s\S]*?<\/a>/gi;

            let match;
            let i = 0;
            while ((match = cardRegex.exec(html)) !== null) {
                const [_, idPath, imgSrc, titleText] = match;

                // Check if the HTML directly outputs the stream_proxy links instead of ptest
                let url;
                if (idPath.includes('stream_proxy.php')) {
                    url = toProxyPath(idPath);
                } else {
                    // Extract just the ID if it's a php query
                    let channelId = idPath;
                    if (channelId.includes('id=')) channelId = channelId.split('id=')[1];
                    channelId = channelId.trim();

                    // Construct the actual target M3U8
                    let targetM3u8 = `http://allinonereborn.store/sony-new/playlists/${channelId.replace(/-/g, '_')}.m3u8`;

                    // Wrap in user's proxy
                    url = `/livtest3/stream_proxy.php?url=${encodeURIComponent(targetM3u8)}`;

                    if (import.meta.env.PROD) {
                        url = DIRECT_BASE + url;
                    }
                }

                addChannel('Sony TV', 'Sony Channels', {
                    id: `sony-${i++}`,
                    name: titleText.trim(),
                    logo: imgSrc,
                    url: url,
                    category: 'Sony Channels',
                    drm: null
                });
            }
        }

        // 3.5 Fetch SonyLive Events JSON
        const sonyLiveEventsRes = await fetch('https://raw.githubusercontent.com/drmlive/sliv-live-events/main/sonyliv.json').catch(() => null);
        let sonyLiveEventsData = staticSony;
        if (sonyLiveEventsRes?.ok) {
             try { sonyLiveEventsData = await sonyLiveEventsRes.json(); } catch (e) { }
        }

        if (sonyLiveEventsData) {
            let matches = sonyLiveEventsData.matches || [];
            
            if (Array.isArray(matches)) {
                matches.forEach((m, matchIdx) => {
                    let streamUrl = m.video_url || m.pub_url || m.dai_url;
                    if (!streamUrl) return; // Skip upcoming matches without streaming URLs

                    // Proxy the akamai URLs to bypass CORS during local dev
                    if (streamUrl.includes('sonydaimenew.akamaized.net')) {
                        streamUrl = streamUrl.replace('https://sonydaimenew.akamaized.net', '/proxy-sony-akamai');
                    }

                    const categoryName = `Sony - ${m.event_category || 'Live'}`;
                    const channelName = m.match_name ? `${m.event_name} - ${m.match_name}` : m.event_name;
                    
                    addChannel('Sony TV', categoryName, {
                        id: `sony-live-${m.contentId || matchIdx}`,
                        name: channelName || `Sony Live ${matchIdx}`,
                        logo: m.src || '',
                        url: streamUrl, 
                        category: categoryName,
                        drm: null, // Stream URLs include necessary tokens/auth
                        isLive: m.isLive
                    });
                });
            }
        }

    } catch (e) {
        console.error("Error fetching channels:", e);
        // We log error but try to return whatever data was successfully constructed
    }

    return { providerList, dataByProvider };
}
