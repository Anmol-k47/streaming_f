/**
 * All stream URLs go through the Vite proxy (/tatatv-web/*).
 * The Vite Node.js proxy injects the required headers (Referer, User-Agent, etc.)
 * before forwarding to allinonereborn.online — browsers can't do this, Node.js can.
 */

const PROXY_BASE = 'https://allinonereborn.store/livtest3/stream_proxy.php?url=';
const DIRECT_BASE = 'https://allinonereborn.store';

function buildApiUrl(path) {
    // The app runs as a persistent Vite Server on Render now.
    // We want the frontend to ALWAYS use the local Vite proxy paths (e.g. /tatatv-web/)
    // so that the backend server can intercept and append the required Referer headers.
    return path;
}

const TATATV_JSON_PROXY = buildApiUrl('/tatatv-json/xchannels.json');
const IPTV_WEB_JSON_PROXY = buildApiUrl('/iptv-web/xchannels.json');
const ZEE5_JSON_PROXY = buildApiUrl('/zee5/channels199.json');
const FANCODE_JSON_PROXY = buildApiUrl('/fctest/json/fancode_latest.json');
const SONY_HTML_PROXY = buildApiUrl('/sony/');

/** Strip origin → proxy path */
function toProxyPath(url) {
    if (!url) return url;

    // Use absolute proxy wrap ONLY for Sony since the HTML provides it explicitly
    if (url.includes('/sony-new/')) {
        return PROXY_BASE + encodeURIComponent(url);
    }

    // Otherwise, strip the origin down to a relative path.
    // e.g. https://allinonereborn.store/tatatv-web/live.php?id=...
    // becomes -> /tatatv-web/live.php?id=...
    // This allows the browser to make the request to our own Vite server,
    // which then forwards it securely WITH headers to the destination.
    try {
        const u = new URL(url);
        return u.pathname + u.search;
    } catch {
        return url;
    }
}

export async function fetchChannels() {
    const providerList = ['TataTV', 'IPTV', 'Zee5', 'Fancode', 'Sony TV'];
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
        if (tataRes?.ok) {
            const data = await tataRes.json();
            Object.keys(data).forEach(cat => {
                data[cat].forEach((ch, i) => addChannel('TataTV', cat, {
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
        if (iptvRes?.ok) {
            const data = await iptvRes.json();
            Object.keys(data).forEach(cat => {
                data[cat].forEach((ch, i) => addChannel('IPTV', cat, {
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
        if (zeeRes?.ok) {
            const data = await zeeRes.json();
            const channels = data.channels || [];
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

        // 2.5 Fetch Fancode (Matches grouped by category, parsing multi-streams)
        const fcRes = await fetch(FANCODE_JSON_PROXY).catch(() => null);
        if (fcRes?.ok) {
            const data = await fcRes.json();
            // Try to extract matches from wherever they are in the JSON object
            let matches = data.matches || [];
            if (!Array.isArray(matches)) {
                // If it's a nested object string, try parsing it
                try {
                    const parsed = JSON.parse(data);
                    matches = parsed.matches || [];
                } catch (e) { }
            }

            if (Array.isArray(matches)) {
                matches.forEach((m, matchIdx) => {
                    if (!m.streams || !Array.isArray(m.streams) || m.streams.length === 0) return;

                    const categoryName = `FC - ${m.category || 'Live'}`;

                    // Extract each stream as a separate channel
                    m.streams.forEach((stream, streamIdx) => {
                        const lang = stream.language || 'Unknown';
                        const streamUrl = stream.playlist_url || stream.url;
                        if (!streamUrl) return;

                        const channelName = m.streams.length > 1
                            ? `${m.title || `Match ${m.match_id}`} (${lang})`
                            : (m.title || `Match ${m.match_id}`);

                        addChannel('Fancode', categoryName, {
                            id: `fc-${m.match_id || matchIdx}-${streamIdx}`,
                            name: channelName,
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

    } catch (e) {
        console.error("Error fetching channels:", e);
        // We log error but try to return whatever data was successfully constructed
    }

    return { providerList, dataByProvider };
}
