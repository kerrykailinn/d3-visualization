/* chart-discipline.js
   Dual-layer donut + horizontal stacked bars + right-side data panel
   Data files (must exist):
     - static/data/category_final.csv
     - static/data/sub_discipline_final.csv
     - static/data/global_stats_final.csv

   Interactions:
     - hover pie slice: highlight slice, update bars + panel
     - click pie slice: lock selection; clicking other slice switches lock
     - default: show global stats
*/
(function () {
  const CONTAINER = '#discipline-chart';
  const PATH_CATEGORY = 'static/data/category_final.csv';
  const PATH_SUB = 'static/data/sub_discipline_final.csv';
  const PATH_GLOBAL = 'static/data/global_stats_final.csv';

  // category colors (15 provided)
  const CATEGORY_COLORS = [
    '#1bb5b9', '#eea78b', '#d5c1d6', '#9566a8', '#a4d2a1', '#e59d6a',
    '#dce73b', '#24808c', '#d5e5c9', '#d4dee9', '#d9c2df', '#b84725',
    '#ead198', '#299d82', '#895c56'
  ];

  // sub-discipline colors (many provided)
  const SUB_COLORS = [
    '#3173a4', '#b6c7e0', '#e0822a', '#eebb8c', '#3a9339', '#9ed594',
    '#bf3d3e', '#f3a5a4', '#9571b1', '#c5b5cf', '#90bbdc', '#ffbf88',
    '#96d096', '#e99593', '#c8b3de', '#c7a9a7', '#f3bce3'
  ];

  const state = {
    category: [], // category rows
    sub: [],
    global: null,
    selectedCategory: null, // locked selection
    hoveredCategory: null,
    containerSize: { width: 1000 }
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
      category_growth_rate: d.category_growth_rate || d.category_growth_rate === 0 ? +d.category_growth_rate : d.category_growth_rate,
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

    // globals: take first row if csv single-row
    state.global = globals && globals.length ? globals[0] : null;
  }

  function buildDOM(root) {
    root.html('');
    const wrapper = root.append('div').attr('class', 'discipline-wrapper').style('display', 'flex').style('gap', '18px');

    // left: charts
    const left = wrapper.append('div').attr('class', 'discipline-left').style('flex','1');
    // title + subtitle
    left.append('h3').attr('class','disc-title').text('学科结构对比 (2011–2015 vs 2016–2020)');
    left.append('div').attr('class','disc-subtitle').text('直观展示 2011–2015 与 2016–2020 两个时间段学科规模与占比结构变化。').style('margin','6px 0 12px 0').style('color','#6b7280').style('font-size','13px');

    // main area: pie on top, bars below
    const main = left.append('div').attr('class','disc-main');

    // pie + legend row
    const pieRow = main.append('div').attr('class','disc-pie-row').style('display','flex').style('align-items','center');
    pieRow.append('div').attr('id','disc-pie-area').style('flex','0 0 420px').style('height','420px');
    pieRow.append('div').attr('id','disc-pie-legend').style('flex','1').style('padding-left','18px');

    // bars area
    main.append('div').attr('id','disc-bars-area').style('margin-top','18px');

    // right: data panel — if a specific external panel exists in the page, use it; otherwise create local one inside the chart container
    const externalPanel = d3.select('#disc-panel-discipline');
    if (externalPanel.empty()) {
      const right = wrapper.append('div').attr('class','discipline-right').style('width','320px');
      right.append('h4').attr('class','disc-panel-title').text('数据看板');
      right.append('div').attr('id','disc-panel-discipline').attr('class','disc-panel-box');
    } else {
      // clear any placeholder content in the external panel
      externalPanel.html('');
    }
  }

  function drawAll() {
    drawPie();
    drawLegend();
    drawBarsForCategory(null); // default: aggregated
    renderPanel(null);
  }

  function drawPie() {
    const area = d3.select('#disc-pie-area');
    area.html('');
    // 固定条形图区域的最小高度，防止内容变化撑大/缩小卡片
    area.style('min-height', '320px')
        .style('display', 'flex')
        .style('flex-direction', 'column');
    const bboxW = Math.max(420, area.node().clientWidth || 420);
    const size = Math.min(420, bboxW);
    const svg = area.append('svg').attr('width', size).attr('height', size).attr('viewBox', `0 0 ${size} ${size}`);
    const g = svg.append('g').attr('transform', `translate(${size/2},${size/2})`);

    // balance ring thickness: equal thickness for inner & outer, with small gap
    const outerOuter = size * 0.44; // outermost radius
    const ringThickness = Math.max( size * 0.095, 8 ); // reasonable thickness
    const gap = Math.max( size * 0.02, 6 );
    const outerInner = outerOuter - ringThickness;
    const innerOuter = outerInner - gap;
    const innerInner = innerOuter - ringThickness;

    const pie11 = d3.pie().sort(null).value(d => d.category_2011_ratio)(state.category);
    const pie16 = d3.pie().sort(null).value(d => d.category_2016_ratio)(state.category);

    const arcOuter = d3.arc().innerRadius(outerInner).outerRadius(outerOuter);
    const arcInner = d3.arc().innerRadius(innerInner).outerRadius(innerOuter);

    // outer (2016)
    const outer = g.append('g').attr('class','arc-outer');
    outer.selectAll('path').data(pie16)
      .enter().append('path')
      .attr('d', arcOuter)
      .attr('fill', d => d.data._color)
      .attr('stroke','#fff').attr('stroke-width',1)
      .on('mouseenter', (event,d) => onPieHover(d.data.discipline_category))
      .on('mouseleave', () => onPieLeave())
      .on('click', (event,d) => onPieClick(d.data.discipline_category));

    // inner (2011)
    const inner = g.append('g').attr('class','arc-inner');
    inner.selectAll('path').data(pie11)
      .enter().append('path')
      .attr('d', arcInner)
      .attr('fill', d => d.data._color)
      .attr('stroke','#fff').attr('stroke-width',1)
      .on('mouseenter', (event,d) => onPieHover(d.data.discipline_category))
      .on('mouseleave', () => onPieLeave())
      .on('click', (event,d) => onPieClick(d.data.discipline_category));

    // center label background & label
    const centerRadius = Math.max(innerInner - 12, 28);
    g.append('circle').attr('r', centerRadius).attr('fill','#fff');
    g.append('text').attr('text-anchor','middle').attr('dy','0.25em').attr('class','pie-center-label').text('2011–2015 / 2016–2020');
  }

  function drawLegend() {
    const container = d3.select('#disc-pie-legend');
    container.html('');
    const list = container.append('div').attr('class','pie-legend-list');
    const items = list.selectAll('.leg-item').data(state.category).enter().append('div').attr('class','leg-item').style('display','flex').style('align-items','center').style('gap','10px').style('margin','6px 0');
    items.append('div').style('width','14px').style('height','14px').style('background', d => d._color).style('border-radius','3px');
    items.append('div').text(d => d.discipline_category).style('color','#12263a');
  }

  function drawBarsForCategory(category) {
    // if category null -> aggregate all sub disciplines
    const area = d3.select('#disc-bars-area');
    area.html('');
  

    const wrap = area.append('div').attr('class','bars-wrap').style('display','flex').style('flex-direction','column').style('gap','10px');

    const titleBar = wrap.append('div').style('display','flex').style('justify-content','space-between').style('align-items','center');
    titleBar.append('div').text(category ? `学科大类：${category} — 细分学科分布` : '全部学科 — 细分学科堆叠');
    titleBar.append('div').style('font-size','13px').style('color','#6b7280').text('上: 2011–2015  下: 2016–2020');

    const chartArea = wrap.append('div').attr('class','bars-area').style('width','100%').style('overflow-x', 'auto').style('padding-bottom','8px');

    const data = (category ? state.sub.filter(d => d.discipline_category === category) : state.sub.slice()).filter(d => d.p11 + d.p16 > 0);
    if (!data.length) {
      chartArea.append('div').text('暂无细分学科数据').style('color','#9ca3af');
      return;
    }

    // compute stacked segments for two rows separately
    const total11 = d3.sum(data, d => d.p11);
    const total16 = d3.sum(data, d => d.p16);

    const rowH = 28;
    const width = chartArea.node().clientWidth || 760;
    // 给 SVG 额外留 60px 宽度放右侧数字
    const svgH = rowH * 2 + 60;
    const viewBoxWidth = Math.max(760, width); 
    const svg = chartArea.append('svg').attr('width',viewBoxWidth).attr('height',svgH).attr('viewBox', `0 0 ${viewBoxWidth} ${svgH}`);
    const innerW = viewBoxWidth - 100;
    const g = svg.append('g').attr('transform', 'translate(12,18)');

    const x11 = d3.scaleLinear().domain([0, Math.max(1,total11)]).range([0, innerW]);
    const x16 = d3.scaleLinear().domain([0, Math.max(1,total16)]).range([0, innerW]);

    // draw 2011 row
    let offset = 0;
    const row1 = g.append('g').attr('transform', `translate(0,0)`);
    data.forEach((d,i) => {
      const w = x11(d.p11);
      if (w>0) {
        row1.append('rect').attr('x', offset).attr('y', 0).attr('width', w).attr('height', rowH-2).attr('fill', d._color).attr('stroke','#fff').attr('stroke-width',1)
          .on('mouseenter', (event) => showSubTooltip(event, d, '2011–2015', total11))
          .on('mousemove', (event) => moveSubTooltip(event))
          .on('mouseleave', hideSubTooltip);
        offset += w;
      }
    });
    row1.append('text').attr('x', innerW + 8).attr('y', rowH/2 +4).text(total11).style('font-weight','600');

    // draw 2016 row
    offset = 0;
    const row2 = g.append('g').attr('transform', `translate(0,${rowH+12})`);
    data.forEach((d,i) => {
      const w = x16(d.p16);
      if (w>0) {
        row2.append('rect').attr('x', offset).attr('y', 0).attr('width', w).attr('height', rowH-2).attr('fill', d._color).attr('stroke','#fff').attr('stroke-width',1)
          .on('mouseenter', (event) => showSubTooltip(event, d, '2016–2020', total16))
          .on('mousemove', (event) => moveSubTooltip(event))
          .on('mouseleave', hideSubTooltip);
        offset += w;
      }
    });
    row2.append('text').attr('x', innerW + 8).attr('y', rowH/2 + rowH + 8).text(total16).style('font-weight','600');

    // legend under bars (scrollable if many)
    // legend under bars (scrollable if many)
    const legend = wrap.append('div')
      .attr('class','bars-legend')
      .style('display', 'flex')
      .style('flex-wrap', 'wrap')
      .style('gap', '8px')
      .style('margin-top', '8px')
      .style('max-height', '100px') // 限制图例高度
      .style('overflow-y', 'auto'); // 超出部分滚动
    data.forEach(d => {
      const it = legend.append('div').attr('class','bars-legend-item').style('display','flex').style('align-items','center').style('gap','8px').style('padding','6px 8px').style('border-radius','6px').style('background','#fff').style('box-shadow','0 1px 0 rgba(0,0,0,0.04)');
      it.append('div').style('width','12px').style('height','12px').style('background', d._color).style('border-radius','2px');
      it.append('div').text(d.discipline_cn).style('font-size','13px');
    });
  }

  // panel render
  function renderPanel(category) {
    const el = d3.select('#disc-panel-discipline');
    el.html('');

    if (!category) {
      // 全局统计视图
      if (!state.global) {
        el.append('div').text('无全局统计数据');
        return;
      }

      el.append('div')
        .attr('class','panel-row category-title')
        .text('总体数据');

      el.append('div')
        .attr('class','panel-row')
        .html(`
          <strong>2011–2015 总论文数：</strong>
          <span class="value">${state.global.total_2011_all || '-'}</span>
        `);

      el.append('div')
        .attr('class','panel-row')
        .html(`
          <strong>2016–2020 总论文数：</strong>
          <span class="value">${state.global.total_2016_all || '-'}</span>
        `);

      el.append('div')
        .attr('class','panel-row')
        .html(`
          <strong>总增长率：</strong>
          <span class="value growth">${state.global.total_growth_rate || '-'}</span>
        `);

      el.append('div')
        .attr('class','panel-section')
        .html('<strong>增长量 Top3：</strong>');
      el.append('div').text(state.global.top3_increase_category || '-');

      el.append('div')
        .attr('class','panel-section')
        .html('<strong>增长率 Top3：</strong>');
      el.append('div').text(state.global.top3_growth_category || '-');

      return;
    }

    // 单学科视图
    const catRow = state.category.find(c => c.discipline_category === category);
    if (!catRow) {
      el.append('div').text('未找到该学科大类信息');
      return;
    }

    // 学科标题
    el.append('div')
      .attr('class','panel-row category-title')
      .text(category);

    // 2011-2015 数据
    el.append('div')
      .attr('class','panel-row')
      .html(`
        <strong>2011–2015：</strong>
        <span class="value">${catRow.category_2011_total}</span>
        <span class="subtext">(${formatPct(catRow.category_2011_ratio)})</span>
      `);

    // 2016-2020 数据
    el.append('div')
      .attr('class','panel-row')
      .html(`
        <strong>2016–2020：</strong>
        <span class="value">${catRow.category_2016_total}</span>
        <span class="subtext">(${formatPct(catRow.category_2016_ratio)})</span>
      `);

    // 增长量
    el.append('div')
      .attr('class','panel-row')
      .html(`
        <strong>大类增长量：</strong>
        <span class="value">${catRow.category_increase}</span>
      `);

    // 增长率（橙色突出）
    el.append('div')
      .attr('class','panel-row')
      .html(`
        <strong>增长率：</strong>
        <span class="value growth">${catRow.category_growth_rate}</span>
      `);

    // 细分学科模块
    el.append('div')
      .attr('class','panel-section')
      .html(`<strong>增长量最大的细分学科：</strong> ${catRow.max_increase_sub || '-'}`);

    el.append('div')
      .attr('class','panel-section')
      .html(`<strong>增长率最大的细分学科：</strong> ${catRow.max_growth_sub || '-'}`);
  }

  function formatPct(v) { if (v===null || v===undefined || isNaN(+v)) return '-'; return (+v).toFixed(1) + '%'; }

  // interactions
  function onPieHover(category) {
    if (state.selectedCategory && state.selectedCategory !== category) return; // locked
    state.hoveredCategory = category;
    highlightPie(category);
    drawBarsForCategory(category);
    renderPanel(category);
  }

  function onPieLeave() {
    if (state.selectedCategory) return;
    state.hoveredCategory = null;
    unhighlightPie();
    drawBarsForCategory(null);
    renderPanel(null);
  }

  function onPieClick(category) {
    if (state.selectedCategory === category) {
      // unlock
      state.selectedCategory = null;
      state.hoveredCategory = null;
      unhighlightPie();
      drawBarsForCategory(null);
      renderPanel(null);
    } else {
      state.selectedCategory = category;
      state.hoveredCategory = category;
      highlightPie(category);
      drawBarsForCategory(category);
      renderPanel(category);
    }
  }

  function highlightPie(category) {
    const area = d3.select('#disc-pie-area svg');
    if (area.empty()) return;
    area.selectAll('path').style('opacity', d => (d.data && d.data.discipline_category === category) ? 1 : 0.35).attr('transform', function(d){
      return (d.data && d.data.discipline_category === category) ? 'scale(1.02)' : null;
    });
  }

  function unhighlightPie() {
    const area = d3.select('#disc-pie-area svg');
    if (area.empty()) return;
    area.selectAll('path').style('opacity', 1).attr('transform', null);
  }

  // simple tooltip for sub bars (shows name, count, percentage)
  const tip = d3.select('body').append('div').attr('class','disc-sub-tooltip').style('position','fixed').style('pointer-events','none').style('z-index',9999).style('display','none').style('background','rgba(15,23,42,0.9)').style('color','#fff').style('padding','8px 10px').style('border-radius','6px').style('font-size','13px').style('box-shadow','0 10px 30px rgba(2,6,23,0.28)');
  function showSubTooltip(event, d, period, total) {
    const count = period.startsWith('2011') ? d.p11 : d.p16;
    const pct = total ? (count / total * 100) : 0;
    tip.style('display','block').html(`<div style="font-weight:600;margin-bottom:6px">${d.discipline_cn}</div><div>${period}：${count.toLocaleString()}</div><div>占比：${pct.toFixed(1)}%</div>`);
    moveSubTooltip(event);
  }
  function moveSubTooltip(event){
    const pad = 12;
    const x = (event && event.pageX) ? event.pageX + pad : (d3.pointer(event)[0] + pad);
    const y = (event && event.pageY) ? event.pageY + pad : (d3.pointer(event)[1] + pad);
    tip.style('left', `${x}px`).style('top', `${y}px`);
  }
  function hideSubTooltip() { tip.style('display','none'); }

  function debounce(fn, delay){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),delay); }; }

  function injectStyles(){
    const css = `
      ${CONTAINER} { font-family: Inter, Helvetica, Arial, sans-serif; }
      .disc-title{margin:0 0 8px 0; font-weight:700; font-size:1.12rem; color:#0f172a}
      .disc-subtitle{color:#6b7280}
      /* 数据看板容器：卡片质感 */
      .disc-panel-box {
        background: #ffffff;
        padding: 24px;
        border-radius: 16px;
        border: none;
        box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        max-height: 640px;
        overflow: auto;
        font-family: "Inter", "PingFang SC", "Hiragino Sans GB", sans-serif;
      }

      /* 行间距和分组 */
      .panel-row {
        margin: 16px 0;
        line-height: 1.5;
      }

      /* 标签文字（次要信息） */
      .panel-row strong {
        display: block;
        font-size: 13px;
        color: #667085;
        font-weight: 500;
        margin-bottom: 4px;
      }

      /* 重点数字（核心数据） */
      .panel-row .value {
        font-size: 26px;
        font-weight: 700;
        color: #101828;
        display: inline-block;
      }

      /* 增长率（橙色突出） */
      .panel-row .value.growth {
        color: #F79009;
      }

      /* 次要文本（括号里的百分比） */
      .panel-row .subtext {
        font-size: 13px;
        color: #667085;
        margin-left: 8px;
      }

      /* 学科标题（顶部大标题） */
      .panel-row.category-title {
        font-size: 20px;
        font-weight: 600;
        color: #101828;
        margin-bottom: 20px;
      }

      /* 模块分隔线 */
      .panel-section {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid #EAECF0;
        font-size: 13px;
        color: #334155;
      }
      
      .panel-row{margin:8px 0; line-height:1.45}
      .panel-row strong{display:block; font-size:13px; color:#0b2540}
      .panel-section{margin-top:10px;font-size:13px;color:#334155}
      .pie-legend-list{max-height:380px;overflow:auto;padding-right:8px}
      .disc-sub-tooltip{box-shadow:0 12px 24px rgba(2,6,23,0.08)}
      /* small improvements for bars legend */
      .bars-wrap .bars-area { background: transparent; }
    `;
    d3.select('head').append('style').text(css);
  }

})();
