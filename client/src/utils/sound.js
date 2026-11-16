// K11: the reward moment's three tones, made in the browser with the Web Audio API (no file, no dependency), and a short
// vibration where the device has one. The caller plays them only inside the reward moment and only when the child has sound on.

let audio = null
// [from Hz, to Hz, start s, length s] per note: the ruler rising, a level (two notes up), a sticker landing (one tick)
const NOTES = { rise: [[392, 587, 0, 0.9]], level: [[523, 523, 0, 0.16], [784, 784, 0.18, 0.32]], sticker: [[988, 988, 0, 0.07]] }

/** Plays one of the tones. Silent with reduced motion on, without Web Audio, and before the browser allows sound. */
export function play(kind) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    audio ??= new AudioContext()
    if (audio.state !== 'running') {
      audio.resume().catch(() => {}) // a browser that has not allowed sound yet keeps it silent; nothing is forced
      return
    }
    for (const [from, to, start, length] of NOTES[kind]) {
      const at = audio.currentTime + start
      const tone = audio.createOscillator()
      const level = audio.createGain()
      tone.frequency.setValueAtTime(from, at)
      tone.frequency.linearRampToValueAtTime(to, at + length)
      level.gain.setValueAtTime(0.0001, at)
      level.gain.exponentialRampToValueAtTime(0.06, at + 0.02) // soft: a cue, not an alarm
      level.gain.exponentialRampToValueAtTime(0.0001, at + length)
      tone.connect(level).connect(audio.destination)
      tone.start(at)
      tone.stop(at + length + 0.05)
    }
    if (kind !== 'rise') navigator.vibrate?.(30)
  } catch {
    // no Web Audio here: the moment stays silent
  }
}
