const backToTopButton = document.getElementById("backToTop");
const navLinks = Array.from(document.querySelectorAll(".site-nav a"));
const sectionIds = ["overview", "country", "discipline", "institution", "archive"];
const heroMapContainer = document.getElementById("hero-map");

function updateBackToTop() {
  if (!backToTopButton) return;
  const show = window.scrollY > 500;
  backToTopButton.classList.toggle("is-visible", show);
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateActiveNav() {
  const midpoint = window.scrollY + window.innerHeight * 0.35;
  let activeId = sectionIds[0];

  for (const id of sectionIds) {
    const section = document.getElementById(id);
    if (!section) continue;
    if (section.offsetTop <= midpoint) {
      activeId = id;
    }
  }

  navLinks.forEach((link) => {
    const target = link.getAttribute("href")?.replace("#", "");
    link.classList.toggle("is-active", target === activeId);
  });
}

function loadTopojson() {
  if (window.topojson) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-topojson="hero"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";
    script.async = true;
    script.dataset.topojson = "hero";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function renderHeroMap() {
  if (!heroMapContainer || typeof d3 === "undefined") return;

  const width = heroMapContainer.clientWidth || 760;
  const height = heroMapContainer.clientHeight || 620;
  heroMapContainer.innerHTML = "";

  try {
    await loadTopojson();
    const world = await d3.json("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
    const countries = window.topojson.feature(world, world.objects.countries).features;

    const svg = d3
      .select(heroMapContainer)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    const projection = d3.geoNaturalEarth1()
      .fitExtent([[14, 14], [width - 14, height - 18]], { type: "Sphere" });
    projection.scale(projection.scale() * 1.34);
    projection.translate([width * 0.58, height * 0.54]);
    const path = d3.geoPath(projection);
    const graticule = d3.geoGraticule10();

    svg.append("path")
      .datum({ type: "Sphere" })
      .attr("class", "hero-map__sphere")
      .attr("d", path);

    svg.append("path")
      .datum(graticule)
      .attr("class", "hero-map__graticule")
      .attr("d", path);

    svg.append("g")
      .selectAll("path")
      .data(countries)
      .join("path")
      .attr("class", "hero-map__country")
      .attr("d", path);

    const ceeRegion = d3.geoCircle().center([19.5, 47.5]).radius(14.6)();
    const chinaRegion = d3.geoCircle().center([104, 35]).radius(19.2)();

    svg.append("path")
      .datum(chinaRegion)
      .attr("class", "hero-map__region hero-map__region--china")
      .attr("d", path);

    svg.append("path")
      .datum(ceeRegion)
      .attr("class", "hero-map__region hero-map__region--cee")
      .attr("d", path);
  } catch (error) {
    console.warn("Hero map background failed to load.", error);
  }
}

if (backToTopButton) {
  backToTopButton.addEventListener("click", scrollToTop);
}

window.addEventListener("scroll", () => {
  updateBackToTop();
  updateActiveNav();
});

window.addEventListener("load", () => {
  updateBackToTop();
  updateActiveNav();
  renderHeroMap();
});

window.addEventListener("resize", () => {
  if (!heroMapContainer) return;
  window.clearTimeout(window.__heroMapResizeTimer);
  window.__heroMapResizeTimer = window.setTimeout(renderHeroMap, 140);
});
