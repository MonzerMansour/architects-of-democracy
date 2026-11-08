/**
 * Two looping scores under the essay.
 *   sad  — second half of Billie Eilish, WILDFLOWER (instrumental)
 *   glad — The Schuyler Sisters (instrumental)
 * Mix is scroll-driven (0 = sad, 1 = glad) so the handoff is a blend.
 * Playback is paused whenever this tab is not visible.
 */
const VOL_SAD = 0.2;
const VOL_GLAD = 0.16;
const CATCH = 1.35; // seconds to catch a jumped mix (__go, fast scroll)

function looping(src) {
  const el = new Audio(src);
  el.loop = true;
  el.preload = 'auto';
  el.playsInline = true;
  el.autoplay = true;
  el.volume = 0;
  el.load();
  return el;
}

/** Soften the loop point so a mid-phrase cut doesn't click. */
function loopEnvelope(el, fade = 1.5) {
  const d = el.duration;
  if (!d || !Number.isFinite(d)) return 1;
  const t = el.currentTime;
  if (t < fade) return t / fade;
  if (d - t < fade) return Math.max(0, (d - t) / fade);
  return 1;
}

export function startMusic({ sad, glad }, button) {
  const tracks = [looping(sad), looping(glad)];
  const vols = [VOL_SAD, VOL_GLAD];
  let mixTarget = 0, mix = 0;
  let muted = localStorage.getItem('aod-muted') === '1';
  let started = false;
  let last = performance.now();

  const tabOn = () => !document.hidden && document.visibilityState === 'visible';
  const allowed = () => !muted && tabOn();
  const audible = () => tracks.some((el) => !el.paused);

  const apply = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.02, dt / CATCH);
    mix += (mixTarget - mix) * k;
    const on = allowed() && started;
    tracks.forEach((el, i) => {
      const part = i === 0 ? 1 - mix : mix;
      const active = on && part > 0.01;
      el.volume = active ? part * vols[i] * loopEnvelope(el) : 0;
      if (active && el.paused) el.play().catch(() => {});
      if (!active && !el.paused && started) el.pause();
    });
  };
  const timer = setInterval(apply, 50);

  const play = () => {
    if (muted || !tabOn()) return;
    const lead = mix < 0.5 ? 0 : 1;
    tracks[lead].play().then(() => {
      started = true;
      tracks[1 - lead].play().catch(() => {});
      unbind();
    }).catch(() => {});
  };

  const gestures = ['pointerdown', 'click', 'keydown', 'touchstart'];
  const onGesture = () => play();
  const unbind = () => gestures.forEach((g) => {
    window.removeEventListener(g, onGesture, true);
    window.removeEventListener(g, onGesture);
  });
  gestures.forEach((g) => {
    window.addEventListener(g, onGesture, { passive: true, capture: true });
    window.addEventListener(g, onGesture, { passive: true });
  });

  const hide = () => {
    tracks.forEach((el) => { el.pause(); el.volume = 0; });
  };
  const show = () => { if (!muted) play(); };

  document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else show(); });
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  tracks.forEach((el) => el.addEventListener('canplay', () => { if (!muted && !started) play(); }));

  const render = () => {
    button.classList.toggle('muted', muted);
    button.setAttribute('aria-label', muted ? 'Play music' : 'Mute music');
    button.setAttribute('aria-pressed', String(!muted));
  };
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    // First click starts audio (browsers block autoplay). Don't treat that as mute.
    if (!audible() && !muted) {
      play();
      return;
    }
    muted = !muted;
    localStorage.setItem('aod-muted', muted ? '1' : '0');
    render();
    if (muted) hide(); else play();
  });

  render();
  play();
  return {
    setMix(t) { mixTarget = Math.max(0, Math.min(1, t)); },
    _timer: timer,
  };
}
