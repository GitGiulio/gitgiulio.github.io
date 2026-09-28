(() => {
  const svg = document.querySelector('#travel-map');
  const status = document.querySelector('#map-status');
  if (!svg || !status) return;

  const visited = new Map(JSON.parse(svg.dataset.visited || '[]').map(item => [item.country, item.note]));
  const labels = {
    visited: svg.dataset.visitedLabel || 'Visited',
    unvisited: svg.dataset.unvisitedLabel || 'Not visited yet',
  };
  const viewport = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  viewport.id = 'map-viewport';
  let view = { x: 0, y: 0, scale: 1 };
  let drag;

  for (const node of [...svg.querySelectorAll('.map-land, .country')]) viewport.append(node);
  svg.append(viewport);

  function applyView() {
    viewport.setAttribute('transform', `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.scale.toFixed(3)})`);
  }

  function label(country, note = visited.get(country)) {
    status.textContent = note ? `${country} · ${note}` : `${country} · ${labels.unvisited}`;
  }

  function wire() {
    for (const country of svg.querySelectorAll('.country')) {
      const name = country.dataset.country;
      country.classList.toggle('visited', visited.has(name));
      country.dataset.visited = visited.get(name) || '';
      country.addEventListener('pointerenter', () => label(name));
      country.addEventListener('focus', () => label(name));
    }
    svg.dataset.ready = 'true';
  }

  async function enhance() {
    if (!window.d3 || !window.topojson) return;
    const data = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(response => response.json());
    const countries = topojson.feature(data, data.objects.countries);
    const projection = d3.geoNaturalEarth1().fitSize([930, 455], countries);
    const path = d3.geoPath(projection);
    svg.querySelectorAll('.country, .map-land').forEach(node => node.remove());
    for (const feature of countries.features) {
      const name = feature.properties.name;
      const country = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      country.setAttribute('d', path(feature));
      country.setAttribute('class', 'country');
      country.dataset.country = name;
      country.setAttribute('tabindex', visited.has(name) ? '0' : '-1');
      viewport.append(country);
    }
    wire();
  }

  svg.addEventListener('wheel', event => {
    event.preventDefault();
    const next = Math.min(8, Math.max(1, view.scale * (event.deltaY < 0 ? 1.18 : 0.85)));
    const box = svg.getBoundingClientRect();
    const point = { x: (event.clientX - box.left) * 960 / box.width, y: (event.clientY - box.top) * 500 / box.height };
    view.x = point.x - (point.x - view.x) * next / view.scale;
    view.y = point.y - (point.y - view.y) * next / view.scale;
    view.scale = next;
    applyView();
  }, { passive: false });
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    svg.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, startX: view.x, startY: view.y };
    svg.classList.add('grabbing');
  });
  svg.addEventListener('pointermove', event => {
    if (!drag) return;
    const box = svg.getBoundingClientRect();
    view.x = drag.startX + (event.clientX - drag.x) * 960 / box.width;
    view.y = drag.startY + (event.clientY - drag.y) * 500 / box.height;
    applyView();
  });
  function stopDrag() {
    drag = null;
    svg.classList.remove('grabbing');
  }
  svg.addEventListener('pointerup', stopDrag);
  svg.addEventListener('pointercancel', stopDrag);
  applyView();
  wire();
  enhance().catch(() => {});
})();
