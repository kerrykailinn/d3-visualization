(function () {
  const TOP10_COUNTRIES = [
    '波兰', '捷克', '希腊', '罗马尼亚', '匈牙利',
    '斯洛文尼亚', '塞尔维亚', '斯洛伐克', '保加利亚', '克罗地亚'
  ];

  const CATEGORY_ORDER = [
    '农学', '医学', '历史学', '哲学', '工学', '教育学', '文学',
    '法学', '理学', '管理学', '经济学', '艺术学', '跨学科'
  ];

  const CATEGORY_COLORS = [
    '#1bb5b9', '#eea78b', '#d5c1d6', '#9566a8', '#a4d2a1', '#3a9339',
    '#e98d49', '#ebcc75', '#489faa', '#3173a4', '#b6c7e0', '#bf3d3e',
    '#f3a5a4'
  ];

  const OTHER_COLOR = '#cbd5e1';

  const STATE = {
    container: null,
    svg: null,
    chartGroup: null,
    legendContainer: null,
    rootHierarchy: null,
    categories: [],
    colorScale: null,
    rawRows: [],
    countryRankList: [],
    countryTotalMap: new Map(),
    overallTotal: 0,
    dashboard: null,
    selectedCountry: null,
    dimensions: { width: 0, height: 0 }
  };
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    STATE.container = d3.select('#country-discipline-treemap');
    if (STATE.container.empty()) {
      console.warn('未找到 #country-discipline-treemap 容器，跳过国家树图初始化。');
      return;
    }

    injectStyles();
    createDOM();
    await loadData();
    window.addEventListener('resize', debounce(renderChart, 180));
  }

  function injectStyles() {
    const css = `
      #country-discipline-treemap { width: 100%; position: relative; }
      .country-treemap-title {
        margin: 0 0 6px 0;
        font-size: 1.5rem;
        font-weight: 700;
        line-height: 1.25;
        color: #0f172a;
      }
      .country-treemap-subtitle {
        margin: 0 0 16px 0;
        color: #6b7280;
        font-size: 1rem;
        line-height: 1.7;
      }
      .treemap-inner {
        display: flex;
        gap: 18px;
        align-items: stretch;
      }
      .treemap-left {
        flex: 1;
        min-width: 0;
      }
      .country-treemap-svg {
        width: 100%;
        height: auto;
        display: block;
        max-width: 100%;
      }
      .country-treemap-legend {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        align-items: center;
        padding-top: 0.75rem;
        width: 100%;
      }
      .country-treemap-legend .legend-item {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0.18rem 0.25rem;
        font-size: 0.88rem;
        color: #334155;
      }
      .country-treemap-legend .legend-swatch {
        width: 14px;
        height: 14px;
        border-radius: 4px;
        flex-shrink: 0;
        border: 1px solid rgba(15, 23, 42, 0.06);
      }
      .country-treemap-path {
        cursor: pointer;
        transition: opacity 180ms ease;
        stroke: #ffffff;
        stroke-width: 0.9;
      }
      .country-treemap-country-boundary {
        fill: none;
        stroke: #f3f6f8;
        stroke-width: 2.4px;
        stroke-linejoin: round;
      }
      .country-selected {
        filter: drop-shadow(0 6px 12px rgba(16, 24, 40, 0.08));
        stroke: #0b1220;
        stroke-width: 2.4px;
      }
      .country-treemap-label {
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        fill: #0f172a;
        font-weight: 700;
        pointer-events: none;
      }
      .country-treemap-small-label {
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        fill: #334155;
        font-weight: 500;
      }
      /* right panel: shared */
      .country-dashboard,
      #disc-panel-country {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(16, 24, 40, 0.06);
        padding: 16px;
        box-sizing: border-box;
        overflow: auto;
        min-height: 0;
      }
    `;
    d3.select('head').append('style').html(css);
  }

  function createDOM() {
    STATE.container.append('h3').attr('class', 'country-treemap-title')
      .text('二、重点国家学科构成（2016–2020）');
    STATE.container.append('div').attr('class', 'country-treemap-subtitle')
      .text('观察2016–2020年主要合作国家的学科分布差异，判断不同国家是否形成差异化合作方向。');

    const inner = STATE.container.append('div').attr('class', 'treemap-inner');
    const leftCol = inner.append('div').attr('class', 'treemap-left').style('flex', '1 1 0%').style('min-width', '0');

    STATE.svg = leftCol.append('svg')
      .attr('class', 'country-treemap-svg')
      .attr('viewBox', '0 0 1000 640');

    STATE.chartGroup = STATE.svg.append('g');
    STATE.legendContainer = leftCol.append('div').attr('class', 'country-treemap-legend');

    // Use external panel or create local
    const externalPanel = d3.select('#disc-panel-country');
    if (!externalPanel.empty()) {
      STATE.dashboard = externalPanel;
      STATE.dashboard.html('');
    } else {
      const rightCol = inner.append('div').style('flex-shrink', '0').style('flex-basis', '360px');
      STATE.dashboard = rightCol.append('div').attr('class', 'country-dashboard');
    }

    renderDashboardDefault(); // placeholder — will be re-rendered after data loads
    resizeChart();
  }

  async function loadData() {
    try {
      const raw = await (window.__loadLocalCsvRows
        ? window.__loadLocalCsvRows(['static/data/all_countries_discipline_with_category.csv', './static/data/all_countries_discipline_with_category.csv'], d => ({
            discipline: d.discipline?.trim(),
            discipline_cn: d.discipline_cn?.trim(),
            paper_n: +d.paper_n || 0,
            country_cn: d.country_cn?.trim(),
            discipline_code: d.discipline_code?.trim(),
            discipline_category: d.discipline_category?.trim()
          }))
        : d3.csv('static/data/all_countries_discipline_with_category.csv', d => ({
        discipline: d.discipline?.trim(),
        discipline_cn: d.discipline_cn?.trim(),
        paper_n: +d.paper_n || 0,
        country_cn: d.country_cn?.trim(),
        discipline_code: d.discipline_code?.trim(),
        discipline_category: d.discipline_category?.trim()
      })));

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

      STATE.rawRows = raw;
      buildHierarchy(filtered);
      computeCountryStats();
      await renderChart();
      buildLegend();
      renderDashboardDefault(); // re-render now that data is ready
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

    itemEnter.append('span').text(d => d);
  }

  async function renderChart() {
    if (!STATE.rootHierarchy) return;
    const containerW = STATE.container.node().clientWidth;
    const rightPanelWidth = 360;
    const gap = 18;
    const availableW = Math.max(0, containerW - rightPanelWidth - gap);
    STATE.dimensions.width = Math.max(700, availableW);
    STATE.dimensions.height = Math.max(520, STATE.dimensions.width * 0.65);

    STATE.svg
      .attr('viewBox', `0 0 ${STATE.dimensions.width} ${STATE.dimensions.height}`)
      .style('height', `${STATE.dimensions.height}px`);

    computeRectangularFallback();
    const leaves = STATE.rootHierarchy.leaves();
    const countries = STATE.rootHierarchy.children || [];

    // Country groups
    const groups = STATE.chartGroup.selectAll('.country-group')
      .data(countries, d => d.data.name);

    groups.exit().remove();

    const groupEnter = groups.enter()
      .append('g')
      .attr('class', 'country-group');

    const countryPaths = groupEnter.append('path')
      .attr('class', 'country-treemap-country-boundary')
      .on('click', (event, d) => {
        event.stopPropagation();
        showCountryDashboard(d.data.name);
      })
      .merge(groups.selectAll('.country-treemap-country-boundary').data(d => [d], d => d.data.name));

    countryPaths
      .attr('d', d => polygonPath(d.polygon || []));

    // Leaves
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
            try { const c = d3.hsl(base); c.s *= 0.92; return c + ''; } catch (e) { return base; }
          }
        } catch (e) { }
        return '#9AA6A3';
      })
      .transition()
      .duration(450)
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0));

    STATE.chartGroup.selectAll('.country-treemap-country-boundary').raise();

    renderLabels(countries);
  }

  function computeRectangularFallback() {
    const treemap = d3.treemap()
      .size([STATE.dimensions.width, STATE.dimensions.height])
      .paddingInner(2)
      .round(true);

    treemap(STATE.rootHierarchy);
    STATE.rootHierarchy.leaves().forEach(leaf => {
      leaf.polygon = [
        [leaf.x0, leaf.y0], [leaf.x1, leaf.y0],
        [leaf.x1, leaf.y1], [leaf.x0, leaf.y1]
      ];
    });

    STATE.rootHierarchy.children.forEach(country => {
      const allPoints = country.leaves().flatMap(leaf => leaf.polygon);
      country.polygon = d3.polygonHull(allPoints) || [];
    });
  }

  function renderLabels(countries) {
    STATE.chartGroup.selectAll('.country-treemap-label, .country-treemap-country-label').remove();

    countries.forEach(country => {
      if (!country.polygon) return;
      const [cx, cy] = d3.polygonCentroid(country.polygon);
      const size = Math.max(16, Math.min(28, Math.round(Math.min(STATE.dimensions.width, STATE.dimensions.height) / 28)));
      const txt = STATE.chartGroup.append('text')
        .attr('class', 'country-treemap-label country-treemap-country-label')
        .attr('x', cx).attr('y', cy)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', size)
        .text(country.data.name);

      const bbox = txt.node().getBBox();
      const maxW = Math.max(60, Math.min(STATE.dimensions.width / 6, 220));
      if (bbox.width > maxW) {
        const scale = maxW / bbox.width;
        txt.attr('transform', `translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`);
      }
    });
  }

  function computeCountryStats() {
    if (!STATE.rawRows) return;
    const rows = STATE.rawRows.filter(r => TOP10_COUNTRIES.includes(r.country_cn));
    const sums = d3.rollups(rows, v => d3.sum(v, d => d.paper_n), d => d.country_cn);
    sums.sort((a, b) => d3.descending(a[1], b[1]));
    STATE.countryRankList = sums.map(([country, total]) => ({ country, total }));
    STATE.countryTotalMap = new Map(sums.map(([c, t]) => [c, t]));
    STATE.overallTotal = d3.sum(STATE.rawRows, r => r.paper_n);
  }

  function showCountryDashboard(countryName) {
    const rows = (STATE.rawRows || []).filter(r => r.country_cn === countryName);
    if (!rows.length) return;

    const total = STATE.countryTotalMap.get(countryName) ?? d3.sum(rows, r => r.paper_n);
    const rankIndex = STATE.countryRankList.findIndex(r => r.country === countryName);
    const rank = rankIndex >= 0 ? rankIndex + 1 : '-';

    // TOP5 categories
    const cats = d3.rollups(rows, v => d3.sum(v, d => d.paper_n), d => d.discipline_category)
      .map(([cat, sum]) => ({ category: cat, total: sum }))
      .sort((a, b) => d3.descending(a.total, b.total))
      .slice(0, 5);

    const topCatsDetailed = cats.map(c => {
      const sub = rows.filter(r => r.discipline_category === c.category);
      const code = sub.length ? sub[0].discipline_code : '';
      const children = d3.rollups(sub, v => d3.sum(v, d => d.paper_n), d => d.discipline_cn)
        .map(([name, val]) => ({ name, value: val }))
        .sort((a, b) => d3.descending(a.value, b.value));
      return { category: c.category, code, total: c.total, children };
    });

    // TOP5 sub-disciplines
    const top5subs = rows.slice()
      .sort((a, b) => d3.descending(a.paper_n, b.paper_n))
      .slice(0, 5)
      .map(r => ({
        code: (r.discipline || '').slice(0, 4),
        name: r.discipline_cn,
        value: r.paper_n,
        category: r.discipline_category
      }));

    clearSelectionHighlight();
    STATE.selectedCountry = countryName;
    highlightCountry(countryName);

    renderCountryDetail(countryName, total, rank, topCatsDetailed, top5subs);
  }

  function renderCountryDetail(name, total, rank, cats, subs) {
    const d = STATE.dashboard;
    d.html('');

    // Header
    const header = d.append('div').attr('class', 'ct-panel-header');

    // Country flag emoji (approximate via text)
    const flagMap = {
      '波兰': '\uD83C\uDDF5\uD83C\uDDF1',
      '捷克': '\uD83C\uDDE8\uD83C\uDDFF',
      '希腊': '\uD83C\uDDEC\uD83C\uDDF7',
      '罗马尼亚': '\uD83C\uDDF7\uD83C\uDDF4',
      '匈牙利': '\uD83C\uDDED\uD83C\uDDFA',
      '斯洛文尼亚': '\uD83C\uDDF8\uD83C\uDDEE',
      '塞尔维亚': '\uD83C\uDDF7\uD83C\uDDF8',
      '斯洛伐克': '\uD83C\uDDF8\uD83C\uDDF0',
      '保加利亚': '\uD83C\uDDE7\uD83C\uDDEC',
      '克罗地亚': '\uD83C\uDDED\uD83C\uDDF7'
    };
    header.append('div').attr('class', 'ct-panel-flag').text(flagMap[name] || '\uD83C\uDFF3');
    const titleGroup = header.append('div').attr('class', 'ct-panel-title-group');
    titleGroup.append('div').attr('class', 'ct-panel-country-name').text(name);
    titleGroup.append('div').attr('class', 'ct-panel-rank').text(`排名第 ${rank} / ${STATE.countryRankList.length} 位`);
    header.append('button').attr('class', 'ct-panel-close').attr('title', '关闭')
      .text('\u2715')
      .on('click', () => {
        clearSelectionHighlight();
        STATE.selectedCountry = null;
        renderDashboardDefault();
      });

    // Stats grid
    const grid = d.append('div').attr('class', 'ct-country-stats');
    const addStat = (label, value, sub) => {
      const card = grid.append('div').attr('class', 'ct-country-stat');
      card.append('div').attr('class', 'ct-stat-label').text(label);
      card.append('div').attr('class', 'ct-stat-value').text(value);
      if (sub) card.append('div').attr('class', 'ct-stat-sub').text(sub);
    };
    addStat('论文总数', total.toLocaleString(), '');
    addStat('Top10排名', `#${rank}`, '');

    // TOP5 categories
    const catBlock = d.append('div').attr('class', 'ct-cat-block');
    catBlock.append('div').attr('class', 'ct-cat-title').text('Top5 学科大类');
    const maxCat = cats.length ? cats[0].total : 1;
    cats.forEach(cat => {
      const catRow = catBlock.append('div').attr('class', 'ct-cat-row');
      catRow.append('div').attr('class', 'ct-cat-swatch')
        .style('background', STATE.colorScale(cat.category) || OTHER_COLOR);
      catRow.append('div').attr('class', 'ct-cat-name').text(cat.category);
      catRow.append('div').attr('class', 'ct-cat-bar-wrap')
        .append('div').attr('class', 'ct-cat-bar')
        .style('width', `${(cat.total / maxCat * 100).toFixed(1)}%`)
        .style('background', STATE.colorScale(cat.category) || OTHER_COLOR);
      catRow.append('div').attr('class', 'ct-cat-count').text(cat.total.toLocaleString());
    });

    // TOP5 sub-disciplines
    const subBlock = d.append('div').attr('class', 'ct-cat-block');
    subBlock.append('div').attr('class', 'ct-cat-title').text('Top5 学科子类');
    const maxSub = subs.length ? subs[0].value : 1;
    subs.forEach(sub => {
      const subRow = subBlock.append('div').attr('class', 'ct-cat-row');
      subRow.append('div').attr('class', 'ct-cat-swatch')
        .style('background', STATE.colorScale(sub.category) || OTHER_COLOR);
      subRow.append('div').attr('class', 'ct-cat-name').text(sub.name);
      subRow.append('div').attr('class', 'ct-cat-bar-wrap')
        .append('div').attr('class', 'ct-cat-bar')
        .style('width', `${(sub.value / maxSub * 100).toFixed(1)}%`)
        .style('background', STATE.colorScale(sub.category) || OTHER_COLOR);
      subRow.append('div').attr('class', 'ct-cat-count').text(sub.value.toLocaleString());
    });
  }

  function renderDashboardDefault() {
    const totalTop10 = d3.sum(STATE.countryRankList, d => d.total);
    const overall = STATE.overallTotal || totalTop10;
    const pct = overall ? (totalTop10 / overall * 100) : 0;
    const d = STATE.dashboard;
    d.html('');

    // Header
    const header = d.append('div').attr('class', 'ct-panel-header');
    header.append('div').attr('class', 'ct-panel-flag').text('\uD83C\uDFF3');
    const titleGroup = header.append('div').attr('class', 'ct-panel-title-group');
    titleGroup.append('div').attr('class', 'ct-panel-country-name').text('中东欧国家概览');
    titleGroup.append('div').attr('class', 'ct-panel-rank').text('中东欧 16 国');

    // Stats
    const grid = d.append('div').attr('class', 'ct-country-stats');
    const addStat = (label, value, sub) => {
      const card = grid.append('div').attr('class', 'ct-country-stat');
      card.append('div').attr('class', 'ct-stat-label').text(label);
      card.append('div').attr('class', 'ct-stat-value').text(value);
      if (sub) card.append('div').attr('class', 'ct-stat-sub').text(sub);
    };
    addStat('论文总数', totalTop10.toLocaleString(), '');
    addStat('中东欧占比', pct.toFixed(1) + '%', 'TOP10 / 16国');

    // Country ranking
    const rankingTitle = d.append('div').attr('class', 'ct-cat-block');
    rankingTitle.append('div').attr('class', 'ct-cat-title').text('国家论文数排名');

    const maxTotal = STATE.countryRankList.length ? STATE.countryRankList[0].total : 1;
    STATE.countryRankList.forEach((r, i) => {
      const row = rankingTitle.append('div').attr('class', 'ct-cat-row');
      row.append('div').attr('class', 'ct-cat-swatch')
        .style('background', i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b87333' : '#e2e8f0');
      row.append('div').attr('class', 'ct-cat-name').text(`${i + 1}. ${r.country}`);
      row.append('div').attr('class', 'ct-cat-bar-wrap')
        .append('div').attr('class', 'ct-cat-bar')
        .style('width', `${(r.total / maxTotal * 100).toFixed(1)}%`)
        .style('background', i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b87333' : '#e2e8f0');
      row.append('div').attr('class', 'ct-cat-count').text(r.total.toLocaleString());
    });

    // Hint
    d.append('div').attr('class', 'dp-panel-hint')
      .text('点击树图中的国家查看详细学科分布');
  }

  function clearSelectionHighlight() {
    STATE.chartGroup.selectAll('.country-treemap-leaf').classed('country-selected', false);
    STATE.chartGroup.selectAll('.country-treemap-country-boundary').classed('country-selected', false);
  }

  function highlightCountry(countryName) {
    STATE.chartGroup.selectAll('.country-treemap-leaf')
      .filter(d => (d.parent && d.parent.data && d.parent.data.name) === countryName)
      .classed('country-selected', true);
    STATE.chartGroup.selectAll('.country-treemap-country-boundary')
      .filter(d => d.data && d.data.name === countryName)
      .classed('country-selected', true);
  }

  function polygonPath(polygon) {
    if (!polygon || !polygon.length) return null;
    return d3.line().curve(d3.curveLinearClosed)(polygon);
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
