"use client";

import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, SkipForward } from 'lucide-react';

const PLAYLIST = [
    "/music/jazz.mp3",
    "/music/jazz2.mp3"
];

export function BackgroundMusic() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
    const playPromiseRef = useRef<Promise<void> | null>(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = 0.15;
        }
    }, []);

    const safePlay = () => {
        if (audioRef.current) {
            // 이전에 진행 중인 play 요청이 있다면 무시하거나 기다림
            playPromiseRef.current = audioRef.current.play();
            playPromiseRef.current
                .then(() => {
                    setIsPlaying(true);
                    playPromiseRef.current = null;
                })
                .catch(err => {
                    if (err.name !== "AbortError") {
                        console.error("Music playback failed:", err);
                    }
                    playPromiseRef.current = null;
                });
        }
    };

    const toggleMusic = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlaying) {
                // play 요청이 완료된 후에만 pause 가능하도록 하거나 AbortError 무시
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                safePlay();
            }
        }
    };

    const handleNextTrack = () => {
        if (audioRef.current) {
            audioRef.current.pause(); // 새로운 로드 전 중단
            const nextIndex = (currentTrackIndex + 1) % PLAYLIST.length;
            setCurrentTrackIndex(nextIndex);

            // src 변경 시 브라우저가 자동으로 다음 곡을 준비하도록 함
            audioRef.current.src = PLAYLIST[nextIndex];
            audioRef.current.load();

            // 약간의 지연을 주어 load 요청과 play 요청이 충돌하지 않게 함
            setTimeout(() => {
                safePlay();
            }, 50);
        }
    };

    return (
        <div className="flex items-center gap-1">
            {!hasInteracted && (
                <div className="fixed top-20 right-8 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[10px] text-white/50 animate-bounce border border-white/10 z-50">
                    클릭하면 재즈가 시작됩니다 🎷
                </div>
            )}
            <audio
                ref={audioRef}
                src={PLAYLIST[currentTrackIndex]}
                onEnded={handleNextTrack}
                preload="auto"
            />
            <button
                onClick={toggleMusic}
                className={`p-2 rounded-xl backdrop-blur-xl transition-all group border ${isPlaying ? "bg-accent/20 border-accent/40" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                title={isPlaying ? "음악 끄기" : "음악 켜기"}
            >
                {isPlaying ? (
                    <Volume2 className="w-4 h-4 text-accent animate-pulse" />
                ) : (
                    <VolumeX className="w-4 h-4 text-white/40 group-hover:text-white" />
                )}
            </button>
            {isPlaying && (
                <button
                    onClick={(e) => { e.stopPropagation(); handleNextTrack(); }}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/20 hover:text-white transition-all"
                    title="다음 곡"
                >
                    <SkipForward className="w-3 h-3" />
                </button>
            )}
        </div>
    );
}
