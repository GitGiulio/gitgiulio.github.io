# Moon globe

The globe uses the real, near-side lunar surface from NASA's Scientific Visualization Studio [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/).

- Local source: `moon-lroc-color.jpg`, the 2048 x 1024 color map released in December 2025.
- Download: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg
- Credit: NASA's Scientific Visualization Studio; Ernie Wright (USRA), Noah Petro (NASA/GSFC). Lunar Reconnaissance Orbiter Camera data assembled by the LROC instrument team at Arizona State University, with polar data from LOLA.
- The map is centered on 0 degrees longitude. `builder/build_moon.cjs` projects it onto a sphere, tilts its axis and shades it with the room's warm light. Craters and maria come from the source map.
- The rendered `moon-globe.png` is a static local asset. The page needs no map download or rendering library.
