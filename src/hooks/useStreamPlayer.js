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
                    const hls = new Hls({ enableWorker: true, lowLatencyMode: true, debug: false });
                    hlsRef.current = hls;
                    hls.loadSource(url);
                    hls.attachMedia(video);

                    hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
                        video.play().catch(e => console.warn('[StreamX] Autoplay blocked:', e));
                        onLoad && onLoad({ type: 'hls', levels: hls.levels });
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
                        onLoad && onLoad({ type: 'hls-native' });
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

                player.addEventListener('error', e => {
                    console.error('[StreamX Shaka]', e.detail);
                    onError && onError(`Shaka [${e.detail.code}]: ${e.detail.message}`);
                });

                if (drmConfig?.keySystem && drmConfig.keySystem !== 'none') {
                    const cfg = { drm: { servers: {} } };
                    if (drmConfig.keySystem === 'org.w3.clearkey' && drmConfig.clearKeys?.length) {
                        const keys = {};
                        drmConfig.clearKeys.forEach(({ kid, key }) => { if (kid && key) keys[kid] = key; });
                        cfg.drm.clearKeys = keys;
                    } else if (drmConfig.licenseUrl) {
                        cfg.drm.servers[drmConfig.keySystem] = drmConfig.licenseUrl;
                        if (drmConfig.headers) {
                            player.getNetworkingEngine().registerRequestFilter((type, request) => {
                                if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
                                    try { Object.assign(request.headers, JSON.parse(drmConfig.headers)); } catch (_) { }
                                }
                            });
                        }
                    }
                    player.configure(cfg);
                }

                await player.load(url);
                video.play().catch(() => { });
                onLoad && onLoad({ type: 'dash', tracks: player.getVariantTracks() });

            } else {
                video.src = url;
                video.load();
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(() => { });
                    onLoad && onLoad({ type: 'native' });
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
