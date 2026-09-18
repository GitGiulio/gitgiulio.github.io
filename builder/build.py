"""Generate three static language pages using only the Python standard library."""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = json.loads((ROOT / "content.json").read_text(encoding="utf-8"))
PAGES = {"en": ("index.html", "English"), "it": ("it.html", "Italiano"), "da": ("da.html", "Dansk")}
SECTIONS = ("about", "experience", "projects", "education", "skills")


def render(lang, text):
    """Render trusted local content, escaping all text and attribute values."""
    t = {key: escape(value) if isinstance(value, str) else value for key, value in text.items()}
    effect, on, off, hint = (t[key] for key in ("trailLabel", "trailOn", "trailOff", "trailHint"))
    email = escape(CONTENT["profile"]["email"], quote=True)
    languages = "".join(
        f'<a href="{file}" lang="{code}" hreflang="{code}"'
        + (' aria-current="page"' if code == lang else '') + f'>{label}</a>'
        for code, (file, label) in PAGES.items()
    )
    navigation = "".join(
        f'<a href="#{section}"><span aria-hidden="true">0{i + 1}</span>{escape(label)}</a>'
        for i, (section, label) in enumerate(zip(SECTIONS, t["nav"]))
    )
    projects = "".join(
        f'<article class="project"><div class="entry-top"><h3>{escape(p["title"])}</h3>'
        f'<span class="date">{escape(p["date"])}</span></div><p>{escape(p["description"])}</p>'
        f'<div class="project-bottom"><ul class="tags">'
        + "".join(f'<li>{escape(tag)}</li>' for tag in p["tags"])
        + f'</ul><a class="project-link" href="{escape(p["url"], quote=True)}">{t["projectLink"]}'
        f'<span class="sr-only">: {escape(p["title"])}</span> <span aria-hidden="true">↗</span></a></div></article>'
        for p in t["projects"]
    )
    education = "".join(
        f'<article class="education-entry"><span class="date">{escape(e["date"])}</span>'
        f'<div><h3>{escape(e["degree"])}</h3><p class="school">{escape(e["school"])}</p>'
        f'<p>{escape(e["detail"])}</p></div></article>' for e in t["education"]
    )
    skills = "".join(
        f'<div><dt>{escape(s["name"])}</dt><dd>{escape(s["items"])}</dd></div>'
        for s in t["skillGroups"]
    )
    bullets = "".join(f'<li>{escape(item)}</li>' for item in t["experience"])
    spoken = "".join(f'<li>{escape(item)}</li>' for item in t["languages"])
    alternates = "".join(f'<link rel="alternate" hreflang="{code}" href="{file}">' for code, (file, _) in PAGES.items())
    return f'''<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#101114">
  <title>{t['title']}</title>
  <meta name="description" content="{t['description']}">
  <meta property="og:title" content="{t['title']}">
  <meta property="og:description" content="{t['description']}">
  <meta property="og:type" content="website">
  {alternates}<link rel="alternate" hreflang="x-default" href="index.html">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="styles.css">
  <script src="trail.js" defer></script>
</head>
<body id="top">
  <a class="skip-link" href="#main">{t['skip']}</a>
  <canvas id="pearl-trail" aria-hidden="true"></canvas>
  <header class="topbar">
    <a class="wordmark" href="#top" aria-label="Giulio Lo Cigno">GLC<span aria-hidden="true">.</span></a>
    <nav class="languages" aria-label="{t['languageLabel']}">{languages}</nav>
  </header>
  <div class="layout">
    <aside class="profile">
      <div class="portrait-frame"><img src="portrait.png" width="250" height="250" alt="{t['portraitAlt']}"></div>
      <p class="profile-name">Giulio <br>Lo Cigno<span aria-hidden="true">.</span></p>
      <p class="role">{t['role']}</p>
      <p class="location"><span aria-hidden="true">⌖</span> {t['location']}</p>
      <a class="contact-button" href="mailto:{email}">{t['contact']} <span aria-hidden="true">↗</span></a>
      <nav class="sections" aria-label="{t['navigation']}">{navigation}</nav>
      <div class="effect-control" hidden>
        <button id="trail-toggle" type="button" aria-pressed="false" data-on="{on}" data-off="{off}" aria-describedby="trail-hint"><span class="pearl-dot" aria-hidden="true"></span>{effect}<span class="toggle-state">{off}</span></button>
        <p id="trail-hint">{hint}</p>
      </div>
    </aside>
    <main id="main" tabindex="-1">
      <section id="about" class="intro-section" aria-labelledby="intro-title">
        <p class="eyebrow">{t['eyebrow']}</p>
        <h1 id="intro-title">{t['heading']}</h1>
        <p class="lead">{t['intro']}</p>
        <p>{t['about']}</p>
        <div class="intro-rule" aria-hidden="true"><span>01 — 05</span><span>GLC / PORTFOLIO</span></div>
      </section>
      <section id="experience" aria-labelledby="experience-title">
        <h2 id="experience-title"><span aria-hidden="true">02</span>{t['experienceLabel']}</h2>
        <article class="work-entry">
          <div class="entry-top"><h3>{t['experienceTitle']}</h3><span class="date">{t['experienceDate']}</span></div>
          <p class="company">{t['company']} <span class="acronym">(EIC-SEWPG)</span></p>
          <ul class="work-list">{bullets}</ul>
          <ul class="tags"><li>Python</li><li>SLURM</li><li>Docker</li></ul>
        </article>
      </section>
      <section id="projects" aria-labelledby="projects-title">
        <h2 id="projects-title"><span aria-hidden="true">03</span>{t['projectsLabel']}</h2>{projects}
      </section>
      <section id="education" aria-labelledby="education-title">
        <h2 id="education-title"><span aria-hidden="true">04</span>{t['educationLabel']}</h2>{education}
        <div class="thesis"><p class="eyebrow">{t['thesisLabel']}</p><p lang="en">{t['thesisTitle']}</p></div>
      </section>
      <section id="skills" aria-labelledby="skills-title">
        <h2 id="skills-title"><span aria-hidden="true">05</span>{t['skillsLabel']}</h2>
        <dl class="skills">{skills}</dl><h3 class="language-heading">{t['languagesLabel']}</h3><ul class="spoken">{spoken}</ul>
      </section>
      <footer><p>{t['footer']}</p><a href="#top">{t['backTop']} ↑</a></footer>
    </main>
  </div>
</body>
</html>
'''


if __name__ == "__main__":
    output = ROOT / "site"
    output.mkdir(exist_ok=True)
    for language, (filename, _) in PAGES.items():
        (output / filename).write_text(render(language, CONTENT[language]), encoding="utf-8")
    print("Built site/index.html, site/it.html and site/da.html")
