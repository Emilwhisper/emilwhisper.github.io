import { useState, useRef, useEffect, useCallback } from "react";

interface Track {
  id: number;
  name: string;
  file: File;
  url: string;
  duration: number;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds === Infinity) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getBarHeights(count: number, playing: boolean): number[] {
  return Array.from({ length: count }, () =>
    playing ? Math.random() * 70 + 20 : 10
  );
}

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"none" | "all" | "one">("none");
  const [isDragging, setIsDragging] = useState(false);
  const [bars, setBars] = useState<number[]>(Array(20).fill(10));

  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const barIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentTrack = currentIndex !== null ? tracks[currentIndex] : null;

  // Animate equalizer bars
  useEffect(() => {
    if (isPlaying) {
      barIntervalRef.current = setInterval(() => {
        setBars(getBarHeights(20, true));
      }, 120);
    } else {
      if (barIntervalRef.current) clearInterval(barIntervalRef.current);
      setBars(Array(20).fill(10));
    }
    return () => {
      if (barIntervalRef.current) clearInterval(barIntervalRef.current);
    };
  }, [isPlaying]);

  // Sync audio volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Load and play when currentIndex changes
  useEffect(() => {
    if (audioRef.current && currentTrack) {
      audioRef.current.src = currentTrack.url;
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current && !isDragging) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, [isDragging]);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setCurrentTime(0);
    }
  }, []);

  const handleEnded = useCallback(() => {
    if (repeat === "one") {
      audioRef.current?.play();
    } else if (shuffle) {
      const next = Math.floor(Math.random() * tracks.length);
      setCurrentIndex(next);
      setIsPlaying(true);
    } else if (repeat === "all" || (currentIndex !== null && currentIndex < tracks.length - 1)) {
      const next = currentIndex !== null ? (currentIndex + 1) % tracks.length : 0;
      setCurrentIndex(next);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [repeat, shuffle, tracks.length, currentIndex]);

  const playTrack = (index: number) => {
    if (currentIndex === index) {
      togglePlay();
    } else {
      setCurrentIndex(index);
      setIsPlaying(true);
      setTimeout(() => {
        audioRef.current?.play().catch(() => {});
      }, 50);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const playNext = useCallback(() => {
    if (tracks.length === 0) return;
    if (shuffle) {
      setCurrentIndex(Math.floor(Math.random() * tracks.length));
    } else {
      setCurrentIndex((prev) =>
        prev === null ? 0 : (prev + 1) % tracks.length
      );
    }
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }, [shuffle, tracks.length]);

  const playPrev = useCallback(() => {
    if (tracks.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    if (shuffle) {
      setCurrentIndex(Math.floor(Math.random() * tracks.length));
    } else {
      setCurrentIndex((prev) =>
        prev === null ? 0 : (prev - 1 + tracks.length) % tracks.length
      );
    }
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(() => {}), 50);
  }, [shuffle, tracks.length]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newTracks: Track[] = [];
    Array.from(files).forEach((file) => {
      if (file.type === "audio/mpeg" || file.name.endsWith(".mp3") || file.type.startsWith("audio/")) {
        const url = URL.createObjectURL(file);
        newTracks.push({
          id: Date.now() + Math.random(),
          name: file.name.replace(/\.[^/.]+$/, ""),
          file,
          url,
          duration: 0,
        });
      }
    });
    setTracks((prev) => [...prev, ...newTracks]);
  };

  const removeTrack = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const newTracks = prev.filter((t) => t.id !== id);
      if (currentIndex !== null) {
        if (prev[currentIndex]?.id === id) {
          audioRef.current?.pause();
          setIsPlaying(false);
          setCurrentIndex(null);
        } else if (idx < currentIndex) {
          setCurrentIndex(currentIndex - 1);
        }
      }
      return newTracks;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const cycleRepeat = () => {
    setRepeat((r) => (r === "none" ? "all" : r === "all" ? "one" : "none"));
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="min-h-screen bg-gray-950 flex items-center justify-center p-4"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div className="w-full max-w-md flex flex-col gap-4">
        {/* Player Card */}
        <div className="bg-gray-900 rounded-3xl shadow-2xl overflow-hidden border border-gray-800">
          {/* Top Gradient Header */}
          <div className="bg-gradient-to-br from-violet-700 via-purple-700 to-fuchsia-700 p-6 pb-8 relative">
            <div className="flex items-center justify-between mb-4">
              <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">Now Playing</span>
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-white/30" />
                <div className="w-2 h-2 rounded-full bg-white/60" />
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </div>

            {/* Album Art / Visualizer */}
            <div className="flex justify-center mb-4">
              <div className="w-36 h-36 rounded-2xl bg-black/30 backdrop-blur flex items-center justify-center shadow-xl border border-white/10 relative overflow-hidden">
                {currentTrack ? (
                  <div className="flex items-end gap-[3px] h-16 px-2">
                    {bars.map((h, i) => (
                      <div
                        key={i}
                        className="w-2 rounded-full bg-white/80 transition-all duration-100"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                ) : (
                  <svg className="w-16 h-16 text-white/30" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z" />
                  </svg>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="text-center">
              <h2 className="text-white font-bold text-lg leading-tight truncate max-w-full px-2">
                {currentTrack ? currentTrack.name : "No track selected"}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                {currentIndex !== null ? `Track ${currentIndex + 1} of ${tracks.length}` : `${tracks.length} track${tracks.length !== 1 ? "s" : ""} loaded`}
              </p>
            </div>
          </div>

          {/* Controls Section */}
          <div className="p-5 bg-gray-900">
            {/* Progress Bar */}
            <div className="mb-4">
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                disabled={!currentTrack}
                className="w-full h-1.5 rounded-full appearance-none bg-gray-700 cursor-pointer accent-violet-500 disabled:opacity-40"
                style={{
                  background: `linear-gradient(to right, #7c3aed ${progress}%, #374151 ${progress}%)`,
                }}
              />
              <div className="flex justify-between text-gray-500 text-xs mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center justify-center gap-5 mb-5">
              {/* Shuffle */}
              <button
                onClick={() => setShuffle((s) => !s)}
                className={`p-2 rounded-full transition-all ${shuffle ? "text-violet-400" : "text-gray-500 hover:text-gray-300"}`}
                title="Shuffle"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                </svg>
              </button>

              {/* Prev */}
              <button
                onClick={playPrev}
                disabled={tracks.length === 0}
                className="p-2 text-gray-300 hover:text-white disabled:opacity-40 transition-all"
                title="Previous"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
                </svg>
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlay}
                disabled={!currentTrack}
                className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:scale-100"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Next */}
              <button
                onClick={playNext}
                disabled={tracks.length === 0}
                className="p-2 text-gray-300 hover:text-white disabled:opacity-40 transition-all"
                title="Next"
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
                </svg>
              </button>

              {/* Repeat */}
              <button
                onClick={cycleRepeat}
                className={`p-2 rounded-full transition-all relative ${repeat !== "none" ? "text-violet-400" : "text-gray-500 hover:text-gray-300"}`}
                title={`Repeat: ${repeat}`}
              >
                {repeat === "one" ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
                  </svg>
                )}
                {repeat !== "none" && (
                  <span className="absolute -top-1 -right-1 text-[9px] bg-violet-500 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">
                    {repeat === "one" ? "1" : "∞"}
                  </span>
                )}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : volume < 0.5 ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer accent-violet-500"
                style={{
                  background: `linear-gradient(to right, #7c3aed ${(isMuted ? 0 : volume) * 100}%, #374151 ${(isMuted ? 0 : volume) * 100}%)`,
                }}
              />
              <span className="text-gray-500 text-xs w-8 text-right">
                {isMuted ? "0%" : `${Math.round(volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Playlist */}
        <div className="bg-gray-900 rounded-3xl border border-gray-800 overflow-hidden shadow-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
            <h3 className="text-white font-semibold text-sm">Playlist</h3>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-full transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              Add MP3s
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.mp3"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {tracks.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-gray-600 cursor-pointer hover:text-gray-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-10 h-10 mb-3 opacity-50" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
              <p className="text-sm font-medium">Drop MP3 files here</p>
              <p className="text-xs mt-1 opacity-60">or click "Add MP3s" to browse</p>
            </div>
          ) : (
            <ul className="max-h-64 overflow-y-auto divide-y divide-gray-800/60 custom-scroll">
              {tracks.map((track, index) => (
                <li
                  key={track.id}
                  onClick={() => playTrack(index)}
                  className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all group ${
                    currentIndex === index
                      ? "bg-violet-950/60"
                      : "hover:bg-gray-800/50"
                  }`}
                >
                  {/* Index / Playing indicator */}
                  <div className="w-6 flex-shrink-0 text-center">
                    {currentIndex === index && isPlaying ? (
                      <div className="flex items-end gap-[2px] h-4 justify-center">
                        {[1, 2, 3].map((b) => (
                          <div
                            key={b}
                            className="w-1 bg-violet-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${b * 0.1}s`, height: `${40 + b * 20}%` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={`text-xs ${currentIndex === index ? "text-violet-400 font-bold" : "text-gray-600 group-hover:text-gray-400"}`}>
                        {index + 1}
                      </span>
                    )}
                  </div>

                  {/* Track name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate font-medium ${currentIndex === index ? "text-violet-300" : "text-gray-300"}`}>
                      {track.name}
                    </p>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={(e) => removeTrack(track.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1 rounded"
                    title="Remove"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-gray-700 text-xs pb-2">
          🎵 MP3 Player · Drag & drop files anywhere
        </p>
      </div>

      <style>{`
        .custom-scroll::-webkit-scrollbar { width: 4px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
        input[type='range']::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: #7c3aed;
          cursor: pointer;
          box-shadow: 0 0 4px rgba(124,58,237,0.6);
        }
        @keyframes bounce {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        .animate-bounce {
          animation: bounce 0.8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
