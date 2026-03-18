import { useEffect, useRef, useCallback } from 'react';
import shaka from 'shaka-player';

/* ─────────────────────────────────────────────────────────────
   detectFormat — live.php / IPTV proxy URLs → 'hls' by default
───────────────────────────────────────────────────────────── */
export function detectFormat(url, explicitFormat = 'auto') {
    if (explicitFormat !== 'auto') return explicitFormat;
    if (!url) return 'native';
    const u = url.toLowerCase().split('?')[0];
    if (u.endsWith('.m3u8') || u.includes('.m3u8')) return 'hls';
    if (u.endsWith('.mpd') || u.includes('.mpd')) return 'dash';
    if (u.includes('live.php') || u.includes('/stream') || u.includes('/playlist') || u.includes('/hls/')) return 'hls';
    if (u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.ogg')) return 'native';
    return 'hls'; // unknown → try HLS
}

/* ─────────────────────────────────────────────────────────────
   useStreamPlayer
───────────────────────────────────────────────────────────── */
export function useStreamPlayer() {
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const shakaRef = useRef(null);

    const destroyAll = useCallback(async () => {
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        if (shakaRef.current) { try { await shakaRef.current.destroy(); } catch (_) { } shakaRef.current = null; }
        if (videoRef.current) { videoRef.current.src = ''; videoRef.current.load(); }
    }, []);

    const loadStream = useCallback(async (url, format, drmConfig, onLoad, onError) => {
        const video = videoRef.current;
        if (!video) return;
        await destroyAll();

        const resolvedFormat = detectFormat(url, format);
        try {
            if (resolvedFormat === 'hls') {
                const Hls = (await import('hls.js')).default;

                if (Hls.isSupported()) {
                    class CustomLoader extends Hls.DefaultConfig.loader {
                        constructor(config) {
                            super(config);
                            const load = this.load.bind(this);
                            this.load = function (context, config, callbacks) {
                                // 1. Unwrap any URL hidden inside stream_proxy.php parameters
                                if (context.url.includes('stream_proxy.php?url=')) {
                                    try {
                                        const urlObj = new URL(context.url, window.location.href);
                                        const embeddedUrl = urlObj.searchParams.get('url');
                                        if (embeddedUrl) {
                                            context.url = embeddedUrl;
                                        }
                                    } catch (e) {
                                        console.warn("[StreamX] Could not decode stream_proxy url", e);
                                    }
                                }

                                // 2. Route traffic through our Vite dev proxy to bypass CORS
                                if (context.url.includes('allinonereborn.online/')) {
                                    context.url = context.url.replace(/^https?:\/\/allinonereborn\.online/, '');
                                } else if (context.url.includes('in-mc-flive.fancode.com')) {
                                    context.url = context.url.replace('https://in-mc-flive.fancode.com', '/proxy-fancode-flive');
                                } else if (context.url.includes('in-mc-fdlive.fancode.com')) {
                                    context.url = context.url.replace('https://in-mc-fdlive.fancode.com', '/proxy-fancode-fdlive');
                                } else if (context.url.includes('in-mc-plive.fancode.com')) {
                                    context.url = context.url.replace('https://in-mc-plive.fancode.com', '/proxy-fancode-plive');
                                } else if (context.url.includes('dai.google.com')) {
                                    // Sometimes Fancode has dynamically inserted ads that also need proxying
                                } else if (context.url.includes('sonydaimenew.akamaized.net')) {
                                    context.url = context.url.replace('https://sonydaimenew.akamaized.net', '/proxy-sony-akamai');
                                } else if (context.url.includes('dishmt.slivcdn.com')) {
                                    context.url = context.url.replace('https://dishmt.slivcdn.com', '/proxy-sony-dish');
                                }
                                load(context, config, callbacks);
                            };
                        }
                    }

                    if (!url || url === 'undefined') {
                        console.warn('[StreamX] Blocked invalid/undefined stream URL');
                        return;
                    }

                    const hls = new Hls({
                        enableWorker: true,
                        lowLatencyMode: true,
                        debug: false,
                        stretchShortVideoTrack: true, // Fix for A/V slightly out of sync
                        maxAudioFramesDrift: 1,       // Stricter audio drift correction
                        maxBufferHole: 0.5,           // Stricter tolerance for gaps in buffer
                        loader: CustomLoader,
                        pLoader: CustomLoader,
                        fLoader: CustomLoader,
                        kLoader: CustomLoader
                    });

                    hlsRef.current = hls;
                    hls.loadSource(url);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
                        video.play().catch(e => console.warn('[StreamX] Autoplay blocked:', e));
                        
                        const handleInitialPlaying = () => {
                            console.log('[StreamX] 🎬 HLS Stream playing started.');
                            onLoad && onLoad({ type: 'hls', levels: hls.levels });
                            video.removeEventListener('playing', handleInitialPlaying);
                        };
                        video.addEventListener('playing', handleInitialPlaying);
                    });

                    hls.on(Hls.Events.ERROR, (_e, data) => {
                        const detail = {
                            type: data.type,
                            details: data.details,
                            fatal: data.fatal,
                            url: data.frag?.url || data.response?.url,
                            httpCode: data.response?.code,
                            reason: data.reason,
                            err: data.err?.message,
                        };
                        console[data.fatal ? 'error' : 'warn']('[StreamX HLS]', data.fatal ? '❌ FATAL' : '⚠️ non-fatal', detail);

                        if (data.fatal) {
                            const msg = [
                                `HLS ${data.type}: ${data.details}`,
                                data.response?.code ? `HTTP ${data.response.code}` : null,
                                data.reason ? `Reason: ${data.reason}` : null,
                                data.err?.message ? data.err.message : null,
                            ].filter(Boolean).join('\n');
                            onError && onError(msg);
                        }
                    });

                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = url;
                    video.addEventListener('loadedmetadata', () => {
                        video.play().catch(() => { });
                        const handleNativePlaying = () => {
                            onLoad && onLoad({ type: 'hls-native' });
                            video.removeEventListener('playing', handleNativePlaying);
                        };
                        video.addEventListener('playing', handleNativePlaying);
                    }, { once: true });
                    video.addEventListener('error', () => {
                        const e = video.error;
                        onError && onError(`Native HLS error code=${e?.code}: ${e?.message}`);
                    }, { once: true });
                } else {
                    onError && onError('HLS is not supported in this browser.');
                }

            } else if (resolvedFormat === 'dash' || (drmConfig?.keySystem && drmConfig.keySystem !== 'none')) {
                shaka.polyfill.installAll();
                if (!shaka.Player.isBrowserSupported()) { onError && onError('Shaka not supported.'); return; }
                const player = new shaka.Player(video);
                shakaRef.current = player;

                // ═══════════════════════════════════════════════════════
                // 🔍 JioTV DRM DEBUGGING — logs every step of decoding
                // ═══════════════════════════════════════════════════════

                player.addEventListener('error', e => {
                    console.error('🔴 [JioTV Debug] Shaka ERROR event:', {
                        code: e.detail.code,
                        message: e.detail.message,
                        severity: e.detail.severity,
                        category: e.detail.category,
                        data: e.detail.data
                    });
                    onError && onError(`Shaka [${e.detail.code}]: ${e.detail.message}`);
                });

                // DRM session lifecycle events
                player.addEventListener('drmsessionupdate', () => {
                    console.log('🟢 [JioTV Debug] DRM SESSION UPDATED — keys accepted by browser! Decryption should work now.');
                });

                // Streaming events  
                player.addEventListener('buffering', (e) => {
                    console.log(`🟡 [JioTV Debug] Buffering: ${e.buffering}`);
                });

                player.addEventListener('loaded', () => {
                    console.log('🟢 [JioTV Debug] Stream LOADED successfully');
                    console.log('🟢 [JioTV Debug] Active tracks:', player.getVariantTracks().map(t => ({
                        id: t.id, width: t.width, height: t.height, 
                        videoCodec: t.videoCodec, audioCodec: t.audioCodec,
                        bandwidth: t.bandwidth
                    })));
                });

                // Video element events to track actual media pipeline
                video.addEventListener('encrypted', (e) => {
                    console.log('🔵 [JioTV Debug] VIDEO ENCRYPTED event fired!', {
                        initDataType: e.initDataType,
                        initDataLength: e.initData?.byteLength
                    });
                });

                video.addEventListener('waitingforkey', () => {
                    console.error('🔴 [JioTV Debug] VIDEO WAITING FOR KEY — the browser cannot find a matching decryption key!');
                });

                video.addEventListener('playing', () => {
                    console.log('🟢 [JioTV Debug] VIDEO PLAYING — frames are being rendered!');
                });

                video.addEventListener('stalled', () => {
                    console.warn('🟡 [JioTV Debug] VIDEO STALLED — no data arriving');
                });

                     if (drmConfig?.keySystem && drmConfig.keySystem !== 'none') {
                    if (drmConfig.keySystem === 'org.w3.clearkey' && drmConfig.clearKeys) {
                        const keys = drmConfig.clearKeys;

                        // Build the keyMap from Array or Object format
                        let keyMap = {};
                        if (Array.isArray(keys) && keys.length > 0) {
                            keys.forEach(({ kid, key }) => { if (kid && key) keyMap[kid] = key; });
                        } else if (typeof keys === 'object' && Object.keys(keys).length > 0) {
                            keyMap = keys;
                        }

                        console.log('🔑 [JioTV Debug] ClearKey map:', JSON.stringify(keyMap));

                        // ═══════════════════════════════════════════════════════════════
                        // SIMPLE ClearKey approach (matching working reference site).
                        // Reference uses Shaka v4.7 with just { clearKeys: channel.drm }.
                        // For Shaka v5, we also need:
                        //   - ignoreDrmInfo: true → ignore Widevine CP in the MPD
                        //   - parseInbandPsshEnabled: false → don't scan init segments
                        //     for Widevine PSSH boxes
                        // This combination tells Shaka: "the stream is ClearKey-encrypted,
                        // here are the keys, ignore any other DRM info you find."
                        // ═══════════════════════════════════════════════════════════════
                        player.configure({
                            drm: {
                                clearKeys: keyMap,
                                parseInbandPsshEnabled: false,
                            },
                            manifest: {
                                dash: {
                                    ignoreDrmInfo: true,
                                },
                            },
                            streaming: {
                                rebufferingGoal: 10,
                                bufferingGoal: 30,
                                bufferBehind: 30,
                                lowLatencyMode: true,
                                autoLowLatencyMode: true,
                            },
                            abr: {
                                enabled: true,
                                defaultBandwidthEstimate: 1000000,
                                switchInterval: 1,
                            },
                        });
                        console.log('🔧 [JioTV Debug] Shaka configured with ClearKey + ignoreDrmInfo + no inband PSSH');

                    } else if (drmConfig.licenseUrl) {
                        const cfg = { drm: { servers: {} } };
                        cfg.drm.servers[drmConfig.keySystem] = drmConfig.licenseUrl;
                        if (drmConfig.headers) {
                            player.getNetworkingEngine().registerRequestFilter((type, request) => {
                                if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
                                    try { Object.assign(request.headers, JSON.parse(drmConfig.headers)); } catch (_) { }
                                }
                            });
                        }
                        player.configure(cfg);
                    }
                }

                // ═══════════════════════════════════════════════════════
                // 🌐 TOKEN INJECTION for segment requests
                // ═══════════════════════════════════════════════════════

                // Network request/response logging
                player.getNetworkingEngine().registerRequestFilter((type, request) => {
                    const typeNames = { 0: 'MANIFEST', 1: 'SEGMENT', 2: 'LICENSE', 3: 'APP', 4: 'TIMING', 5: 'SERVER_CERTIFICATE' };
                    let uri = request.uris[0];
                    
                    if (uri && !uri.startsWith('data:')) {
                        if (uri.includes('jiotvpllive.cdn.jio.com')) {
                            uri = uri.replace('https://jiotvpllive.cdn.jio.com', '/proxy-jiotv-pllive');
                        } else if (uri.includes('jiotvmblive.cdn.jio.com')) {
                            uri = uri.replace('https://jiotvmblive.cdn.jio.com', '/proxy-jiotv-live');
                        } else if (uri.includes('in-mc-flive.fancode.com')) {
                            uri = uri.replace('https://in-mc-flive.fancode.com', '/proxy-fancode-flive');
                        } else if (uri.includes('in-mc-fdlive.fancode.com')) {
                            uri = uri.replace('https://in-mc-fdlive.fancode.com', '/proxy-fancode-fdlive');
                        } else if (uri.includes('in-mc-plive.fancode.com')) {
                            uri = uri.replace('https://in-mc-plive.fancode.com', '/proxy-fancode-plive');
                        } else if (uri.includes('sonydaimenew.akamaized.net')) {
                            uri = uri.replace('https://sonydaimenew.akamaized.net', '/proxy-sony-akamai');
                        } else if (uri.includes('dishmt.slivcdn.com')) {
                            uri = uri.replace('https://dishmt.slivcdn.com', '/proxy-sony-dish');
                        }
                        request.uris[0] = uri;
                    }
                    console.log(`🌐 [Proxy Rewriter] Request [${typeNames[type] || type}]: ${request.uris[0].substring(0, 120)}...`);
                });

                player.getNetworkingEngine().registerResponseFilter((type, response) => {
                    const typeNames = { 0: 'MANIFEST', 1: 'SEGMENT', 2: 'LICENSE' };
                    if (type <= 2) {
                        console.log(`📥 [JioTV Debug] Response [${typeNames[type]}]: ${response.data.byteLength} bytes, status ${response.status}`);
                        if (type === 0) {
                            // Log first 500 chars of MPD manifest to check DRM info
                            const text = new TextDecoder().decode(response.data.slice(0, 500));
                            console.log('📄 [JioTV Debug] MPD preview:', text);
                        }
                    }
                });

                // If the stream URL contains a token (like JioTV's __hdnea__), we need to append
                // it to all segment and license requests, otherwise they will 403 Forbidden.
                try {
                    const parsedUrl = new URL(url.startsWith('http') ? url : window.location.origin + url);
                    const tokenParams = Array.from(parsedUrl.searchParams.entries())
                        .filter(([k]) => k.includes('hdnea') || k.includes('hdnts') || k.includes('token'));
                    
                    if (tokenParams.length > 0) {
                        console.log('🎫 [JioTV Debug] Token params found:', tokenParams.map(([k,v]) => `${k}=${v.substring(0,30)}...`));
                        player.getNetworkingEngine().registerRequestFilter((type, request) => {
                            try {
                                let uri = request.uris[0];
                                
                                // Do not append tokens or decode data: URIs (used for ClearKey licenses)
                                if (uri.startsWith('data:')) return;
                                
                                tokenParams.forEach(([k, v]) => {
                                    if (!uri.includes(k + '=')) {
                                        const separator = uri.includes('?') ? '&' : '?';
                                        uri += `${separator}${k}=${v}`;
                                    }
                                });
                                // Remove decodeURIComponent as it corrupts base64 strings and HMACs
                                request.uris[0] = uri;
                            } catch (e) {
                                console.warn('[StreamX] Shaka filter error', e);
                            }
                        });
                    }
                } catch (e) {
                    // Ignore parse errors on relative URLs
                }

                console.log('🚀 [JioTV Debug] Loading URL:', url.substring(0, 120) + '...');
                
                // Catch Shaka errors with detailed info
                player.addEventListener('error', (event) => {
                    const error = event.detail;
                    console.error('🔴 [JioTV Debug] SHAKA ERROR EVENT:', {
                        severity: error.severity,
                        category: error.category,
                        code: error.code,
                        data: error.data,
                        message: error.message
                    });
                });
                
                // Catch buffering events
                player.addEventListener('buffering', (event) => {
                    console.log('🟡 [JioTV Debug] Buffering:', event.buffering);
                });
                
                await player.load(url);
                console.log('🟢 [JioTV Debug] player.load() completed successfully!');
                console.log('🟢 [JioTV Debug] Key statuses:', player.getKeyStatuses && player.getKeyStatuses());
                video.play().catch(() => { });
                const handleShakaPlaying = () => {
                    console.log('[StreamX] 🎬 Shaka Stream playing started.');
                    onLoad && onLoad({ type: 'dash', tracks: player.getVariantTracks() });
                    video.removeEventListener('playing', handleShakaPlaying);
                };
                video.addEventListener('playing', handleShakaPlaying);

            } else {
                video.src = url;
                video.load();
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(() => { });
                    const handleNativePlaying = () => {
                        console.log('[StreamX] 🎬 Native Stream playing started.');
                        onLoad && onLoad({ type: 'native' });
                        video.removeEventListener('playing', handleNativePlaying);
                    };
                    video.addEventListener('playing', handleNativePlaying);
                }, { once: true });
                video.addEventListener('error', () => {
                    const e = video.error;
                    onError && onError(`Native playback error code=${e?.code}: ${e?.message}`);
                }, { once: true });
            }

        } catch (err) {
            console.error('[StreamX] threw:', err);
            onError && onError(err.message || String(err));
        }
    }, [destroyAll]);

    useEffect(() => () => { destroyAll(); }, [destroyAll]);

    return { videoRef, hlsRef, shakaRef, loadStream, destroyAll };
}
