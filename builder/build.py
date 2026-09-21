"""Generate six pages in three languages using the Python standard library."""

import json
from hashlib import sha256
from html import escape
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent
CONTENT = json.loads((ROOT / "content.json").read_text(encoding="utf-8"))
PAGES = {"en": ("index.html", "English"), "it": ("it.html", "Italiano"), "da": ("da.html", "Dansk")}
SECTIONS = ("about", "experience", "projects", "education", "skills", "interests")
ASSET_VERSIONS = {
    name: sha256((ROOT / "site" / name).read_bytes()).hexdigest()[:12]
    for name in ("styles.css", "trail.js")
}


def page_filename(lang, section):
    """Keep existing homepage URLs and give each section a shareable URL."""
    if section == "about":
        return PAGES[lang][0]
    return f"{section}{'' if lang == 'en' else '-' + lang}.html"


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
        raise ValueError("Use a relative media path inside site, such as media/skating.jpg.")
    alt = media.get("alt", "").strip()
    if not alt:
        raise ValueError("Add a descriptive alt label to interest media before setting its src.")
    src, alt = escape(src, quote=True), escape(alt, quote=True)
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
    effect, on, off, hint = (t[key] for key in ("trailLabel", "trailOn", "trailOff", "trailHint"))
    email = escape(CONTENT["profile"]["email"], quote=True)
    languages = "".join(
        f'<a href="{page_filename(code, section)}" lang="{code}" hreflang="{code}"'
        + (' aria-current="page"' if code == lang else '') + f'>{label}</a>'
        for code, (file, label) in PAGES.items()
    )
    navigation = "".join(
        f'<a href="{page_filename(lang, target)}"'
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
        + '</div></div></article>'
        for p in t["projects"]
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
    alternates = "".join(f'<link rel="alternate" hreflang="{code}" href="{page_filename(code, section)}">' for code in PAGES)
    title = t['title'] if section == 'about' else f'{escape(t["nav"][SECTIONS.index(section)])} — Giulio Lo Cigno'
    descriptions = {
        'about': t['description'],
        'experience': f'{t["experienceTitle"]} · {t["company"]} · {t["experienceDate"]}',
        'projects': escape(' · '.join(p['title'] for p in text['projects'])),
        'education': escape(' · '.join(e['degree'] + ' — ' + e['school'] for e in text['education'])),
        'skills': escape(' · '.join(s['items'] for s in text['skillGroups'])),
        'interests': t['interestsIntro'],
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
        <dl class="skills">{skills}</dl><h2 class="language-heading">{t['languagesLabel']}</h2><ul class="spoken">{spoken}</ul>''',
        'interests': f'''<p class="eyebrow">06 / {len(SECTIONS):02d}</p>
        <h1 id="page-title">{t['interestsLabel']}</h1>
        <p class="lead">{t['interestsIntro']}</p>{interests}''',
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
  {alternates}<link rel="alternate" hreflang="x-default" href="{page_filename('en', section)}">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css?v={ASSET_VERSIONS['styles.css']}">
  <script src="trail.js?v={ASSET_VERSIONS['trail.js']}" defer></script>
</head>
<body id="top">
  <a class="skip-link" href="#main">{t['skip']}</a>
  <canvas id="pearl-trail" aria-hidden="true"></canvas>
  <header class="topbar">
    <a class="wordmark" href="{page_filename(lang, 'about')}" aria-label="Giulio Lo Cigno">GLC<span aria-hidden="true">.</span></a>
    <nav class="sections" aria-label="{t['navigation']}">{navigation}</nav>
    <nav class="languages" aria-label="{t['languageLabel']}">{languages}</nav>
  </header>
  <div class="layout">
    <aside class="profile">
      <div class="portrait-frame"><img src="portrait.png" width="250" height="250" alt="{t['portraitAlt']}"></div>
      <p class="profile-name">Giulio <br>Lo Cigno<span aria-hidden="true">.</span></p>
      <p class="role">{t['role']}</p>
      <p class="location"><span aria-hidden="true">⌖</span> {t['location']}</p>
      <a class="contact-button" href="mailto:{email}">{t['contact']} <span aria-hidden="true">↗</span></a>
      <div class="effect-control" hidden>
        <button id="trail-toggle" type="button" aria-pressed="false" data-on="{on}" data-off="{off}" aria-describedby="trail-hint"><span class="pearl-dot" aria-hidden="true"></span>{effect}<span class="toggle-state">{off}</span></button>
        <p id="trail-hint">{hint}</p>
      </div>
    </aside>
    <main id="main" tabindex="-1">
      <section id="{section}" class="{'intro-section' if section == 'about' else 'content-section'}" aria-labelledby="page-title">{sections[section]}</section>
      <footer><p>{t['footer']}</p><a href="#top">{t['backTop']} ↑</a></footer>
    </main>
  </div>
</body>
</html>
'''


if __name__ == "__main__":
    output = ROOT / "site"
    output.mkdir(exist_ok=True)
    for language in PAGES:
        for section in SECTIONS:
            (output / page_filename(language, section)).write_text(
                render(language, CONTENT[language], section), encoding="utf-8"
            )
    print(f"Built {len(SECTIONS) * len(PAGES)} pages in site across three languages.")
