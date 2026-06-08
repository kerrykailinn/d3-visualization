/* chart-discipline.js
   Dual-layer donut + horizontal stacked bars + right-side data panel
   Data files (must exist):
     - static/data/category_final.csv
     - static/data/sub_discipline_final.csv
     - static/data/global_stats_final.csv

   Interactions:
     - hover pie slice: highlight slice, update bars + panel
     - click pie slice: lock selection; clicking other slice switches lock
     - click "其他" slice: show 其他 breakdown panel
     - default: show global stats
     - pie shows top5 categories + 其他
*/
(function () {
  const CONTAINER = '#discipline-chart';
  const PATH_CATEGORY = 'static/data/category_final.csv';
  const PATH_SUB = 'static/data/sub_discipline_final.csv';
  const PATH_GLOBAL = 'static/data/global_stats_final.csv';
  const TOP_N = 5;

  // 饼图：5 个蓝色系 + 灰色（其他）
  const CATEGORY_COLORS = [
    '#A4D9E1', '#7FB5CD', '#598EB2', '#3D6B98', '#1F4D6C'
  ];

  // 条形图：10 个区分度高、递进的颜色
  const SUB_COLORS = [
    '#7b95c6', '#49c2d9', '#a1d8e8', '#67a583', '#a2c986',
    '#d0e2c0', '#fded95', '#ffc1a6', '#f59c7c', '#f47254', '#c85e62'
  ];

  // "其他" grey
  const OTHER_COLOR = '#cbd5e1';

  const state = {
    category: [],        // all category rows
    displayCategories: [], // top5 + 其他 entry
    sub: [],
    global: null,
    selectedCategory: null,
    hoveredCategory: null,
    showingOther: false,
    categoryRankings: [],  // sorted by growth rate for ranking display
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const root = d3.select(CONTAINER);
    if (root.empty()) {
      console.warn('容器 ' + CONTAINER + ' 未找到');
      return;
    }
    injectStyles();
    buildDOM(root);
    Promise.all([
      d3.csv(PATH_CATEGORY),
      d3.csv(PATH_SUB),
      d3.csv(PATH_GLOBAL)
    ]).then(([cats, subs, globals]) => {
      parseData(cats, subs, globals);
      buildDisplayCategories();
      drawAll();
      window.addEventListener('resize', debounce(() => drawAll(), 180));
    }).catch(err => console.error('数据加载失败', err));
  }

  function parseData(cats, subs, globals) {
    state.category = cats.map((d, i) => ({
      discipline_category: d.discipline_category,
      category_2011_total: +d.category_2011_total || 0,
      category_2016_total: +d.category_2016_total || 0,
      category_2011_ratio: +d.category_2011_ratio || 0,
      category_2016_ratio: +d.category_2016_ratio || 0,
      category_increase: +d.category_increase || 0,
      // growth_rate is a multiplier; express as % increase: (rate - 1) * 100
      category_growth_rate: d.category_growth_rate !== undefined ? +d.category_growth_rate : 1,
      max_increase_sub: d.max_increase_sub,
      max_growth_sub: d.max_growth_sub,
      _color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
    }));

    state.sub = subs.map((d, i) => ({
      discipline_category: d.discipline_category,
      discipline_cn: d.discipline_cn,
      p11: +d['2011_2015_papers'] || 0,
      p16: +d['2016_2020_papers'] || 0,
      sub_increase: +d.sub_increase || 0,
      sub_growth_rate: +d.sub_growth_rate || 0,
      _color: SUB_COLORS[i % SUB_COLORS.length]
    }));

    // pre-compute rankings
    const sorted = [...state.category].sort((a, b) => {
      const ga = a.category_growth_rate;
      const gb = b.category_growth_rate;
      return gb - ga; // descending by growth rate
    });
    state.categoryRankings = sorted.map((c, i) => ({ ...c, rank: i + 1 }));

    state.global = globals && globals.length ? globals[0] : null;
  }

  function buildDisplayCategories() {
    const cats = state.category;
    // sort by 2016 paper total descending
    const sorted = [...cats].sort((a, b) => b.category_2016_total - a.category_2016_total);
    const top5 = sorted.slice(0, TOP_N);
    const other = sorted.slice(TOP_N);

    const display = top5.map(c => ({ ...c, _isOther: false }));

    // compute combined "其他" entry
    if (other.length > 0) {
      const otherEntry = {
        discipline_category: '其他',
        category_2011_total: d3.sum(other, d => d.category_2011_total),
        category_2016_total: d3.sum(other, d => d.category_2016_total),
        category_increase: d3.sum(other, d => d.category_increase),
        category_growth_rate: 0,
        max_increase_sub: '',
        max_growth_sub: '',
        _isOther: true,
        _otherItems: other,     // raw category objects in "其他"
        _color: OTHER_COLOR,
      };
      if (otherEntry.category_2011_total > 0) {
        otherEntry.category_growth_rate = otherEntry.category_2016_total / otherEntry.category_2011_total;
      }
      // Compute ratio vs ALL categories (including top5) so it never shows 0%
      const allTotal16 = d3.sum(state.category, d => d.category_2016_total);
      otherEntry.category_2016_ratio = allTotal16 ? otherEntry.category_2016_total / allTotal16 : 0;
      display.push(otherEntry);
    }

    state.displayCategories = display;
  }

  function buildDOM(root) {
    root.html('');
    const wrapper = root.append('div').attr('class', 'discipline-wrapper').style('display', 'flex').style('gap', '18px');

    const left = wrapper.append('div').attr('class', 'discipline-left').style('flex', '1');
    left.append('h3').attr('class', 'disc-title').text('学科结构对比 (2011–2015 vs 2016–2020)');
    left.append('div').attr('class', 'disc-subtitle')
      .text('内圈：2011–2015 年　　外圈：2016–2020 年　　仅展示前五大学科大类，其余合并为"其他"')
      .style('margin', '6px 0 12px 0').style('color', '#6b7280').style('font-size', '12px');

    const main = left.append('div').attr('class', 'disc-main');
    // Row 1: pie (left, responsive) + legend (right, fills remaining)
    const pieRow = main.append('div').attr('class', 'disc-pie-row')
      .style('display', 'flex').style('align-items', 'flex-start').style('gap', '20px');
    pieRow.append('div').attr('id', 'disc-pie-area')
      .style('flex', '0 0 auto').style('min-width', '0').style('min-height', '340px');
    pieRow.append('div').attr('id', 'disc-pie-legend')
      .style('flex', '1').style('min-width', '0');

    // Row 2: bars (full width)
    main.append('div').attr('id', 'disc-bars-area').style('margin-top', '14px');

    const externalPanel = d3.select('#disc-panel-discipline');
    if (externalPanel.empty()) {
      const right = wrapper.append('div').attr('class', 'discipline-right').style('width', '360px');
      right.append('h4').attr('class', 'disc-panel-title').text('数据看板');
      right.append('div').attr('id', 'disc-panel-discipline').attr('class', 'disc-panel-box');
    } else {
      externalPanel.html('');
    }
  }

  function drawAll() {
    drawPie();
    drawLegend();
    drawBarsForCategory(null);
    renderPanel(null);
  }

  function drawPie() {
    const area = d3.select('#disc-pie-area');
    area.html('');
    area.style('display', 'flex').style('align-items', 'center').style('justify-content', 'center');

    // Responsive size based on available container width — give pie slightly more room
    const containerW = area.node().parentElement.clientWidth || 800;
    const availableForPie = Math.floor(containerW * 0.52);
    const size = Math.min(380, Math.max(240, availableForPie));

    const svg = area.append('svg')
      .attr('width', size).attr('height', size)
      .attr('viewBox', `0 0 ${size} ${size}`)
      .style('display', 'block');
    const g = svg.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const outerOuter = size * 0.44;
    const ringThickness = Math.max(size * 0.095, 8);
    const gap = Math.max(size * 0.02, 6);
    const outerInner = outerOuter - ringThickness;
    const innerOuter = outerInner - gap;
    const innerInner = innerOuter - ringThickness;

    const cats = state.displayCategories;

    const pie11 = d3.pie().sort(null).value(d => d.category_2011_total)(cats);
    const pie16 = d3.pie().sort(null).value(d => d.category_2016_total)(cats);

    const arcOuter = d3.arc().innerRadius(outerInner).outerRadius(outerOuter);
    const arcInner = d3.arc().innerRadius(innerInner).outerRadius(innerOuter);

    // outer (2016)
    const outer = g.append('g').attr('class', 'arc-outer');
    outer.selectAll('path').data(pie16)
      .enter().append('path')
      .attr('d', arcOuter)
      .attr('fill', d => d.data._color)
      .attr('stroke', '#fff').attr('stroke-width', 1)
      .on('mouseenter', (event, d) => onPieHover(d.data))
      .on('mouseleave', () => onPieLeave())
      .on('click', (event, d) => onPieClick(d.data));

    // inner (2011)
    const inner = g.append('g').attr('class', 'arc-inner');
    inner.selectAll('path').data(pie11)
      .enter().append('path')
      .attr('d', arcInner)
      .attr('fill', d => d.data._color)
      .attr('stroke', '#fff').attr('stroke-width', 1)
      .on('mouseenter', (event, d) => onPieHover(d.data))
      .on('mouseleave', () => onPieLeave())
      .on('click', (event, d) => onPieClick(d.data));

    // center
    const centerRadius = Math.max(innerInner - 12, 28);
    g.append('circle').attr('r', centerRadius).attr('fill', '#fff');
    g.append('text').attr('text-anchor', 'middle').attr('dy', '-0.3em')
      .attr('class', 'pie-center-label').attr('font-size', 11).attr('fill', '#64748b')
      .text('内圈');
    g.append('text').attr('text-anchor', 'middle').attr('dy', '1em')
      .attr('class', 'pie-center-label').attr('font-size', 11).attr('fill', '#64748b')
      .text('2011–2015');
    g.append('text').attr('text-anchor', 'middle').attr('dy', '2.5em')
      .attr('class', 'pie-center-label').attr('font-size', 11).attr('fill', '#64748b')
      .text('外圈');
    g.append('text').attr('text-anchor', 'middle').attr('dy', '3.8em')
      .attr('class', 'pie-center-label').attr('font-size', 11).attr('fill', '#64748b')
      .text('2016–2020');
  }

  function drawLegend() {
    const container = d3.select('#disc-pie-legend');
    container.html('');
    const cats = state.displayCategories;

    // header
    container.append('div').attr('class', 'leg-header').style('font-size', '12px')
      .style('font-weight', '700').style('color', '#475569')
      .style('margin-bottom', '10px').style('text-transform', 'uppercase')
      .style('letter-spacing', '0.06em').text('学科大类');

    const list = container.append('div').attr('class', 'pie-legend-list');

    cats.forEach((cat, i) => {
      const item = list.append('div').attr('class', 'leg-item')
        .style('display', 'flex').style('align-items', 'center')
        .style('gap', '10px').style('margin', '6px 0')
        .style('cursor', 'pointer')
        .style('padding', '4px 6px').style('border-radius', '6px')
        .on('mouseenter', () => onPieHover(cat))
        .on('mouseleave', () => onPieLeave())
        .on('click', () => onPieClick(cat));

      // single color swatch
      item.append('div').style('width', '14px').style('height', '14px')
        .style('background', cat._color).style('border-radius', '3px')
        .style('flex-shrink', '0');

      const text = item.append('div').style('flex', '1').style('min-width', '0');
      text.append('div').style('font-size', '13px').style('color', '#12263a')
        .style('font-weight', '500').text(cat.discipline_category);

      // show 2016 ratio next to name
      const total16 = d3.sum(cats, d => d.category_2016_total);
      const pct = total16 ? (cat.category_2016_total / total16 * 100) : 0;
      text.append('div').style('font-size', '11px').style('color', '#94a3b8')
        .text(`占比 ${pct.toFixed(1)}%`);
    });
  }

  function drawBarsForCategory(category) {
    const area = d3.select('#disc-bars-area');
    area.html('');

    const wrap = area.append('div').attr('class', 'bars-wrap')
      .style('display', 'flex').style('flex-direction', 'column').style('gap', '10px');

    const titleBar = wrap.append('div').style('display', 'flex')
      .style('justify-content', 'space-between').style('align-items', 'center');
    titleBar.append('div').text(category ? `学科大类：${category} — 细分学科分布` : '全部学科 — 细分学科堆叠');
    titleBar.append('div').style('font-size', '13px').style('color', '#6b7280')
      .text('上: 2011–2015  下: 2016–2020');

    const chartArea = wrap.append('div').attr('class', 'bars-area')
      .style('width', '100%').style('overflow-x', 'auto');

    // Filter: top5 sub-disciplines only + 其他 if needed
    let data = category
      ? state.sub.filter(d => d.discipline_category === category)
      : state.sub.slice();

    data = data.filter(d => d.p11 + d.p16 > 0);
    if (!data.length) {
      chartArea.append('div').text('暂无细分学科数据').style('color', '#9ca3af');
      return;
    }

    // Sort by 2016-2020 total, take top5
    const sortedBy16 = [...data].sort((a, b) => b.p16 - a.p16);
    const top5subs = sortedBy16.slice(0, TOP_N);
    const otherSubs = sortedBy16.slice(TOP_N);
    let displaySubs = top5subs;
    if (otherSubs.length > 0) {
      const otherEntry = {
        discipline_category: '__other__',
        discipline_cn: '其他',
        p11: d3.sum(otherSubs, d => d.p11),
        p16: d3.sum(otherSubs, d => d.p16),
        sub_increase: d3.sum(otherSubs, d => d.sub_increase),
        sub_growth_rate: 0,
        _color: OTHER_COLOR,
        _isOther: true
      };
      if (otherEntry.p11 > 0) otherEntry.sub_growth_rate = otherEntry.p16 / otherEntry.p11;
      displaySubs = [...top5subs, otherEntry];
    }

    // Reuse the existing chartArea div, just update its styles
    chartArea
      .style('display', 'flex').style('align-items', 'flex-start')
      .style('width', '100%').style('overflow-x', 'auto');

    const rowH = 28;
    const rowGap = 14;
    const width = chartArea.node().clientWidth || 760;
    const svgW = Math.max(620, width)-40;

    // SVG: bars only, no text
    const svg = chartArea.append('svg')
      .attr('width', svgW).attr('height', rowH * 2 + rowGap + 20)
      .style('flex', '1').style('min-width', '0')
      .style('height', 'auto').style('display', 'block');
    const g = svg.append('g').attr('transform', 'translate(0,0)');

    const total11 = d3.sum(displaySubs, d => d.p11);
    const total16 = d3.sum(displaySubs, d => d.p16);
    const maxVal = Math.max(1, total11, total16);
    const x11 = d3.scaleLinear().domain([0, maxVal]).range([0, svgW - 8]);
    const x16 = d3.scaleLinear().domain([0, maxVal]).range([0, svgW - 8]);

    // 2011 row
    let offset1 = 0;
    const row1 = g.append('g').attr('transform', 'translate(0,0)');
    displaySubs.forEach(d => {
      const w = x11(d.p11);
      if (w > 0) {
        row1.append('rect')
          .attr('x', offset1).attr('y', 0).attr('width', w).attr('height', rowH - 2)
          .attr('fill', d._color).attr('stroke', '#fff').attr('stroke-width', 1)
          .on('mouseenter', (event) => showSubTooltip(event, d, '2011–2015', total11))
          .on('mousemove', moveSubTooltip)
          .on('mouseleave', hideSubTooltip);
        offset1 += w;
      }
    });

    // 2016 row
    let offset2 = 0;
    const row2 = g.append('g').attr('transform', `translate(0,${rowH + rowGap})`);
    displaySubs.forEach(d => {
      const w = x16(d.p16);
      if (w > 0) {
        row2.append('rect')
          .attr('x', offset2).attr('y', 0).attr('width', w).attr('height', rowH - 2)
          .attr('fill', d._color).attr('stroke', '#fff').attr('stroke-width', 1)
          .on('mouseenter', (event) => showSubTooltip(event, d, '2016–2020', total16))
          .on('mousemove', moveSubTooltip)
          .on('mouseleave', hideSubTooltip);
        offset2 += w;
      }
    });

    // Labels: HTML divs to the right of bars — always at bar end position
    const labelsDiv = chartArea.append('div').attr('class', 'bars-labels')
      .style('flex', '0 0 80px').style('display', 'flex').style('flex-direction', 'column')
      .style('justify-content', 'space-between').style('padding-top', '2px');

    labelsDiv.append('div').style('height', `${rowH - 2}px`)
      .style('display', 'flex').style('align-items', 'center')
      .append('span')
      .style('font-size', '13px').style('font-weight', '600').style('color', '#0f172a')
      .text(total11.toLocaleString());

    labelsDiv.append('div').style('height', `${rowH - 2}px`)
      .style('display', 'flex').style('align-items', 'center')
      .append('span')
      .style('font-size', '13px').style('font-weight', '600').style('color', '#0f172a')
      .text(total16.toLocaleString());

    // Legend
    const legend = wrap.append('div')
      .attr('class', 'bars-legend')
      .style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '8px')
      .style('margin-top', '8px').style('max-height', '100px')
      .style('overflow-y', 'auto');

    displaySubs.forEach(d => {
      const it = legend.append('div').attr('class', 'bars-legend-item')
        .style('display', 'flex').style('align-items', 'center').style('gap', '8px')
        .style('padding', '6px 8px').style('border-radius', '6px')
        .style('background', '#fff').style('box-shadow', '0 1px 0 rgba(0,0,0,0.04)');
      it.append('div').style('width', '12px').style('height', '12px')
        .style('background', d._color).style('border-radius', '2px');
      it.append('div').text(d.discipline_cn).style('font-size', '13px');
    });
  }

  // ── Panel rendering ──
  function renderPanel(category) {
    const el = d3.select('#disc-panel-discipline');
    el.html('');

    if (state.showingOther) {
      renderOtherPanel(el);
      return;
    }

    if (!category) {
      renderGlobalPanel(el);
      return;
    }

    renderCategoryPanel(el, category);
  }

  function renderGlobalPanel(el) {
    if (!state.global) { el.append('div').text('无全局统计数据'); return; }
    const g = state.global;

    // Insight card
    el.append('div').attr('class', 'dp-insight-card')
      .html(`<div class="dp-insight-title">核心发现</div>
        <div class="dp-insight-body">
          2016–2020 年论文总量较 2011–2015 年增长
          <strong>${fmtGrowth(state.global.total_growth_rate)}</strong>，
          工学、理学、医学为绝对主力；
          经济学的增长率最高，但基数较小。
        </div>`);

    // Stats grid
    const grid = el.append('div').attr('class', 'dp-stat-grid');

    addStatCard(grid, '2011–2015', (+g.total_2011_all).toLocaleString(), '篇论文', false);
    addStatCard(grid, '2016–2020', (+g.total_2016_all).toLocaleString(), '篇论文', false);
    addStatCard(grid, '总增长量', (+g.total_increase).toLocaleString(), '篇', false);
    addStatCard(grid, '总增长率', fmtGrowth(g.total_growth_rate), '', true);

    // Period comparison
    el.append('hr').attr('class', 'dp-divider');
    const total11 = +g.total_2011_all;
    const total16 = +g.total_2016_all;
    renderPeriodCompare(el, total11, total16);

    // Rankings
    const rankingList = el.append('div').attr('class', 'dp-ranking-list')
      .html('<div class="dp-ranking-title">学科增长率排名</div>');
    state.categoryRankings.forEach((cat, i) => {
      const row = rankingList.append('div').attr('class', 'dp-ranking-row');
      let badgeClass = 'dp-rank-badge';
      if (i === 0) badgeClass += ' dp-top1';
      else if (i === 1) badgeClass += ' dp-top2';
      else if (i === 2) badgeClass += ' dp-top3';
      row.append('div').attr('class', badgeClass).text(cat.rank);
      row.append('div').attr('class', 'dp-ranking-name').text(cat.discipline_category);
      row.append('div').attr('class', 'dp-ranking-stat').text(fmtGrowth(cat.category_growth_rate));
    });

    // Hint
    el.append('div').attr('class', 'dp-panel-hint')
      .text('点击学科查看详情 · 点击"其他"查看合并学科');
  }

  function renderCategoryPanel(el, cat) {
    const catData = state.category.find(c => c.discipline_category === cat);
    if (!catData) { el.append('div').text('未找到该学科大类信息'); return; }

    const rankInfo = state.categoryRankings.find(c => c.discipline_category === cat);

    // Title + reset row
    const titleRow = el.append('div').style('display', 'flex').style('align-items', 'center')
      .style('gap', '10px').style('margin-bottom', '14px');
    titleRow.append('div').style('width', '12px').style('height', '12px')
      .style('background', catData._color).style('border-radius', '3px').style('flex-shrink', '0');
    titleRow.append('div').style('font-size', '18px').style('font-weight', '700')
      .style('color', '#0f172a').text(catData.discipline_category);
    titleRow.append('button').style('margin-left', 'auto')
      .style('background', '#f1f5f9').style('border', 'none').style('border-radius', '6px')
      .style('width', '28px').style('height', '28px').style('cursor', 'pointer')
      .style('font-size', '14px').style('color', '#64748b').style('flex-shrink', '0')
      .style('display', 'flex').style('align-items', 'center').style('justify-content', 'center')
      .text('\u2715')
      .on('click', () => {
        state.selectedCategory = null;
        state.hoveredCategory = null;
        state.showingOther = false;
        unhighlightPie();
        renderPanel(null);
      });

    // Insight
    el.append('div').attr('class', 'dp-insight-card').style('margin-bottom', '14px')
      .html(`<div class="dp-insight-title">学科概况</div>
        <div class="dp-insight-body">
          ${catData.discipline_category}在 2016–2020 年发表论文
          <strong>${catData.category_2016_total.toLocaleString()}</strong> 篇，
          较上一周期增长 <strong>${fmtGrowth(catData.category_growth_rate)}</strong>，
          占全部论文的 <strong>${(catData.category_2016_ratio * 100).toFixed(1)}%</strong>。
          ${rankInfo ? `该学科增长率排名第 <strong>${rankInfo.rank}</strong> 位。` : ''}
        </div>`);

    // Stats
    const grid = el.append('div').attr('class', 'dp-stat-grid');
    addStatCard(grid, '2011–2015', catData.category_2011_total.toLocaleString(),
      `${(catData.category_2011_ratio * 100).toFixed(1)}% 占比`, false);
    addStatCard(grid, '2016–2020', catData.category_2016_total.toLocaleString(),
      `${(catData.category_2016_ratio * 100).toFixed(1)}% 占比`, false);
    addStatCard(grid, '净增长', `+${catData.category_increase.toLocaleString()}`, '篇', false);
    addStatCard(grid, '增长率', fmtGrowth(catData.category_growth_rate), '', true);

    // Period comparison bars
    el.append('hr').attr('class', 'dp-divider');
    renderPeriodCompare(el, catData.category_2011_total, catData.category_2016_total);

    // Sub-discipline change ranking (sorted by growth rate)
    const catRankingList = el.append('div').attr('class', 'dp-ranking-list')
      .html('<div class="dp-ranking-title">学科子类增长率排名</div>');
    const catSubs = state.sub
      .filter(d => d.discipline_category === cat)
      .map(d => ({ ...d, _rankGrowth: d.sub_growth_rate }))
      .sort((a, b) => b._rankGrowth - a._rankGrowth)
      .slice(0, 10);

    catSubs.forEach((sub, i) => {
      const row = catRankingList.append('div').attr('class', 'dp-ranking-row');
      let badgeClass = 'dp-rank-badge';
      if (i === 0) badgeClass += ' dp-top1';
      else if (i === 1) badgeClass += ' dp-top2';
      else if (i === 2) badgeClass += ' dp-top3';
      row.append('div').attr('class', badgeClass).text(i + 1);
      row.append('div').attr('class', 'dp-ranking-name').text(sub.discipline_cn);
      row.append('div').attr('class', 'dp-ranking-stat').text(fmtGrowth(sub.sub_growth_rate));
    });

    el.append('div').attr('class', 'dp-panel-hint')
      .text('点击 × 返回总览');
  }

  function renderOtherPanel(el) {
    const otherEntry = state.displayCategories.find(d => d._isOther);
    if (!otherEntry) return;

    const items = otherEntry._otherItems || [];
    const total11 = otherEntry.category_2011_total;
    const total16 = otherEntry.category_2016_total;

    // Title + reset row
    const titleRow2 = el.append('div').style('display', 'flex').style('align-items', 'center')
      .style('gap', '10px').style('margin-bottom', '14px');
    titleRow2.append('div').style('width', '12px').style('height', '12px')
      .style('background', OTHER_COLOR).style('border-radius', '3px').style('flex-shrink', '0');
    titleRow2.append('div').style('font-size', '18px').style('font-weight', '700')
      .style('color', '#0f172a').text('其他');
    titleRow2.append('button').style('margin-left', 'auto')
      .style('background', '#f1f5f9').style('border', 'none').style('border-radius', '6px')
      .style('width', '28px').style('height', '28px').style('cursor', 'pointer')
      .style('font-size', '14px').style('color', '#64748b').style('flex-shrink', '0')
      .style('display', 'flex').style('align-items', 'center').style('justify-content', 'center')
      .text('\u2715')
      .on('click', () => {
        state.selectedCategory = null;
        state.hoveredCategory = null;
        state.showingOther = false;
        unhighlightPie();
        renderPanel(null);
      });

    el.append('div').attr('class', 'dp-insight-card').style('margin-bottom', '14px')
      .html(`<div class="dp-insight-title">其他学科说明</div>
        <div class="dp-insight-body">
          以下 ${items.length} 个学科大类未进入前五，合并呈现。
          共计论文 <strong>${total16.toLocaleString()}</strong> 篇（2016–2020），
          占全部论文的 <strong>${(otherEntry.category_2016_ratio * 100 || 0).toFixed(1)}%</strong>，
          增长率 <strong>${fmtGrowth(otherEntry.category_growth_rate)}</strong>。
        </div>`);

    // Stats
    const grid = el.append('div').attr('class', 'dp-stat-grid');
    addStatCard(grid, '2011–2015', total11.toLocaleString(), '篇', false);
    addStatCard(grid, '2016–2020', total16.toLocaleString(), '篇', false);
    addStatCard(grid, '涉及学科', items.length.toString(), '个', false);
    addStatCard(grid, '增长率', fmtGrowth(otherEntry.category_growth_rate), '', true);

    // Period comparison
    el.append('hr').attr('class', 'dp-divider');
    renderPeriodCompare(el, total11, total16);

    // Breakdown list (scrollable)
    el.append('div').attr('class', 'dp-other-section')
      .html('<div class="dp-other-title">包含的学科大类</div>');
    const scrollWrap = el.append('div').style('max-height', '180px').style('overflow-y', 'auto').style('padding-right', '4px');
    scrollWrap.append('style').text('.dp-other-section .dp-other-item { display:flex; align-items:center; gap:8px; padding:4px 0; }');
    items.forEach(item => {
      const itemRow = scrollWrap.append('div').attr('class', 'dp-other-item');
      const rank = state.categoryRankings.find(c => c.discipline_category === item.discipline_category);
      itemRow.append('div').style('width', '8px').style('height', '8px')
        .style('background', item._color).style('border-radius', '2px').style('flex-shrink', '0');
      itemRow.append('div').style('flex', '1').style('font-size', '12px')
        .style('color', '#475569').text(item.discipline_category);
      itemRow.append('div').style('font-size', '12px').style('font-weight', '600')
        .style('color', '#0f172a').text(item.category_2016_total.toLocaleString());
      const pct16 = otherEntry.category_2016_total
        ? (item.category_2016_total / otherEntry.category_2016_total * 100) : 0;
      itemRow.append('div').style('font-size', '11px').style('color', '#94a3b8')
        .style('flex', '0 0 40px').style('text-align', 'right').text(`${pct16.toFixed(1)}%`);
    });

    el.append('div').attr('class', 'dp-panel-hint')
      .text('点击 × 返回总览');
  }

  function renderPeriodCompare(el, val11, val16) {
    const max = Math.max(val11, val16);
    const x11 = max > 0 ? val11 / max : 0;
    const x16 = max > 0 ? val16 / max : 0;

    // Wrap both blocks in a flex row so they sit side by side with equal height
    const blocksRow = el.append('div').style('display', 'flex').style('gap', '10px').style('flex-shrink', '0');

    const block11 = blocksRow.append('div').style('flex', '1').style('display', 'flex').style('flex-direction', 'column')
      .attr('class', 'dp-period-block dp-first');
    block11.append('div').attr('class', 'dp-period-label').text('2011–2015');
    const r11 = block11.append('div').style('flex', '1').style('display', 'flex').style('align-items', 'center').style('gap', '8px');
    r11.append('div').style('flex', '1').style('height', '10px')
      .style('background', '#f1f5f9').style('border-radius', '5px').style('overflow', 'hidden')
      .append('div').style('height', '100%').style('width', `${x11 * 100}%`)
      .style('background', '#64748b').style('border-radius', '5px');
    r11.append('div').style('font-size', '13px').style('font-weight', '700')
      .style('color', '#0f172a').style('flex', '0 0 auto').style('margin-left', '6px')
      .text(val11.toLocaleString());

    const block16 = blocksRow.append('div').style('flex', '1').style('display', 'flex').style('flex-direction', 'column')
      .attr('class', 'dp-period-block dp-second');
    block16.append('div').attr('class', 'dp-period-label').text('2016–2020');
    const r16 = block16.append('div').style('flex', '1').style('display', 'flex').style('align-items', 'center').style('gap', '8px');
    r16.append('div').style('flex', '1').style('height', '10px')
      .style('background', '#f1f5f9').style('border-radius', '5px').style('overflow', 'hidden')
      .append('div').style('height', '100%').style('width', `${x16 * 100}%`)
      .style('background', '#3b82f6').style('border-radius', '5px');
    r16.append('div').style('font-size', '13px').style('font-weight', '700')
      .style('color', '#0f172a').style('flex', '0 0 auto').style('margin-left', '6px')
      .text(val16.toLocaleString());
  }

  function addStatCard(grid, label, value, sub, isGrowth) {
    const card = grid.append('div').attr('class', 'dp-stat-card' + (isGrowth ? ' dp-growth' : ''));
    card.append('div').attr('class', 'dp-stat-label').text(label);
    card.append('div').attr('class', 'dp-stat-value').text(value);
    if (sub) card.append('div').attr('class', 'dp-stat-sub').text(sub);
  }

  // ── Interactions ──
  function onPieHover(data) {
    if (state.selectedCategory && state.selectedCategory !== data.discipline_category) return;
    state.hoveredCategory = data.discipline_category;
    highlightPie(data.discipline_category);
    if (data._isOther) {
      state.showingOther = true;
      drawBarsForCategory(null);
      renderPanel(null);
    } else {
      state.showingOther = false;
      drawBarsForCategory(data.discipline_category);
      renderPanel(data.discipline_category);
    }
  }

  function onPieLeave() {
    if (state.selectedCategory) return;
    state.hoveredCategory = null;
    state.showingOther = false;
    unhighlightPie();
    drawBarsForCategory(null);
    renderPanel(null);
  }

  function onPieClick(data) {
    if (data._isOther) {
      state.selectedCategory = '其他';
      state.showingOther = true;
      highlightPie('其他');
      drawBarsForCategory(null);
      renderPanel(null);
      return;
    }
    if (state.selectedCategory === data.discipline_category) {
      state.selectedCategory = null;
      state.hoveredCategory = null;
      state.showingOther = false;
      unhighlightPie();
      drawBarsForCategory(null);
      renderPanel(null);
    } else {
      state.selectedCategory = data.discipline_category;
      state.hoveredCategory = data.discipline_category;
      state.showingOther = false;
      highlightPie(data.discipline_category);
      drawBarsForCategory(data.discipline_category);
      renderPanel(data.discipline_category);
    }
  }

  function highlightPie(name) {
    const area = d3.select('#disc-pie-area svg');
    if (area.empty()) return;
    area.selectAll('path')
      .style('opacity', d => (d.data && d.data.discipline_category === name) ? 1 : 0.3)
      .attr('transform', function (d) {
        return (d.data && d.data.discipline_category === name) ? 'scale(1.03)' : null;
      });
  }

  function unhighlightPie() {
    const area = d3.select('#disc-pie-area svg');
    if (area.empty()) return;
    area.selectAll('path').style('opacity', 1).attr('transform', null);
  }

  // ── Utilities ──
  function fmtGrowth(rate) {
    if (rate === undefined || rate === null || isNaN(+rate)) return '-';
    const r = +rate;
    const pct = (r - 1) * 100;
    const sign = pct >= 0 ? '+' : '';
    return sign + pct.toFixed(2) + '%';
  }

  const tip = d3.select('body').append('div').attr('class', 'disc-sub-tooltip')
    .style('position', 'fixed').style('pointer-events', 'none').style('z-index', 9999)
    .style('display', 'none').style('background', 'rgba(15,23,42,0.9)').style('color', '#fff')
    .style('padding', '8px 10px').style('border-radius', '6px').style('font-size', '13px')
    .style('box-shadow', '0 10px 30px rgba(2,6,23,0.28)');

  function showSubTooltip(event, d, period, total) {
    const count = period.startsWith('2011') ? d.p11 : d.p16;
    const pct = total ? (count / total * 100) : 0;
    const growth = d.sub_growth_rate ? fmtGrowth(d.sub_growth_rate) : '-';
    tip.style('display', 'block').html(
      `<div style="font-weight:600;margin-bottom:6px">${d.discipline_cn}</div>
       <div>${period}：${count.toLocaleString()} 篇</div>
       <div>占比：${pct.toFixed(1)}%</div>
       <div>增长率：${growth}</div>`
    );
    moveSubTooltip(event);
  }

  function moveSubTooltip(event) {
    const pad = 12;
    const x = event ? (event.pageX + pad) : 0;
    const y = event ? (event.pageY + pad) : 0;
    tip.style('left', `${x}px`).style('top', `${y}px`);
  }

  function hideSubTooltip() { tip.style('display', 'none'); }

  function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }

  function injectStyles() {
    const css = `
      ${CONTAINER} { font-family: Inter, Helvetica, Arial, sans-serif; }
      .disc-title { margin: 0 0 8px 0; font-weight: 700; font-size: 1.12rem; color: #0f172a; }
      .disc-subtitle { color: #6b7280; }
      .pie-legend-list { max-height: 380px; overflow-y: auto; padding-right: 4px; }
      .disc-sub-tooltip { box-shadow: 0 12px 24px rgba(2,6,23,0.08); }
      .leg-item:hover { background: #f8fafc; }
      .dp-ranking-list::-webkit-scrollbar { width: 5px; }
      .dp-ranking-list::-webkit-scrollbar-track { background: transparent; }
      .dp-ranking-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      .dp-other-section > div[style*="max-height"]::-webkit-scrollbar { width: 5px; }
      .dp-other-section > div[style*="max-height"]::-webkit-scrollbar-track { background: transparent; }
      .dp-other-section > div[style*="max-height"]::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    `;
    d3.select('head').append('style').text(css);
  }
})();
