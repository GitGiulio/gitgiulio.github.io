"""Generate six pages in three languages using the Python standard library."""

import json
from hashlib import sha256
from html import escape
from pathlib import Path, PurePosixPath

BUILDER = Path(__file__).resolve().parent
ROOT = BUILDER.parent
SITE = ROOT / "site"
CURRENT_PAGE_IN_SITE = False
CONTENT = json.loads((BUILDER / "content.json").read_text(encoding="utf-8"))
PAGES = {"en": ("index.html", "English"), "it": ("it.html", "Italiano"), "da": ("da.html", "Dansk")}
SECTIONS = ("about", "experience", "projects", "education", "skills", "interests")
ASSET_VERSIONS = {
    name: sha256((SITE / name).read_bytes()).hexdigest()[:12]
    for name in ("styles.css", "trail.js", "eggs.js", "travel.js")
}
EGGS = {
    "blade": 'M8 5v9l5 2h9q4 0 4 4H6v-6M11 20v4m11-4v4M4 25h21l3-2M9 9h5m-5 3h5',
    "hold": 'M5 20 9 9l10-4 8 9-4 11-12 2Z M10 18l4-7 6-1 M14 21l7-4 M5 6h2m-3 4h1',
    "knight": 'M7 27h19v-4H9l2-5 8-4-5-3-5 4-3-3 7-8 2 3 5-2 5 9-3 9 M17 9h1 M4 19v5h3',
    "rocket": 'M12 19 10 12Q15 4 26 4q0 11-8 16Z M11 12l-6 2-1 7 8-2m6 1-1 8 7-2 1-7 M9 23l-4 4m5-1-1 3m-3-8-3 1 M19 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4',
    "compass": 'M16 3a13 13 0 1 0 0 26 13 13 0 0 0 0-26M19 19l-9 4 4-9 9-4Z M16 16h.1',
}


def egg_icon(egg):
    """Small matching line symbols, kept local and decorative."""
    return (f'<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">'
            f'<path d="{EGGS[egg]}"/></svg>')


def egg_button(egg, hunt, lang):
    if lang != {'blade': 'en', 'hold': 'en', 'knight': 'it', 'rocket': 'da', 'compass': 'en'}[egg]:
        return ''
    index = list(EGGS).index(egg)
    return (f'<button type="button" class="egg-symbol egg-{egg}" data-egg="{egg}" hidden '
            f'aria-label="{escape(hunt["names"][index], quote=True)}" aria-pressed="false" '
            f'data-message="{escape(hunt["messages"][index], quote=True)}">'
            f'{egg_icon(egg)}</button>')


def render_hunt(hunt):
    slots = ''.join(
        f'<span class="egg-slot" data-egg-slot="{egg}" aria-hidden="true">{egg_icon(egg)}</span>'
        for egg in EGGS
    )
    return f'''<div id="egg-collection" hidden>
        <p id="egg-notice" role="status" aria-live="polite" aria-atomic="true"></p>
        <p id="egg-progress" data-found="{escape(hunt['found'], quote=True)}"
           data-progress="{escape(hunt['progress'], quote=True)}" data-complete="{escape(hunt['complete'], quote=True)}"></p>
        <div class="egg-rewards"><div class="egg-slots">{slots}</div>
          <a id="secret-link" href="{asset_path('secret.html')}" hidden>{escape(hunt['enter'])} <span aria-hidden="true">↗</span></a></div>
      </div>'''


def page_filename(lang, section):
    """Keep existing homepage URLs and give each section a shareable URL."""
    if section == "about":
        return PAGES[lang][0]
    return f"{section}{'' if lang == 'en' else '-' + lang}.html"


def page_output(lang, section):
    filename = page_filename(lang, section)
    return ROOT / filename if filename == "index.html" else SITE / filename


def site_relative():
    return "" if CURRENT_PAGE_IN_SITE else "site/"


def page_path(lang, section):
    filename = page_filename(lang, section)
    if filename == "index.html":
        return "../index.html" if CURRENT_PAGE_IN_SITE else "index.html"
    return f"{site_relative()}{filename}"


def asset_path(path):
    return f"{site_relative()}{path}"


def render_travel_link(lang, text):
    return f'''<article class="interest travel-callout">
          <h2>{escape(text["travelTitle"])}</h2>
          <p>{escape(text["travelText"])}</p>
          <a class="project-link" href="{page_path(lang, 'travel')}">{escape(text["travelLink"])} <span aria-hidden="true">↗</span></a>
        </article>'''


def render_travel_map(lang, text):
    visited = CONTENT["travel"]["visited"]
    note_by_country = {item["country"]: item["note"] for item in visited}
    visited_json = json.dumps(visited, ensure_ascii=False)
    fallback = {
        "Italy": "M485 173l14 7 7 22-11 2 8 16 14 10-5 8-20-8-10-21-11-8 8-11Z",
        "Denmark": "M482 138l10 3-2 8-10 1-4-6Z M497 146l7 2-3 6-6-1Z",
        "South Africa": "M493 386l54-1 16 19-11 23-42 9-39-17Z",
    }
    paths = ''.join(
        f'<path class="country visited" data-country="{escape(country, quote=True)}" '
        f'data-visited="{escape(note_by_country[country], quote=True)}" tabindex="0" d="{path}"></path>'
        for country, path in fallback.items()
    )
    return f'''<div class="map-panel">
          <div class="map-copy">
            <p class="eyebrow">{escape(text["travelVisited"])}</p>
            <p id="map-status" aria-live="polite">{escape(text["travelDefault"])}</p>
          </div>
          <svg id="travel-map" viewBox="0 0 960 500" role="img" aria-labelledby="map-title map-desc"
               data-visited='{escape(visited_json, quote=True)}'
               data-visited-label="{escape(text["travelVisited"], quote=True)}"
               data-unvisited-label="{escape(text["travelUnvisited"], quote=True)}">
            <title id="map-title">{escape(text["travelHeading"])}</title>
            <desc id="map-desc">{escape(text["travelIntro"])}</desc>
            <rect class="map-ocean" width="960" height="500"></rect>
            <path class="map-land" d="M105 92h214v112H105zM336 114h292v146H336zM654 96h198v135H654zM178 244h168v156H178zM420 285h184v156H420zM652 292h190v110H652z"></path>
            {paths}
          </svg>
        </div>
        <div class="egg-map">{egg_button('compass', text['hunt'], lang)}</div>
        <script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js"></script>
        <script src="{asset_path('travel.js')}?v={ASSET_VERSIONS['travel.js']}" defer></script>'''


def render_interest_media(media, placeholder):
    """Render an optional local image, video, or empty media slot."""
    if media is None:
        return ""
    src = media.get("src", "").strip()
    if not src:
        return (
            '<div class="interest-media media-placeholder">'
            '<span class="media-symbol" aria-hidden="true">▷</span>'
            f'<span>{escape(placeholder)}</span></div>'
        )
    kind = media.get("type", "image")
    if kind not in ("image", "video"):
        raise ValueError("Interest media type must be image or video.")
    if src.startswith("/") or "\\" in src or ":" in src or ".." in PurePosixPath(src).parts:
        raise ValueError("Use a relative site asset path, such as media/skating.jpg.")
    alt = media.get("alt", "").strip()
    if not alt:
        raise ValueError("Add a descriptive alt label to interest media before setting its src.")
    src, alt = escape(asset_path(src), quote=True), escape(alt, quote=True)
    if kind == "image":
        element = f'<img src="{src}" alt="{alt}" loading="lazy" decoding="async">'
    else:
        element = (
            f'<video src="{src}" aria-label="{alt}" controls playsinline preload="metadata">'
            f'<a href="{src}">{alt}</a></video>'
        )
    return f'<div class="interest-media">{element}</div>'


def render(lang, text, section):
    """Render trusted local content, escaping all text and attribute values."""
    t = {key: escape(value) if isinstance(value, str) else value for key, value in text.items()}
    hunt = text['hunt']
    effect, on, off = (t[key] for key in ("trailLabel", "trailOn", "trailOff"))
    email = escape(CONTENT["profile"]["email"], quote=True)
    languages = "".join(
        f'<a href="{page_path(code, section)}" lang="{code}" hreflang="{code}"'
        + (' aria-current="page"' if code == lang else '') + f'>{label}</a>'
        for code, (file, label) in PAGES.items()
    )
    navigation = "".join(
        f'<a href="{page_path(lang, target)}"'
        + (' aria-current="page"' if target == section else '') + f'>{escape(label)}</a>'
        for target, label in zip(SECTIONS, t["nav"])
    )
    projects = "".join(
        f'<article class="project"><div class="entry-top"><h2>{escape(p["title"])}</h2>'
        f'<span class="date">{escape(p["date"])}</span></div><p>{escape(p["description"])}</p>'
        f'<div class="project-bottom"><ul class="tags">'
        + "".join(f'<li>{escape(tag)}</li>' for tag in p["tags"])
        + '</ul><div class="project-links">'
        + "".join(
            f'<a class="project-link" href="{escape(link["url"], quote=True)}">{escape(link["label"])}'
            f'<span class="sr-only">: {escape(p["title"])}</span> <span aria-hidden="true">↗</span></a>'
            for link in (p["links"] if "links" in p else [{"url": p["url"], "label": text["projectLink"]}])
        )
        + '</div></div>' + (egg_button('hold', hunt, lang) if index == 0 else '') + '</article>'
        for index, p in enumerate(t["projects"])
    )
    education = "".join(
        f'<article class="education-entry"><span class="date">{escape(e["date"])}</span>'
        f'<div><h2>{escape(e["degree"])}</h2><p class="school">{escape(e["school"])}</p>'
        f'<p>{escape(e["detail"])}</p></div></article>' for e in t["education"]
    )
    skills = "".join(
        f'<div><dt>{escape(s["name"])}</dt><dd>{escape(s["items"])}</dd></div>'
        for s in t["skillGroups"]
    )
    bullets = "".join(f'<li>{escape(item)}</li>' for item in t["experience"])
    interests = "".join(
        f'<article class="interest"><h2>{escape(item["title"])}</h2>'
        f'<p>{escape(item["description"])}</p>'
        f'{render_interest_media(item.get("media"), text["mediaPlaceholder"])}</article>'
        for item in t["interests"]
    )
    spoken = "".join(f'<li>{escape(item)}</li>' for item in t["languages"])
    alternates = "".join(f'<link rel="alternate" hreflang="{code}" href="{page_path(code, section)}">' for code in PAGES)
    title = t['title'] if section == 'about' else (
        f'{t["travelHeading"]} — Giulio Lo Cigno' if section == "travel"
        else f'{escape(t["nav"][SECTIONS.index(section)])} — Giulio Lo Cigno'
    )
    descriptions = {
        'about': t['description'],
        'experience': f'{t["experienceTitle"]} · {t["company"]} · {t["experienceDate"]}',
        'projects': escape(' · '.join(p['title'] for p in text['projects'])),
        'education': escape(' · '.join(e['degree'] + ' — ' + e['school'] for e in text['education'])),
        'skills': escape(' · '.join(s['items'] for s in text['skillGroups'])),
        'interests': t['interestsIntro'],
        'travel': escape(text.get('travelIntro', CONTENT['en']['travelIntro'])),
    }
    sections = {
        'about': f'''<p class="eyebrow">{t['eyebrow']}</p>
        <h1 id="page-title">{t['heading']}</h1>
        <p class="lead">{t['intro']}</p><p>{t['about']}</p>
        <div class="intro-rule" aria-hidden="true"><span>01 / {len(SECTIONS):02d}</span><span>GLC / PORTFOLIO</span></div>''',
        'experience': f'''<p class="eyebrow">02 / {len(SECTIONS):02d} · {t['experienceLabel']}</p>
        <h1 id="page-title">{escape(t['nav'][1])}</h1>
        <article class="work-entry">
          <div class="entry-top"><h2>{t['experienceTitle']}</h2><span class="date">{t['experienceDate']}</span></div>
          <p class="company">{t['company']} <span class="acronym">(EIC-SEWPG)</span></p>
          <ul class="work-list">{bullets}</ul>
          <ul class="tags"><li>Python</li><li>SLURM</li><li>Docker</li></ul>
        </article>''',
        'projects': f'''<p class="eyebrow">03 / {len(SECTIONS):02d} · {t['projectsLabel']}</p>
        <h1 id="page-title">{escape(t['nav'][2])}</h1>{projects}''',
        'education': f'''<p class="eyebrow">04 / {len(SECTIONS):02d}</p>
        <h1 id="page-title">{t['educationLabel']}</h1>{education}
        <div class="thesis"><p class="eyebrow">{t['thesisLabel']}</p><p lang="en">{t['thesisTitle']}</p></div>''',
        'skills': f'''<p class="eyebrow">05 / {len(SECTIONS):02d}</p>
        <h1 id="page-title">{t['skillsLabel']}</h1>
        <dl class="skills">{skills}</dl><h2 class="language-heading">{t['languagesLabel']}</h2><ul class="spoken">{spoken}</ul>
        <div class="egg-perch">{egg_button('knight', hunt, lang)}</div>''',
        'interests': f'''<p class="eyebrow">06 / {len(SECTIONS):02d}</p>
        <h1 id="page-title">{t['interestsLabel']}</h1>
        <p class="lead">{t['interestsIntro']}</p>{interests}{render_travel_link(lang, text)}
        <div class="egg-launchpad">{egg_button('rocket', hunt, lang)}</div>''',
        'travel': f'''<p class="eyebrow">{t['travelEyebrow']}</p>
        <h1 id="page-title">{t['travelHeading']}</h1>
        <p class="lead">{t['travelIntro']}</p>{render_travel_map(lang, text)}''',
    }
    return f'''<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#101114">
  <title>{title}</title>
  <meta name="description" content="{descriptions[section]}">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{descriptions[section]}">
  <meta property="og:type" content="website">
  {alternates}<link rel="alternate" hreflang="x-default" href="{page_path('en', section)}">
  <link rel="icon" href="{asset_path('favicon.svg')}" type="image/svg+xml">
  <link rel="stylesheet" href="{asset_path('styles.css')}?v={ASSET_VERSIONS['styles.css']}">
  <script src="{asset_path('trail.js')}?v={ASSET_VERSIONS['trail.js']}" defer></script>
  <script src="{asset_path('eggs.js')}?v={ASSET_VERSIONS['eggs.js']}" defer></script>
</head>
<body id="top">
  <a class="skip-link" href="#main">{t['skip']}</a>
  <canvas id="pearl-trail" aria-hidden="true"></canvas>
  <header class="topbar">
    <a class="wordmark" href="{page_path(lang, 'about')}" aria-label="Giulio Lo Cigno">GLC<span aria-hidden="true">.</span></a>
    <nav class="sections" aria-label="{t['navigation']}">{navigation}</nav>
    <nav class="languages" aria-label="{t['languageLabel']}">{languages}</nav>
  </header>
  <div class="layout">
    <aside class="profile">
      <div class="portrait-frame"><img src="{asset_path('portrait.png')}" width="250" height="250" alt="{t['portraitAlt']}"></div>
      <p class="profile-name">Giulio <br>Lo Cigno<span aria-hidden="true">.</span></p>
      <p class="role">{t['role']}</p>
      <p class="location"><span aria-hidden="true">⌖</span> {t['location']}{egg_button('blade', hunt, lang) if section == 'about' else ''}</p>
      <a class="contact-button" href="mailto:{email}">{t['contact']} <span aria-hidden="true">↗</span></a>
      <div class="effect-control" hidden>
        <button id="trail-toggle" type="button" aria-pressed="false" data-on="{on}" data-off="{off}"><span class="pearl-dot" aria-hidden="true"></span>{effect}<span class="toggle-state">{off}</span></button>
      </div>
    </aside>
    <main id="main" tabindex="-1">
      <section id="{section}" class="{'intro-section' if section == 'about' else 'content-section'}" aria-labelledby="page-title">{sections[section]}</section>
      <footer>{render_hunt(hunt)}<p>{t['footer']}</p><a href="#top">{t['backTop']} ↑</a></footer>
    </main>
  </div>
</body>
</html>
'''


if __name__ == "__main__":
    SITE.mkdir(exist_ok=True)
    for language in PAGES:
        for section in SECTIONS:
            output = page_output(language, section)
            if output.parent != ROOT:
                (ROOT / output.name).unlink(missing_ok=True)
    for language in PAGES:
        for section in SECTIONS:
            output = page_output(language, section)
            CURRENT_PAGE_IN_SITE = output.parent == SITE
            output.write_text(render(language, CONTENT[language], section), encoding="utf-8")
    for language in PAGES:
        output = page_output(language, "travel")
        CURRENT_PAGE_IN_SITE = True
        output.write_text(render(language, CONTENT[language], "travel"), encoding="utf-8")
    print(f"Built index.html plus {len(SECTIONS) * len(PAGES) - 1 + len(PAGES)} site pages in {SITE}.")
