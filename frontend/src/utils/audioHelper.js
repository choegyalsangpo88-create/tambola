// Mobile-friendly audio utility using Howler.js
// Updated for iOS 16+ compatibility
import { Howl, Howler } from 'howler';

// Enable auto-unlock for mobile
Howler.autoUnlock = true;

// Store for playing sounds
let currentSound = null;
let isUnlocked = false;
let audioContext = null;

// Initialize AudioContext for iOS
const initAudioContext = () => {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('AudioContext not supported');
    }
  }
  return audioContext;
};

// Resume AudioContext if suspended (critical for iOS 16+)
const resumeAudioContext = async () => {
  const ctx = initAudioContext();
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
      console.log('AudioContext resumed');
    } catch (e) {
      console.log('Failed to resume AudioContext:', e);
    }
  }
};

// Silent audio for unlocking mobile - more compatible format
const SILENT_MP3 = 'data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1NvZnR3YXJlAExhdmY1OC43Ni4xMDAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////';

/**
 * Unlock audio on mobile devices - MUST be called from user gesture (click/tap)
 * Updated for iOS 16+ with multiple fallback methods
 */
export const unlockMobileAudio = async () => {
  if (isUnlocked) {
    return true;
  }

  console.log('Attempting to unlock mobile audio...');

  try {
    // Method 1: Resume AudioContext first (critical for iOS 16+)
    await resumeAudioContext();
    
    // Method 2: Resume Howler's AudioContext
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      await Howler.ctx.resume();
      console.log('Howler AudioContext resumed');
    }

    // Method 3: Play a silent sound with multiple format support
    return new Promise((resolve) => {
      const silentSound = new Howl({
        src: [SILENT_MP3],
        html5: true,
        volume: 0.001,
        preload: true,
        onplay: () => {
          console.log('Silent audio playing - unlocking...');
        },
        onend: () => {
          isUnlocked = true;
          console.log('Audio unlocked successfully');
          resolve(true);
        },
        onloaderror: (id, error) => {
          console.log('Silent audio load error:', error);
          // Still mark as unlocked - the AudioContext resume should work
          isUnlocked = true;
          resolve(true);
        },
        onplayerror: async (id, error) => {
          console.log('Silent audio play error:', error);
          // Try to resume and retry
          try {
            await resumeAudioContext();
            if (Howler.ctx) {
              await Howler.ctx.resume();
            }
            silentSound.play();
          } catch (e) {
            isUnlocked = true;
            resolve(true);
          }
        }
      });

      silentSound.play();

      // Safety timeout
      setTimeout(() => {
        if (!isUnlocked) {
          isUnlocked = true;
          console.log('Audio unlock timeout - assuming unlocked');
        }
        resolve(true);
      }, 2000);
    });
  } catch (e) {
    console.log('Audio unlock error:', e);
    isUnlocked = true;
    return true;
  }
};

/**
 * Check if audio is unlocked
 */
export const isAudioUnlocked = () => isUnlocked;

/**
 * Force reset unlock state (for debugging)
 */
export const resetAudioUnlock = () => {
  isUnlocked = false;
};

/**
 * Play audio from base64 data
 * Updated for iOS 16+ with better error handling
 * @param {string} base64Audio - Base64 encoded MP3 audio
 * @returns {Promise<boolean>} - Whether playback succeeded
 */
export const playBase64Audio = async (base64Audio) => {
  try {
    // Ensure AudioContext is resumed before playing
    await resumeAudioContext();
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      await Howler.ctx.resume();
    }

    // Stop any currently playing sound
    if (currentSound) {
      currentSound.stop();
      currentSound.unload();
    }

    const audioSrc = base64Audio.startsWith('data:') 
      ? base64Audio 
      : `data:audio/mpeg;base64,${base64Audio}`;

    return new Promise((resolve) => {
      currentSound = new Howl({
        src: [audioSrc],
        html5: true, // Critical for iOS Safari
        format: ['mp3'],
        volume: 1.0,
        preload: true,
        onplay: () => {
          console.log('Audio playing');
        },
        onend: () => {
          console.log('Audio finished');
          resolve(true);
        },
        onloaderror: (id, error) => {
          console.log('Audio load error:', error);
          resolve(false);
        },
        onplayerror: async (id, error) => {
          console.log('Audio play error:', error);
          // Try to unlock and replay (iOS 16+ workaround)
          try {
            await resumeAudioContext();
            if (Howler.ctx) {
              await Howler.ctx.resume();
            }
            // Short delay then retry
            setTimeout(() => {
              if (currentSound) {
                currentSound.play();
              }
            }, 100);
          } catch (e) {
            console.log('Retry failed:', e);
            resolve(false);
          }
        }
      });

      currentSound.play();

      // Timeout safety
      setTimeout(() => resolve(true), 10000);
    });
  } catch (e) {
    console.log('playBase64Audio error:', e);
    return false;
  }
};

/**
 * Play text using browser speech synthesis (fallback for iOS)
 * iOS 16+ has better support for SpeechSynthesis
 * @param {string} text - Text to speak
 * @returns {Promise<void>}
 */
export const speakText = (text) => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.log('Speech synthesis not supported');
      resolve();
      return;
    }

    try {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';
      
      // Find a good voice (prefer English voices)
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => 
        v.lang.startsWith('en') && (v.name.includes('Enhanced') || v.name.includes('Premium'))
      ) || voices.find(v => v.lang.startsWith('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      
      utterance.onend = () => {
        console.log('Speech finished');
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.log('Speech error:', event.error);
        resolve();
      };
      
      // iOS workaround - need to handle interrupted state
      utterance.onpause = () => {
        window.speechSynthesis.resume();
      };
      
      window.speechSynthesis.speak(utterance);
      
      // iOS 16+ can pause speech when screen is off, keep it alive
      const keepAlive = setInterval(() => {
        if (window.speechSynthesis.speaking) {
          window.speechSynthesis.resume();
        } else {
          clearInterval(keepAlive);
        }
      }, 1000);
      
      // Timeout safety
      setTimeout(() => {
        clearInterval(keepAlive);
        resolve();
      }, 15000);
    } catch (e) {
      console.log('speakText error:', e);
      resolve();
    }
  });
};

/**
 * Stop any currently playing audio
 */
export const stopAudio = () => {
  if (currentSound) {
    currentSound.stop();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};

/**
 * Get audio context state for debugging
 */
export const getAudioState = () => ({
  isUnlocked,
  howlerCtxState: Howler.ctx?.state,
  audioCtxState: audioContext?.state,
  currentSoundPlaying: currentSound?.playing()
});

export default {
  unlockMobileAudio,
  isAudioUnlocked,
  resetAudioUnlock,
  playBase64Audio,
  speakText,
  stopAudio,
  getAudioState
};
