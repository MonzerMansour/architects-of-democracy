/**
 * Two looping scores under the essay.
 *   sad  — second half of Billie Eilish, WILDFLOWER (instrumental)
 *   glad — The Schuyler Sisters (instrumental)
 * Mix is scroll-driven (0 = sad, 1 = glad) so the handoff is a blend.
 * Playback is paused whenever this tab is not visible.
 *
 * Unmuted autoplay is blocked in most browsers. We try it on load, keep a muted
 * buffer running, then unmute on the first real click/key so the first gesture
 * starts the score instead of pausing it. The speaker stays in the paused look
 * until unmuted audio is actually running.
 */
const VOL_SAD = 0.2;
const VOL_GLAD = 0.16;
const CATCH = 1.35;

function looping(src) {
  const el = new Audio(src);
  el.loop = true;
  el.preload = 'auto';
  el.playsInline = true;
  el.muted = true;
  el.volume = 0;
  return el;
}

function loopEnvelope(el, fade = 1.5) {
  const d = el.duration;
  if (!d || !Number.isFinite(d)) return 1;
  const t = el.currentTime;
  if (t < fade) return t / fade;
  if (d - t < fade) return Math.max(0, (d - t) / fade);
  return 1;
}

function playSafe(el) {
  const p = el.play();
  if (!p) return Promise.resolve(true);
  return p.then(() => true).catch((err) => (err && err.name === 'AbortError' ? true : false));
}

export function startMusic({ sad, glad }, button) {
  const tracks = [looping(sad), looping(glad)];
  const vols = [VOL_SAD, VOL_GLAD];
  let mixTarget = 0, mix = 0;
  let muted = false;
  let unlocked = false;
  let last = performance.now();
  let shownPlaying = false;

  const tabOn = () => !document.hidden && document.visibilityState === 'visible';
  const live = () => tracks.some((el) => !el.paused && !el.muted);

  const render = () => {
    const playing = unlocked && !muted && (live() || tracks.some((el) => !el.paused));
    if (playing === shownPlaying) return;
    shownPlaying = playing;
    button.classList.toggle('muted', !playing);
    button.setAttribute('aria-label', playing ? 'Mute music' : 'Play music');
    button.setAttribute('aria-pressed', String(playing));
  };

  const apply = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const k = 1 - Math.pow(0.02, dt / CATCH);
    mix += (mixTarget - mix) * k;
    const on = unlocked && !muted && tabOn();
    tracks.forEach((el, i) => {
      const part = i === 0 ? 1 - mix : mix;
      const active = on && part > 0.01;
      el.muted = !on;
      el.volume = active ? part * vols[i] * loopEnvelope(el) : 0;
      if (on && el.paused) playSafe(el);
      if (!on && !el.paused && unlocked) el.pause();
    });
    render();
  };
  const timer = setInterval(apply, 50);

  const primeMuted = () => {
    tracks.forEach((el) => { el.muted = true; playSafe(el); });
  };

  const unlock = () => {
    if (muted) return;
    unlocked = true;
    tracks.forEach((el) => { el.muted = false; playSafe(el); });
    render();
  };

  const onGesture = (e) => {
    if (button.contains(e.target)) return;
    if (unlocked) return;
    unlock();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach((g) => {
    window.addEventListener(g, onGesture, { capture: true, passive: true });
  });

  const hide = () => {
    tracks.forEach((el) => { el.pause(); el.volume = 0; el.muted = true; });
  };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hide();
    else if (unlocked && !muted) tracks.forEach((el) => { el.muted = false; playSafe(el); });
  });
  window.addEventListener('pagehide', hide);

  button.addEventListener('pointerdown', (e) => e.stopPropagation());
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // If nothing is actually audible, this click starts the score — never mute-first.
    if (!unlocked || muted || !live()) {
      muted = false;
      unlock();
      return;
    }
    muted = true;
    hide();
    render();
  });

  render();
  primeMuted();
  // Try unmuted autoplay (works when the browser treats this load as a gesture).
  Promise.allSettled(tracks.map((el) => { el.muted = false; return playSafe(el); }))
    .then((results) => {
      const ok = results.some((r) => r.status === 'fulfilled' && r.value && live());
      if (ok) { unlocked = true; render(); }
      else primeMuted();
    });

  return {
    setMix(t) { mixTarget = Math.max(0, Math.min(1, t)); },
    _timer: timer,
    status() {
      return {
        unlocked, muted, shownPlaying, live: live(),
        tracks: tracks.map((el) => ({ paused: el.paused, muted: el.muted, vol: +el.volume.toFixed(3), t: +el.currentTime.toFixed(2), err: el.error?.message || null })),
      };
    },
  };
}
