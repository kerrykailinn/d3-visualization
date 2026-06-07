(function () {
  const TOP10_COUNTRIES = [
    '波兰', '捷克', '希腊', '罗马尼亚', '匈牙利',
    '斯洛文尼亚', '塞尔维亚', '斯洛伐克', '保加利亚', '克罗地亚'
  ];

  const CATEGORY_ORDER = [
    '农学',
    '医学',
    '历史学',
    '哲学',
    '工学',
    '教育学',
    '文学',
    '法学',
    '理学',
    '管理学',
    '经济学',
    '艺术学',
    '跨学科'
  ];

  const CATEGORY_COLORS = [
   '#1bb5b9', '#eea78b', '#d5c1d6', '#9566a8', '#a4d2a1', '#e59d6a',
    '#58a7e7', '#24808c', '#d5e5c9', '#d4dee9', '#dfc2d8', '#b84725',
    '#ead198', '#299d82', '#895c56'
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
    // 使用矩形 treemap 实现（不加载 Voronoi treemap 相关脚本）
    await loadData();
    window.addEventListener('resize', debounce(resizeChart, 180));
  }

  function injectStyles() {
    const css = `
      #country-discipline-treemap { width:100%; position:relative; }
      .country-treemap-title { font-size:1.35rem; font-weight:600; color:#1f2937; margin-bottom:0.75rem; text-align:center; }
      .country-treemap-subtitle { font-size:13px; color:#6b7280; text-align:center; margin-bottom:8px; }
      .country-treemap-svg { width:100%; height:auto; overflow:visible; }
      /* allow svg to shrink inside flex layout and not force the right panel down */
      .treemap-left { min-width: 0; flex: 1 1 0%; }
      .treemap-inner {
        display: flex;
        gap: 18px;
        align-items: stretch; /* 关键：让左右高度一致 */
      }
      .treemap-left {
        flex: 1;
        min-width: 0; /* 关键：允许SVG缩小 */
      }
      .treemap-right {
        /* 固定宽度，不被 SVG 挤压 */
        flex-shrink: 0;
        flex-basis: 380px;
        /* column layout so multiple cards stack vertically and can stretch */
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      /* make direct dashboard children stretch to fill available height */
      .treemap-right > .country-dashboard,
      .treemap-right > #disc-panel-country { flex: 1 1 0%; height: 100%; overflow: auto; }
      .country-treemap-svg {
        width: 100%;
        height: auto;
        max-width: 100%; /* 关键：防止SVG溢出 */
      }
      .country-treemap-svg { display:block; max-width:100%; }
      .country-treemap-legend { display:grid; grid-template-columns: repeat(auto-fill,minmax(160px,1fr)); gap:8px 12px; align-items:start; padding-top:1rem; }
      .country-treemap-legend .legend-item { display:flex; align-items:center; gap:0.45rem; padding:0.18rem 0.25rem; font-size:0.88rem; color:#334155; }
      .country-treemap-legend .legend-swatch { width:14px; height:14px; border-radius:4px; flex-shrink:0; border:1px solid rgba(15,23,42,0.06); }
      .country-treemap-path { cursor:pointer; transition:opacity 180ms ease, transform 180ms ease; stroke:#ffffff; stroke-width:0.9; }
      /* enhance borders between countries and within country partitions */
      .country-treemap-path { stroke:#ffffff; stroke-width:1; }
      .country-treemap-country-boundary { fill:none; stroke:#f3f6f8; stroke-width:2.4px; stroke-linejoin:round; }
      /* selected highlight */
      .country-selected { filter: drop-shadow(0 6px 12px rgba(16,24,40,0.08)); stroke:#0b1220; stroke-width:2.4px; }
      .country-treemap-label { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#ffffff; font-weight:700; pointer-events:none; }
      .country-treemap-small-label { font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill:#334155; font-weight:500; }

      /* Dashboard (right column inside treemap container) */
      /* Panel inner elements styled under the generic disc-panel-box so external container styles apply */
      .disc-panel-box .cd-header { display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .disc-panel-box .cd-title { font-size:1.06rem; font-weight:700; color:#0b2540; }
      .disc-panel-box .cd-close { background:transparent; border:0; font-size:1.05rem; cursor:pointer; color:#64748b; }
      .disc-panel-box .cd-section { margin-top:12px; }
      .disc-panel-box svg { width:100%; height:120px; }
      .disc-panel-box .cd-meta { font-size:0.95rem; color:#334155; margin-top:6px; line-height:1.5 }
      .disc-panel-box .cd-subtitle { font-size:0.95rem; font-weight:600; color:#0f172a; margin-bottom:6px; }
      .disc-panel-box .value { font-weight:700; font-size:1.06rem; color:#0b2540 }
      /* dashboard card styles */
      .country-dashboard, #disc-panel-country { background:#ffffff; border-radius:12px; box-shadow:0 8px 20px rgba(16,24,40,0.06); padding:16px; box-sizing:border-box; overflow:auto; }
      .country-dashboard .cd-header, #disc-panel-country .cd-header { align-items:center; }
      .country-dashboard .cd-title, #disc-panel-country .cd-title { font-size:1.05rem; color:#0b2540 }
      .country-dashboard .cd-close, #disc-panel-country .cd-close { background:transparent; border:0; cursor:pointer }
      /* ensure the right panel stays vertically aligned to top */
      /* treemap-inner uses stretch to keep equal heights */
    `;
    d3.select('head').append('style').html(css);
  }

  function createDOM() {
    STATE.container.append('div')
      .attr('class', 'country-treemap-title')
      .text('TOP10 Countries: Discipline Distribution by Paper Count');
    STATE.container.append('div').attr('class','country-treemap-subtitle').text('直观展示中东欧Top10国家的学科分布差异与论文规模对比');

    // layout: left = chart + legend, right = dashboard
    const inner = STATE.container.append('div').attr('class','treemap-inner');
    const leftCol = inner.append('div').attr('class','treemap-left').style('flex','1 1 0%').style('min-width','0');

    STATE.svg = leftCol.append('svg')
      .attr('class', 'country-treemap-svg')
      .attr('viewBox', '0 0 1000 640');

    STATE.chartGroup = STATE.svg.append('g');
    STATE.legendContainer = leftCol.append('div').attr('class', 'country-treemap-legend');
    STATE.tooltip = null;

    // If a unified external panel exists (added in page markup), use it; otherwise create a local dashboard
    const externalPanel = d3.select('#disc-panel-country');
    if (!externalPanel.empty()) {
      // use the external sub-panel directly; don't add extra wrapper class to avoid style conflicts
      STATE.dashboard = externalPanel;
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
    } else {
      const rightCol = inner.append('div').attr('class','treemap-right').style('flex-shrink','0').style('flex-basis','380px');
      // keep reference so we can set its height to match the chart
      STATE.rightCol = rightCol;
      STATE.dashboard = rightCol.append('div').attr('class', 'country-dashboard');
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
    }

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
      // render dashboard default (overview)
      renderDashboardDefault();
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
    // compute available width for the treemap by subtracting the right panel width and gap
    const containerW = STATE.container.node().clientWidth;
    const rightPanelWidth = 380; // must match .treemap-right flex-basis
    const gap = 18; // must match .treemap-inner gap
    const availableW = Math.max(0, containerW - rightPanelWidth - gap);
    // keep a sensible minimum width for the chart
    STATE.dimensions.width = Math.max(700, availableW);
    STATE.dimensions.height = Math.max(520, STATE.dimensions.width * 0.65);

    STATE.svg
      .attr('viewBox', `0 0 ${STATE.dimensions.width} ${STATE.dimensions.height}`)
      .style('height', `${STATE.dimensions.height}px`);

    // ensure dashboard height matches treemap area
    if (STATE.rightCol) {
      // set right column height so its child cards (flex:1) stretch to match the treemap
      STATE.rightCol.style('height', `${STATE.dimensions.height}px`);
    } else if (STATE.dashboard) {
      // fallback: set dashboard height directly
      STATE.dashboard.style('height', `${STATE.dimensions.height}px`);
    }

    STATE.chartGroup
      .selectAll('.country-boundary')
      .raise();

    // always use rectangular treemap layout (矩形布局)
    computeRectangularFallback();

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
      .append('rect')
      .attr('class', 'country-treemap-path country-treemap-leaf')
      .attr('fill-opacity', 0.96)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1)
      .on('click', (event, d) => {
        event.stopPropagation();
        showCountryDashboard(d.parent?.data?.name || d.data?.name);
      });

    leafEnter.merge(leafSelection)
      .attr('fill', d => {
        const key = (d.data && (d.data.name || d.data.category) || '').toString().trim();
        try {
          if (STATE.colorScale) {
            const base = STATE.colorScale(key);
            try { const c = d3.hsl(base); c.s *= 0.92; return c + ''; } catch(e){ return base; }
          }
        } catch (e) {}
        return '#9AA6A3';
      })
      .transition()
      .duration(450)
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0));

    leafEnter.merge(leafSelection)
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1);

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
      .paddingInner(2)
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
    // remove any previously rendered labels to avoid duplicates on resize/redraw
    STATE.chartGroup.selectAll('.country-treemap-label, .country-treemap-small-label, .country-treemap-country-label, .country-treemap-category-label').remove();

    countries.forEach(country => {
      if (!country.polygon) return;
      const [cx, cy] = d3.polygonCentroid(country.polygon);
      const txt = STATE.chartGroup.append('text')
        // include both generic and specific classes so future clears can target them
        .attr('class', 'country-treemap-label country-treemap-country-label')
        .attr('x', cx)
        .attr('y', cy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', Math.max(12, Math.min(20, Math.round(Math.min(STATE.dimensions.width, STATE.dimensions.height) / 40))))
        .text(country.data.name);
      // simple truncation if too long to avoid overflow
      // set max width by measuring and scaling down font-size slightly
      const bbox = txt.node().getBBox();
      const maxW = Math.max(60, Math.min(STATE.dimensions.width / 6, 220));
      if (bbox.width > maxW) {
        const scale = maxW / bbox.width;
        txt.attr('transform', `translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`);
      }
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
    // overall total across all countries (for percentage calculation)
    STATE.overallTotal = d3.sum(STATE.rawRows, r => r.paper_n);
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

    // highlight selection in chart
    clearSelectionHighlight();
    STATE.selectedCountry = countryName;
    highlightCountry(countryName);
    STATE.dashboard.classed('visible', true);
  }

  function renderDashboardDefault(){
    // default panel: Top10 totals and Top3 countries ranking
    const totalTop10 = d3.sum(STATE.countryRankList, d => d.total);
    const overall = STATE.overallTotal || totalTop10;
    const pct = overall ? (totalTop10 / overall * 100) : 0;
    STATE.dashboard.select('.cd-title').text('Top10 国家概览');
    STATE.dashboard.select('.cd-meta').html(`<div><strong>Top10 国家论文总数：</strong><span class="value">${totalTop10}</span></div><div style="margin-top:6px;color:#6b7280">占全部文献：${pct.toFixed(1)}%</div>`);

    const top3 = STATE.countryRankList.slice(0,3);
    const top3Html = top3.map((r,i)=>`<div style="margin-top:6px"><strong>${i+1}. ${r.country}</strong>：${r.total}</div>`).join('');
    STATE.dashboard.select('.cd-stacked').selectAll('*').remove();
    STATE.dashboard.select('.cd-top10').selectAll('*').remove();
    STATE.dashboard.select('.cd-section').filter(function(){ return d3.select(this).select('.cd-subtitle').text() === 'TOP3学科大类'; }).selectAll('*').remove();
    // append top3 block
    STATE.dashboard.select('.cd-section').filter(function(d,i){ return i===1; }).html(`<div class="cd-subtitle">Top3 国家论文数</div>${top3Html}`);
  }

  function clearSelectionHighlight(){
    STATE.chartGroup.selectAll('.country-treemap-leaf').classed('country-selected', false);
    STATE.chartGroup.selectAll('.country-treemap-country-boundary').classed('country-selected', false);
  }

  function highlightCountry(countryName){
    // add class on leaves belonging to the country
    STATE.chartGroup.selectAll('.country-treemap-leaf').filter(d => (d.parent && d.parent.data && d.parent.data.name) === countryName)
      .classed('country-selected', true);
    // highlight the country boundary
    STATE.chartGroup.selectAll('.country-treemap-country-boundary').filter(d => d.data && d.data.name === countryName)
      .classed('country-selected', true);
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
    // hover tooltip removed; keep slight visual feedback
    d3.select(this).attr('opacity', 0.96).attr('stroke-width', 1.6);
  }

  function handleMouseMove(event) {
    // no-op: tooltip removed
  }

  function handleMouseLeave() {
    d3.select(this).attr('opacity', 0.92).attr('stroke-width', 0.9);
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