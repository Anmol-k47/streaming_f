import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Search, Shield, Zap, Clock, ChevronRight, ChevronDown,
  AlertTriangle, Loader2, RefreshCw, X, Layers,
  PictureInPicture2, CheckCircle2, Tv, Radio, Settings2,
  Link, Plus, RotateCcw, MonitorPlay, ListVideo
} from 'lucide-react';

import { cn } from './lib/utils';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from './components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import { Switch } from './components/ui/switch';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from './components/ui/tooltip';
import { useStreamPlayer, detectFormat } from './hooks/useStreamPlayer';
import { fetchChannels } from './services/channelService';

/* ─── helpers ───────────────────────────────────── */
function fmtBadgeVariant(type) {
  if (!type) return 'outline';
  if (type?.startsWith('hls')) return 'hls';
  if (type === 'dash' || type === 'shaka') return 'dash';
  return 'native';
}
function fmtLabel(type) {
  if (!type) return '';
  if (type?.startsWith('hls')) return 'HLS';
  if (type === 'dash' || type === 'shaka') return 'DASH';
  return 'Native';
}

const DRM_SYSTEMS = [
  { id: 'none', label: 'No DRM' },
  { id: 'com.widevine.alpha', label: 'Widevine' },
  { id: 'com.microsoft.playready', label: 'PlayReady' },
  { id: 'org.w3.clearkey', label: 'ClearKey' },
];

/* ─── Custom Video Controls ─────────────────────── */
function VideoControls({ videoRef, isPlaying, isMuted, onPlayPause, onMuteToggle, duration, currentTime, onSeek }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const fmt = (s) => {
    if (!s || !isFinite(s) || s > 360000) return 'Live';
    const m = Math.floor(s / 60); const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const isLive = duration > 360000 || !isFinite(duration);
  const pct = !isLive && duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleSeekDrag = (e) => onSeek(Number(e.target.value));

  const handleVolumeDrag = (e) => {
    const v = videoRef.current;
    if (v) {
      v.volume = Number(e.target.value);
      if (v.volume > 0 && isMuted) onMuteToggle();
      if (v.volume === 0 && !isMuted) onMuteToggle();
    }
  };

  const changeSpeed = (rate) => {
    const v = videoRef.current;
    if (v) { v.playbackRate = rate; setPlaybackRate(rate); }
    setShowSettings(false);
  };

  const toggleFS = () => {
    const el = document.querySelector('.video-container');
    if (!document.fullscreenElement) { el?.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const togglePiP = async () => {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await videoRef.current?.requestPictureInPicture?.().catch(() => {});
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 group/controls">
      {/* Add a Subtle Gradient to bottom to ensure controls are always visible */}
      <div className="h-32 bg-gradient-to-t from-black/95 via-black/50 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 space-y-2 opacity-0 group-hover/controls:opacity-100 transition-opacity duration-300">
        {/* Progress Slider */}
        <div className="group relative flex items-center h-4 cursor-pointer">
          <input
            type="range" min="0" max={duration || 100} value={currentTime} onChange={handleSeekDrag}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div className="w-full h-1 bg-white/20 rounded-full relative group-hover:h-1.5 transition-all">
            <div className="h-full bg-primary rounded-full relative" style={{ width: `${pct}%` }}>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 scale-0 group-hover:scale-100 transition-all pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={onPlayPause} className="h-9 w-9 text-white hover:bg-white/15 hover:text-white">
                  {isPlaying ? <Pause className="h-4.5 w-4.5 fill-white" /> : <Play className="h-4.5 w-4.5 fill-white ml-0.5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isPlaying ? 'Pause' : 'Play'}</TooltipContent>
            </Tooltip>

            {/* Volume section with hidden slider on hover */}
            <div className="group/vol relative flex items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={onMuteToggle} className="h-9 w-9 text-white hover:bg-white/15 hover:text-white">
                    {isMuted || videoRef.current?.volume === 0 ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
              </Tooltip>
              <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-[width] duration-300 ease-out flex items-center">
                <input
                  type="range" min="0" max="1" step="0.05"
                  defaultValue={videoRef.current?.volume ?? 1}
                  onChange={handleVolumeDrag}
                  className="w-16 h-1 mt-0.5 ml-2 accent-white bg-white/30 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer outline-none"
                />
              </div>
            </div>

            <span className="text-white/70 text-xs font-medium ml-2 font-mono flex items-center gap-1.5">
              {isLive ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-glow" /> LIVE
                </>
              ) : (
                <>{fmt(currentTime)}{duration > 0 ? ` / ${fmt(duration)}` : ''}</>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1 relative">
            {/* Settings Menu */}
            <div className="relative">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={() => setShowSettings(!showSettings)} className={cn("h-8 w-8 text-white hover:bg-white/15 transition-transform", showSettings && "rotate-45 bg-white/15")}>
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Settings</TooltipContent>
              </Tooltip>

              {showSettings && (
                <div className="absolute bottom-10 right-0 w-36 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200">
                  <p className="text-[10px] uppercase font-bold text-white/50 px-2 py-1.5 mb-1 border-b border-white/10">Speed</p>
                  {[0.5, 1, 1.25, 1.5, 2].map(r => (
                    <button
                      key={r}
                      onClick={() => changeSpeed(r)}
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs font-medium text-white/90 hover:bg-white/10 transition-colors text-left"
                    >
                      <span>{r === 1 ? 'Normal' : `${r}x`}</span>
                      {playbackRate === r && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={togglePiP} className="h-8 w-8 text-white hover:bg-white/15">
                  <PictureInPicture2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Picture in Picture</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={toggleFS} className="h-8 w-8 text-white hover:bg-white/15">
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Channel Card ───────────────────────────────── */
function ChannelCard({ channel, isActive, isFav, onToggleFav, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="relative group/card cursor-pointer w-full" onClick={onClick}>
      <div
        className={cn(
          'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 text-center h-full',
          isActive
            ? 'bg-primary/15 border-primary/50 shadow-lg shadow-primary/10'
            : 'bg-white/[0.03] border-white/[0.06] group-hover/card:bg-white/[0.07] group-hover/card:border-white/[0.15]'
        )}
      >
        {/* Live dot */}
        {isActive && (
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse-glow z-10" />
        )}
        {/* Fav Button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(channel.id); }}
          className={cn(
            "absolute top-2 left-2 z-10 h-7 w-7 rounded-full flex items-center justify-center transition-all opacity-0 group-hover/card:opacity-100 bg-black/50 hover:bg-black/80 backdrop-blur-sm border border-white/10",
            isFav && "opacity-100"
          )}
        >
          <svg className={cn("w-4 h-4 transition-colors", isFav ? "fill-red-500 text-red-500" : "fill-none text-white")} viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>

        {/* Logo */}
        <div className={cn(
          "w-full rounded-lg overflow-hidden bg-black/40 flex items-center justify-center relative",
          channel.isFancode ? "aspect-[21/9]" : "aspect-video"
        )}>
          {!imgFailed ? (
            <img
              src={channel.logo}
              alt={channel.name}
              className={cn("w-full h-full p-1", channel.isFancode ? "object-cover" : "object-contain")}
              onError={() => setImgFailed(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Tv className="h-5 w-5 text-primary/60" />
            </div>
          )}
          {/* DRM Badge */}
          {channel.drm && (
            <div className="absolute bottom-1 right-1 bg-black/80 rounded px-1.5 py-0.5 text-[9px] font-bold text-amber-500 border border-amber-500/30">DRM</div>
          )}
          {/* Fancode Status Badge */}
          {channel.isFancode && channel.fcStatus && (
            <div className={cn(
              "absolute top-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold border uppercase tracking-wide flex items-center gap-1",
              channel.fcStatus === 'LIVE' || channel.fcStatus === 'STARTED'
                ? "bg-red-500/90 text-white border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                : "bg-black/80 text-foreground/80 border-white/20"
            )}>
              {(channel.fcStatus === 'LIVE' || channel.fcStatus === 'STARTED') && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
              {channel.fcStatus === 'STARTED' ? 'LIVE' : channel.fcStatus}
            </div>
          )}
        </div>
        {/* Name */}
        <p className={cn(
          'text-xs font-medium leading-tight line-clamp-2 w-full transition-colors truncate',
          isActive ? 'text-primary' : 'text-foreground/70 group-hover/card:text-foreground'
        )}>
          {channel.name}
        </p>
      </div>
    </div>
  );
}

/* ─── Category Sidebar Item ─────────────────────── */
function CategoryItem({ cat, count, isActive, isSpecial, icon: Icon, onClick }) {
  const shortName = typeof cat === 'string' ? cat.trim().replace(/\s*-\s*$/, '') : cat;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between w-full px-3 py-2 rounded-lg text-left transition-all duration-200 group',
        isActive
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon ? (
          <Icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? (isSpecial ? "text-amber-400" : "text-primary") : "text-muted-foreground/60 group-hover:text-foreground/80")} />
        ) : (
          <div className={cn('shrink-0 h-1.5 w-1.5 rounded-full transition-colors', isActive ? 'bg-primary' : 'bg-muted-foreground/40 group-hover:bg-muted-foreground')} />
        )}
        <span className="text-xs font-medium truncate">{shortName}</span>
      </div>
      {count !== undefined && (
        <span className={cn('text-[10px] shrink-0 font-mono tabular-nums', isActive ? 'text-primary/70' : 'text-muted-foreground/50')}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Main App ───────────────────────────────────── */
export default function App() {
  // ── Channel data state ──
  const [channelData, setChannelData] = useState(null); // { providerList, dataByProvider }
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [channelError, setChannelError] = useState('');
  
  const [activeProvider, setActiveProvider] = useState('TataTV');
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');
  const [activeChannel, setActiveChannel] = useState(null);

  // ── Persistent Data (LocalStorage) ──
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('streamx_favs')) || []);
  const [recents, setRecents] = useState(() => JSON.parse(localStorage.getItem('streamx_recents')) || []);

  // Save to LS whenever they change
  useEffect(() => { localStorage.setItem('streamx_favs', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('streamx_recents', JSON.stringify(recents)); }, [recents]);

  const toggleFav = (id) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  // ── Player state ──
  const [format, setFormat] = useState('auto');
  const [showDrm, setShowDrm] = useState(false);
  const [drmConfig, setDrmConfig] = useState({ keySystem: 'none', licenseUrl: '', headers: '', clearKeys: [{ kid: '', key: '' }] });
  const [playerStatus, setPlayerStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [streamInfo, setStreamInfo] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [viewMode, setViewMode] = useState('channels'); // 'channels' | 'url'
  const controlsTimerRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { videoRef, hlsRef, shakaRef, loadStream } = useStreamPlayer();

  /* ── Fetch channels on mount ── */
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchChannels();
        setChannelData(data);
        if (data.providerList?.length > 0) {
            const firstProvider = data.providerList[0];
            setActiveProvider(firstProvider);
            if (data.dataByProvider[firstProvider]?.categories?.length > 0) {
              setActiveCategory(data.dataByProvider[firstProvider].categories[0]);
            }
        }
      } catch (e) {
        setChannelError(e.message || 'Failed to load channels');
      } finally {
        setLoadingChannels(false);
      }
    })();
  }, []);

  /* ── Video events & Shortcuts & Ambilight ── */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    let ambilightFrameId;
    const canvas = document.getElementById('ambilight-glow');
    const ctx = canvas?.getContext('2d', { alpha: false });

    // Ambilight rendering loop
    const drawAmbilight = () => {
      if (!video.paused && !video.ended && canvas && ctx) {
        // Draw the current video frame to the small canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      ambilightFrameId = requestAnimationFrame(drawAmbilight);
    };

    const handlers = {
      play: () => {
        setIsPlaying(true);
        if (canvas) {
          canvas.width = 64; // Low res for performance
          canvas.height = 36;
          drawAmbilight();
        }
      },
      pause: () => {
        setIsPlaying(false);
        cancelAnimationFrame(ambilightFrameId);
      },
      timeupdate: () => setCurrentTime(video.currentTime),
      durationchange: () => setDuration(video.duration || 0),
      waiting: () => setIsBuffering(true),
      playing: () => setIsBuffering(false),
    };
    Object.entries(handlers).forEach(([e, fn]) => video.addEventListener(e, fn));

    // Global Keyboard Shortcuts
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (!video) return;

      switch(e.key.toLowerCase()) {
        case ' ': // Space = Play/Pause
          e.preventDefault();
          video.paused ? video.play() : video.pause();
          break;
        case 'm': // Mute
          e.preventDefault();
          video.muted = !video.muted;
          setIsMuted(video.muted);
          break;
        case 'f': // Fullscreen
          e.preventDefault();
          const el = document.querySelector('.video-container');
          if (!document.fullscreenElement) el?.requestFullscreen();
          else document.exitFullscreen();
          break;
        case 'arrowright': // Seek Forward 10s
          e.preventDefault();
          if (video.duration) video.currentTime = Math.min(video.duration, video.currentTime + 10);
          break;
        case 'arrowleft': // Seek Backward 10s
          e.preventDefault();
          if (video.duration) video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'arrowup': // Volume Up (+10%)
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          if (video.volume > 0 && video.muted) { video.muted = false; setIsMuted(false); }
          break;
        case 'arrowdown': // Volume Down (-10%)
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      Object.entries(handlers).forEach(([e, fn]) => video.removeEventListener(e, fn));
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(ambilightFrameId);
    }
  }, [videoRef]);

  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  /* ── Play a channel or URL ── */
  const playStream = useCallback(async (url, channel) => {
    setPlayerStatus('loading');
    setErrorMsg('');
    setStreamInfo(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    
    let activeDrmConfig = showDrm ? drmConfig : null;

    if (channel) {
      setActiveChannel(channel);
      // Auto-apply DRM if the channel provides it (like Zee5)
      if (channel.drm) {
        setShowDrm(true);
        activeDrmConfig = channel.drm;
        setDrmConfig(channel.drm);
      } else {
        setShowDrm(false);
        activeDrmConfig = null;
      }

      // Append to recently watched (max 15, deduplicated)
      setRecents(prev => {
        const unique = prev.filter(id => id !== channel.id);
        return [channel.id, ...unique].slice(0, 15);
      });
    }

    await loadStream(url, format, activeDrmConfig,
      (info) => { setPlayerStatus('playing'); setStreamInfo(info); },
      (err) => { setPlayerStatus('error'); setErrorMsg(err); }
    );
  }, [format, showDrm, drmConfig, loadStream]);

  const togglePlayPause = () => { const v = videoRef.current; if (!v) return; v.paused ? v.play() : v.pause(); };
  const toggleMute = () => { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setIsMuted(v.muted); };
  const handleSeek = (t) => { if (videoRef.current) videoRef.current.currentTime = t; };

  /* ── Filtered channels ── */
  const displayedChannels = (() => {
    if (!channelData) return [];
    
    // Virtual Categories: 'Favorites' and 'Recents'
    let src = [];
    if (activeCategory === 'Favorites ⭐') {
      const allProviders = Object.values(channelData.dataByProvider);
      const allCategories = allProviders.map(p => Object.values(p.byCategory)).flat(2);
      src = favorites.map(fId => allCategories.find(c => c.id === fId)).filter(Boolean);
    } else if (activeCategory === 'Recently Watched 🕒') {
      const allProviders = Object.values(channelData.dataByProvider);
      const allCategories = allProviders.map(p => Object.values(p.byCategory)).flat(2);
      src = recents.map(rId => allCategories.find(c => c.id === rId)).filter(Boolean);
    } else {
      const providerData = channelData.dataByProvider[activeProvider];
      if (!providerData) return [];

      src = search.trim()
        ? Object.values(providerData.byCategory || {}).flat()
        : (providerData.byCategory?.[activeCategory] || []);
    }

    // De-duplicate in case of multiple IDs in original feed, and handle search
    const uniqueSrc = Array.from(new Map(src.map(item => [item.id, item])).values());
    if (!search.trim()) return uniqueSrc;
    const q = search.toLowerCase();
    return uniqueSrc.filter(c => c.name.toLowerCase().includes(q));
  })();

  /* ── ClearKey helpers ── */
  const updateClearKey = (idx, f, v) => setDrmConfig(prev => ({ ...prev, clearKeys: prev.clearKeys.map((k, i) => i === idx ? { ...k, [f]: v } : k) }));
  const addClearKey = () => setDrmConfig(prev => ({ ...prev, clearKeys: [...prev.clearKeys, { kid: '', key: '' }] }));
  const removeClearKey = (idx) => setDrmConfig(prev => ({ ...prev, clearKeys: prev.clearKeys.filter((_, i) => i !== idx) }));

  return (
    <TooltipProvider delayDuration={300}>
      <div className="ambient-bg flex flex-col h-screen overflow-hidden bg-background font-sans">

        {/* ══ Header ══ */}
        <header className="shrink-0 flex items-center justify-between h-14 px-4 border-b border-white/[0.06] bg-background/90 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(v => !v)} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors text-muted-foreground hover:text-foreground">
              <ListVideo className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <MonitorPlay className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
              StreamX
            </span>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <div className="flex items-center gap-1">
              <button onClick={() => setViewMode('channels')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', viewMode === 'channels' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]')}>
                <span className="flex items-center gap-1.5"><Tv className="h-3.5 w-3.5" /> Channels</span>
              </button>
              <button onClick={() => setViewMode('matches')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', viewMode === 'matches' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]')}>
                <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Live Matches</span>
              </button>
              <button onClick={() => setViewMode('url')} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors', viewMode === 'url' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.05]')}>
                <span className="flex items-center gap-1.5"><Link className="h-3.5 w-3.5" /> Custom URL</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeChannel && playerStatus === 'playing' && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-glow" />
                <span className="text-xs font-medium text-red-400 truncate max-w-[180px]">{activeChannel.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
              HLS · DASH · DRM
            </div>
          </div>
        </header>

        {/* ══ Body ══ */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Category Sidebar ── */}
          {viewMode === 'channels' && sidebarOpen && (
            <aside className="shrink-0 w-56 flex flex-col border-r border-white/[0.06] bg-background/60">
              <div className="p-3 border-b border-white/[0.06] flex flex-col gap-3">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Providers</p>
                
                {/* Provider Tabs Horizontal Scroll */}
                {channelData?.providerList && channelData.providerList.length > 0 && !loadingChannels && !channelError && (
                  <div className="flex overflow-x-auto no-scrollbar gap-1.5 pb-2 -mx-2 px-2 snap-x">
                    {channelData.providerList.map(prov => (
                      <button
                        key={prov}
                        onClick={() => {
                          setActiveProvider(prov);
                          setSearch('');
                          if (channelData.dataByProvider[prov]?.categories?.length > 0) {
                            setActiveCategory(channelData.dataByProvider[prov].categories[0]);
                          }
                        }}
                        className={cn(
                          "shrink-0 snap-start whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-medium transition-all duration-200 border",
                          activeProvider === prov && activeCategory !== 'Favorites ⭐' && activeCategory !== 'Recently Watched 🕒'
                            ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                            : "bg-white/[0.03] text-muted-foreground border-white/[0.08] hover:bg-white/[0.08] hover:text-white"
                        )}
                      >
                        {prov}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-0.5">
                  {loadingChannels ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-8 rounded-lg bg-white/[0.04] animate-pulse mx-1" />
                    ))
                  ) : channelError ? (
                    <p className="text-xs text-red-400 px-3 py-2">{channelError}</p>
                  ) : (
                    <>
                      {/* Special Persistent Categories */}
                      {favorites.length > 0 && (
                        <CategoryItem cat="Favorites ⭐" count={favorites.length} isActive={activeCategory === 'Favorites ⭐' && !search} isSpecial onClick={() => { setActiveCategory('Favorites ⭐'); setSearch(''); }} />
                      )}
                      {recents.length > 0 && (
                        <CategoryItem cat="Recently Watched 🕒" count={recents.length} isActive={activeCategory === 'Recently Watched 🕒' && !search} isSpecial onClick={() => { setActiveCategory('Recently Watched 🕒'); setSearch(''); }} />
                      )}
                      
                      {/* Separator before provider specific categories */}
                      {(favorites.length > 0 || recents.length > 0) && <div className="h-px bg-white/[0.06] my-2 w-full" />}

                      {/* Provider Categories */}
                      {channelData?.dataByProvider[activeProvider]?.categories?.map(cat => (
                        <CategoryItem
                          key={cat}
                          cat={cat}
                          count={channelData.dataByProvider[activeProvider]?.byCategory?.[cat]?.length || 0}
                          isActive={activeCategory === cat && !search}
                          onClick={() => { setActiveCategory(cat); setSearch(''); }}
                        />
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </aside>
          )}

          {/* ── Main area ── */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {viewMode === 'url' ? (
              /* ── Custom URL Mode ── */
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-2xl mx-auto space-y-4">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Link className="h-5 w-5 text-primary" /> Custom Stream URL</h2>
                  <div className="glass-card p-5 space-y-4">
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                          id="custom-url-input"
                          type="url"
                          value={customUrl}
                          onChange={e => setCustomUrl(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && customUrl && playStream(customUrl, null)}
                          placeholder="https://example.com/stream.m3u8  ·  .mpd  ·  .mp4"
                          className="w-full h-11 pl-10 pr-4 rounded-xl border text-sm outline-none transition-all bg-white/[0.04] border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:bg-white/[0.07] focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <Button size="lg" onClick={() => customUrl && playStream(customUrl, null)}
                        disabled={!customUrl.trim() || playerStatus === 'loading'} className="h-11 px-6 rounded-xl gap-2 shrink-0">
                        {playerStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-white" />}
                        Play
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <Tabs value={format} onValueChange={setFormat}>
                        <TabsList className="h-8 bg-white/[0.04] border border-white/[0.06] p-0.5">
                          {['auto', 'hls', 'dash', 'native'].map(f => (
                            <TabsTrigger key={f} value={f} className="h-7 px-3 text-xs capitalize">{f === 'auto' ? '⚡ Auto' : f.toUpperCase()}</TabsTrigger>
                          ))}
                        </TabsList>
                      </Tabs>
                      <div className="ml-auto flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Shield className={cn('h-3.5 w-3.5', showDrm ? 'text-amber-400' : 'text-muted-foreground')} />
                          <span className="text-xs font-medium text-muted-foreground">DRM</span>
                        </label>
                        <Switch checked={showDrm} onCheckedChange={setShowDrm} />
                      </div>
                    </div>
                    {showDrm && (
                      <div className="animate-fade-in rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-2"><Shield className="h-3.5 w-3.5" /> DRM Configuration</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Key System</label>
                            <Select value={drmConfig.keySystem} onValueChange={v => setDrmConfig(d => ({ ...d, keySystem: v }))}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DRM_SYSTEMS.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          {drmConfig.keySystem !== 'none' && drmConfig.keySystem !== 'org.w3.clearkey' && (
                            <div className="space-y-1.5">
                              <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">License URL</label>
                              <input type="url" value={drmConfig.licenseUrl} onChange={e => setDrmConfig(d => ({ ...d, licenseUrl: e.target.value }))}
                                placeholder="https://license-server.example.com/..." className="w-full h-9 px-3 rounded-md border border-white/[0.08] bg-white/[0.04] text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors" />
                            </div>
                          )}
                          {drmConfig.keySystem === 'org.w3.clearkey' && (
                            <div className="sm:col-span-2 space-y-2">
                              <label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">ClearKey Pairs</label>
                              {drmConfig.clearKeys.map((pair, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                  <input className="h-8 px-3 rounded-md border border-white/[0.08] bg-white/[0.04] text-xs outline-none" placeholder="KID (hex)" value={pair.kid} onChange={e => updateClearKey(idx, 'kid', e.target.value)} />
                                  <input className="h-8 px-3 rounded-md border border-white/[0.08] bg-white/[0.04] text-xs outline-none" placeholder="Key (hex)" value={pair.key} onChange={e => updateClearKey(idx, 'key', e.target.value)} />
                                  <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-destructive hover:bg-red-500/10" onClick={() => removeClearKey(idx)}><X className="h-3.5 w-3.5" /></Button>
                                </div>
                              ))}
                              <Button variant="outline" size="sm" onClick={addClearKey} className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"><Plus className="h-3 w-3 mr-1" />Add Key</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : viewMode === 'matches' ? (
              /* ── Live Matches Mode ── */
              <div className="flex-1 overflow-auto p-6">
                <div className="max-w-4xl mx-auto space-y-6">
                  <h2 className="text-lg font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Live Matches</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* IND VS ENG MATCH */}
                    <div 
                      className="group relative rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all cursor-pointer overflow-hidden flex flex-col"
                      onClick={() => playStream('https://otte.live.fly.ww.aiv-cdn.net/syd-nitro/live/dash/enc/ppulp45ou8/out/v1/564bb083afea4561a5a60c4447258379/cenc.mpd', {
                        id: 'ind-vs-eng',
                        name: 'IND vs ENG',
                        category: 'Live Match',
                        logo: 'https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/Cricket_India_Crest.svg/1200px-Cricket_India_Crest.svg.png',
                        drm: {
                          keySystem: 'org.w3.clearkey',
                          clearKeys: [{
                            kid: '03018e1facaf7f344fa3d7439c6fc5b2',
                            key: '48a92e8fc0c897a7b23044f4b86e544b'
                          }]
                        }
                      })}
                    >
                      <div className="aspect-[21/9] bg-black/40 relative flex items-center justify-center p-4">
                         <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/90 text-white border border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] flex items-center gap-1">
                           <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> LIVE
                         </span>
                         <div className="flex items-center justify-center gap-4 w-full">
                           <div className="flex flex-col items-center">
                             <div className="h-10 w-10 flex border-[2px] border-blue-500 rounded-full bg-white shrink-0 overflow-hidden p-1 shadow-[0_0_10px_rgba(59,130,246,0.3)]">
                               <img src="https://upload.wikimedia.org/wikipedia/en/thumb/8/8d/Cricket_India_Crest.svg/120px-Cricket_India_Crest.svg.png" alt="IND" className="w-full h-full object-contain" />
                             </div>
                             <span className="text-[10px] mt-1.5 font-bold uppercase tracking-wider text-white">IND</span>
                           </div>
                           <span className="text-amber-500 font-black text-sm italic">VS</span>
                           <div className="flex flex-col items-center">
                             <div className="h-10 w-10 flex border-[2px] border-red-500 rounded-full bg-white shrink-0 overflow-hidden p-1 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                               <img src="https://upload.wikimedia.org/wikipedia/en/thumb/b/be/England_and_Wales_Cricket_Board_logo.svg/120px-England_and_Wales_Cricket_Board_logo.svg.png" alt="ENG" className="w-full h-full object-contain" />
                             </div>
                             <span className="text-[10px] mt-1.5 font-bold uppercase tracking-wider text-white">ENG</span>
                           </div>
                         </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-xs group-hover:text-primary transition-colors line-clamp-1">IND vs ENG - Live Streaming</h3>
                        <p className="text-[10px] text-muted-foreground mt-0.5">International Cricket</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── Channel Browser Mode ── */
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Search bar */}
                <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      id="channel-search"
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search channels…"
                      className="w-full h-9 pl-9 pr-9 rounded-xl border border-white/[0.08] bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60 transition-colors"
                    />
                    {search && (
                      <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {loadingChannels ? 'Loading…' : `${displayedChannels.length} channels`}
                  </span>
                  {!loadingChannels && !search && activeCategory && (
                    <Badge variant="secondary" className="text-xs">{activeCategory.trim()}</Badge>
                  )}
                </div>

                {/* Channel Grid */}
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {loadingChannels ? (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                        {Array.from({ length: 24 }).map((_, i) => (
                          <div key={i} className="rounded-xl bg-white/[0.04] animate-pulse" style={{ aspectRatio: '1/1.3' }} />
                        ))}
                      </div>
                    ) : channelError ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                        <div className="h-16 w-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                          <AlertTriangle className="h-8 w-8 text-red-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-red-400">Failed to load channels</p>
                          <p className="text-sm text-muted-foreground mt-1">{channelError}</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="gap-2">
                          <RotateCcw className="h-4 w-4" /> Retry
                        </Button>
                      </div>
                    ) : displayedChannels.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Search className="h-10 w-10 text-muted-foreground/30" />
                        <p className="text-muted-foreground text-sm">No channels found for "{search}"</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                        {displayedChannels.map(ch => (
                          <ChannelCard
                            key={ch.id}
                            channel={ch}
                            isActive={activeChannel?.id === ch.id && playerStatus === 'playing'}
                            isFav={favorites.includes(ch.id)}
                            onToggleFav={toggleFav}
                            onClick={() => playStream(ch.url, ch)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* ══ Player Panel ══ */}
          <div className="shrink-0 w-[420px] flex flex-col border-l border-white/[0.06] bg-background/50">

            {/* Player */}
            <div
              className="video-container relative z-10 bg-black/80"
              style={{ aspectRatio: '16/9' }}
              onMouseMove={resetControlsTimer}
              onMouseLeave={() => setShowControls(false)}
              onMouseEnter={() => setShowControls(true)}
            >
              <video
                ref={videoRef}
                id="video-player"
                className="w-full h-full object-contain relative z-20"
                playsInline
                crossOrigin="anonymous"
                onClick={togglePlayPause}
              />
              {/* Ambilight glow canvas handles drawing inside */}
              <canvas id="ambilight-glow" className="absolute top-0 left-0 w-full h-full opacity-40 blur-[80px] scale-110 -z-10 pointer-events-none transition-all duration-700 ease-out" />

              {/* Idle */}
              {playerStatus === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full border border-primary/8" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border border-primary/12" />
                  </div>
                  <div className="relative h-16 w-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center animate-float">
                    <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                      <Play className="h-5 w-5 text-primary fill-primary ml-0.5" />
                    </div>
                  </div>
                  <p className="relative text-sm font-medium text-foreground/60">Select a channel to watch</p>
                </div>
              )}

              {/* Loading */}
              {playerStatus === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
                  <div className="relative">
                    <div className="h-12 w-12 rounded-full border-2 border-primary/30 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                    <div className="absolute inset-0 rounded-full border border-primary/10 animate-ping" />
                  </div>
                  <p className="text-xs text-muted-foreground animate-pulse">Connecting…</p>
                </div>
              )}

              {/* Error */}
              {playerStatus === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm p-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-semibold text-red-400">Playback Error</p>
                    <p className="text-[11px] text-muted-foreground max-w-[280px] line-clamp-3">{errorMsg}</p>
                  </div>
                  <div className="flex gap-2">
                    {activeChannel && (
                      <Button variant="outline" size="sm" onClick={() => playStream(activeChannel.url, activeChannel)} className="gap-1.5 text-xs border-white/10 hover:bg-white/5">
                        <RefreshCw className="h-3.5 w-3.5" /> Retry
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setPlayerStatus('idle')} className="text-xs text-muted-foreground">Dismiss</Button>
                  </div>
                </div>
              )}
              
              {/* Buffering Overlay */}
              {playerStatus === 'playing' && isBuffering && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-[2px] z-20 pointer-events-none">
                  <div className="relative">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  </div>
                  <p className="text-[11px] text-white/90 font-medium animate-pulse tracking-wide">Buffering…</p>
                </div>
              )}

              {/* Controls */}
              {playerStatus === 'playing' && (
                <div className={cn('transition-opacity duration-300', showControls ? 'opacity-100' : 'opacity-0')}>
                  <VideoControls videoRef={videoRef} isPlaying={isPlaying} isMuted={isMuted}
                    onPlayPause={togglePlayPause} onMuteToggle={toggleMute}
                    duration={duration} currentTime={currentTime} onSeek={handleSeek} />
                </div>
              )}
            </div>

            {/* Now Playing Info */}
            <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] min-h-[68px] flex flex-col justify-center">
              {activeChannel && playerStatus !== 'idle' ? (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg overflow-hidden bg-black/50 shrink-0 flex items-center justify-center border border-white/[0.06]">
                    <img src={activeChannel.logo} alt={activeChannel.name}
                      className="w-full h-full object-contain p-0.5"
                      onError={e => { e.target.style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{activeChannel.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {playerStatus === 'playing' && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-glow shrink-0" />}
                      <span className="text-xs text-muted-foreground truncate">{activeChannel.category.trim()}</span>
                      {streamInfo && <Badge variant={fmtBadgeVariant(streamInfo.type)} className="text-[10px] px-1.5 py-0">{fmtLabel(streamInfo.type)}</Badge>}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No channel selected</p>
              )}
            </div>

            {/* Up Next / Related channels from same category */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="shrink-0 px-4 py-2 flex items-center gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Up Next</p>
                {activeCategory && <span className="text-[10px] text-muted-foreground/50">· {activeCategory.trim()}</span>}
              </div>
              <ScrollArea className="flex-1">
                <div className="px-3 pb-3 space-y-1">
                  {displayedChannels.slice(0, 30).map(ch => (
                    <button
                      key={ch.id}
                      onClick={() => playStream(ch.url, ch)}
                      className={cn(
                        'flex items-center gap-3 w-full p-2 rounded-xl border transition-all duration-200 text-left group',
                        activeChannel?.id === ch.id && playerStatus === 'playing'
                          ? 'bg-primary/10 border-primary/30'
                          : 'border-transparent hover:bg-white/[0.04] hover:border-white/[0.06]'
                      )}
                    >
                      <div className="h-8 w-14 rounded-lg overflow-hidden bg-black/50 shrink-0 border border-white/[0.05] flex items-center justify-center">
                        <img src={ch.logo} alt={ch.name} className="w-full h-full object-contain p-0.5"
                          onError={e => { e.target.style.display = 'none'; }} />
                      </div>
                      <p className={cn('text-xs truncate font-medium transition-colors',
                        activeChannel?.id === ch.id && playerStatus === 'playing'
                          ? 'text-primary'
                          : 'text-foreground/60 group-hover:text-foreground')}>
                        {ch.name}
                      </p>
                      {activeChannel?.id === ch.id && playerStatus === 'playing' && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse-glow shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
