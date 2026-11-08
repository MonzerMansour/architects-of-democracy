import gsap from 'gsap';
import { RoughEase } from 'gsap/EasePack';
import { clamp } from './utils.js';

gsap.registerPlugin(RoughEase);

/** Wrap words of all text nodes under `root` in spans (skipping elements with data-nosplit). */
function splitWords(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      let p = n.parentElement;
      while (p && p !== root) { if (p.dataset.nosplit !== undefined || p.classList.contains('w')) return NodeFilter.FILTER_REJECT; p = p.parentElement; }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const frag = document.createDocumentFragment();
    const parts = n.nodeValue.split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span'); s.className = 'w'; s.textContent = part; frag.appendChild(s);
    }
    n.parentNode.replaceChild(frag, n);
  }
  return Array.from(root.querySelectorAll('.w'));
}

function splitChars(el) {
  const text = el.textContent; el.textContent = '';
  const out = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(part)); continue; }
    const word = document.createElement('span');
    word.style.whiteSpace = 'nowrap';
    for (const ch of part) { const s = document.createElement('span'); s.className = 'c'; s.textContent = ch; word.appendChild(s); out.push(s); }
    el.appendChild(word);
  }
  return out;
}

export class TextDirector {
  constructor(sections, { onTrigger, onEvent }) {
    this.sections = sections;
    this.onTrigger = onTrigger;
    this.onEvent = onEvent || (() => {});
    this.state = sections.map(() => ({ shown: false, tl: null, fired: new Set() }));
    this.prepare();
  }

  prepare() {
    this.sections.forEach((sec, i) => {
      const text = sec.querySelector('.text');
      const anim = sec.dataset.anim;
      sec._text = text;
      sec._words = [];
      if (['fade', 'slide-left', 'zoom-out', 'dark-rise', 'glitch', 'gallery', 'shine', 'weights', 'finale', 'parchment', 'spin-in', 'stamp', 'split'].includes(anim)) {
        // don't split structural widgets
        text.querySelectorAll('.stamp, .split-row, .triad, .morph-word, .glitch-swap').forEach((el) => (el.dataset.nosplit = ''));
        sec._words = splitWords(text);
      }
      if (anim === 'blueprint') {
        sec._chars = Array.from(text.querySelectorAll('.blueprint-line')).flatMap((l) => {
          const out = [];
          l.childNodes.forEach((n) => {
            if (n.nodeType === 3) { const span = document.createElement('span'); span.textContent = n.nodeValue; n.replaceWith(span); out.push(...splitChars(span)); }
            else out.push(...splitChars(n));
          });
          return out;
        });
      }
      if (anim === 'morph') {
        const mw = text.querySelector('.morph-word'); mw.dataset.nosplit = '';
        sec._words = splitWords(text);
      }
      if (sec._words.length) gsap.set(sec._words, { opacity: 0 });
      // interactive anchors
      text.querySelectorAll('mark[data-trigger]').forEach((m) => {
        const fire = () => { m.classList.remove('pulse'); void m.offsetWidth; m.classList.add('pulse'); this.onTrigger(i, m.dataset.trigger, m); };
        m.addEventListener('mouseenter', fire);
        m.addEventListener('click', fire);
        if (m.classList.contains('glitch-word')) m.addEventListener('mouseenter', () => this.glitchWord(m));
      });
      gsap.set(text, { opacity: 0 });
    });
  }

  /** Underline a mark the moment its first word appears — never before the text. */
  lightMark(i, el) {
    const mark = el?.closest?.('mark');
    if (!mark || mark.classList.contains('in')) return;
    mark.classList.add('in');
    if (!this.state[i].shown || !mark.dataset.trigger) return;
    mark.classList.add('pulse');
    setTimeout(() => mark.classList.remove('pulse'), 900);
    this.onTrigger(i, mark.dataset.trigger, mark);
  }

  /** GSAP stagger that lights a parent <mark> as each word fades in. */
  staggerMarks(i, each, extra = {}) {
    const self = this;
    return {
      each,
      ...extra,
      onStart() {
        extra.onStart?.call(this);
        self.lightMark(i, this.targets()[0]);
      },
    };
  }

  show(i, dir = 1) {
    const st = this.state[i]; if (st.shown) return; st.shown = true;
    const sec = this.sections[i], text = sec._text, words = sec._words || [];
    st.tl?.kill();
    text.classList.add('visible');
    const tl = gsap.timeline({ onComplete: () => this.onEvent(i, 'entered') });
    st.tl = tl;
    gsap.set(text, { clearProps: 'transform,filter' });
    gsap.set(text, { opacity: 1 });
    const anim = sec.dataset.anim;
    switch (anim) {
      case 'fade': {
        tl.fromTo(words, { opacity: 0, y: 10, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.6, stagger: this.staggerMarks(i, 0.045), ease: 'power2.out' });
        const verdict = text.querySelector('.verdict');
        tl.fromTo(verdict, { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9, ease: 'expo.out' }, '-=0.4');
        break;
      }
      case 'slide-left':
        tl.fromTo(words, { x: -120, opacity: 0, skewX: 12 }, { x: 0, opacity: 1, skewX: 0, duration: 0.9, stagger: this.staggerMarks(i, 0.03), ease: 'power3.out' });
        break;
      case 'zoom-out':
        tl.fromTo(text, { scale: 1.9, opacity: 0, filter: 'blur(10px)' }, { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 1.3, ease: 'expo.out' });
        tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: this.staggerMarks(i, 0.02) }, 0.2);
        break;
      case 'split': {
        const l = text.querySelector('.half-left'), r = text.querySelector('.half-right'), and = text.querySelector('.split-and');
        tl.fromTo(words, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, stagger: this.staggerMarks(i, 0.02) });
        tl.fromTo([l, r], { x: 0, opacity: 0, rotateY: 90 }, { opacity: 1, rotateY: 0, duration: 0.6, ease: 'back.out(2)', onStart: () => { this.lightMark(i, l); this.lightMark(i, r); } }, '-=0.3');
        tl.to(l, { x: -40, duration: 0.8, ease: 'power3.inOut' }, '+=0.1').to(r, { x: 40, duration: 0.8, ease: 'power3.inOut' }, '<').fromTo(and, { opacity: 0 }, { opacity: 0.6, duration: 0.4 }, '<0.3');
        break;
      }
      case 'dark-rise':
        tl.fromTo(words, { opacity: 0, y: 40, filter: 'blur(4px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 2, stagger: this.staggerMarks(i, 0.035), ease: 'power2.out' });
        break;
      case 'parchment':
        tl.fromTo(text, { y: '-120vh', rotateX: 25, opacity: 1 }, { y: 0, rotateX: 0, duration: 1.4, ease: 'bounce.out' });
        tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: this.staggerMarks(i, 0.012) }, '-=0.9');
        break;
      case 'glitch': {
        tl.fromTo(words, { opacity: 0, x: () => (Math.random() - 0.5) * 60, y: () => (Math.random() - 0.5) * 30 }, { opacity: 1, x: 0, y: 0, duration: 0.5, stagger: this.staggerMarks(i, 0.02, { from: 'random' }), ease: 'steps(4)' });
        text.querySelectorAll('.glitch-word').forEach((m, k) => tl.call(() => this.glitchWord(m), null, 0.8 + k * 0.5));
        const swap = text.querySelector('.glitch-swap');
        tl.call(() => this.glitchSwap(swap), null, 2.4);
        break;
      }
      case 'spin-in': {
        tl.fromTo(text, { rotateY: -90, scale: 0.6, opacity: 0, transformPerspective: 900 }, { rotateY: 0, scale: 1, opacity: 1, duration: 1.1, ease: 'expo.out' });
        tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: this.staggerMarks(i, 0.02) }, 0.3);
        const people = text.querySelectorAll('.triad:not(.men) span'), men = text.querySelectorAll('.triad.men span');
        tl.fromTo(people, { opacity: 0, y: 10 }, { opacity: 1, y: 0, stagger: 0.25, duration: 0.5 }, 1);
        tl.to(people, { opacity: 0.35, textDecoration: 'line-through', duration: 0.4 }, 2.2);
        tl.fromTo(men, { opacity: 0, scale: 1.5, x: 20 }, { opacity: 1, scale: 1, x: 0, stagger: 0.25, duration: 0.5, ease: 'back.out(3)' }, 2.3);
        break;
      }
      case 'gallery':
        tl.fromTo(words, { opacity: 0, y: 14, filter: 'blur(5px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1, stagger: this.staggerMarks(i, 0.04), ease: 'power2.out' });
        break;
      case 'stamp': {
        const stamp = text.querySelector('.stamp');
        tl.fromTo(stamp, { opacity: 0, scale: 6, rotate: -12 }, { opacity: 0.95, scale: 1, rotate: -12, duration: 0.35, ease: 'power4.in', onComplete: () => this.onEvent(i, 'stamp') });
        tl.fromTo(text, { x: 0 }, { x: 0, duration: 0.5, ease: 'rough({strength: 3, points: 20, randomize: true})' });
        tl.fromTo(words, { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.5, stagger: this.staggerMarks(i, 0.02), ease: 'power3.out' }, '-=0.3');
        break;
      }
      case 'shine': {
        tl.fromTo(words, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.9, stagger: this.staggerMarks(i, 0.03) });
        const shine = text.querySelectorAll('.shine-line .w');
        tl.fromTo(shine, { backgroundPosition: '100% 0' }, { backgroundPosition: '-10% 0', duration: 2.2, stagger: 0.03, ease: 'power2.inOut' }, '-=0.55');
        break;
      }
      case 'weights':
        tl.fromTo(words, { opacity: 0, y: -160, rotate: () => (Math.random() - 0.5) * 10 }, { opacity: 1, y: 0, rotate: 0, duration: 1.2, stagger: this.staggerMarks(i, 0.035), ease: 'bounce.out' });
        break;
      case 'morph': {
        tl.fromTo(words, { opacity: 0, scale: 1.6, filter: 'blur(8px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.5, stagger: this.staggerMarks(i, 0.05), ease: 'expo.out' });
        const mw = text.querySelector('.morph-word');
        const list = mw.dataset.words.split('|');
        let k = 0;
        st.morph = setInterval(() => { k = (k + 1) % list.length; gsap.fromTo(mw, { scaleY: 0.2, opacity: 0.2 }, { scaleY: 1, opacity: 1, duration: 0.35, ease: 'expo.out' }); mw.textContent = list[k]; }, 650);
        break;
      }
      case 'replace':
        // revealed progressively via progress()
        gsap.set(text, { opacity: 1 });
        break;
      case 'blueprint': {
        const chars = sec._chars || [];
        tl.fromTo(chars, { opacity: 0, y: 30, color: '#4df2ff' }, { opacity: 1, y: 0, color: '#dff9ff', duration: 0.05, stagger: this.staggerMarks(i, 0.025), ease: 'none' });
        tl.fromTo(text, { filter: 'drop-shadow(0 0 0px #4df2ff)' }, { filter: 'drop-shadow(0 0 24px #4df2ff)', duration: 0.8, yoyo: true, repeat: 1 }, '-=0.5');
        break;
      }
      case 'finale': {
        const fl = text.querySelector('.finale-line');
        tl.fromTo(words.filter((w) => !fl.contains(w)), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 1.4, stagger: this.staggerMarks(i, 0.03), ease: 'power2.out' });
        tl.fromTo(fl, { opacity: 0, scale: 0.9, letterSpacing: '0.1em' }, { opacity: 1, scale: 1, letterSpacing: '-0.02em', duration: 1.6, ease: 'expo.out' }, '-=0.3');
        tl.fromTo(fl.querySelectorAll('.w'), { opacity: 0 }, { opacity: 1, duration: 0.6, stagger: this.staggerMarks(i, 0.08) }, '<');
        break;
      }
      default:
        tl.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.8, stagger: this.staggerMarks(i, 0.03) });
    }
  }

  hide(i, dir = 1) {
    const st = this.state[i]; if (!st.shown) return; st.shown = false;
    const sec = this.sections[i], text = sec._text, words = sec._words || [];
    st.tl?.kill();
    if (st.morph) { clearInterval(st.morph); st.morph = null; }
    text.classList.remove('visible');
    text.querySelectorAll('mark').forEach((m) => m.classList.remove('in', 'pulse'));
    const anim = sec.dataset.anim;
    const tl = gsap.timeline();
    st.tl = tl;
    if (anim === 'parchment') tl.to(text, { y: dir > 0 ? '-110vh' : '110vh', rotateX: -20, duration: 0.8, ease: 'power3.in' });
    else if (anim === 'glitch') tl.to(words, { opacity: 0, x: () => (Math.random() - 0.5) * 80, duration: 0.35, stagger: { each: 0.01, from: 'random' }, ease: 'steps(3)' });
    else tl.to(text, { opacity: 0, y: dir > 0 ? -28 : 28, filter: 'blur(6px)', duration: 0.55, ease: 'power2.in' });
    tl.set(text, { opacity: 0 });
    if (words.length) tl.set(words, { opacity: 0 });
    if (anim === 'stamp') tl.set(text.querySelector('.stamp'), { opacity: 0 });
    if (anim === 'split') tl.set(text.querySelectorAll('.half-left,.half-right'), { x: 0 });
    if (anim === 'replace') {
      const reps = text.querySelectorAll('.rep');
      reps.forEach((r) => { r._on = false; r.classList.remove('is-on'); r._tl?.kill(); });
    }
  }

  /** Scroll-scrubbed per-section progress (used by the replacement list + stamp etc). */
  progress(i, local) {
    const sec = this.sections[i];
    if (sec.dataset.anim === 'replace') {
      const reps = sec.querySelectorAll('.rep');
      const idx = Math.min(reps.length - 1, Math.floor(clamp((local - 0.04) / 0.9) * reps.length));
      reps.forEach((rep, k) => {
        const want = k <= idx;
        if (want && !rep._on) {
          rep._on = true;
          rep.classList.add('is-on');
          const s = rep.querySelector('s'), b = rep.querySelector('b');
          // old name alone → hold → strike (at 3D swap, see sceneReplace SWAP) → new name
          rep._tl?.kill();
          rep._tl = gsap.timeline()
            .set(b, { opacity: 0 })
            .set(s, { '--strike': 0, opacity: 1 })
            .fromTo(rep, { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.5, ease: 'power3.out' })
            .to(s, { '--strike': 1, duration: 0.4, ease: 'power2.in' }, 1.6)
            .to(s, { opacity: 0.45, duration: 0.3 }, 2.0)
            .fromTo(b, { opacity: 0, scale: 1.8, x: 30, filter: 'blur(6px)' }, { opacity: 1, scale: 1, x: 0, filter: 'blur(0px)', duration: 0.45, ease: 'back.out(3)' }, 2.05)
            .fromTo(rep, { x: 0 }, { x: 0, duration: 0.3, ease: 'rough({strength: 2, points: 12, randomize: true})' }, 2.0);
          this.onEvent(i, 'replace', k);
          if (k === idx) gsap.to(Array.from(reps).filter((r) => r !== rep && r._on), { opacity: 0.35, duration: 0.3 });
        } else if (!want && rep._on) {
          rep._on = false;
          rep.classList.remove('is-on');
          rep._tl?.kill();
          gsap.to(rep, { opacity: 0, x: -60, duration: 0.25 });
          this.onEvent(i, 'replace', Math.max(0, idx));
          gsap.to(reps, { opacity: (el, t) => (t === idx ? 1 : t < idx ? 0.35 : 0), duration: 0.3 });
        }
      });
    }
  }

  glitchWord(m) {
    if (m.classList.contains('glitching')) return;
    const orig = m.textContent, alt = m.dataset.alt || orig.toUpperCase();
    const chars = '█▓▒░#%&@*!?/\\|<>';
    m.classList.add('glitching');
    let n = 0;
    const iv = setInterval(() => {
      n++;
      m.textContent = n % 2 ? Array.from(orig, (c) => (Math.random() < 0.5 ? chars[Math.floor(Math.random() * chars.length)] : c)).join('') : alt;
      if (n > 8) { clearInterval(iv); m.textContent = orig; m.classList.remove('glitching'); }
    }, 70);
  }

  glitchSwap(el) {
    if (!el) return;
    const from = el.dataset.from;
    const seq = ['d▓mocr█tic or eg▒lit█rian', 'democratic or egalitarian', 'd e m o c r a t i c', 'undemocratic', 'patriarchal', from];
    let k = 0;
    const iv = setInterval(() => {
      el.textContent = seq[k];
      k++;
      if (k >= seq.length) { clearInterval(iv); el.classList.add('struck'); }
    }, 160);
  }
}
