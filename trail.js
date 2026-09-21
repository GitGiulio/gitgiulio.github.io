/* A bounded canvas trail; the page and language navigation work without JS. */
(() => {
  const canvas = document.querySelector('#pearl-trail');
  const context = canvas.getContext('2d');
  const toggle = document.querySelector('#trail-toggle');
  if (!context) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(any-pointer: fine)');
  let preference;
  try { preference = localStorage.getItem('pearl-trail'); } catch { /* Storage is optional. */ }
  let enabled = !reduced.matches && finePointer.matches && preference !== 'off';
  let points = [];
  let frame = 0;
  let pressed = false;
  let pointer = null;
  let lastEmission = 0;
  let width = 0;
  let height = 0;
  let scale = 1;
  let sequence = 0;
  const lifetime = 1350;

  function resize() {
    width = innerWidth;
    height = innerHeight;
    scale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function clear() {
    cancelAnimationFrame(frame);
    frame = 0;
    points = [];
    pressed = false;
    pointer = null;
    context.clearRect(0, 0, width, height);
  }

  function sync() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.querySelector('.toggle-state').textContent = enabled ? toggle.dataset.on : toggle.dataset.off;
    if (!enabled) clear();
  }

  function emit(x, y, strong, now) {
    const angle = now * .007 + sequence++ * 2.4;
    const hue = (strong ? angle * 180 / Math.PI : now * .05 + sequence * 5) % 360;
    // Reuse the exact gradient at any size; only its transform and opacity animate.
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, `hsla(${hue}, 72%, 84%, .3)`);
    glow.addColorStop(.25, `hsla(${hue + 40}, 80%, 78%, .22)`);
    glow.addColorStop(.6, `hsla(${hue + 100}, 80%, 65%, .09)`);
    glow.addColorStop(1, `hsla(${hue + 160}, 80%, 65%, 0)`);
    const ribbons = [-1, 0, 1].map(ribbon => `hsl(${hue + ribbon * 70}, 70%, 85%)`);
    points.push({ x: x + (strong ? Math.cos(angle) * 14 : 0),
      y: y + (strong ? Math.sin(angle) * 14 : 0), born: now,
      glow, ribbons,
      radius: strong ? 30 : 19, dx: Math.cos(angle) * (strong ? 52 : 7),
      dy: Math.sin(angle) * (strong ? 52 : 7), strong });
    // ponytail: bounded to 180 particles; use WebGL only if a denser effect is needed.
    if (points.length > 180) points.splice(0, points.length - 180);
    if (!frame) frame = requestAnimationFrame(draw);
  }

  function draw(now) {
    if (!enabled) return;
    if (pressed && pointer && now - lastEmission > 16) {
      for (let i = 0; i < 3; i++) emit(pointer.x, pointer.y, true, now + i);
      lastEmission = now;
    }
    context.clearRect(0, 0, width, height);
    // Normal alpha blending keeps overlapping pastel colors from adding up to white.
    points = points.filter(point => now - point.born < lifetime);
    let previous;
    for (const point of points) {
      const age = Math.max(0, (now - point.born) / lifetime);
      const alpha = (1 - age) ** 2;
      const x = point.x + point.dx * age;
      const y = point.y + point.dy * age;
      const radius = point.radius * (1 + age * 1.4);
      context.globalAlpha = alpha;
      context.setTransform(scale * radius, 0, 0, scale * radius, scale * x, scale * y);
      context.fillStyle = point.glow;
      context.beginPath();
      context.arc(0, 0, 1, 0, Math.PI * 2);
      context.fill();
      context.setTransform(scale, 0, 0, scale, 0, 0);
      if (previous && Math.hypot(x - previous.x, y - previous.y) < 90) {
        context.globalAlpha = alpha * .22;
        context.lineWidth = point.strong ? 2 : 1;
        const wave = Math.sin(age * 5 + now * .0015) * 8;
        for (let ribbon = -1; ribbon <= 1; ribbon++) {
          const offset = wave * ribbon;
          context.beginPath();
          context.moveTo(previous.x, previous.y + offset);
          context.quadraticCurveTo((previous.x + x) / 2, y + offset * 2, x, y + offset);
          context.strokeStyle = point.ribbons[ribbon + 1];
          context.stroke();
        }
      }
      previous = { x, y };
    }
    context.globalAlpha = 1;
    frame = points.length || pressed ? requestAnimationFrame(draw) : 0;
  }

  window.addEventListener('pointermove', event => {
    if (!enabled || event.pointerType !== 'mouse') return;
    pressed = Boolean(event.buttons & 3);
    const next = { x: event.clientX, y: event.clientY };
    const start = pointer || next;
    const count = Math.min(32, Math.max(1, Math.ceil(Math.hypot(next.x - start.x, next.y - start.y) / 7)));
    const now = performance.now();
    for (let i = 1; i <= count; i++) {
      emit(start.x + (next.x - start.x) * i / count, start.y + (next.y - start.y) * i / count, pressed, now);
    }
    pointer = next;
  }, { passive: true });
  window.addEventListener('pointerdown', event => {
    if (!enabled || event.pointerType !== 'mouse' || !(event.buttons & 3) || event.target.closest('button')) return;
    pressed = true;
    pointer = { x: event.clientX, y: event.clientY };
    const now = performance.now();
    for (let i = 0; i < 12; i++) emit(pointer.x, pointer.y, true, now);
  }, { passive: true });
  window.addEventListener('pointerup', event => { pressed = Boolean(event.buttons & 3); }, { passive: true });
  window.addEventListener('pointercancel', () => { pressed = false; pointer = null; });
  document.documentElement.addEventListener('pointerleave', () => { pressed = false; pointer = null; });
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('resize', resize);
  reduced.addEventListener('change', () => { if (reduced.matches) { enabled = false; sync(); } });
  finePointer.addEventListener('change', () => { if (!finePointer.matches) { enabled = false; sync(); } });
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    try { localStorage.setItem('pearl-trail', enabled ? 'on' : 'off'); } catch { /* Keep the session choice. */ }
    sync();
  });
  resize();
  sync();
  toggle.closest('.effect-control').hidden = false;
})();
