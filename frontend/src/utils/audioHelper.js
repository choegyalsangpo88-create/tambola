// Mobile-friendly audio utility using Howler.js
import { Howl, Howler } from 'howler';

// Enable auto-unlock for mobile
Howler.autoUnlock = true;

// Store for playing sounds
let currentSound = null;
let isUnlocked = false;

// Silent audio for unlocking mobile
const SILENT_AUDIO = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////';

/**
 * Unlock audio on mobile devices - MUST be called from user gesture (click/tap)
 */
export const unlockMobileAudio = () => {
  return new Promise((resolve) => {
    if (isUnlocked) {
      resolve(true);
      return;
    }

    // Play silent sound to unlock
    const silentSound = new Howl({
      src: [SILENT_AUDIO],
      html5: true,
      volume: 0.01,
      onend: () => {
        isUnlocked = true;
        resolve(true);
      },
      onloaderror: () => {
        // Try alternate method
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          if (ctx.state === 'suspended') {
            ctx.resume().then(() => {
              isUnlocked = true;
              resolve(true);
            });
          } else {
            isUnlocked = true;
            resolve(true);
          }
        } catch (e) {
          isUnlocked = true;
          resolve(true);
        }
      }
    });
    
    silentSound.play();
  });
};

/**
 * Check if audio is unlocked
 */
export const isAudioUnlocked = () => isUnlocked;

/**
 * Play audio from base64 data
 * @param {string} base64Audio - Base64 encoded MP3 audio
 * @returns {Promise<boolean>} - Whether playback succeeded
 */
export const playBase64Audio = (base64Audio) => {
  return new Promise((resolve) => {
    try {
      // Stop any currently playing sound
      if (currentSound) {
        currentSound.stop();
        currentSound.unload();
      }

      const audioSrc = base64Audio.startsWith('data:') 
        ? base64Audio 
        : `data:audio/mp3;base64,${base64Audio}`;

      currentSound = new Howl({
        src: [audioSrc],
        html5: true, // Critical for iOS Safari
        format: ['mp3'],
        volume: 1.0,
        onend: () => {
          resolve(true);
        },
        onloaderror: (id, error) => {
          console.log('Audio load error:', error);
          resolve(false);
        },
        onplayerror: (id, error) => {
          console.log('Audio play error:', error);
          // Try to unlock and replay
          Howler.ctx?.resume().then(() => {
            currentSound.play();
          }).catch(() => resolve(false));
        }
      });

      currentSound.play();

      // Timeout safety
      setTimeout(() => resolve(true), 8000);
    } catch (e) {
      console.log('Howler error:', e);
      resolve(false);
    }
  });
};

/**
 * Play text using browser speech synthesis (fallback)
 * @param {string} text - Text to speak
 * @returns {Promise<void>}
 */
export const speakText = (text) => {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';
      
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      
      window.speechSynthesis.speak(utterance);
      
      // Timeout safety
      setTimeout(resolve, 10000);
    } catch (e) {
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

export default {
  unlockMobileAudio,
  isAudioUnlocked,
  playBase64Audio,
  speakText,
  stopAudio
};
