(function () {
  const TOP10_COUNTRIES = [
    '波兰', '捷克', '希腊', '罗马尼亚', '匈牙利',
    '斯洛文尼亚', '塞尔维亚', '斯洛伐克', '保加利亚', '克罗地亚'
  ];

  const CATEGORY_ORDER = [
    '哲学',
    '经济学',
    '法学',
    '教育学',
    '文学',
    '历史学',
    '理学',
    '工学',
    '农学',
    '医学',
    '军事学',
    '管理学',
    '艺术学',
    '跨学科'
  ];

  const CATEGORY_COLORS = [
    '#8AA6A3',
    '#B8A29A',
    '#7C91A7',
    '#B8B2D0',
    '#A5B48A',
    '#C2A69A',
    '#90A2B3',
    '#ACA87E',
    '#B78E9F',
    '#8A9C8A',
    '#A48D84',
    '#7F8EA6',
    '#B7AD87',
    '#A9A9A9'
  ];

  const STATE = {
    container: null,
    svg: null,
    chartGroup: null,
    tooltip: null,
    legendContainer: null,
    rootHierarchy: null,
    categories: [],
    colorScale: null,
    dimensions: { width: 0, height: 0, margin: 24 }
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    STATE.container = d3.select('#country-discipline-treemap');
    if (STATE.container.empty()) {
      console.warn('未找到 #country-discipline-treemap 容器，跳过冯洛诺伊树图初始化。');
      return;
    }

    injectStyles();
    createDOM();

    try {
      await ensureVoronoiTreemap();
    } catch (error) {
      console.warn('Voronoi Treemap 插件加载失败，后备为矩形树图：', error);
    }

    await loadData();
    window.addEventListener('resize', debounce(resizeChart, 180));
  }

  function injectStyles() {
    const css = `
      #country-discipline-treemap { width:100%; position:relative; }
      .country-treemap-title { font-size:1.35rem; font-weight:600; color:#1f2937; margin-bottom:0.75rem; text-align:center; }
      .country-treemap-svg { width:100%; height:auto; overflow:visible; }
      .country-treemap-legend { display:flex; flex-wrap:wrap; justify-content:center; gap:0.85rem; padding-top:1rem; }
      .country-treemap-legend .legend-item { display:flex; align-items:center; gap:0.45rem; padding:0.25rem 0.35rem; font-size:0.88rem; color:#334155; }
      .country-treemap-legend .legend-swatch { width:16px; height:16px; border-radius:4px; flex-shrink:0; border:1px solid rgba(15,23,42,0.1); }
      .country-treemap-tooltip { position:fixed; pointer-events:none; z-index:9999; background:rgba(15,23,42,0.93); color:#f8fafc; padding:0.8rem 1rem; border-radius:10px; font-size:0.92rem; line-height:1.5; opacity:0; transition:opacity 160ms ease; box-shadow:0 16px 40px rgba(15,23,42,0.18); max-width:260px; }
      .country-treemap-path { cursor:pointer; transition:opacity 180ms ease, transform 180ms ease; }
      .country-treemap-path:hover { opacity:0.95; }
      .country-treemap-country-boundary { fill:none; stroke:#111827; stroke-width:3px; opacity:1; }
      .country-treemap-label { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#0f172a; font-weight:600; }
      .country-treemap-small-label { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#334155; font-weight:500; }
      .country-treemap-country-boundary { stroke-linejoin:round; stroke:#0b1220; stroke-opacity:0.9; }
      .country-treemap-country-boundary { pointer-events:all; stroke-width:2px; }

      /* Dashboard (right side) */
      .country-dashboard { position:fixed; right:20px; top:120px; width:460px; max-width:44vw; max-height:72vh; overflow:auto; background:#ffffff; border:1px solid rgba(15,23,42,0.06); border-radius:12px; box-shadow:0 18px 36px rgba(2,6,23,0.12); padding:14px; z-index:10005; display:none; }
      .country-dashboard.visible { display:block; }
      .country-dashboard .cd-header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .country-dashboard .cd-title { font-size:1.02rem; font-weight:700; color:#0f172a; }
      .country-dashboard .cd-close { background:transparent; border:0; font-size:1.05rem; cursor:pointer; color:#64748b; }
      .country-dashboard .cd-section { margin-top:10px; }
      .country-dashboard svg { width:100%; height:120px; }
      .country-dashboard .cd-meta { font-size:0.92rem; color:#334155; margin-top:6px; }
      .country-dashboard .cd-subtitle { font-size:0.95rem; font-weight:600; color:#0f172a; margin-bottom:6px; }
    `;
    d3.select('head').append('style').html(css);
  }

  function createDOM() {
    STATE.container.append('div')
      .attr('class', 'country-treemap-title')
      .text('TOP10 Countries: Discipline Distribution by Paper Count');

    STATE.svg = STATE.container.append('svg')
      .attr('class', 'country-treemap-svg')
      .attr('viewBox', '0 0 1000 640');

    STATE.chartGroup = STATE.svg.append('g');
    STATE.legendContainer = STATE.container.append('div').attr('class', 'country-treemap-legend');
    STATE.tooltip = d3.select('body').append('div').attr('class', 'country-treemap-tooltip');
    // right-side dashboard for selected country
    STATE.dashboard = STATE.container.append('div').attr('class', 'country-dashboard');
    STATE.dashboard.html(`
      <div class="cd-header">
        <div class="cd-title">Country Details</div>
        <button class="cd-close">×</button>
      </div>
      <div class="cd-meta"></div>
      <div class="cd-section">
        <div class="cd-subtitle">TOP3学科大类</div>
        <svg class="cd-stacked"></svg>
      </div>
      <div class="cd-section">
        <div class="cd-subtitle">TOP10学科子类</div>
        <svg class="cd-top10"></svg>
      </div>
    `);
    STATE.dashboard.select('.cd-close').on('click', () => STATE.dashboard.classed('visible', false));
    document.addEventListener('click', (e) => { if (!e.target.closest || !e.target.closest('.country-dashboard')) STATE.dashboard.classed('visible', false); });

    resizeChart();
  }

  async function ensureVoronoiTreemap() {
    if (d3.voronoiTreemap) return;

    await loadScript("https://rawcdn.githack.com/Kcnarf/d3-weighted-voronoi/v1.1.3/build/d3-weighted-voronoi.js");
    await loadScript("https://rawcdn.githack.com/Kcnarf/d3-voronoi-map/v2.1.1/build/d3-voronoi-map.js");
    await loadScript("https://rawcdn.githack.com/Kcnarf/d3-voronoi-treemap/v1.1.2/build/d3-voronoi-treemap.js");
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadData() {
    try {
      const raw = await d3.csv('static/data/all_countries_discipline_with_category.csv', d => ({
        discipline: d.discipline?.trim(),
        discipline_cn: d.discipline_cn?.trim(),
        paper_n: +d.paper_n || 0,
        country_cn: d.country_cn?.trim(),
        discipline_code: d.discipline_code?.trim(),
        discipline_category: d.discipline_category?.trim()
      }));

      const filtered = raw.filter(d => 
        TOP10_COUNTRIES.includes(d.country_cn) 
        && d.paper_n > 0 
        && d.discipline_category
      );

      if (!filtered.length) {
        STATE.chartGroup.append('text')
          .attr('x', 20).attr('y', 40)
          .attr('fill', '#8b95a1')
          .text('无法从数据中找到 TOP10 国家，或 paper_n 值为空。');
        return;
      }

      STATE.categories = Array.from(new Set(filtered.map(d => d.discipline_category))).sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a);
        const ib = CATEGORY_ORDER.indexOf(b);
        if (ia >= 0 && ib >= 0) return ia - ib;
        if (ia >= 0) return -1;
        if (ib >= 0) return 1;
        return a.localeCompare(b, 'zh');
      });

      STATE.colorScale = d3.scaleOrdinal()
        .domain(STATE.categories)
        .range(CATEGORY_COLORS.slice(0, STATE.categories.length));

      // keep raw rows for dashboard computations
      STATE.rawRows = raw;
      buildHierarchy(filtered);
      // precompute per-country totals & rankings
      computeCountryStats();
      await renderChart();
      buildLegend();
    } catch (error) {
      console.error('加载国家学科数据失败：', error);
    }
  }

  function buildHierarchy(rows) {
    const countryGroups = d3.rollups(
      rows,
      values => d3.rollup(values, g => d3.sum(g, d => d.paper_n), d => d.discipline_category),
      d => d.country_cn
    );

    const children = countryGroups
      .map(([country, categories]) => ({
        name: country,
        children: Array.from(categories, ([category, value]) => ({ name: category, value }))
          .sort((a, b) => d3.descending(a.value, b.value))
      }))
      .sort((a, b) => TOP10_COUNTRIES.indexOf(a.name) - TOP10_COUNTRIES.indexOf(b.name));

    const rootData = { name: 'root', children };
    const root = d3.hierarchy(rootData)
      .sum(d => d.value)
      .sort((a, b) => b.value - a.value);

    STATE.rootHierarchy = root;
  }

  function buildLegend() {
    STATE.legendContainer.selectAll('*').remove();
    const items = STATE.legendContainer.selectAll('.legend-item')
      .data(STATE.categories, d => d);

    const itemEnter = items.enter()
      .append('div')
      .attr('class', 'legend-item');

    itemEnter.append('span')
      .attr('class', 'legend-swatch')
      .style('background-color', d => STATE.colorScale(d));

    itemEnter.append('span')
      .text(d => d);
  }

  async function renderChart() {
    if (!STATE.rootHierarchy) return;
    STATE.dimensions.width = Math.max(700, STATE.container.node().clientWidth);
    STATE.dimensions.height = Math.max(520, STATE.dimensions.width * 0.65);

    STATE.svg
      .attr('viewBox', `0 0 ${STATE.dimensions.width} ${STATE.dimensions.height}`)
      .style('height', `${STATE.dimensions.height}px`);

    STATE.chartGroup
      .selectAll('.country-boundary')
      .raise();

    const radius = Math.min(STATE.dimensions.width, STATE.dimensions.height) * 0.46;
    const centerX = STATE.dimensions.width / 2;
    const centerY = STATE.dimensions.height / 2;

    const clip = Array.from({ length: 120 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 120;
      return [
        centerX + radius * Math.cos(angle),
        centerY + radius * Math.sin(angle)
      ];
    });

    const layoutSucceeded = await computeVoronoiPolygons(clip);
    if (!layoutSucceeded) {
      computeRectangularFallback();
    }

    const leaves = STATE.rootHierarchy.leaves();
    const countries = STATE.rootHierarchy.children || [];

    const groups = STATE.chartGroup.selectAll('.country-group')
      .data(countries, d => d.data.name);

    groups.exit().remove();

    const groupEnter = groups.enter()
      .append('g')
      .attr('class', 'country-group');

    const groupMerge = groupEnter.merge(groups);

    const countryPaths = groupMerge.selectAll('.country-boundary')
      .data(d => [d]);

    countryPaths.enter()
      .append('path')
      .attr('class', 'country-treemap-country-boundary')
      .on('click', (event, d) => {
        console.log('[treemap] boundary clicked', d.data.name);
        event.stopPropagation();
        showCountryDashboard(d.data.name);
      })
      .merge(countryPaths)
      .attr('d', d => polygonPath(d.polygon || []));

    countryPaths.exit().remove();

    const leafSelection = STATE.chartGroup.selectAll('.country-treemap-leaf')
      .data(leaves, d => `${d.parent.data.name}|${d.data.name}`);

    leafSelection.exit().transition().duration(220).style('opacity', 0).remove();

    const leafEnter = leafSelection.enter()
      .append('path')
      .attr('class', 'country-treemap-path country-treemap-leaf')
      .attr('fill-opacity', 0.92)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 0.9)
      .on('mouseenter', handleMouseEnter)
      .on('mousemove', handleMouseMove)
      .on('mouseleave', handleMouseLeave)
      .on('click', (event, d) => {
        console.log('[treemap] leaf clicked', d.parent?.data?.name || d.data?.name);
        event.stopPropagation();
        showCountryDashboard(d.parent?.data?.name || d.data?.name);
      });

    leafEnter.merge(leafSelection)
      .attr('fill', d => {
        const key = (d.data && (d.data.name || d.data.category) || '').toString().trim();
        try {
          if (STATE.colorScale) {
            const c = STATE.colorScale(key);
            if (c) return c;
          }
        } catch (e) {}
        return '#9AA6A3';
      })
      .transition()
      .duration(450)
      .attrTween('d', function (d) {
        const previous = this.__previous || d.polygon;
        const current = d.polygon || [];
        this.__previous = current;
        return interpolatePolygon(previous, current);
      });

    leafEnter.merge(leafSelection)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.9);

    leafSelection.merge(leafEnter).attr('fill', d => STATE.colorScale(d.data.name));

    // ensure country boundaries are above leaves and clickable
    STATE.chartGroup.selectAll('.country-treemap-country-boundary').raise();

    renderLabels(countries, leaves);
  }

  async function computeVoronoiPolygons(clip) {
    if (!d3.voronoiTreemap) {
      return false;
    }

    try {
      const voronoi = d3.voronoiTreemap()
        .clip(clip)
        .iterations(50);

      await voronoi(STATE.rootHierarchy);
      STATE.rootHierarchy.sum(d => d.value);
      STATE.rootHierarchy.each(node => {
        if (!node.polygon && node.data && node.data.polygon) {
          node.polygon = node.data.polygon;
        }
      });
      return true;
    } catch (error) {
      console.warn('Voronoi treemap 计算失败，使用备选矩形布局：', error);
      return false;
    }
  }

  function computeRectangularFallback() {
    const treemap = d3.treemap()
      .size([STATE.dimensions.width, STATE.dimensions.height])
      .paddingInner(1)
      .round(true);

    treemap(STATE.rootHierarchy);
    STATE.rootHierarchy.leaves().forEach(leaf => {
      leaf.polygon = [
        [leaf.x0, leaf.y0],
        [leaf.x1, leaf.y0],
        [leaf.x1, leaf.y1],
        [leaf.x0, leaf.y1]
      ];
    });

    STATE.rootHierarchy.children.forEach(country => {
      const allPoints = country.leaves().flatMap(leaf => leaf.polygon);
      country.polygon = d3.polygonHull(allPoints) || [];
    });
  }

  function renderLabels(countries, leaves) {
    STATE.chartGroup.selectAll('.country-treemap-country-label').remove();
    STATE.chartGroup.selectAll('.country-treemap-category-label').remove();

    countries.forEach(country => {
      if (!country.polygon) return;
      const [cx, cy] = d3.polygonCentroid(country.polygon);
      STATE.chartGroup.append('text')
        .attr('class', 'country-treemap-label')
        .attr('x', cx)
        .attr('y', cy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', '18px')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#fff')
        .attr('stroke-width', 4)
        .text(country.data.name);
    });
  }

  // ----- Country stats & dashboard helpers -----
  function computeCountryStats() {
    if (!STATE.rawRows) return;
    // only consider the TOP10 countries shown in the treemap
    const rows = STATE.rawRows.filter(r => TOP10_COUNTRIES.includes(r.country_cn));
    const sums = d3.rollups(rows, v => d3.sum(v, d => d.paper_n), d => d.country_cn);
    sums.sort((a, b) => d3.descending(a[1], b[1]));
    STATE.countryRankList = sums.map(([country, total]) => ({ country, total }));
    STATE.countryTotalMap = new Map(sums.map(([c, t]) => [c, t]));
  }

  function getSubColor(category, idx, total) {
    try {
      const base = d3.color(STATE.colorScale(category)) || d3.color('#9AA6A3');
      const t = total <= 1 ? 0.32 : 0.28 + 0.6 * (idx / Math.max(1, total - 1));
      return d3.interpolateRgb(base, d3.rgb(255, 255, 255))(t);
    } catch (e) {
      return STATE.colorScale(category);
    }
  }

  function showCountryDashboard(countryName) {
    console.log('[treemap] showCountryDashboard', countryName);
    const rows = (STATE.rawRows || []).filter(r => r.country_cn === countryName);
    if (!rows.length) return;
    const total = STATE.countryTotalMap?.get(countryName) ?? d3.sum(rows, r => r.paper_n);
    const rankIndex = STATE.countryRankList.findIndex(r => r.country === countryName);
    const rank = rankIndex >= 0 ? rankIndex + 1 : '-';

    // Top3 categories (with a representative code)
    const cats = d3.rollups(rows, v => d3.sum(v, d => d.paper_n), d => d.discipline_category)
      .map(([cat, sum]) => ({ category: cat, total: sum }))
      .sort((a, b) => d3.descending(a.total, b.total))
      .slice(0, 3);

    const topCatsDetailed = cats.map(c => {
      const sub = rows.filter(r => r.discipline_category === c.category);
      const code = sub.length ? sub[0].discipline_code : '';
      const children = d3.rollups(sub, v => d3.sum(v, d => d.paper_n), d => d.discipline_cn)
        .map(([name, val]) => ({ name, value: val }))
        .sort((a, b) => d3.descending(a.value, b.value));
      return { category: c.category, code, total: c.total, children };
    });

    // Top10 subcategories
    const top10 = rows.slice().sort((a, b) => d3.descending(a.paper_n, b.paper_n)).slice(0, 10)
      .map(r => ({ code: (r.discipline || '').slice(0, 4), name: r.discipline_cn, value: r.paper_n }));

    // populate dashboard
    STATE.dashboard.select('.cd-title').text(countryName);
    STATE.dashboard.select('.cd-meta').html(`<div><strong>论文总数：</strong>${total}</div><div style="margin-top:6px;"><strong>总排名：</strong>${rank}/${STATE.countryRankList.length}</div>`);

    renderStackedChart(STATE.dashboard.select('svg.cd-stacked'), topCatsDetailed);
    renderTop10Chart(STATE.dashboard.select('svg.cd-top10'), top10);

    STATE.dashboard.classed('visible', true);
  }

  function renderStackedChart(svgSel, data) {
    const svg = svgSel.node();
    if (!svg) return;
    const width = Math.max(260, svg.getBoundingClientRect().width);
    const height = 120;
    d3.select(svg).attr('viewBox', `0 0 ${width} ${height}`);
    d3.select(svg).selectAll('*').remove();

    const g = d3.select(svg).append('g').attr('transform', 'translate(8,8)');
    const innerW = width - 16;
    const rowH = (height - 16) / Math.max(1, data.length);
    const xMax = d3.max(data, d => d.total) || 1;
    const x = d3.scaleLinear().domain([0, xMax]).range([0, innerW]);

    data.forEach((d, i) => {
      let offset = 0;
      const y = i * rowH;
      const rowG = g.append('g').attr('transform', `translate(0,${y})`);
      d.children.forEach((ch, ci) => {
        const w = x(ch.value);
        const fill = getSubColor(d.category, ci, d.children.length);
        rowG.append('rect')
          .attr('x', offset)
          .attr('y', 2)
          .attr('width', w)
          .attr('height', rowH - 6)
          .attr('fill', fill)
          .attr('stroke', '#fff')
          .attr('stroke-width', 0.6);
        offset += w;
      });
      rowG.append('text').attr('x', 4).attr('y', rowH - 8).attr('fill', '#0f172a').attr('font-size', 11).text(`${d.code || ''} ${d.category} (${d.total})`);
    });
  }

  function renderTop10Chart(svgSel, data) {
    const svg = svgSel.node();
    if (!svg) return;
    const width = Math.max(260, svg.getBoundingClientRect().width);
    const height = Math.max(220, data.length * 22 + 20);
    d3.select(svg).attr('viewBox', `0 0 ${width} ${height}`).style('height', `${height}px`);
    d3.select(svg).selectAll('*').remove();

    const g = d3.select(svg).append('g').attr('transform', 'translate(8,8)');
    const innerW = width - 48;
    const maxV = d3.max(data, d => d.value) || 1;
    const x = d3.scaleLinear().domain([0, maxV]).range([0, innerW]);

    data.forEach((d, i) => {
      const y = i * 20;
      g.append('text').attr('x', 0).attr('y', y + 12).attr('font-size', 11).attr('fill', '#0f172a').text(`${d.code} ${d.name}`);
      g.append('rect')
        .attr('x', 120)
        .attr('y', y + 2)
        .attr('width', x(d.value))
        .attr('height', 12)
        .attr('fill', '#7f9db3');
      g.append('text').attr('x', 124 + x(d.value)).attr('y', y + 12).attr('font-size', 11).attr('fill', '#0f172a').text(d.value);
    });
  }

  function handleMouseEnter(event, d) {
    d3.select(this).attr('opacity', 0.92).attr('stroke-width', 1.6);
    STATE.tooltip.html(`
      <div><strong>国家：</strong>${d.parent.data.name}</div>
      <div><strong>学科大类：</strong>${d.data.name}</div>
      <div><strong>论文数量：</strong>${d.data.value}</div>
    `).style('opacity', 1);
  }

  function handleMouseMove(event) {
    const [x, y] = d3.pointer(event);
    STATE.tooltip.style('left', `${event.pageX + 14}px`)
      .style('top', `${event.pageY + 14}px`);
  }

  function handleMouseLeave() {
    d3.select(this).attr('opacity', 0.92).attr('stroke-width', 0.9);
    STATE.tooltip.style('opacity', 0);
  }

  function polygonPath(polygon) {
    if (!polygon || !polygon.length) return null;
    return d3.line().curve(d3.curveLinearClosed)(polygon);
  }

  function interpolatePolygon(previous, current) {
    const prevPoints = Array.isArray(previous) && previous.length ? previous : current;
    const currPoints = Array.isArray(current) && current.length ? current : prevPoints;
    const n = Math.max(prevPoints.length, currPoints.length);
    const prev = expandPolygon(prevPoints, n);
    const curr = expandPolygon(currPoints, n);

    return function (t) {
      const interpolated = new Array(n).fill(null).map((_, i) => [
        prev[i][0] + (curr[i][0] - prev[i][0]) * t,
        prev[i][1] + (curr[i][1] - prev[i][1]) * t
      ]);
      return d3.line().curve(d3.curveLinearClosed)(interpolated);
    };
  }

  function expandPolygon(points, n) {
    if (!points || !points.length) return Array.from({ length: n }, () => [0, 0]);
    const result = points.slice();
    while (result.length < n) {
      result.push(result[result.length - 1]);
    }
    return result;
  }

  function resizeChart() {
    if (!STATE.container) return;
    renderChart();
  }

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.apply(this, args), delay);
    };
  }
})();