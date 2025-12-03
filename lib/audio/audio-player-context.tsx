'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';

// Track type for any playable audio content
export interface AudioTrack {
  id: string;
  title: string;
  type: 'brief' | 'podcast' | 'audio';
  audioUrl: string;
  imageUrl?: string | null;
  duration?: number; // in seconds
  description?: string;
  createdAt?: string;
}

// Audio player state
export interface AudioPlayerState {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  error: string | null;
}

// Audio player context actions
export interface AudioPlayerContextType extends AudioPlayerState {
  play: (track: AudioTrack) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  togglePlay: () => void;
}

// Create context
const AudioPlayerContext = createContext<AudioPlayerContextType | undefined>(undefined);

// Global audio instance - persists across provider re-mounts
// This ensures audio continues playing even if React re-renders
let globalAudio: HTMLAudioElement | null = null;
let globalTrack: AudioTrack | null = null;

function getGlobalAudio(): HTMLAudioElement {
  if (typeof window !== 'undefined' && !globalAudio) {
    globalAudio = new Audio();
    globalAudio.volume = 0.75;
  }
  return globalAudio!;
}

// AudioPlayerProvider component
export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  // Initialize state from global audio if it exists (handles re-mounts)
  const [playerState, setPlayerState] = useState<AudioPlayerState>(() => {
    if (typeof window !== 'undefined' && globalAudio) {
      return {
        currentTrack: globalTrack,
        isPlaying: !globalAudio.paused && !globalAudio.ended,
        currentTime: globalAudio.currentTime || 0,
        duration: globalAudio.duration || 0,
        volume: globalAudio.volume,
        isLoading: false,
        error: null,
      };
    }
    return {
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.75,
      isLoading: false,
      error: null,
    };
  });

  // Audio element ref (points to global audio)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const listenersAttachedRef = useRef(false);

  // Initialize audio element and sync state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = getGlobalAudio();
    audioRef.current = audio;

    // Sync state from global audio (handles page navigation)
    if (globalTrack && audio.src) {
      setPlayerState(prev => ({
        ...prev,
        currentTrack: globalTrack,
        isPlaying: !audio.paused && !audio.ended,
        currentTime: audio.currentTime || 0,
        duration: audio.duration || 0,
        volume: audio.volume,
      }));
    }

    // Only attach listeners once per audio element
    if (listenersAttachedRef.current) return;
    listenersAttachedRef.current = true;

    audio.addEventListener('loadedmetadata', () => {
      setPlayerState(prev => ({
        ...prev,
        duration: audio.duration,
        isLoading: false,
      }));
    });

    audio.addEventListener('ended', () => {
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0,
      }));
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    });

    audio.addEventListener('error', () => {
      console.error('[AudioPlayer] Audio error:', audio.error);
      setPlayerState(prev => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
        error: 'Failed to load audio',
      }));
    });

    audio.addEventListener('waiting', () => {
      setPlayerState(prev => ({ ...prev, isLoading: true }));
    });

    audio.addEventListener('canplay', () => {
      setPlayerState(prev => ({ ...prev, isLoading: false }));
    });

    audio.addEventListener('play', () => {
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    });

    audio.addEventListener('pause', () => {
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update time display using requestAnimationFrame for smooth updates
  const updateTimeDisplay = useCallback(() => {
    if (audioRef.current && playerState.isPlaying) {
      setPlayerState(prev => ({
        ...prev,
        currentTime: audioRef.current?.currentTime || 0,
      }));
      animationFrameRef.current = requestAnimationFrame(updateTimeDisplay);
    }
  }, [playerState.isPlaying]);

  // Start/stop time updates based on playing state
  useEffect(() => {
    if (playerState.isPlaying) {
      animationFrameRef.current = requestAnimationFrame(updateTimeDisplay);
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [playerState.isPlaying, updateTimeDisplay]);

  // Play a new track
  const play = useCallback((track: AudioTrack) => {
    console.log('[AudioPlayer] play() called with track:', track);
    if (!audioRef.current) {
      console.log('[AudioPlayer] audioRef.current is null!');
      return;
    }

    console.log('[AudioPlayer] Playing track:', track.title);

    // If same track, just resume
    if (playerState.currentTrack?.id === track.id && audioRef.current.src) {
      audioRef.current.play().catch(console.error);
      setPlayerState(prev => ({ ...prev, isPlaying: true, error: null }));
      return;
    }

    // Update global track reference for persistence across navigation
    globalTrack = track;

    // New track - load and play
    console.log('[AudioPlayer] Setting new track in state');
    setPlayerState(prev => {
      const newState = {
        ...prev,
        currentTrack: track,
        isPlaying: false,
        isLoading: true,
        currentTime: 0,
        duration: track.duration || 0,
        error: null,
      };
      console.log('[AudioPlayer] New state:', newState);
      return newState;
    });

    audioRef.current.src = track.audioUrl;
    audioRef.current.load();
    audioRef.current.play()
      .then(() => {
        setPlayerState(prev => ({ ...prev, isPlaying: true }));
      })
      .catch((error) => {
        console.error('[AudioPlayer] Play error:', error);
        setPlayerState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to play audio',
        }));
      });
  }, [playerState.currentTrack]);

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setPlayerState(prev => ({ ...prev, isPlaying: false }));
    }
  }, []);

  // Resume playback
  const resume = useCallback(() => {
    if (audioRef.current && playerState.currentTrack) {
      audioRef.current.play().catch(console.error);
      setPlayerState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [playerState.currentTrack]);

  // Stop playback and clear track
  const stop = useCallback(() => {
    // Clear global track reference
    globalTrack = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
    }
    setPlayerState(prev => ({
      ...prev,
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    }));
  }, []);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
      setPlayerState(prev => ({ ...prev, currentTime: audioRef.current?.currentTime || 0 }));
    }
  }, []);

  // Set volume (0-1)
  const setVolume = useCallback((volume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    setPlayerState(prev => ({ ...prev, volume: clampedVolume }));
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (playerState.isPlaying) {
      pause();
    } else if (playerState.currentTrack) {
      resume();
    }
  }, [playerState.isPlaying, playerState.currentTrack, pause, resume]);

  const contextValue: AudioPlayerContextType = {
    ...playerState,
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    togglePlay,
  };

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

// useAudioPlayer hook - access audio player context in components
export function useAudioPlayer(): AudioPlayerContextType {
  const context = useContext(AudioPlayerContext);
  if (context === undefined) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}

// Helper to format time (seconds) to MM:SS
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
