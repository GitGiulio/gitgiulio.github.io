/* Four small discoveries; progress is optional browser-local data. */
(() => {
  const collection = document.querySelector('#egg-collection');
  const progress = document.querySelector('#egg-progress');
  const notice = document.querySelector('#egg-notice');
  const slots = [...document.querySelectorAll('[data-egg-slot]')];
  const ids = slots.map(slot => slot.dataset.eggSlot);
  const key = 'glc-eggs-v1';
  const found = new Set();
  let storageAvailable = true;
  let collectionTimer;

  function readProgress() {
    // Carry discoveries through ordinary links when storage cannot cross pages.
    if (location.hash.startsWith('#eggs=')) {
      for (const id of location.hash.slice(6).split(',')) if (ids.includes(id)) found.add(id);
    }
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) {
        for (const id of saved) if (ids.includes(id)) found.add(id);
      }
    } catch { /* Invalid or unavailable storage must not break the hunt. */ }
  }

  readProgress();
  try {
    localStorage.setItem(key, JSON.stringify([...found]));
  } catch { storageAvailable = false; }

  const buttons = [...document.querySelectorAll('[data-egg]')];
  function sync(reveal = false) {
    const complete = found.size === ids.length;
    collection.hidden = !complete && !reveal;
    progress.textContent = `${complete ? progress.dataset.complete : progress.dataset.found} ${progress.dataset.progress.replace('{count}', found.size)}`;
    document.querySelector('#secret-link').hidden = !complete;
    if ((!storageAvailable || location.protocol === 'file:') && found.size) {
      const hash = `#eggs=${[...found].join(',')}`;
      history.replaceState(null, '', hash);
      for (const link of document.querySelectorAll('header a[href]')) {
        const url = new URL(link.href);
        if (url.pathname.endsWith('.html')) link.setAttribute('href', link.getAttribute('href').split('#')[0] + hash);
      }
    }
    for (const slot of slots) slot.classList.toggle('found', found.has(slot.dataset.eggSlot));
    for (const button of buttons) {
      button.hidden = false;
      button.setAttribute('aria-pressed', String(found.has(button.dataset.egg)));
    }
  }

  for (const button of buttons) {
    button.addEventListener('click', () => {
      readProgress();
      const fresh = !found.has(button.dataset.egg);
      found.add(button.dataset.egg);
      try {
        localStorage.setItem(key, JSON.stringify([...found]));
      } catch { storageAvailable = false; }
      sync(true);
      notice.textContent = button.dataset.message;
      clearTimeout(collectionTimer);
      if (found.size < ids.length) collectionTimer = setTimeout(() => {
        if (found.size < ids.length) collection.hidden = true;
      }, 5000);
      if (fresh) {
        button.classList.add('discovered');
        setTimeout(() => button.classList.remove('discovered'), 900);
      }
    });
  }
  window.addEventListener('pageshow', () => { readProgress(); sync(); });
  window.addEventListener('storage', event => {
    if (event.key === key) { readProgress(); clearTimeout(collectionTimer); sync(); }
  });
  sync();
})();
