// Spoken prompts. A toddler cannot read, so every step is announced aloud.
// Inside the Android app the native TextToSpeech engine is used (the WebView
// has no speech synthesis of its own); in a browser the Web Speech API is.

const TAGS = { hi: 'hi-IN', gu: 'gu-IN', en: 'en-IN' };

export class Voice {
  constructor() {
    this.lang = 'hi';
    this.enabled = true;
  }

  speak(text) {
    if (!this.enabled || !text) return;
    const tag = TAGS[this.lang] || 'hi-IN';
    try {
      if (window.AndroidBridge && window.AndroidBridge.speak) {
        window.AndroidBridge.speak(text, tag);
        return;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = tag;
        u.rate = 0.9;
        u.pitch = 1.15;
        window.speechSynthesis.speak(u);
      }
    } catch (_) {
      /* speech is a nicety; never let it break the game */
    }
  }

  stop() {
    try {
      if (window.AndroidBridge && window.AndroidBridge.stopSpeaking) window.AndroidBridge.stopSpeaking();
      else if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (_) {
      /* ignore */
    }
  }
}
