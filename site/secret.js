/* Local artwork, CSS ambience and an SVG cube with physical layer turns. */
(() => {
  const body = document.body;
  if (location.hash.startsWith('#eggs=')) document.querySelector('.back-link').hash = location.hash;
  const scene = document.querySelector('.room-scene');
  const tooltip = document.querySelector('#room-tooltip');
  const title = document.querySelector('#tooltip-title');
  const copy = document.querySelector('#tooltip-copy');
  const preview = document.querySelector('#game-preview');
  const motion = document.querySelector('#motion-toggle');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const games = { trackmania: 'Trackmania 2020', hearthstone: 'Hearthstone', chess: 'Chess.com', fez: 'FEZ' };
  const monitorStories = {
    trackmania: 'Trackmania 2020 is on tonight. Your game-specific text will go here.',
    hearthstone: 'Hearthstone is on tonight. Your game-specific text will go here.',
    chess: 'Chess.com is on tonight. Your game-specific text will go here.',
    fez: 'FEZ is on tonight — the one-percent guest. Your game-specific text will go here.',
  };
  let active;
  let pinned = false;
  let closeTimer;

  // UN members plus the Holy See and Palestine; fixed code order keeps the daily draw identical across browsers.
  const countryCodes = `
    ad ae af ag al am ao ar at au az
    ba bb bd be bf bg bh bi bj bn bo br bs bt bw by bz
    ca cd cf cg ch ci cl cm cn co cr cu cv cy cz
    de dj dk dm do dz ec ee eg er es et fi fj fm fr
    ga gb gd ge gh gm gn gq gr gt gw gy hn hr ht hu
    id ie il in iq ir is it jm jo jp ke kg kh ki km kn kp kr kw kz
    la lb lc li lk lr ls lt lu lv ly
    ma mc md me mg mh mk ml mm mn mr mt mu mv mw mx my mz
    na ne ng ni nl no np nr nz om pa pe pg ph pk pl ps pt pw py qa
    ro rs ru rw sa sb sc sd se sg si sk sl sm sn so sr ss st sv sy sz
    td tg th tj tl tm tn to tr tt tv tz ua ug us uy uz
    va vc ve vn vu ws ye za zm zw
  `.trim().split(/\s+/);
  const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
  const names = { va: 'Vatican City (Holy See)', ps: 'Palestine', cd: 'Democratic Republic of the Congo', cg: 'Republic of the Congo', fm: 'Micronesia', cv: 'Cabo Verde', tl: 'Timor-Leste', tr: 'Türkiye' };
  const aliases = { va: ['Vatican', 'Vatican City', 'Holy See'], ps: ['State of Palestine'], cd: ['DR Congo', 'DRC', 'Congo Kinshasa'], cg: ['Congo', 'Congo Brazzaville'], us: ['USA', 'US', 'United States of America'], gb: ['UK', 'Great Britain', 'Britain'], cz: ['Czech Republic'], ci: ['Ivory Coast'], cv: ['Cape Verde'], tl: ['East Timor'], sz: ['Swaziland'], mm: ['Burma'], tr: ['Turkey'], kr: ['Republic of Korea'], kp: ['DPRK', 'Democratic People’s Republic of Korea'] };
  const countries = countryCodes.map(code => ({ code, name: names[code] || countryNames.of(code.toUpperCase()) }));
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
  const quiz = document.querySelector('#flag-quiz');
  const inputs = [...document.querySelectorAll('.flag-question input')];
  const score = document.querySelector('#flag-score');
  const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' });
  let flagDay;
  let flagTimer;
  let dailyFlags;
  for (const country of [...countries].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    const option = document.createElement('option');
    option.value = country.name;
    option.dataset.code = country.code;
    document.querySelector('#country-options').append(option);
  }
  function updateDailyFlags() {
    clearTimeout(flagTimer);
    flagTimer = setTimeout(updateDailyFlags, 60_000 - Date.now() % 60_000);
    const now = new Date();
    const day = dayFormat.format(now);
    if (day === flagDay) return;
    flagDay = day;
    let seed = [...day].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
    const pool = [...countries];
    dailyFlags = Array.from({ length: 3 }, () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return pool.splice(Math.floor(seed / 4294967296 * pool.length), 1)[0];
    });
    document.querySelector('#flag-day').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
    for (let i = 0; i < 3; i++) {
      const src = `media/flags/${dailyFlags[i].code}.svg`;
      document.querySelectorAll('.daily-flag')[i].setAttribute('href', src);
      document.querySelectorAll('.quiz-flag')[i].src = src;
      inputs[i].value = '';
      inputs[i].removeAttribute('aria-invalid');
      const result = document.querySelector(`#flag-result-${i}`);
      result.textContent = '';
      delete result.dataset.correct;
    }
    score.textContent = '0 / 3 identified';
  }
  updateDailyFlags();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDailyFlags(); });
  function openFlags() {
    updateDailyFlags();
    hideTooltip();
    quiz.showModal();
    inputs[0].focus();
  }
  document.querySelector('#flags-toggle').addEventListener('click', openFlags);
  document.querySelector('#flag-close').addEventListener('click', () => quiz.close());
  quiz.addEventListener('click', event => {
    const bounds = quiz.getBoundingClientRect();
    if (event.target === quiz && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) quiz.close();
  });
  document.querySelector('#flag-form').addEventListener('submit', event => {
    event.preventDefault();
    updateDailyFlags();
    let correct = 0;
    inputs.forEach((input, i) => {
      const country = dailyFlags[i];
      const answer = normalize(input.value);
      const matches = [country.name, countryNames.of(country.code.toUpperCase()), ...(aliases[country.code] || [])].some(name => normalize(name) === answer);
      const result = document.querySelector(`#flag-result-${i}`);
      result.textContent = matches ? `Correct — ${country.name}` : answer ? 'Not quite. Try again.' : '';
      result.dataset.correct = String(matches);
      input.setAttribute('aria-invalid', String(Boolean(answer) && !matches));
      correct += Number(matches);
    });
    score.textContent = `${correct} / 3 identified${correct === 3 ? ' · You got them all!' : ''}`;
  });

  // Each piece keeps its geometry and plastic colors through physical quarter-turns.
  const cubeModel = document.querySelector('#cube-model');
  const cubeShadow = document.querySelector('#cube-shadow');
  const scramble = [[0, 1, 1], [1, 1, -1], [2, 1, 1], [0, 1, -1], [1, -1, 1], [2, -1, -1]];
  const solution = [...scramble].reverse().map(([axis, layer, direction]) => [axis, layer, -direction]);
  const plastic = ['#ce573c', '#e69840', '#e7c955', '#e8dfc6', '#619c4d', '#5085b0'];
  let pieces;
  let cubeFrame;
  function rotate(point, axis, angle) {
    const result = [...point];
    const u = (axis + 1) % 3, v = (axis + 2) % 3;
    result[u] = point[u] * Math.cos(angle) - point[v] * Math.sin(angle);
    result[v] = point[u] * Math.sin(angle) + point[v] * Math.cos(angle);
    return result;
  }
  function turnCube([axis, layer, direction]) {
    for (const piece of pieces.filter(piece => piece.position[axis] === layer)) {
      piece.position = rotate(piece.position, axis, direction * Math.PI / 2).map(Math.round);
      for (const face of piece.faces) {
        face.normal = rotate(face.normal, axis, direction * Math.PI / 2).map(Math.round);
        face.vertices = face.vertices.map(point => rotate(point, axis, direction * Math.PI / 2));
      }
    }
  }
  function viewCube(point) { return rotate(rotate(point, 1, -.72), 0, .36); }
  function drawCube(move, angle = 0) {
    const faces = [];
    for (const piece of pieces) {
      const turning = move && piece.position[move[0]] === move[1];
      for (const face of piece.faces) {
        const normal = viewCube(turning ? rotate(face.normal, move[0], angle) : face.normal);
        const vertices = face.vertices.map(point => viewCube(turning ? rotate(point, move[0], angle) : point));
        face.path.style.display = normal[2] > .001 ? '' : 'none';
        face.path.setAttribute('d', vertices.map((point, i) => `${i ? 'L' : 'M'}${(748 + point[0] * 8.2).toFixed(2)} ${(530 - point[1] * 8.2).toFixed(2)}`).join('') + 'Z');
        face.path.setAttribute('fill-opacity', String(.72 + normal[2] * .18 + normal[1] * .08));
        faces.push({ path: face.path, depth: vertices.reduce((sum, point) => sum + point[2], 0) });
      }
    }
    for (const face of faces.sort((a, b) => a.depth - b.depth)) cubeModel.append(face.path);
  }
  function resetCube() {
    cancelAnimationFrame(cubeFrame);
    cubeModel.removeAttribute('transform');
    cubeShadow.setAttribute('rx', '16');
    cubeShadow.setAttribute('opacity', '.35');
    cubeModel.replaceChildren();
    pieces = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!x && !y && !z) continue;
      const position = [x, y, z];
      const faces = [];
      for (let axis = 0; axis < 3; axis++) for (const sign of [1, -1]) {
        const normal = [0, 0, 0];
        normal[axis] = sign;
        const vertices = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
          const point = [...position];
          point[axis] += sign * .48;
          point[(axis + 1) % 3] += u * .48;
          point[(axis + 2) % 3] += v * .48;
          return point;
        });
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', position[axis] === sign ? plastic[axis * 2 + Number(sign < 0)] : '#665640');
        faces.push({ normal, vertices, path });
      }
      pieces.push({ position, faces });
    }
    scramble.forEach(turnCube);
    cubeModel.dataset.state = 'scrambled';
    drawCube();
  }
  function solveCube() {
    if (!['scrambled', 'solved'].includes(cubeModel.dataset.state)) return;
    if (cubeModel.dataset.state === 'solved') resetCube();
    if (body.dataset.motion === 'off') {
      solution.forEach(turnCube);
      cubeModel.dataset.state = 'solved';
      drawCube();
      return;
    }
    cubeModel.dataset.state = 'lifting';
    let step = 0, elapsed = 0, previous;
    function floatCube(amount) {
      cubeModel.setAttribute('transform', `translate(748 ${530 - amount * 40}) scale(${1 + amount * .35}) translate(-748 -530)`);
      cubeShadow.setAttribute('rx', String(16 - amount * 3));
      cubeShadow.setAttribute('opacity', String(.35 - amount * .15));
    }
    function frame(time) {
      if (previous !== undefined && body.dataset.motion === 'on') elapsed += time - previous;
      previous = time;
      if (body.dataset.motion === 'off') { cubeFrame = requestAnimationFrame(frame); return; }
      const turning = cubeModel.dataset.state === 'turning';
      const progress = Math.min(1, elapsed / (turning ? 540 : 600));
      const ease = progress * progress * (3 - 2 * progress);
      if (turning) {
        drawCube(solution[step], ease * solution[step][2] * Math.PI / 2);
        if (progress === 1) {
          turnCube(solution[step++]);
          elapsed = 0;
          if (step === solution.length) { cubeModel.dataset.state = 'landing'; drawCube(); }
        }
      } else {
        floatCube(cubeModel.dataset.state === 'lifting' ? ease : 1 - ease);
        if (progress === 1 && cubeModel.dataset.state === 'lifting') {
          cubeModel.dataset.state = 'turning';
          elapsed = 0;
        } else if (progress === 1) {
          cubeModel.dataset.state = 'solved';
          cubeModel.removeAttribute('transform');
          return;
        }
      }
      cubeFrame = requestAnimationFrame(frame);
    }
    cubeFrame = requestAnimationFrame(frame);
  }
  resetCube();
  document.querySelector('#cube-render').removeAttribute('hidden');

  function setGame(game) {
    body.dataset.game = game;
    document.querySelector('#current-game').textContent = games[game];
    preview.value = game;
    for (const screen of document.querySelectorAll('.game-screen')) screen.classList.toggle('selected', screen.dataset.screen === game);
    if (active?.dataset.object === 'monitor') {
      title.textContent = games[game];
      copy.textContent = monitorStories[game];
      placeTooltip();
    }
  }
  const draw = Math.random();
  setGame(draw < .7 ? 'trackmania' : draw < .85 ? 'hearthstone' : draw < .99 ? 'chess' : 'fez');
  preview.addEventListener('change', () => setGame(preview.value));

  function setMotion(on) {
    body.dataset.motion = on ? 'on' : 'off';
    motion.setAttribute('aria-pressed', String(!on));
    motion.querySelector('span').textContent = on ? 'Pause motion' : 'Resume motion';
  }
  setMotion(!reduced.matches);
  motion.addEventListener('click', () => setMotion(body.dataset.motion !== 'on'));
  reduced.addEventListener('change', () => setMotion(!reduced.matches));
  document.querySelector('#objects-toggle').addEventListener('click', event => {
    const visible = scene.classList.toggle('show-objects');
    event.currentTarget.setAttribute('aria-pressed', String(visible));
  });

  function placeTooltip() {
    if (!active || tooltip.hidden) return;
    const target = active.getBoundingClientRect();
    const panel = tooltip.getBoundingClientRect();
    const above = target.top - panel.height - 14;
    let left = target.left + target.width / 2 - panel.width / 2;
    let top = above >= 12 ? above : target.bottom + 14;
    if (active.dataset.object === 'cube') {
      if (target.right + panel.width + 30 <= innerWidth) { left = target.right + 18; top = target.top; }
      else top = target.bottom + panel.height + 30 <= innerHeight ? target.bottom + 18 : above - 60;
    }
    tooltip.style.left = `${Math.max(12, Math.min(innerWidth - panel.width - 12, left))}px`;
    tooltip.style.top = `${Math.max(12, Math.min(innerHeight - panel.height - 12, top))}px`;
  }
  function hideTooltip() {
    clearTimeout(closeTimer);
    active?.classList.remove('active');
    active?.removeAttribute('aria-describedby');
    active = undefined;
    pinned = false;
    delete scene.dataset.active;
    tooltip.hidden = true;
  }
  function showTooltip(button) {
    clearTimeout(closeTimer);
    if (active !== button) hideTooltip();
    active = button;
    button.classList.add('active');
    button.setAttribute('aria-describedby', 'room-tooltip');
    scene.dataset.active = button.dataset.object;
    title.textContent = button.dataset.object === 'monitor' ? games[body.dataset.game] : button.dataset.title;
    copy.textContent = button.dataset.object === 'monitor' ? monitorStories[body.dataset.game] : button.dataset.copy;
    if (button.dataset.object === 'cube') solveCube();
    tooltip.hidden = false;
    placeTooltip();
  }
  function scheduleHide() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      if (!pinned && active && document.activeElement !== active && !active.matches(':hover') && !tooltip.matches(':hover')) hideTooltip();
    }, 180);
  }
  for (const button of document.querySelectorAll('.hotspot')) {
    button.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch' && !pinned) showTooltip(button); });
    button.addEventListener('pointerleave', event => {
      if (!pinned && active === button && document.activeElement !== button && !tooltip.contains(event.relatedTarget)) scheduleHide();
    });
    button.addEventListener('focus', () => showTooltip(button));
    button.addEventListener('blur', () => { if (active === button && !button.matches(':hover') && !pinned) scheduleHide(); });
    button.addEventListener('click', () => {
      if (button.dataset.object === 'flags') openFlags();
      else { showTooltip(button); pinned = true; }
    });
  }
  tooltip.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  tooltip.addEventListener('pointerleave', scheduleHide);
  document.addEventListener('pointerdown', event => { if (!event.target.closest('.hotspot, #room-tooltip')) hideTooltip(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
  window.addEventListener('resize', placeTooltip);
  document.addEventListener('scroll', placeTooltip, true);
  document.querySelector('.room-controls').hidden = false;
  document.querySelector('.room-hotspots').hidden = false;
  document.querySelector('.preview-control').hidden = false;
})();
