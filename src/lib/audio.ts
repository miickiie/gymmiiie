let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export async function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') await a.resume();
}

export function beep(times = 2, frequency = 880, duration = 0.12) {
  const a = audio();
  if (!a) return;
  if (a.state === 'suspended') void a.resume();
  const now = a.currentTime;
  for (let i = 0; i < times; i++) {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency + i * 60;
    gain.gain.setValueAtTime(0.0001, now + i * 0.22);
    gain.gain.exponentialRampToValueAtTime(0.22, now + i * 0.22 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.22 + duration);
    osc.connect(gain).connect(a.destination);
    osc.start(now + i * 0.22);
    osc.stop(now + i * 0.22 + duration + 0.02);
  }
}

export function vibrate(pattern: number | number[] = [90, 60, 90]) {
  if ('vibrate' in navigator) navigator.vibrate(pattern);
}
