const toggle = document.querySelector('#sfx-enabled');
let audio;

function unlockAudio() {
  if (!toggle.checked || !window.AudioContext) return;
  audio ||= new AudioContext();
  void audio.resume();
}

document.addEventListener('click', unlockAudio, { capture: true });
document.addEventListener('keydown', unlockAudio, { capture: true });
toggle.addEventListener('change', () => { if (toggle.checked) unlockAudio(); });

function note(start, end, duration, delay = 0, type = 'triangle', volume = .12) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const time = audio.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(start, time);
  oscillator.frequency.exponentialRampToValueAtTime(end, time + duration);
  gain.gain.setValueAtTime(.001, time);
  gain.gain.exponentialRampToValueAtTime(volume, time + .025);
  gain.gain.exponentialRampToValueAtTime(.001, time + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(time);
  oscillator.stop(time + duration + .02);
}

export function playCue(cue) {
  if (!toggle.checked || !audio || audio.state !== 'running') return;
  if (cue === 'draw') note(350, 600, .18, 0, 'sine', .07);
  if (cue === 'slash') {
    note(760, 150, .28, 0, 'sawtooth', .1);
    note(140, 55, .32, .08, 'triangle', .12);
  }
  if (cue === 'fire') {
    note(180, 75, .55, 0, 'sawtooth', .055);
    note(540, 140, .48, .08, 'triangle', .11);
    note(260, 90, .34, .38, 'sawtooth', .06);
  }
  if (cue === 'seal') {
    note(460, 230, .36, 0, 'sine', .08);
    note(350, 175, .48, .13, 'triangle', .08);
    note(120, 65, .26, .32, 'sine', .11);
  }
  if (cue === 'heal') {
    note(392, 588, .38, 0, 'sine', .075);
    note(494, 740, .48, .15, 'sine', .07);
    note(587, 880, .55, .3, 'triangle', .055);
  }
  if (cue === 'perfect') {
    note(330, 660, .42, 0, 'sine', .1);
    note(495, 990, .55, .12, 'triangle', .09);
    note(990, 180, .34, .48, 'sawtooth', .11);
    note(120, 50, .55, .7, 'triangle', .16);
  }
  if (cue === 'omen') {
    note(120, 65, .6, 0, 'sine', .15);
    note(180, 90, .7, .3, 'triangle', .1);
  }
  if (cue === 'victory') {
    note(440, 660, .45, 0, 'sine', .1);
    note(550, 880, .55, .18, 'sine', .1);
  }
}
