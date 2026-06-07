
(function () {
  'use strict';

  const MODULE_ID = 'ksj-trend-dashboard';
  const TARGET_ID = 'trend-chart';

  const DATA_PATHS = {
    area: ['area.csv', './area.csv', 'static/data/area.csv', './static/data/area.csv'],
    country: ['country.csv', './country.csv', 'static/data/country.csv', './static/data/country.csv']
  };

  const CEE_COUNTRIES = [
    { country: 'POLAND', cn: '波兰', iso3: 'POL' },
    { country: 'CZECH REPUBLIC', cn: '捷克', iso3: 'CZE' },
    { country: 'GREECE', cn: '希腊', iso3: 'GRC' },
    { country: 'HUNGARY', cn: '匈牙利', iso3: 'HUN' },
    { country: 'ROMANIA', cn: '罗马尼亚', iso3: 'ROU' },
    { country: 'SERBIA', cn: '塞尔维亚', iso3: 'SRB' },
    { country: 'SLOVENIA', cn: '斯洛文尼亚', iso3: 'SVN' },
    { country: 'SLOVAKIA', cn: '斯洛伐克', iso3: 'SVK' },
    { country: 'CROATIA', cn: '克罗地亚', iso3: 'HRV' },
    { country: 'BULGARIA', cn: '保加利亚', iso3: 'BGR' },
    { country: 'ESTONIA', cn: '爱沙尼亚', iso3: 'EST' },
    { country: 'LATVIA', cn: '拉脱维亚', iso3: 'LVA' },
    { country: 'MACEDONIA', cn: '马其顿', iso3: 'MKD' },
    { country: 'MONTENEGRO', cn: '黑山', iso3: 'MNE' },
    { country: 'BOSNIA & HERZEGOVINA', cn: '波黑', iso3: 'BIH' },
    { country: 'ALBANIA', cn: '阿尔巴尼亚', iso3: 'ALB' },
    { country: 'KOSOVO', cn: '科索沃', iso3: 'XKX' }
  ];

  const COUNTRY_META = new Map(CEE_COUNTRIES.map(d => [d.country, d]));
  const COUNTRY_CN_TO_META = new Map(CEE_COUNTRIES.map(d => [d.cn, d]));

  const fmt = {
    int: d3.format(','),
    pct: d3.format('.2f'),
    pct1: d3.format('.1f'),
    pct2: d3.format('.2f'),
    growth: d3.format('+.0%'),
    signedInt: d3.format('+,.0f')
  };

  const state = {
    root: null,
    tooltip: null,
    data: {
      yearly: [],
      countries: [],
      stages: []
    },
    view: {
      sortBy: 'p2',
      stage: 'p2',
      highlightMode: 'all',
      selectedCountry: null,
      hoveredCountry: null
    },
    resizeTimer: null,
    ro: null
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const target = document.getElementById(TARGET_ID);
    if (!target) return;
    state.root = d3.select(target);
    injectStyles();
    injectSkeleton();
    state.tooltip = d3.select('body').append('div').attr('class', 'ksj-tooltip');

    try {
      const [areaRows, countryRows] = await Promise.all([
        loadCsvFromCandidates(DATA_PATHS.area),
        loadCsvFromCandidates(DATA_PATHS.country)
      ]);
      prepareData(areaRows, countryRows);
      renderAll();
      setupResize();
    } catch (error) {
      showLoadError(error);
    }
  }

  function injectSkeleton() {
    state.root.html(`
      <div id="${MODULE_ID}" class="ksj-wrap">
        <nav class="level mb-5 ksj-zyl-stats" id="ksj-hero-metrics"></nav>

        <div class="box mb-5 ksj-zyl-box">
          <div class="level mb-4">
            <div class="level-left">
              <div class="content mb-0">
                <h3 class="title is-4 mb-1">整体趋势：年度合作规模与占比</h3>
                <p class="subtitle is-6 has-text-grey mt-2">
                  展示2011—2020年中国—中东欧合作论文量及年度占比变化。
                </p>
              </div>
            </div>
          </div>

          <div class="columns is-desktop ksj-macro-two-col">
            <div class="column is-four-fifths">
              <div class="ksj-chart-surface macro-large" id="ksj-macro-chart"></div>
            </div>
            <div class="column">
              <div class="box ksj-zyl-side-card" id="ksj-macro-card">
                <p class="heading mb-2">年度指标</p>
                <p class="has-text-grey is-size-7">悬停年份可查看年度合作量、占比水平和较基期变化。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="box mb-5 ksj-zyl-box">
          <div class="content mb-3">
            <h3 class="title is-4 mb-1">国家结构：阶段排名与新增合作量</h3>
            <p class="subtitle is-6 has-text-grey mt-2">
              对比2011—2015与2016—2020两个阶段的国家排名、排名变化和新增合作量。
            </p>
          </div>
          <div class="ksj-control-row ksj-rank-control-row">
            <div class="ksj-control-title">国家类型筛选</div>
            <div class="buttons has-addons mb-4 ksj-toolbar ksj-toolbar-under" id="ksj-rank-toolbar">
              <button class="button is-small ksj-pill is-light" data-focus="core" title="后期排名前3，或后期合作份额较高">核心</button>
              <button class="button is-small ksj-pill is-light" data-focus="chaser" title="增长率较高且新增量为正">追赶</button>
              <button class="button is-small ksj-pill is-light" data-focus="tail" title="合作规模或增量较小">长尾</button>
              <button class="button is-small ksj-pill is-link active" data-focus="all">全部</button>
            </div>
          </div>

          <div class="columns is-desktop ksj-rank-two-col">
            <div class="column is-three-quarters">
              <div class="ksj-chart-surface tall" id="ksj-rank-flow"></div>
            </div>
            <div class="column">
              <div class="box ksj-zyl-side-card" id="ksj-selected-card">
                <p class="heading mb-2">国家结构</p>
                <p class="has-text-grey is-size-7">悬停或点击国家可查看两阶段合作量、排名变化、增长率和结构类型。</p>
              </div>
            </div>
          </div>
        </div>

        <div class="box mb-5 ksj-zyl-box">
          <div class="content mb-3">
            <h3 class="title is-4 mb-1">国家均衡：国家份额与集中度</h3>
            <p class="subtitle is-6 has-text-grey mt-2">
              气泡表示各国阶段合作量，Lorenz曲线用于判断国家间分布是否集中。
            </p>
          </div>
          <div class="ksj-control-row">
            <div class="ksj-control-title">阶段与范围筛选</div>
            <div class="buttons has-addons mb-0 ksj-toolbar" id="ksj-balance-toolbar">
              <button class="button is-small ksj-pill is-link active" data-stage="p2">2016–2020</button>
              <button class="button is-small ksj-pill is-light" data-stage="p1">2011–2015</button>
              <button class="button is-small ksj-pill is-light" data-focus="top3">Top3</button>
              <button class="button is-small ksj-pill is-light" data-focus="top5">Top5</button>
              <button class="button is-small ksj-pill is-light active" data-focus="all">全部</button>
            </div>
          </div>

          <div class="notification is-light ksj-link-bridge-card" id="ksj-balance-link-card">
            <p class="heading mb-2">结构概览</p>
            <p class="has-text-grey is-size-7 mb-0">
              选择阶段或高亮范围后，图3与图4同步更新，用于观察TOP3/TOP5合作国家的集中度变化。
            </p>
          </div>

          <div class="columns is-desktop ksj-balance-pair">
            <div class="column">
              <div class="ksj-chart-surface balance-large" id="ksj-bubble-map"></div>
            </div>
            <div class="column">
              <div class="ksj-chart-surface lorenz-large compact" id="ksj-lorenz-chart"></div>
            </div>
          </div>


          <div class="notification is-info is-light mt-3" id="ksj-conclusion"></div>
        </div>
      </div>
    `);
  }


  function injectStyles() {
    if (document.getElementById('ksj-trend-style')) return;
    const css = `
      #trend-chart,
      #${MODULE_ID} {
        width: 100%;
        position: relative;
        font-family: Inter, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        color: #172033;
      }

      #${MODULE_ID} * {
        box-sizing: border-box;
      }

      .ksj-wrap {
        --ink: #172033;
        --muted: #6b778d;
        --soft: #eef5fb;
        --line: #d9e4ef;
        --blue: #5b8def;
        --blue-dark: #315cba;
        --orange: #f2a65a;
        --orange-dark: #d97706;
        --green: #6abf8f;
        --red: #e76f6f;
        --purple: #8c7ae6;
        --paper: rgba(255, 255, 255, 0.92);
        --shadow: 0 18px 45px rgba(31, 47, 70, 0.12);
        width: 100%;
      }

      .ksj-hero-card {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.85fr);
        gap: 20px;
        padding: 26px;
        margin: 0 0 22px;
        border: 1px solid rgba(91, 141, 239, 0.18);
        border-radius: 24px;
        background:
          radial-gradient(circle at 10% 10%, rgba(91,141,239,.16), transparent 28%),
          radial-gradient(circle at 95% 5%, rgba(242,166,90,.16), transparent 25%),
          linear-gradient(135deg, #f8fbff 0%, #ffffff 58%, #fffaf4 100%);
        box-shadow: var(--shadow);
      }

      .ksj-eyebrow {
        letter-spacing: .08em;
        text-transform: uppercase;
        color: var(--blue-dark);
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .ksj-hero-card h2 {
        font-size: clamp(1.8rem, 2.6vw, 2.45rem);
        line-height: 1.12;
        margin: 0 0 12px;
        color: var(--ink);
        font-weight: 850;
      }

      .ksj-hero-card p,
      .ksj-viz-card p,
      .ksj-panel-copy,
      .ksj-definition-box p {
        color: var(--muted);
        line-height: 1.72;
      }

      .ksj-hero-metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .ksj-metric {
        min-height: 102px;
        padding: 15px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.78);
        border: 1px solid rgba(217, 228, 239, .9);
        box-shadow: 0 8px 20px rgba(31, 47, 70, .07);
      }

      .ksj-metric-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 750;
        margin-bottom: 7px;
      }

      .ksj-metric-value {
        font-size: 1.5rem;
        font-weight: 850;
        color: var(--ink);
      }

      .ksj-metric-foot {
        margin-top: 5px;
        font-size: 12px;
        color: var(--muted);
      }

      .ksj-story-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 22px;
        align-items: start;
      }

      .ksj-story-grid.no-sidebar {
        grid-template-columns: 1fr;
      }

      .ksj-main-panel.full-width {
        width: 100%;
      }

      .ksj-insight-panel {
        position: sticky;
        top: 18px;
        padding: 18px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, .92);
        box-shadow: 0 14px 32px rgba(31, 47, 70, .09);
      }

      .ksj-panel-title {
        font-size: 1.05rem;
        color: var(--ink);
        font-weight: 850;
        margin-bottom: 9px;
      }

      .ksj-definition-box,
      .ksj-selected-card {
        margin-top: 14px;
        padding: 14px;
        border: 1px solid rgba(217,228,239,.95);
        border-radius: 16px;
        background: linear-gradient(180deg, #fbfdff 0%, #fff 100%);
      }

      .ksj-mini-title {
        font-size: 13px;
        color: var(--ink);
        font-weight: 850;
        margin-bottom: 8px;
      }

      .ksj-muted {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.6;
      }

      .ksj-country-name {
        font-size: 1.25rem;
        font-weight: 900;
        color: var(--ink);
        margin-bottom: 4px;
      }

      .ksj-country-type {
        display: inline-flex;
        padding: 4px 9px;
        border-radius: 999px;
        background: #eef5ff;
        color: var(--blue-dark);
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 8px;
      }

      .ksj-country-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 10px;
      }

      .ksj-country-stat {
        padding: 9px;
        border-radius: 13px;
        background: #f7fafc;
        border: 1px solid rgba(217,228,239,.8);
      }

      .ksj-country-stat span {
        display: block;
        color: var(--muted);
        font-size: 11px;
        margin-bottom: 2px;
      }

      .ksj-country-stat b {
        font-size: 14px;
        color: var(--ink);
      }

      .ksj-main-panel {
        min-width: 0;
      }

      .ksj-viz-card {
        margin-bottom: 24px;
        padding: 26px;
        border-radius: 24px;
        border: 1px solid rgba(217, 228, 239, .95);
        background: var(--paper);
        box-shadow: 0 16px 38px rgba(31, 47, 70, .08);
      }

      .ksj-card-header {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
        gap: 18px;
        align-items: start;
        margin-bottom: 12px;
      }

      .ksj-card-header.compact {
        display: block;
      }

      .ksj-question-tag {
        display: inline-flex;
        align-items: center;
        padding: 5px 10px;
        border-radius: 999px;
        background: #eef5ff;
        color: var(--blue-dark);
        font-size: 12px;
        font-weight: 850;
        margin-bottom: 8px;
      }

      .ksj-viz-card h3 {
        margin: 0 0 6px;
        color: var(--ink);
        font-size: clamp(1.2rem, 1.8vw, 1.55rem);
        font-weight: 850;
      }

      .ksj-viz-card p {
        margin: 0;
        font-size: 14px;
      }

      .ksj-chart-note {
        padding: 13px 14px;
        border-left: 4px solid var(--orange);
        border-radius: 14px;
        background: #fff8ec;
        color: #6f4b1a;
        font-size: 13px;
        line-height: 1.55;
      }

      .ksj-chart-surface {
        position: relative;
        width: 100%;
        min-height: 340px;
        border-radius: 18px;
        background:
          linear-gradient(180deg, rgba(248,250,252,.92), rgba(255,255,255,.98));
        border: 1px solid rgba(217, 228, 239, .82);
        overflow: hidden;
      }

      .ksj-chart-surface.tall {
        min-height: 780px;
      }

      .ksj-chart-surface.balance-large {
        min-height: 520px;
      }

      .ksj-chart-surface svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .ksj-heat-strip {
        margin-top: 12px;
      }

      .ksj-heat-grid {
        display: grid;
        grid-template-columns: repeat(10, minmax(0, 1fr));
        gap: 6px;
      }

      .ksj-heat-cell {
        position: relative;
        padding: 9px 8px;
        border-radius: 12px;
        border: 1px solid rgba(217,228,239,.8);
        min-height: 60px;
        cursor: pointer;
        transition: transform .18s ease, box-shadow .18s ease;
      }

      .ksj-heat-cell:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 22px rgba(31,47,70,.12);
      }

      .ksj-heat-year {
        font-size: 11px;
        color: rgba(23,32,51,.68);
        font-weight: 800;
      }

      .ksj-heat-value {
        margin-top: 3px;
        font-size: 15px;
        color: var(--ink);
        font-weight: 900;
      }

      .ksj-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        padding: 12px;
        margin: 12px 0;
        border-radius: 16px;
        background: #f6f9fd;
        border: 1px solid rgba(217,228,239,.9);
      }

      .ksj-toolbar-label {
        font-size: 13px;
        color: var(--muted);
        font-weight: 800;
        margin-right: 2px;
      }

      .ksj-toolbar-spacer {
        flex: 1 1 18px;
      }

      .ksj-pill {
        appearance: none;
        border: 1px solid rgba(91,141,239,.28);
        background: #fff;
        color: #315cba;
        font-weight: 800;
        font-size: 13px;
        padding: 8px 12px;
        border-radius: 999px;
        cursor: pointer;
        transition: transform .18s ease, background .18s ease, box-shadow .18s ease, color .18s ease;
      }

      .ksj-pill:hover {
        transform: translateY(-1px);
        box-shadow: 0 8px 16px rgba(31,47,70,.1);
      }

      .ksj-pill.active {
        background: var(--blue);
        color: white;
        box-shadow: 0 10px 20px rgba(91,141,239,.25);
      }

      .ksj-pill.ghost {
        color: #52606f;
        border-color: rgba(107,119,141,.28);
      }

      .ksj-pill.ghost.active {
        background: #172033;
        color: #fff;
      }

      .ksj-balance-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
      }

      .ksj-balance-grid.wide {
        grid-template-columns: 1fr;
      }

      .ksj-conclusion {
        margin-top: 12px;
        padding: 14px 16px;
        border-radius: 18px;
        background: linear-gradient(135deg, #f2f8ff, #fff8ee);
        border: 1px solid rgba(217, 228, 239, .95);
        color: var(--ink);
        line-height: 1.65;
      }

      .ksj-conclusion b {
        color: var(--blue-dark);
      }


      .ksj-conclusion-line {
        line-height: 1.75;
      }

      .ksj-axis text {
        fill: #738097;
        font-size: 11px;
      }

      .ksj-axis path,
      .ksj-axis line {
        stroke: rgba(115,128,151,.22);
      }

      .ksj-grid line {
        stroke: rgba(115,128,151,.16);
        stroke-dasharray: 3 5;
      }

      .ksj-grid path {
        display: none;
      }

      .ksj-tooltip {
        position: fixed;
        pointer-events: none;
        z-index: 99999;
        opacity: 0;
        transform: translate(-50%, calc(-100% - 14px));
        max-width: 310px;
        padding: 12px 13px;
        border-radius: 14px;
        background: rgba(23, 32, 51, .95);
        color: #f8fafc;
        box-shadow: 0 18px 42px rgba(2,6,23,.26);
        font-size: 13px;
        line-height: 1.55;
        transition: opacity .12s ease;
      }

      .ksj-tooltip-title {
        font-size: 14px;
        font-weight: 900;
        margin-bottom: 5px;
      }

      .ksj-tooltip-row {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        white-space: nowrap;
      }

      .ksj-tooltip-row span:first-child {
        color: #cbd5e1;
      }

      .ksj-ribbon,
      .ksj-bubble,
      .ksj-country-node,
      .ksj-radial-arc {
        cursor: pointer;
        transition: opacity .18s ease, filter .18s ease, stroke-width .18s ease;
      }

      .ksj-dim {
        opacity: .28 !important;
      }

      .ksj-focus-hit {
        opacity: 1 !important;
      }

      .ksj-bubble-node.ksj-focus-hit .ksj-bubble {
        stroke: #f59e0b;
        stroke-width: 4.4px;
        filter: drop-shadow(0 10px 18px rgba(245,158,11,.28));
      }

      .ksj-ribbon.ksj-focus-hit {
        stroke-opacity: 1 !important;
        filter: drop-shadow(0 6px 14px rgba(37,99,235,.18));
      }

      .ksj-country-node.ksj-focus-hit circle,
      .ksj-growth-badge.ksj-focus-hit rect,
      .ksj-lorenz-country-dot.ksj-focus-hit,
      .ksj-lorenz-segment.ksj-focus-hit {
        opacity: 1 !important;
        stroke: #f59e0b !important;
        stroke-width: 3px !important;
      }

      .ksj-small-label.ksj-focus-hit,
      .ksj-strip-label.ksj-focus-hit {
        fill: #172033 !important;
        font-weight: 950 !important;
      }

      .ksj-emphasis {
        opacity: 1 !important;
      }

      .ksj-bubble-node.ksj-emphasis .ksj-bubble {
        stroke: #f59e0b;
        stroke-width: 5px;
        filter: drop-shadow(0 0 0 rgba(245,158,11,.0)) drop-shadow(0 12px 20px rgba(245,158,11,.28));
      }

      .ksj-bubble-node.ksj-dim .ksj-bubble,
      .ksj-lorenz-country-dot.ksj-dim,
      .ksj-lorenz-segment.ksj-dim {
        opacity: .18 !important;
      }

      .ksj-lorenz-country-dot.ksj-emphasis {
        stroke: #f59e0b;
        stroke-width: 3.6;
        filter: drop-shadow(0 8px 18px rgba(245,158,11,.35));
      }

      .ksj-lorenz-segment.ksj-emphasis {
        stroke: #172033;
        stroke-width: 2.6;
      }

      .ksj-bubble-node.ksj-emphasis .ksj-label,
      .ksj-bubble-node.ksj-emphasis .ksj-small-label,
      .ksj-strip-label.ksj-emphasis {
        fill: #172033;
        font-weight: 950;
      }

      .ksj-label {
        pointer-events: none;
        fill: #172033;
        font-weight: 850;
      }

      .ksj-small-label {
        pointer-events: none;
        fill: #334155;
        font-size: 12.5px;
      }

      .ksj-empty {
        padding: 24px;
        color: #64748b;
      }



      .ksj-explain-strip {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }

      .ksj-explain-chip {
        padding: 10px 12px;
        border-radius: 14px;
        background: #f8fbff;
        border: 1px solid rgba(217,228,239,.9);
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .ksj-explain-chip b {
        display: block;
        color: var(--ink);
        font-size: 13px;
        margin-bottom: 2px;
      }

      .ksj-growth-bar-bg {
        stroke: rgba(203, 213, 225, .7);
        stroke-width: 8;
        stroke-linecap: round;
      }

      .ksj-growth-bar {
        stroke-width: 8;
        stroke-linecap: round;
      }

      .ksj-bubble-node:hover .ksj-bubble,
      .ksj-country-node:hover circle {
        stroke-width: 3.6;
        fill-opacity: .96;
      }

      .ksj-emphasis {
        opacity: 1 !important;
      }



      .ksj-macro-layout,
      .ksj-rank-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 310px;
        gap: 16px;
        align-items: stretch;
      }

      .ksj-balance-stack {
        display: grid;
        gap: 16px;
      }

      .ksj-balance-pair {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 16px;
        align-items: stretch;
      }

      .ksj-balance-card-row {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }

      .ksj-link-bridge-card {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid rgba(217,228,239,.95);
        background: linear-gradient(135deg, #f8fbff 0%, #fffaf2 100%);
        box-shadow: 0 8px 20px rgba(31,47,70,.06);
      }

      .ksj-link-bridge-card 
      .ksj-link-bridge-card {
        border-left: 4px solid #f59e0b;
        background: #fffaf0;
        border: 1px solid #fde7c2;
        box-shadow: none;
      }

      .ksj-link-bullets {
        margin-top: 12px;
        background: #ffffff;
      }

      .ksj-link-grid {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .ksj-link-mini-stat {
        padding: 10px 12px;
        border-radius: 14px;
        background: rgba(255,255,255,.88);
        border: 1px solid rgba(217,228,239,.85);
      }

      .ksj-link-mini-stat span {
        display: block;
        font-size: 11px;
        color: var(--muted);
        font-weight: 800;
        margin-bottom: 4px;
      }

      .ksj-link-mini-stat b {
        display: block;
        font-size: 14px;
        color: var(--ink);
        font-weight: 900;
      }

      .ksj-chart-surface.macro-large {
        min-height: 620px;
      }

      .ksj-chart-surface.balance-large {
        min-height: 680px;
      }

      .ksj-chart-surface.lorenz-large {
        min-height: 680px;
      }

      .ksj-chart-info-card,
      .ksj-selected-card,
      .ksj-side-selected {
        margin-top: 0;
        padding: 15px;
        min-height: 250px;
        align-self: stretch;
        border-radius: 18px;
        border: 1px solid rgba(217,228,239,.95);
        background:
          radial-gradient(circle at 85% 0%, rgba(91,141,239,.14), transparent 34%),
          linear-gradient(180deg, #fbfdff 0%, #ffffff 100%);
        box-shadow: 0 10px 24px rgba(31,47,70,.07);
      }

      .ksj-side-selected {
        position: sticky;
        top: 14px;
        height: fit-content;
      }

      .ksj-card-big-value {
        font-size: 2.05rem;
        color: var(--blue-dark);
        font-weight: 950;
        line-height: 1.1;
        margin: 8px 0 3px;
      }

      .ksj-card-formula {
        margin-top: 12px;
        padding: 11px 12px;
        border-radius: 14px;
        background: #eef6ff;
        border: 1px solid rgba(91,141,239,.18);
        color: #315cba;
        font-size: 12px;
        line-height: 1.55;
        font-weight: 760;
      }


      .ksj-bullet-panel {
        margin-top: 14px;
        padding: 14px 16px;
        border-radius: 14px;
        background: #f8fbff;
        border: 1px solid rgba(91,141,239,.16);
      }

      .ksj-bullet-title {
        font-size: 12px;
        font-weight: 820;
        color: #315cba;
        margin-bottom: 8px;
      }

      .ksj-bullet-list {
        margin: 0;
        padding-left: 18px;
        color: #52627a;
        font-size: 12.5px;
        line-height: 1.8;
      }

      .ksj-bullet-list li + li {
        margin-top: 6px;
      }


      .ksj-explain-box {
        margin-top: 12px;
        padding: 12px 14px;
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #475569;
        font-size: 12px;
        line-height: 1.65;
      }

      .ksj-explain-title {
        margin-bottom: 6px;
        color: #1e293b;
        font-size: 12px;
        font-weight: 750;
      }

      .ksj-explain-box p {
        margin: 0 0 6px 0;
      }

      .ksj-explain-box p:last-child {
        margin-bottom: 0;
      }

      .ksj-formula-steps {
        margin-top: 12px;
        display: grid;
        gap: 8px;
      }

      .ksj-formula-row {
        padding: 10px 12px;
        border-radius: 8px;
        background: #fff7ed;
        border: 1px solid #fed7aa;
      }

      .ksj-formula-row span {
        display: block;
        margin-bottom: 4px;
        color: #9a3412;
        font-size: 11px;
        font-weight: 700;
      }

      .ksj-formula-row b {
        display: block;
        color: #1e293b;
        font-size: 12px;
        line-height: 1.55;
      }

      .ksj-mini-surface {
        position: relative;
        min-height: 430px;
        border-radius: 18px;
        background: linear-gradient(180deg, rgba(248,250,252,.94), rgba(255,255,255,.98));
        border: 1px solid rgba(217, 228, 239, .86);
        overflow: hidden;
      }

      .ksj-mini-surface svg {
        display: block;
        width: 100%;
        height: auto;
      }

      .ksj-mini-caption {
        margin-top: 9px;
        padding: 9px 11px;
        border-radius: 13px;
        background: #f4f8ff;
        border: 1px solid rgba(217,228,239,.85);
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .ksj-growth-side-panel .panel-bg {
        fill: rgba(248, 251, 255, .92);
        stroke: rgba(217, 228, 239, .9);
      }

      .ksj-growth-column rect {
        transition: opacity .18s ease, y .18s ease, height .18s ease;
      }

      .ksj-lorenz-copy {
        font-size: 11.5px;
        fill: #667085;
        font-weight: 700;
      }



      .ksj-inline-guide {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 12px;
      }

      .ksj-guide-card,
      .ksj-lorenz-note-card {
        padding: 11px 13px;
        border-radius: 15px;
        border: 1px solid rgba(217,228,239,.92);
        background: #f7fbff;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.55;
      }

      .ksj-guide-card b,
      .ksj-lorenz-note-card b {
        display: block;
        color: var(--ink);
        font-size: 13px;
        margin-bottom: 2px;
      }

      .ksj-wide-selected {
        margin-top: 12px;
        display: block;
      }

      .ksj-growth-micro-bg {
        fill: #e8f1ff;
      }

      .ksj-growth-micro-fill {
        fill: url(#ksj-growth-micro-gradient);
      }

      .ksj-formula-box {
        fill: #f7fbff;
        stroke: rgba(217,228,239,.95);
      }

      .ksj-why-index {
        font-size: 11.5px;
        fill: #667085;
        font-weight: 750;
      }

      .ksj-lorenz-ribbon {
        fill: rgba(91, 141, 239, .14);
      }

      .ksj-lorenz-country-dot {
        cursor: pointer;
        transition: r .15s ease, opacity .15s ease;
      }

      .ksj-lorenz-country-dot:hover {
        r: 7;
      }

      .ksj-context-bar,
      .ksj-share-point,
      .ksj-lorenz-segment,
      .ksj-year-connector {
        cursor: pointer;
        transition: opacity .16s ease, stroke-width .16s ease, transform .16s ease;
      }


      .ksj-heat-cell.active {
        outline: 3px solid rgba(36,111,206,.35);
        box-shadow: 0 12px 28px rgba(36,111,206,.20);
        transform: translateY(-2px);
      }

      .ksj-growth-badge {
        cursor: pointer;
      }

      .ksj-growth-badge rect {
        fill: #eef6ff;
        stroke: rgba(91,141,239,.28);
        transition: fill .16s ease, stroke .16s ease;
      }

      .ksj-growth-badge:hover rect,
      .ksj-growth-badge.active rect {
        fill: #dbeafe;
        stroke: rgba(49,92,186,.48);
      }

      .ksj-rank-footer {
        margin-top: 10px;
        padding: 12px 14px;
        border-radius: 15px;
        border: 1px solid rgba(217,228,239,.92);
        background: #f7fbff;
        color: var(--muted);
        font-size: 13.5px;
        line-height: 1.7;
      }

      .ksj-rank-footer b {
        color: var(--ink);
      }

      .ksj-context-bar:hover,
      .ksj-lorenz-segment:hover {
        opacity: 1 !important;
      }

      .ksj-rank-growth-text {
        font-size: 13.5px;
        font-weight: 950;
        fill: #1f4f9a;
        letter-spacing: .1px;
      }

      .ksj-rank-main-title {
        font-size: 17px;
        font-weight: 950;
        fill: #172033;
      }

      .ksj-rank-subtitle {
        font-size: 13px;
        font-weight: 780;
        fill: #52606f;
      }

      .ksj-bubble-node.ksj-emphasis .ksj-bubble,
      .ksj-country-node.ksj-emphasis circle {
        stroke: #172033 !important;
        stroke-width: 4px !important;
        filter: drop-shadow(0 8px 14px rgba(49,92,186,.20));
      }

      .ksj-ribbon.ksj-emphasis {
        stroke-opacity: 1 !important;
        filter: drop-shadow(0 8px 12px rgba(49,92,186,.20));
      }

      .ksj-lorenz-country-dot.ksj-emphasis {
        stroke: #172033 !important;
        stroke-width: 4px !important;
        filter: drop-shadow(0 5px 10px rgba(49,92,186,.24));
      }

      .ksj-lorenz-segment.ksj-emphasis {
        stroke: #172033 !important;
        stroke-width: 2.6px !important;
      }

      .ksj-growth-badge.ksj-emphasis rect {
        fill: #dbeafe !important;
        stroke: rgba(49,92,186,.60) !important;
      }

      .ksj-lorenz-focus-guide line {
        stroke: rgba(35,110,208,.42);
        stroke-dasharray: 4 5;
        stroke-width: 1.6;
        pointer-events: none;
      }

      .ksj-lorenz-focus-guide circle {
        fill: none;
        stroke: #236ed0;
        stroke-width: 3;
        pointer-events: none;
      }

      .ksj-lorenz-focus-guide text {
        fill: #172033;
        font-size: 12.5px;
        font-weight: 900;
        pointer-events: none;
      }


      .ksj-share-callout {
        fill: #f6fbff;
        stroke: rgba(91,141,239,.22);
      }


      .ksj-control-row {
        margin: 10px 0 18px;
      }

      .ksj-control-title {
        margin-bottom: 8px;
        color: #475569;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .02em;
      }

      .ksj-card-lead {
        margin: 8px 0 12px;
      }

      .ksj-clean-grid .ksj-country-stat {
        min-height: 68px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      .ksj-clean-grid .ksj-country-stat span {
        margin-bottom: 5px;
      }



      /* v10: make hover/selection and explanation cards more visible */
      .ksj-rank-layout {
        grid-template-columns: minmax(0, 1fr) 380px;
        gap: 22px;
      }

      #ksj-selected-card {
        min-height: 560px;
        padding: 20px;
        border-radius: 22px;
        background:
          radial-gradient(circle at 88% 0%, rgba(255, 179, 102, .16), transparent 34%),
          linear-gradient(180deg, #fbfdff 0%, #ffffff 100%);
      }

      #ksj-selected-card .ksj-mini-title {
        font-size: 14.5px;
      }

      #ksj-selected-card .ksj-country-name {
        font-size: 1.55rem;
      }

      #ksj-selected-card .ksj-muted {
        font-size: 14px;
        line-height: 1.75;
      }

      #ksj-selected-card .ksj-country-stat {
        padding: 12px;
      }

      #ksj-selected-card .ksj-country-stat span {
        font-size: 13px;
      }

      #ksj-selected-card .ksj-country-stat b {
        font-size: 18px;
      }

      #ksj-selected-card .ksj-card-formula {
        font-size: 13px;
        line-height: 1.65;
      }

      .ksj-ribbon {
        mix-blend-mode: multiply;
      }

      .ksj-ribbon.ksj-emphasis {
        stroke: #f59e0b !important;
        stroke-opacity: 1 !important;
        filter: drop-shadow(0 8px 16px rgba(245, 158, 11, .24));
      }

      .ksj-growth-badge.ksj-emphasis rect {
        fill: #fff7ed !important;
        stroke: rgba(245, 158, 11, .62) !important;
      }

      .ksj-growth-badge.ksj-emphasis text {
        fill: #b45309 !important;
      }

      .ksj-share-point.active-year {
        stroke: #f59e0b !important;
        fill: #fff7ed !important;
        filter: drop-shadow(0 10px 18px rgba(245,158,11,.30));
      }

      @media screen and (max-width: 980px) {
        .ksj-hero-card,
        .ksj-story-grid,
        .ksj-balance-grid,
        .ksj-card-header,
        .ksj-explain-strip,
        .ksj-macro-layout,
        .ksj-rank-layout,
        .ksj-balance-layout,
        .ksj-lorenz-layout {
          grid-template-columns: 1fr;
        }
        .ksj-insight-panel {
          position: relative;
          top: auto;
        }
        .ksj-hero-metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media screen and (max-width: 620px) {
        .ksj-hero-card,
        .ksj-viz-card,
        .ksj-insight-panel {
          padding: 16px;
          border-radius: 18px;
        }
        .ksj-hero-metrics,
        .ksj-heat-grid {
          grid-template-columns: 1fr;
        }
        .ksj-toolbar-spacer {
          display: none;
        }
        .ksj-pill {
          flex: 1 1 auto;
        }
      }

      /* ZYL unified academic style override */
      #${MODULE_ID} .box {
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        border: 1px solid #ededed;
      }

      #${MODULE_ID} .title {
        color: #363636;
        font-weight: 600;
      }

      #${MODULE_ID} .subtitle {
        line-height: 1.6;
      }

      .ksj-zyl-intro {
        border-left: 4px solid #d97706;
        padding: 1.25rem;
      }

      .ksj-zyl-box {
        padding: 1.5rem;
      }

      .ksj-zyl-stats {
        background: #f8fafc;
        padding: 16px;
        border-radius: 8px;
        border-left: 4px solid #2563eb;
      }

      .ksj-hero-metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0;
      }

      .ksj-metric {
        min-height: auto;
        padding: 0 18px;
        border: 0;
        border-right: 1px solid #e2e8f0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        text-align: center;
      }

      .ksj-metric:last-child {
        border-right: 0;
      }

      .ksj-metric-label {
        color: #64748b;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: .02em;
      }

      .ksj-metric-value {
        color: #1e293b;
        font-size: 1.45rem;
        font-weight: 700;
      }

      .ksj-metric-foot {
        color: #94a3b8;
        font-size: 11px;
      }

      .ksj-chart-surface {
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        background: #ffffff;
        box-shadow: none;
      }

      .ksj-zyl-side-card,
      .ksj-selected-card,
      .ksj-chart-info-card {
        border-radius: 8px !important;
        border: 1px solid #ededed !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
        background: #ffffff !important;
        min-height: auto !important;
      }

      .ksj-toolbar {
        padding: 0;
        margin: 0;
        border: 0;
        background: transparent;
        border-radius: 0;
        gap: 0;
      }

      .ksj-pill {
        border-radius: 2px !important;
        font-weight: 600 !important;
        box-shadow: none !important;
        transform: none !important;
      }

      .ksj-pill:hover {
        transform: none !important;
        box-shadow: none !important;
      }

      .ksj-pill.active {
        box-shadow: none !important;
      }

      .ksj-card-big-value {
        color: #2563eb;
        font-size: 1.8rem;
      }

      .ksj-card-formula {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #475569;
        border-radius: 6px;
      }

      .ksj-country-stat {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
      }

      .ksj-link-bridge-card {
        border-left: 4px solid #d97706;
        border-radius: 8px;
      }

      .ksj-link-bridge-card .ksj-link-grid {
        margin-top: 10px;
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
      }

      .ksj-link-mini-stat {
        padding: 10px 12px;
        border-radius: 6px;
        background: #fff;
        border: 1px solid #e2e8f0;
      }

      .ksj-link-mini-stat span {
        display: block;
        font-size: 11px;
        color: #64748b;
        margin-bottom: 3px;
      }

      .ksj-link-mini-stat b {
        display: block;
        color: #1e293b;
        font-size: 13px;
      }

      .ksj-bubble-node.ksj-emphasis .ksj-bubble,
      .ksj-lorenz-country-dot.ksj-emphasis {
        stroke: #d97706 !important;
        stroke-width: 4px !important;
        filter: drop-shadow(0 4px 10px rgba(217,119,6,.35));
      }

      .ksj-bubble-node.ksj-dim .ksj-bubble,
      .ksj-lorenz-country-dot.ksj-dim,
      .ksj-lorenz-segment.ksj-dim {
        opacity: .16 !important;
      }

      .ksj-chart-surface.balance-large,
      .ksj-chart-surface.lorenz-large {
        min-height: 620px;
      }

      @media screen and (max-width: 980px) {
        .ksj-hero-metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .ksj-metric {
          border-right: 0;
          border-bottom: 1px solid #e2e8f0;
          padding: 10px;
        }
        .ksj-link-bridge-card .ksj-link-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }


      .ksj-context-note {
        margin-top: 12px;
        border-left: 4px solid #94a3b8;
        border-radius: 8px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        border-right: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
      }

      #ksj-rank-toolbar.ksj-toolbar-under,
      #ksj-balance-toolbar {
        justify-content: flex-start;
        gap: 8px;
      }

      #ksj-rank-toolbar.ksj-toolbar-under {
        margin-top: 8px;
        margin-bottom: 18px;
      }
      }

      /* feedback refinement: bigger charts, lower controls, concise cards */
      .ksj-stat-positive { color: #15803d !important; }
      .ksj-stat-negative { color: #b91c1c !important; }
      .ksj-stat-neutral { color: #1e293b !important; }

      .ksj-context-note {
        margin-top: 14px;
        border-left: 4px solid #94a3b8;
        border-radius: 8px;
        background: #f8fafc;
        border-top: 1px solid #e2e8f0;
        border-right: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
      }

      .ksj-chart-surface.macro-large {
        min-height: 710px;
      }

      .ksj-chart-surface.tall {
        min-height: 910px;
      }

      .ksj-chart-surface.balance-large,
      .ksj-chart-surface.lorenz-large {
        min-height: 820px;
      }

      .ksj-rank-control-row {
        margin-top: 18px;
        margin-bottom: 24px;
        padding-top: 10px;
        border-top: 1px solid #f1f5f9;
      }

      #ksj-selected-card {
        margin-top: 74px !important;
      }

      .ksj-link-bridge-card {
        margin-bottom: 16px;
      }

      .ksj-link-mini-stat b,
      .ksj-country-stat b {
        transition: color .16s ease;
      }

      /* refinement v2: remove duplicate background note and normalize 图2 card typography */
      #ksj-selected-card .ksj-card-lead {
        font-size: 13px;
        line-height: 1.65;
        margin-bottom: 14px;
      }

      #ksj-selected-card .ksj-country-grid.ksj-selected-grid {
        gap: 10px;
      }

      #ksj-selected-card .ksj-country-grid.ksj-selected-grid .ksj-country-stat {
        min-height: 72px;
        padding: 11px 12px;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }

      #ksj-selected-card .ksj-country-grid.ksj-selected-grid .ksj-country-stat span {
        font-size: 12px;
        line-height: 1.25;
        margin-bottom: 7px;
      }

      #ksj-selected-card .ksj-country-grid.ksj-selected-grid .ksj-country-stat b {
        font-size: 14px;
        line-height: 1.35;
        font-weight: 800;
        letter-spacing: 0;
        white-space: nowrap;
      }

      #ksj-rank-flow .ksj-rank-main-title {
        font-size: 15px;
        font-weight: 850;
      }

      #ksj-rank-flow .ksj-rank-subtitle,
      #ksj-rank-flow .ksj-rank-growth-text,
      #ksj-rank-flow .ksj-small-label {
        font-size: 12.5px;
        font-weight: 780;
      }

      @media screen and (min-width: 981px) {
        .ksj-macro-two-col .column:first-child {
          flex: 0 0 80%;
          max-width: 80%;
        }
        .ksj-macro-two-col .column:last-child {
          flex: 0 0 20%;
          max-width: 20%;
        }
      }

      @media screen and (max-width: 980px) {
        #ksj-selected-card {
          margin-top: 0 !important;
        }
      }


    `;
    d3.select('head').append('style').attr('id', 'ksj-trend-style').html(css);
  }

  async function loadCsvFromCandidates(paths) {
    let lastError = null;
    for (const path of paths) {
      try {
        const res = await fetch(path, { cache: 'no-store' });
        if (!res.ok) throw new Error(`${path} returned ${res.status}`);
        const buffer = await res.arrayBuffer();
        const text = decodeCsvBuffer(buffer);
        const rows = d3.csvParse(text);
        if (rows && rows.length) return rows;
        lastError = new Error(`${path} is empty`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('CSV loading failed');
  }

  function decodeCsvBuffer(buffer) {
    const decoders = [
      () => new TextDecoder('utf-8', { fatal: true }).decode(buffer),
      () => new TextDecoder('gb18030').decode(buffer),
      () => new TextDecoder('gbk').decode(buffer),
      () => new TextDecoder('utf-8').decode(buffer)
    ];
    for (const decode of decoders) {
      try {
        const text = decode();
        if (text && !text.includes('\uFFFD')) return text;
      } catch (error) {
        // try next decoder
      }
    }
    return new TextDecoder('utf-8').decode(buffer);
  }

  function prepareData(areaRows, countryRows) {
    const yearly = areaRows
      .filter(row => /^\d{4}$/.test(String(row.year || '').trim()))
      .map(row => ({
        year: +String(row.year || '').trim(),
        cee: toNumber(row.cee_china_cooperation),
        china: toNumber(row.china_cooperation),
        proportion: toNumber(row.proportion)
      }))
      .filter(d => Number.isFinite(d.year) && d.year >= 2011 && d.year <= 2020 && d.cee > 0 && d.china > 0)
      .sort((a, b) => d3.ascending(a.year, b.year));

    if (!yearly.length) {
      throw new Error('area.csv 未读取到有效年度数据。请检查 year、cee_china_cooperation、china_cooperation、proportion 字段。');
    }

    const rawCountries = countryRows.map(row => {
      const rawName = normalizeName(row.country);
      const meta = COUNTRY_META.get(rawName) || COUNTRY_CN_TO_META.get(String(row.country_cn || '').trim());
      return {
        country: rawName,
        countryCn: meta ? meta.cn : String(row.country_cn || row.country || '').trim(),
        iso3: meta ? meta.iso3 : rawName.slice(0, 3),
        p1: toNumber(row['2011_2015_papers']),
        p2: toNumber(row['2016_2020_papers']),
        rank2Original: toNumber(row['2016_2020_rank'])
      };
    });

    const ceeSet = new Set(CEE_COUNTRIES.map(d => d.country));
    const countries = rawCountries
      .filter(d => ceeSet.has(d.country) && d.p1 >= 0 && d.p2 >= 0)
      .map(d => ({ ...d }));

    if (!countries.length) {
      throw new Error('country.csv 未匹配到有效国家数据。请检查 country、country_cn、2011_2015_papers、2016_2020_papers 字段。');
    }

    const totalP1 = d3.sum(countries, d => d.p1);
    const totalP2 = d3.sum(countries, d => d.p2);

    const rank1 = rankMap(countries, d => d.p1);
    const rank2 = rankMap(countries, d => d.p2);
    const growthRates = countries.map(d => d.p1 > 0 ? (d.p2 - d.p1) / d.p1 : Infinity).filter(Number.isFinite);
    const growthMedian = d3.median(growthRates) || 0;

    countries.forEach(d => {
      d.total = d.p1 + d.p2;
      d.diff = d.p2 - d.p1;
      d.growthRate = d.p1 > 0 ? (d.p2 - d.p1) / d.p1 : d.p2 > 0 ? Infinity : 0;
      d.share1 = totalP1 > 0 ? d.p1 / totalP1 : 0;
      d.share2 = totalP2 > 0 ? d.p2 / totalP2 : 0;
      d.rank1 = rank1.get(d.country) || 999;
      d.rank2 = rank2.get(d.country) || 999;
      d.rankChange = d.rank1 - d.rank2;
      d.type = classifyCountry(d, growthMedian);
      d.typeLabel = typeLabel(d.type);
    });

    state.data.yearly = yearly;
    state.data.countries = countries;
    state.data.stages = [
      summarizeStage(countries, 'p1', '2011–2015'),
      summarizeStage(countries, 'p2', '2016–2020')
    ];
  }

  function toNumber(value) {
    if (value === null || value === undefined) return NaN;
    const cleaned = String(value).replace(/,/g, '').replace(/%/g, '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'nan') return NaN;
    return +cleaned;
  }

  function normalizeName(name) {
    return String(name || '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  function rankMap(rows, accessor) {
    const sorted = rows.slice().sort((a, b) => d3.descending(accessor(a), accessor(b)) || d3.ascending(a.country, b.country));
    return new Map(sorted.map((d, i) => [d.country, i + 1]));
  }

  function classifyCountry(d, growthMedian) {
    if (d.rank2 <= 3 || d.share2 >= 0.13) return 'core';
    if (d.rank2 <= 8 || d.share2 >= 0.07) return 'middle';
    if (d.growthRate > growthMedian && d.diff > 0) return 'chaser';
    return 'tail';
  }

  function typeLabel(type) {
    return {
      core: '核心国家',
      middle: '稳定国家',
      chaser: '追赶国家',
      tail: '长尾国家'
    }[type] || '国家';
  }

  function summarizeStage(countries, key, label) {
    const values = countries.map(d => ({ ...d, value: d[key] })).sort((a, b) => d3.descending(a.value, b.value));
    const total = d3.sum(values, d => d.value);
    return {
      key,
      label,
      total,
      top1: values[0],
      top3Share: d3.sum(values.slice(0, 3), d => d.value) / total,
      top5Share: d3.sum(values.slice(0, 5), d => d.value) / total,
      tailShare: d3.sum(values.slice(8), d => d.value) / total,
      gini: gini(values.map(d => d.value)),
      hhi: d3.sum(values, d => Math.pow(d.value / total, 2)),
      values
    };
  }

  function gini(values) {
    const arr = values.filter(v => v >= 0).sort((a, b) => a - b);
    const n = arr.length;
    const sum = d3.sum(arr);
    if (!n || sum === 0) return 0;
    let weighted = 0;
    arr.forEach((v, i) => { weighted += (i + 1) * v; });
    return (2 * weighted) / (n * sum) - (n + 1) / n;
  }

  function renderAll() {
    renderHeroMetrics();
    renderSelectedCard(null);
    renderBalanceCard(null);
    renderMacroChart();
    renderMacroCard(state.data.yearly[state.data.yearly.length - 1]);
    renderProportionStrip();
    renderRankToolbar();
    renderRankFlow();
    renderBalanceToolbar();
    renderBalanceLinkCard(null);
    renderBubbleMap();
    renderLorenzChart();
    renderLorenzCard(null);
    renderConclusion();
  }

  function renderHeroMetrics() {
    const y = state.data.yearly;
    const c = state.data.countries;
    const first = y[0];
    const last = y[y.length - 1];
    const ceeGrowth = first.cee ? (last.cee / first.cee - 1) : 0;
    const chinaGrowth = first.china ? (last.china / first.china - 1) : 0;
    const stage1 = state.data.stages[0];
    const stage2 = state.data.stages[1];
    const topMover = c.slice().sort((a, b) => d3.descending(a.diff, b.diff))[0];

    d3.select('#ksj-hero-metrics').html(`
      ${metricHTML('中东欧合作量增长', `${fmt.growth(ceeGrowth)}`, `${first.year}→${last.year}: ${fmt.int(first.cee)} 至 ${fmt.int(last.cee)}`)}
      ${metricHTML('中国国际合作总量增长', `${fmt.growth(chinaGrowth)}`, `${first.year}→${last.year}: ${fmt.int(first.china)} 至 ${fmt.int(last.china)}`)}
      ${metricHTML('后期 Top3 合作国家占比', `${fmt.pct1(stage2.top3Share * 100)}%`, `较前期 ${formatPP(stage2.top3Share - stage1.top3Share)}`)}
      ${metricHTML('新增合作量最高', topMover.countryCn, `+${fmt.int(topMover.diff)} 篇，${topMover.typeLabel}`)}
    `);

    d3.select('#ksj-macro-note').html(
      `中东欧合作量由 <b>${fmt.int(first.cee)}</b> 增至 <b>${fmt.int(last.cee)}</b>；` +
      `占比从 <b>${fmt.pct(first.proportion)}%</b> 至 <b>${fmt.pct(last.proportion)}%</b>，变化为 <b>${formatPP(last.proportion - first.proportion)}</b>。`
    );
  }

  function metricHTML(label, value, foot) {
    return `
      <div class="ksj-metric">
        <div class="ksj-metric-label">${label}</div>
        <div class="ksj-metric-value">${value}</div>
        <div class="ksj-metric-foot">${foot}</div>
      </div>
    `;
  }

  function renderMacroChart() {
    const el = document.getElementById('ksj-macro-chart');
    if (!el) return;
    const data = state.data.yearly;
    const width = Math.max(1120, el.clientWidth || 1240);
    const height = 710;
    drawShareLensTimeline(d3.select(el).html(''), data, width, height);
  }

  function drawShareLensTimeline(box, data, width, height) {
    const margin = { top: 104, right: 58, bottom: 74, left: 86 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const first = data[0];
    const last = data[data.length - 1];
    const minShare = d3.min(data, d => d.proportion);
    const maxShare = d3.max(data, d => d.proportion);
    const maxCee = d3.max(data, d => d.cee);
    const maxD = data.find(d => d.proportion === maxShare);
    const minD = data.find(d => d.proportion === minShare);

    const svg = box.append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'CEE collaboration share within China international collaboration');

    const defs = svg.append('defs');
    const shareGrad = defs.append('linearGradient')
      .attr('id', `ksj-share-lens-grad-${width}`)
      .attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
    shareGrad.append('stop').attr('offset', '0%').attr('stop-color', '#8fc0ff').attr('stop-opacity', .24);
    shareGrad.append('stop').attr('offset', '100%').attr('stop-color', '#edf6ff').attr('stop-opacity', .04);

    svg.append('text')
      .attr('x', 26).attr('y', 32)
      .attr('fill', '#172033')
      .attr('font-size', 17)
      .attr('font-weight', 950)
      .text('图1 年度合作占比趋势（2011—2020）');

    svg.append('text')
      .attr('x', 26).attr('y', 57)
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 760)
      .text('蓝线表示合作占比变化，灰线为线性趋势线，圆点面积表示年度合作量。');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scalePoint().domain(data.map(d => d.year)).range([0, innerW]).padding(.38);
    const y = d3.scaleLinear()
      .domain([Math.max(0, minShare - .16), maxShare + .22])
      .nice()
      .range([innerH, 0]);
    const r = d3.scaleSqrt().domain([0, maxCee]).range([8, 20]);

    g.append('g')
      .attr('class', 'ksj-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(''));

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.proportion))
      .curve(d3.curveMonotoneX);
    const area = d3.area()
      .x(d => x(d.year))
      .y0(innerH)
      .y1(d => y(d.proportion))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(data)
      .attr('fill', `url(#ksj-share-lens-grad-${width})`)
      .attr('d', area);

    const trend = computeLinearTrend(data, d => d.year, d => d.proportion);
    if (trend) {
      g.append('line')
        .attr('x1', x(trend.x1))
        .attr('y1', y(trend.y1))
        .attr('x2', x(trend.x2))
        .attr('y2', y(trend.y2))
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 2.4)
        .attr('stroke-dasharray', '6 6')
        .attr('stroke-linecap', 'round');
    }

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#73a9ee')
      .attr('stroke-width', 3.8)
      .attr('stroke-linecap', 'round')
      .attr('d', line);

    const focus = g.append('g').attr('class', 'ksj-macro-focus').style('opacity', 0);
    focus.append('line')
      .attr('class', 'ksj-focus-line')
      .attr('y1', 0).attr('y2', innerH)
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.1)
      .attr('stroke-dasharray', '4 5');
    focus.append('circle')
      .attr('class', 'ksj-focus-ring')
      .attr('r', 24)
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2.8)
      .attr('stroke-opacity', .55);

    g.selectAll('.ksj-share-point')
      .data(data)
      .join('circle')
      .attr('class', 'ksj-share-point')
      .attr('data-year', d => d.year)
      .attr('cx', d => x(d.year))
      .attr('cy', d => y(d.proportion))
      .attr('r', d => r(d.cee))
      .attr('data-base-r', d => r(d.cee))
      .attr('fill', '#ffffff')
      .attr('stroke', '#73a9ee')
      .attr('stroke-width', 3)
      .attr('filter', 'drop-shadow(0 8px 14px rgba(36,111,206,.20))')
      .on('mouseenter', (event, d) => { highlightMacroYear(d.year); renderMacroCard(d); showYearTooltip(event, d); })
      .on('mousemove', (event, d) => { highlightMacroYear(d.year); renderMacroCard(d); showYearTooltip(event, d); })
      .on('mouseleave', () => { hideTooltip(); })
      .on('click', (event, d) => { highlightMacroYear(d.year); renderMacroCard(d); });

    const labels = [first, maxD, last].filter((d, i, arr) => d && arr.findIndex(x => x.year === d.year) === i);
    labels.forEach((d) => {
      const isLast = d.year === last.year;
      const isFirst = d.year === first.year;
      const textAnchor = isLast ? 'end' : isFirst ? 'start' : 'middle';
      const dx = isLast ? -8 : isFirst ? 8 : 0;
      const dy = isFirst ? 30 : -20;
      g.append('text')
        .attr('x', x(d.year) + dx)
        .attr('y', y(d.proportion) + dy)
        .attr('text-anchor', textAnchor)
        .attr('fill', '#172033')
        .attr('font-size', 12)
        .attr('font-weight', 920)
        .text(`${d.year}：${fmt.pct(d.proportion)}%`);
    });

    g.append('g')
      .attr('class', 'ksj-axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll('text')
      .attr('text-anchor', 'middle')
      .attr('dx', 0)
      .attr('dy', '.75em');
    g.append('g')
      .attr('class', 'ksj-axis')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`));

    g.append('text')
      .attr('x', -innerH / 2)
      .attr('y', -55)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 850)
      .text('合作占比');

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 52)
      .attr('text-anchor', 'middle')
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 850)
      .text('年份');

    const overlay = g.append('g').attr('class', 'ksj-overlay-layer');
    overlay.selectAll('rect')
      .data(data)
      .join('rect')
      .attr('x', d => x(d.year) - Math.max(24, innerW / data.length / 2))
      .attr('y', 0)
      .attr('width', Math.max(48, innerW / data.length))
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', (event, d) => { highlightMacroYear(d.year); renderMacroCard(d); showYearTooltip(event, d); })
      .on('mousemove', (event, d) => { highlightMacroYear(d.year); renderMacroCard(d); showYearTooltip(event, d); })
      .on('mouseleave', hideTooltip)
      .on('click', (event, d) => { highlightMacroYear(d.year); renderMacroCard(d); });

    svg.append('g')
      .attr('class', 'ksj-mini-legend')
      .attr('transform', `translate(${margin.left},${height - 2})` )
      .call(gLegend => {
        gLegend.append('circle').attr('cx', 0).attr('cy', -5).attr('r', 7).attr('fill', '#fff').attr('stroke', '#73a9ee').attr('stroke-width', 3);
        gLegend.append('text').attr('x', 14).attr('y', -1).attr('fill', '#667085').attr('font-size', 12).attr('font-weight', 780).text('圆点面积：年度合作量');
        gLegend.append('line').attr('x1', 230).attr('x2', 263).attr('y1', -5).attr('y2', -5).attr('stroke', '#73a9ee').attr('stroke-width', 4).attr('stroke-linecap', 'round');
        gLegend.append('text').attr('x', 274).attr('y', -1).attr('fill', '#667085').attr('font-size', 12).attr('font-weight', 780).text('蓝线：合作占比变化');
        gLegend.append('line').attr('x1', 450).attr('x2', 485).attr('y1', -5).attr('y2', -5).attr('stroke', '#94a3b8').attr('stroke-width', 2.4).attr('stroke-dasharray', '6 6').attr('stroke-linecap', 'round');
        gLegend.append('text').attr('x', 496).attr('y', -1).attr('fill', '#667085').attr('font-size', 12).attr('font-weight', 780).text('灰线：线性趋势');
      });

    svg.property('ksjXScale', x).property('ksjYScale', y);
    highlightMacroYear(last.year);
  }

  function renderMacroCard(d) {
    const el = d3.select('#ksj-macro-card');
    if (el.empty()) return;
    const data = state.data.yearly;
    const first = data[0] || d;
    const last = data[data.length - 1] || d;
    const maxShare = d3.max(data, x => x.proportion);
    const maxD = data.find(x => x.proportion === maxShare) || last;
    const minShare = d3.min(data, x => x.proportion);
    const minD = data.find(x => x.proportion === minShare) || first;
    const periodChange = last && first ? last.proportion - first.proportion : 0;

    if (!d) {
      el.html(`
        <div class="ksj-mini-title">年度指标</div>
        <div class="ksj-card-big-value">${fmt.pct(last.proportion)}%</div>
        <div class="ksj-muted">
          默认显示末期年份。悬停或点击折线图上的年份，可查看年度合作量、占比和较基准变化。
        </div>
        <div class="ksj-country-grid">
          ${countryStatHTML('基准占比', `${fmt.pct(first.proportion)}%`)}
          ${countryStatHTML('末期占比', `${fmt.pct(last.proportion)}%`)}
          ${countryStatHTML('较基准变化', formatPP(periodChange))}
          ${countryStatHTML('最高年份', `${maxD.year}年`)}
        </div>
      `);
      return;
    }

    const firstGrowth = first.cee ? (d.cee / first.cee - 1) : 0;
    const shareChange = d.proportion - first.proportion;

    el.html(`
      <div class="ksj-mini-title">${d.year} 年度指标</div>
      <div class="ksj-card-big-value">${fmt.pct(d.proportion)}%</div>
      <div class="ksj-muted">
        当前年份较基准占比变化为 <b class="${statToneClass(formatPP(shareChange))}">${formatPP(shareChange)}</b>；合作量较基准${firstGrowth >= 0 ? '增长' : '下降'} <b class="${firstGrowth >= 0 ? 'ksj-stat-positive' : 'ksj-stat-negative'}">${fmt.pct(Math.abs(firstGrowth))}%</b>。
      </div>
      <div class="ksj-country-grid">
        ${countryStatHTML('中东欧合作量', `${fmt.int(d.cee)} 篇`)}
        ${countryStatHTML('国际合作总量', `${fmt.int(d.china)} 篇`)}
        ${countryStatHTML('合作占比', `${fmt.pct(d.proportion)}%`)}
        ${countryStatHTML('较基准变化', formatPP(shareChange))}
      </div>
    `);
  }


  function showYearTooltip(event, d) {
    const first = state.data.yearly[0] || d;
    const html = `
      <div class="ksj-tooltip-title">${d.year}</div>
      <div class="ksj-tooltip-row"><span>中东欧合作量</span><b>${fmt.int(d.cee)}</b></div>
      <div class="ksj-tooltip-row"><span>中国国际合作总量</span><b>${fmt.int(d.china)}</b></div>
      <div class="ksj-tooltip-row"><span>合作占比</span><b>${fmt.pct(d.proportion)}%</b></div>
      <div class="ksj-tooltip-row"><span>较基准变化</span><b>${formatPP(d.proportion - first.proportion)}</b></div>
    `;
    moveTooltip(event, html);
  }


  function highlightMacroYear(year) {
    d3.selectAll('.ksj-share-point')
      .classed('active-year', d => +d.year === +year)
      .attr('stroke-width', d => +d.year === +year ? 5.8 : 2.8)
      .attr('fill', d => +d.year === +year ? '#fff7ed' : '#ffffff')
      .attr('r', function(d) {
        const base = +d3.select(this).attr('data-base-r') || 8;
        return +d.year === +year ? base + 3.2 : base;
      });
    d3.selectAll('.ksj-heat-cell').classed('active', function() {
      return +this.dataset.year === +year;
    });
    const svg = d3.select('#ksj-macro-chart svg');
    const focus = svg.select('.ksj-macro-focus');
    const point = state.data.yearly.find(d => +d.year === +year);
    if (!focus.empty() && point) {
      const xScale = svg.property('ksjXScale');
      const yScale = svg.property('ksjYScale');
      if (xScale && yScale) {
        focus.style('opacity', 1)
          .attr('transform', `translate(${xScale(point.year)},0)`);
        focus.select('.ksj-focus-ring')
          .attr('cy', yScale(point.proportion));
      }
    }
  }

  function renderProportionStrip() {
    // 年度占比分布色块与主折线图信息重复，按反馈保留为空。
  }


  function renderRankToolbar() {
    d3.select('#ksj-rank-toolbar').selectAll('[data-focus]')
      .on('click', function () {
        state.view.highlightMode = this.dataset.focus;
        state.view.hoveredCountry = null;
        state.view.selectedCountry = null;
        hideTooltip();
        hideLorenzFocus();
        d3.select('#ksj-rank-toolbar').selectAll('[data-focus]')
          .classed('active', false).classed('is-link', false).classed('is-light', true);
        d3.select(this).classed('active', true).classed('is-link', true).classed('is-light', false);
        renderSelectedCard(null);
        applyHighlighting();
      });
  }

  function sortedCountries() {
    return state.data.countries.slice().sort((a, b) => d3.descending(a.p2, b.p2));
  }

  function safeRate(rate) {
    return Number.isFinite(rate) ? rate : 999;
  }

  function renderRankFlow() {
    const el = document.getElementById('ksj-rank-flow');
    if (!el) return;
    const rows = sortedCountries();
    const width = Math.max(1180, el.clientWidth || 1240);
    const rowH = 50;
    const height = Math.max(930, rows.length * rowH + 230);
    const margin = { top: 130, right: 220, bottom: 86, left: 154 };
    const innerH = height - margin.top - margin.bottom;
    const leftX = margin.left;
    const rightX = width - margin.right;
    const growthX = rightX + 70;

    const finiteRates = rows.map(d => d.growthRate).filter(Number.isFinite);
    const rateExtent = d3.extent(finiteRates);
    const rateP90 = finiteRates.length ? d3.quantile(finiteRates.slice().sort(d3.ascending), .90) : (rateExtent[1] ?? 1);
    const rateColor = d3.scaleSequential(t => d3.interpolateRgbBasis(['#d7ecff', '#83c5ff', '#2f80ed', '#1557bd', '#0b2f73'])(t))
      .domain([rateExtent[0] ?? 0, rateP90 || (rateExtent[1] ?? 1)])
      .clamp(true);

    const diffExtent = d3.extent(rows, d => Math.max(0, d.diff));
    const widthScale = d3.scaleSqrt().domain(diffExtent).range([6.5, 28]);
    const nodeRadius = d3.scaleSqrt().domain(d3.extent(rows, d => d.p2)).range([5.5, 11.5]);

    const svg = d3.select(el).html('').append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Rank flow chart for CEE countries with numeric growth badges');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('fill', '#172033')
      .attr('class', 'ksj-rank-main-title')
      .text('图2 国家阶段排名变化与新增合作量');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 55)
      .attr('text-anchor', 'middle')
      .attr('fill', '#667085')
      .attr('class', 'ksj-rank-subtitle')
      .text('颜色表示增长率高低，线宽表示新增合作量，左右两侧分别为两个阶段排名。');

    svg.append('text')
      .attr('x', leftX)
      .attr('y', 86)
      .attr('fill', '#172033')
      .attr('class', 'ksj-rank-main-title')
      .text('2011—2015排名');

    svg.append('text')
      .attr('x', rightX)
      .attr('y', 86)
      .attr('text-anchor', 'end')
      .attr('fill', '#172033')
      .attr('class', 'ksj-rank-main-title')
      .text('2016—2020排名');

    svg.append('text')
      .attr('x', growthX)
      .attr('y', 86)
      .attr('fill', '#172033')
      .attr('class', 'ksj-rank-main-title')
      .text('增长率');

    const y1 = d3.scaleLinear().domain([1, rows.length]).range([margin.top, margin.top + innerH]);
    const y2 = d3.scaleLinear().domain([1, rows.length]).range([margin.top, margin.top + innerH]);

    [leftX, rightX].forEach(xPos => {
      svg.append('line')
        .attr('x1', xPos).attr('x2', xPos)
        .attr('y1', margin.top - 16).attr('y2', height - margin.bottom + 6)
        .attr('stroke', '#d9e4ef')
        .attr('stroke-width', 2);
    });

    const orderedByRank1 = rows.slice().sort((a, b) => d3.ascending(a.rank1, b.rank1));
    const orderedByRank2 = rows.slice().sort((a, b) => d3.ascending(a.rank2, b.rank2));
    drawRankLabels(svg, orderedByRank1, leftX, y1, 'left');
    drawRankLabels(svg, orderedByRank2, rightX, y2, 'right');

    const ribbonLayer = svg.append('g').attr('class', 'ksj-ribbon-layer');
    ribbonLayer.selectAll('.ksj-ribbon')
      .data(rows, d => d.country)
      .join('path')
      .attr('class', d => `ksj-ribbon country-${slug(d.country)} type-${d.type}`)
      .attr('data-country', d => d.country)
      .attr('fill', 'none')
      .attr('stroke', d => Number.isFinite(d.growthRate) ? rateColor(d.growthRate) : '#f2a65a')
      .attr('stroke-width', d => widthScale(Math.max(0, d.diff)))
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', .94)
      .attr('d', d => ribbonPath(leftX + 13, y1(d.rank1), rightX - 13, y2(d.rank2)))
      .on('mouseenter', (event, d) => setCountryHover(event, d))
      .on('mousemove', (event, d) => showCountryTooltip(event, d))
      .on('mouseleave', clearCountryHover)
      .on('click', (event, d) => selectCountry(d));

    const nodes = svg.append('g').selectAll('.ksj-country-node')
      .data(rows, d => d.country)
      .join('g')
      .attr('class', d => `ksj-country-node country-${slug(d.country)}`)
      .attr('data-country', d => d.country)
      .on('mouseenter', (event, d) => setCountryHover(event, d))
      .on('mousemove', (event, d) => showCountryTooltip(event, d))
      .on('mouseleave', clearCountryHover)
      .on('click', (event, d) => selectCountry(d));

    nodes.append('circle')
      .attr('cx', leftX)
      .attr('cy', d => y1(d.rank1))
      .attr('r', 5.8)
      .attr('fill', d => typeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    nodes.append('circle')
      .attr('cx', rightX)
      .attr('cy', d => y2(d.rank2))
      .attr('r', d => nodeRadius(d.p2))
      .attr('fill', d => typeColor(d.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    const badgeW = 88;
    const badgeH = 30;
    const badge = svg.append('g').attr('class', 'ksj-growth-badge-layer')
      .selectAll('.ksj-growth-badge')
      .data(rows, d => d.country)
      .join('g')
      .attr('class', d => `ksj-growth-badge country-${slug(d.country)}`)
      .attr('data-country', d => d.country)
      .attr('transform', d => `translate(${growthX},${y2(d.rank2) - badgeH / 2})`)
      .on('mouseenter', (event, d) => setCountryHover(event, d))
      .on('mousemove', (event, d) => showCountryTooltip(event, d))
      .on('mouseleave', clearCountryHover)
      .on('click', (event, d) => selectCountry(d));

    badge.append('rect')
      .attr('width', badgeW)
      .attr('height', badgeH)
      .attr('rx', 13);

    badge.append('text')
      .attr('class', 'ksj-rank-growth-text')
      .attr('x', badgeW / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .text(d => formatGrowthRate(d.growthRate));

    const legend = svg.append('g').attr('transform', `translate(${margin.left},${height - 30})`);
    const types = ['core', 'middle', 'chaser', 'tail'];
    types.forEach((type, i) => {
      const item = legend.append('g').attr('transform', `translate(${i * 130},0)`);
      item.append('circle').attr('r', 6).attr('fill', typeColor(type));
      item.append('text').attr('x', 12).attr('y', 4).attr('fill', '#667085').attr('font-size', 13).attr('font-weight', 850).text(typeLabel(type));
    });
    const colorLegend = legend.append('g').attr('transform', `translate(${types.length * 130 + 18},0)`);
    colorLegend.append('line').attr('x1',0).attr('x2',30).attr('y1',0).attr('y2',0).attr('stroke','#d7ecff').attr('stroke-width',5).attr('stroke-linecap','round');
    colorLegend.append('line').attr('x1',34).attr('x2',64).attr('y1',0).attr('y2',0).attr('stroke','#2f80ed').attr('stroke-width',5).attr('stroke-linecap','round');
    colorLegend.append('line').attr('x1',68).attr('x2',98).attr('y1',0).attr('y2',0).attr('stroke','#0b2f73').attr('stroke-width',5).attr('stroke-linecap','round');
    colorLegend.append('text').attr('x',108).attr('y',4).attr('fill','#667085').attr('font-size',13).attr('font-weight',850).text('增长率：低 → 高');

    applyHighlighting();
  }

  function drawRankLabels(svg, rows, x, y, side) {
    const anchor = side === 'left' ? 'end' : 'start';
    const dx = side === 'left' ? -13 : 13;
    const group = svg.append('g');
    group.selectAll(`text.${side}-rank-label`)
      .data(rows)
      .join('text')
      .attr('class', d => `ksj-small-label ${side}-rank-label country-${slug(d.country)}`)
      .attr('data-country', d => d.country)
      .attr('x', x + dx)
      .attr('y', d => y(side === 'left' ? d.rank1 : d.rank2) + 4)
      .attr('text-anchor', anchor)
      .attr('font-size', 13)
      .attr('font-weight', 900)
      .text(d => `${side === 'left' ? d.rank1 : d.rank2}. ${d.countryCn}`);
  }

  function ribbonPath(x1, y1, x2, y2) {
    const mid = (x1 + x2) / 2;
    return `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`;
  }

  function makeGlow(defs, id, color) {
    const filter = defs.append('filter').attr('id', id).attr('height', '180%').attr('width', '180%').attr('x', '-40%').attr('y', '-40%');
    filter.append('feGaussianBlur').attr('stdDeviation', 4).attr('result', 'coloredBlur');
    const merge = filter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'coloredBlur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');
  }

  function renderBalanceToolbar() {
    d3.select('#ksj-balance-toolbar').selectAll('[data-stage]')
      .on('click', function () {
        state.view.stage = this.dataset.stage;
        state.view.hoveredCountry = null;
        state.view.selectedCountry = null;
        d3.select('#ksj-balance-toolbar').selectAll('[data-stage]')
          .classed('active', false).classed('is-link', false).classed('is-light', true);
        d3.select(this).classed('active', true).classed('is-link', true).classed('is-light', false);
        renderBubbleMap();
        renderLorenzChart();
        renderConclusion();
        renderBalanceLinkCard(null);
        hideLorenzFocus();
        applyHighlighting();
      });

    d3.select('#ksj-balance-toolbar').selectAll('[data-focus]')
      .on('click', function () {
        state.view.highlightMode = this.dataset.focus;
        state.view.hoveredCountry = null;
        state.view.selectedCountry = null;
        hideTooltip();
        hideLorenzFocus();
        d3.select('#ksj-balance-toolbar').selectAll('[data-focus]')
          .classed('active', false).classed('is-link', false).classed('is-light', true);
        d3.select(this).classed('active', true).classed('is-link', true).classed('is-light', false);
        renderBalanceLinkCard(null);
        applyHighlighting();
      });
  }

  function renderBalanceLinkCard(d) {
    const el = d3.select('#ksj-balance-link-card');
    if (el.empty()) return;
    const stageKey = state.view.stage;
    const stage = state.data.stages.find(s => s.key === stageKey) || state.data.stages[1];
    const stageLabel = stageKey === 'p1' ? '2011–2015' : '2016–2020';
    const totalCountries = state.data.countries.length;
    const focus = state.view.highlightMode || 'all';
    const focusMeta = {
      all: { title: '全部国家', note: '显示全部国家，用于观察整体结构。' },
      top3: { title: 'Top3 国家', note: '突出阶段排名前3的国家。' },
      top5: { title: 'Top5 国家', note: '突出阶段排名前5的国家。' },
      core: { title: '核心国家', note: '突出后期排名前3，或后期合作份额≥13%的国家。' },
      chaser: { title: '追赶国家', note: '突出未进入核心或稳定范围，且增长率高于中位数、新增量为正的国家。' },
      tail: { title: '长尾国家', note: '突出未满足核心、稳定、追赶条件，合作规模或增量较小的国家。' }
    }[focus] || { title: '全部国家', note: '显示全部国家。' };
    const focusCountries = state.data.countries
      .filter(row => countryShouldShow(row, focus, null))
      .sort((a, b) => d3.descending(a[stageKey], b[stageKey]));
    const focusTotal = d3.sum(focusCountries, row => row[stageKey]);
    const focusShare = stage.total ? focusTotal / stage.total : 0;
    const focusNames = focusCountries.slice(0, 5).map(row => row.countryCn).join('、') || '全部国家';

    if (!d) {
      const prevStage = state.data.stages.find(s => s.key === 'p1') || stage;
      const top3Names = stage.values.slice(0, 3).map(row => row.countryCn).join('、');
      const top3Change = stage.top3Share - prevStage.top3Share;
      const top5Change = stage.top5Share - prevStage.top5Share;
      el.html(`
        <p class="heading mb-2">集中度变化</p>
        <p class="has-text-grey is-size-7 mb-2">
          后期TOP3合作国家为 <b>${top3Names}</b>，下方直接展示其占比和较前期变化。
        </p>
        <div class="ksj-link-grid">
          ${miniStatHTML('当前阶段', stageLabel)}
          ${miniStatHTML('Top3合作国家占比', `${fmt.pct1(stage.top3Share * 100)}%`)}
          ${miniStatHTML('Top3较前期变化', formatPP(top3Change))}
          ${miniStatHTML('Top5较前期变化', formatPP(top5Change))}
        </div>
      `);
      return;
    }
    const rows = state.data.countries.slice().sort((a, b) => d3.ascending(a[stageKey], b[stageKey]));
    const total = d3.sum(rows, x => x[stageKey]);
    let acc = 0;
    let cumulative = 0;
    let order = 0;
    rows.forEach((row, i) => {
      acc += row[stageKey];
      if (row.country === d.country) {
        cumulative = total ? acc / total : 0;
        order = i + 1;
      }
    });
    const share = total ? d[stageKey] / total : 0;
    const countryRatio = totalCountries ? order / totalCountries : 0;
    el.html(`
      <p class="heading mb-2">联动解读：${d.countryCn}</p>
      <p class="has-text-grey is-size-7 mb-2">
        当前高亮国家为 <b>${d.countryCn}</b>。气泡显示阶段合作量，Lorenz曲线节点显示其在累计分布中的位置。
      </p>
      <div class="ksj-link-grid">
        ${miniStatHTML('阶段合作量', fmt.int(d[stageKey]))}
        ${miniStatHTML('阶段份额', `${fmt.pct1(share * 100)}%`)}
        ${miniStatHTML('国家类型', d.typeLabel)}
        ${miniStatHTML('累计合作比例', `${fmt.pct1(cumulative * 100)}%`)}
      </div>
    `);
  }

  function renderBubbleMap() {
    const el = document.getElementById('ksj-bubble-map');
    if (!el) return;
    const stageKey = state.view.stage;
    const rows = state.data.countries.map(d => ({ ...d, value: d[stageKey], share: stageKey === 'p1' ? d.share1 : d.share2 }));
    const width = Math.max(640, el.clientWidth || 720);
    const height = 860;

    const svg = d3.select(el).html('').append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Packed bubble chart of CEE country shares');

    svg.append('text')
      .attr('x', 24).attr('y', 29)
      .attr('fill', '#172033')
      .attr('font-weight', 900)
      .attr('font-size', 15)
      .text(`图3 国家合作量气泡图：${stageKey === 'p1' ? '2011–2015' : '2016–2020'}`);

    svg.append('text')
      .attr('x', 24).attr('y', 50)
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 700)
.text('气泡面积表示国家合作量；悬停或点击国家后，右侧Lorenz曲线会同步定位。');

    const root = d3.hierarchy({ children: rows }).sum(d => d.value);
    d3.pack().size([width - 36, height - 120]).padding(9)(root);
    const nodes = root.leaves();

    const g = svg.append('g').attr('transform', 'translate(18,96)');
    g.append('circle')
      .attr('cx', (width - 36) / 2)
      .attr('cy', (height - 120) / 2)
      .attr('r', Math.min(width - 36, height - 120) / 2 - 2)
      .attr('fill', 'none')
      .attr('stroke', '#d9e4ef')
      .attr('stroke-dasharray', '5 7');

    const node = g.selectAll('.ksj-bubble-node')
      .data(nodes, d => d.data.country)
      .join('g')
      .attr('class', d => `ksj-bubble-node country-${slug(d.data.country)} type-${d.data.type}`)
      .attr('data-country', d => d.data.country)
      .attr('transform', d => `translate(${d.x},${d.y})`)
      .on('mouseenter', (event, d) => setCountryHover(event, d.data))
      .on('mousemove', (event, d) => showCountryTooltip(event, d.data))
      .on('mouseleave', clearCountryHover)
      .on('click', (event, d) => selectCountry(d.data));

    node.append('circle')
      .attr('class', 'ksj-bubble')
      .attr('r', d => d.r)
      .attr('fill', d => typeColor(d.data.type))
      .attr('fill-opacity', .96)
      .attr('stroke', 'rgba(255,255,255,.96)')
      .attr('stroke-width', 2.6);

    node.filter(d => d.r > 21).append('text')
      .attr('class', 'ksj-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '-.05em')
      .attr('font-size', d => Math.min(15, Math.max(11, d.r / 3)))
      .text(d => d.data.countryCn);

    node.filter(d => d.r > 28).append('text')
      .attr('class', 'ksj-small-label')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.25em')
      .attr('font-size', 13)
      .attr('font-weight', 900)
      .text(d => `${fmt.pct1(d.data.share * 100)}%`);
  }


  function getLorenzPointForCountry(country) {
    if (!country) return null;
    const stageKey = state.view.stage;
    const rows = state.data.countries.slice().sort((a, b) => d3.ascending(a[stageKey], b[stageKey]));
    const total = d3.sum(rows, d => d[stageKey]);
    let acc = 0;
    for (let i = 0; i < rows.length; i += 1) {
      const d = rows[i];
      acc += d[stageKey];
      if (d.country === country) {
        return {
          x: (i + 1) / rows.length,
          y: total ? acc / total : 0,
          countryCn: d.countryCn,
          value: d[stageKey],
          cumulative: acc,
          data: d,
          order: i + 1
        };
      }
    }
    return null;
  }

  function showLorenzFocus(point) {
    const host = d3.select('#ksj-lorenz-chart');
    const x = host.property('ksjLorenzXScale');
    const y = host.property('ksjLorenzYScale');
    const innerH = host.property('ksjLorenzInnerH');
    const innerW = host.property('ksjLorenzInnerW');
    const focus = host.select('.ksj-lorenz-focus-guide');
    if (!point || !x || !y || focus.empty()) return;
    const px = x(point.x);
    const py = y(point.y);
    focus.style('opacity', 1);
    focus.select('.ksj-focus-x').attr('x1', px).attr('x2', px).attr('y1', py).attr('y2', innerH);
    focus.select('.ksj-focus-y').attr('x1', 0).attr('x2', px).attr('y1', py).attr('y2', py);
    focus.select('.ksj-focus-ring').attr('cx', px).attr('cy', py);
    focus.select('.ksj-focus-label')
      .attr('x', Math.min(innerW - 120, Math.max(8, px + 10)))
      .attr('y', Math.max(18, py - 12))
      .text(`${point.countryCn}：累计 ${fmt.pct1(point.y * 100)}%`);
  }

  function hideLorenzFocus() {
    d3.select('#ksj-lorenz-chart').select('.ksj-lorenz-focus-guide').style('opacity', 0);
  }

  function syncLorenzFromCountry(country) {
    const point = getLorenzPointForCountry(country);
    if (point) {
      renderLorenzCard(point);
      showLorenzFocus(point);
    }
  }

  function renderLorenzChart() {
    const el = document.getElementById('ksj-lorenz-chart');
    if (!el) return;
    const stageKey = state.view.stage;
    const stage = state.data.stages.find(s => s.key === stageKey);
    const rows = state.data.countries.slice().sort((a, b) => d3.ascending(a[stageKey], b[stageKey]));
    const total = d3.sum(rows, d => d[stageKey]);
    const points = [{ x: 0, y: 0, countryCn: '起点', value: 0, cumulative: 0, data: null }];
    let acc = 0;
    rows.forEach((d, i) => {
      acc += d[stageKey];
      points.push({
        x: (i + 1) / rows.length,
        y: total ? acc / total : 0,
        countryCn: d.countryCn,
        value: d[stageKey],
        cumulative: acc,
        data: d,
        order: i + 1
      });
    });

    const width = Math.max(760, el.clientWidth || 840);
    const height = 920;
    const margin = { top: 102, right: 72, bottom: 186, left: 78 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(el).html('').append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Interactive Lorenz curve with country accumulation bars');

    const defs = svg.append('defs');
    const gapGrad = defs.append('linearGradient')
      .attr('id', `ksj-lorenz-gap-grad-${width}`)
      .attr('x1', '0%').attr('x2', '0%').attr('y1', '0%').attr('y2', '100%');
    gapGrad.append('stop').attr('offset', '0%').attr('stop-color', '#6aa9ff').attr('stop-opacity', .20);
    gapGrad.append('stop').attr('offset', '100%').attr('stop-color', '#d8ebff').attr('stop-opacity', .06);

    svg.append('text')
      .attr('x', 26).attr('y', 32)
      .attr('fill', '#172033')
      .attr('font-weight', 950)
      .attr('font-size', 16.5)
      .text(`图4 Lorenz曲线：${stage.label}`);

    svg.append('text')
      .attr('x', 26).attr('y', 56)
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 760)
.text('蓝线表示合作量累计分布；越偏离均衡线，集中度越高。');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = d3.scaleLinear().domain([0, 1]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 1]).range([innerH, 0]);
    d3.select(el)
      .property('ksjLorenzXScale', x)
      .property('ksjLorenzYScale', y)
      .property('ksjLorenzInnerH', innerH)
      .property('ksjLorenzInnerW', innerW);

    g.append('g')
      .attr('class', 'ksj-grid')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-innerH).tickFormat(''));
    g.append('g')
      .attr('class', 'ksj-grid')
      .call(d3.axisLeft(y).ticks(5).tickSize(-innerW).tickFormat(''));

    const equality = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const polygon = equality.concat(points.slice().reverse());
    const lineGen = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);

    g.append('path')
      .datum(polygon)
      .attr('fill', `url(#ksj-lorenz-gap-grad-${width})`)
      .attr('d', d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveLinear) + 'Z');

    g.append('path')
      .datum(equality)
      .attr('fill', 'none')
      .attr('stroke', '#94acc8')
      .attr('stroke-width', 2.6)
      .attr('stroke-dasharray', '7 7')
      .attr('d', d3.line().x(d => x(d.x)).y(d => y(d.y)));

    g.append('path')
      .datum(points)
      .attr('fill', 'none')
      .attr('stroke', '#236ed0')
      .attr('stroke-width', 5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineGen);

    const focusGuide = g.append('g')
      .attr('class', 'ksj-lorenz-focus-guide')
      .style('opacity', 0);
    focusGuide.append('line').attr('class', 'ksj-focus-x');
    focusGuide.append('line').attr('class', 'ksj-focus-y');
    focusGuide.append('circle').attr('class', 'ksj-focus-ring').attr('r', 9);
    focusGuide.append('text').attr('class', 'ksj-focus-label');

    g.append('text')
      .attr('x', x(.66))
      .attr('y', y(.73))
      .attr('fill', '#6d82a0')
      .attr('font-size', 12)
      .attr('font-weight', 900)
      .text('完全均衡线：各国贡献相同时，蓝线会接近该线');

    g.append('text')
      .attr('x', x(.34))
      .attr('y', y(.09))
      .attr('fill', '#315cba')
      .attr('font-size', 12)
      .attr('font-weight', 900)
      .text('蓝色阴影越大，合作越集中');

    const dot = g.selectAll('.ksj-lorenz-country-dot')
      .data(points.slice(1))
      .join('circle')
      .attr('class', d => `ksj-lorenz-country-dot country-${slug(d.data.country)} type-${d.data.type}`)
      .attr('data-country', d => d.data.country)
      .attr('cx', d => x(d.x))
      .attr('cy', d => y(d.y))
      .attr('r', d => d.data.rank2 <= 5 ? 6.6 : 4.9)
      .attr('fill', d => typeColor(d.data.type))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2.2)
      .on('mouseenter', (event, d) => { setCountryHover(event, d.data); renderLorenzCard(d); showLorenzFocus(d); })
      .on('mousemove', (event, d) => { showLorenzTooltip(event, d); renderLorenzCard(d); showLorenzFocus(d); })
      .on('mouseleave', () => { clearCountryHover(); })
      .on('click', (event, d) => { selectCountry(d.data); renderLorenzCard(d); showLorenzFocus(d); });

    g.append('g')
      .attr('class', 'ksj-axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`));
    g.append('g')
      .attr('class', 'ksj-axis')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${Math.round(d * 100)}%`));

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', innerH + 50)
      .attr('text-anchor', 'middle')
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 850)
      .text('累计国家比例');
    g.append('text')
      .attr('x', -innerH / 2)
      .attr('y', -52)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .attr('fill', '#667085')
      .attr('font-size', 12)
      .attr('font-weight', 850)
      .text('累计合作量比例');

    const stripY = innerH + 84;
    const strip = g.append('g').attr('transform', `translate(0,${stripY})`);
    strip.append('text')
      .attr('x', 0).attr('y', -18)
      .attr('fill', '#172033')
      .attr('font-size', 12.5)
      .attr('font-weight', 930)
      .text('国家贡献条：每段代表一个国家，宽度表示该国贡献份额');

    let segX = 0;
    strip.selectAll('.ksj-lorenz-segment')
      .data(rows)
      .join('rect')
      .attr('class', d => `ksj-lorenz-segment country-${slug(d.country)} type-${d.type}`)
      .attr('data-country', d => d.country)
      .attr('x', d => {
        const x0 = segX;
        segX += total ? (d[stageKey] / total) * innerW : 0;
        return x0;
      })
      .attr('y', 0)
      .attr('width', d => Math.max(4, total ? (d[stageKey] / total) * innerW : 0))
      .attr('height', 24)
      .attr('rx', 7)
      .attr('fill', d => typeColor(d.type))
      .attr('fill-opacity', .94)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.2)
      .on('mouseenter', (event, d) => {
        const point = points.find(p => p.data && p.data.country === d.country);
        setCountryHover(event, d);
        renderLorenzCard(point);
        showLorenzFocus(point);
      })
      .on('mousemove', (event, d) => {
        const point = points.find(p => p.data && p.data.country === d.country);
        showLorenzTooltip(event, point);
        renderLorenzCard(point);
        showLorenzFocus(point);
      })
      .on('mouseleave', () => { clearCountryHover(); })
      .on('click', (event, d) => {
        const point = points.find(p => p.data && p.data.country === d.country);
        selectCountry(d);
        renderLorenzCard(point);
        showLorenzFocus(point);
      });

    // 在贡献条下面放几个关键国家名，避免它看起来只是装饰条。
    strip.selectAll('.ksj-strip-label')
      .data(rows.filter(d => d.rank2 <= 5 || d[stageKey] / total > .06))
      .join('text')
      .attr('class', 'ksj-strip-label')
      .attr('x', d => {
        let before = 0;
        rows.forEach(r => { if (rows.indexOf(r) < rows.indexOf(d)) before += total ? (r[stageKey] / total) * innerW : 0; });
        return before + Math.max(4, total ? (d[stageKey] / total) * innerW : 0) / 2;
      })
      .attr('y', 44)
      .attr('text-anchor', 'middle')
      .attr('fill', '#4f5f73')
      .attr('font-size', 10.5)
      .attr('font-weight', 850)
      .text(d => d.countryCn);

    // 指标说明已移至下方“指标说明与综合结论”卡片，避免图内文字重复。
  }

  function showLorenzTooltip(event, d) {
    if (!d) return;
    const html = `
      <div class="ksj-tooltip-title">累加至：${d.countryCn}</div>
      <div class="ksj-tooltip-row"><span>该国合作量</span><b>${fmt.int(d.value)}</b></div>
      <div class="ksj-tooltip-row"><span>累计国家比例</span><b>${fmt.pct1(d.x * 100)}%</b></div>
      <div class="ksj-tooltip-row"><span>累计合作量比例</span><b>${fmt.pct1(d.y * 100)}%</b></div>
      <div class="ksj-tooltip-row"><span>国家类型</span><b>${d.data.typeLabel}</b></div>
    `;
    moveTooltip(event, html);
  }

  function renderLorenzCard(point) {
    const el = d3.select('#ksj-lorenz-card');
    if (el.empty()) return;
    const stageKey = state.view.stage;
    const stage = state.data.stages.find(s => s.key === stageKey) || state.data.stages[1];
    const stageLabel = stageKey === 'p1' ? '2011–2015' : '2016–2020';
    if (!point || !point.data) {
      el.html(`
        <div class="ksj-mini-title">集中度指标</div>
        <div class="ksj-card-big-value">Gini ${fmt.pct(stage.gini)}</div>
        <div class="ksj-muted">Lorenz曲线按各国合作量从小到大累加。蓝线越接近对角线，分布越均衡；越向右下弯，集中度越高。</div>
        <div class="ksj-country-grid">
          ${countryStatHTML('Gini', fmt.pct(stage.gini))}
          ${countryStatHTML('HHI', fmt.pct(stage.hhi))}
          ${countryStatHTML('Top3占比', `${fmt.pct1(stage.top3Share * 100)}%`)}
          ${countryStatHTML('Top5占比', `${fmt.pct1(stage.top5Share * 100)}%`)}
        </div>
        <div class="ksj-bullet-panel">
          <div class="ksj-bullet-title">指标说明</div>
          <ul class="ksj-bullet-list">
            <li>灰色对角线表示完全均衡，蓝线越接近对角线，分布越均衡。</li>
            <li>蓝线越向右下方弯曲，说明合作越集中于少数国家。</li>
            <li>Gini衡量分布差异，HHI衡量头部集中度；数值越高，合作越集中。</li>
          </ul>
        </div>
      `);
      return;
    }
    const d = point.data;
    const share = stage.total ? d[stageKey] / stage.total : 0;
    el.html(`
      <div class="ksj-mini-title">Lorenz累计点</div>
      <div class="ksj-country-name">${d.countryCn}</div>
      <div class="ksj-country-type">${d.typeLabel}</div>
      <div class="ksj-muted">按合作量从小到大累加至 ${d.countryCn} 时，国家比例为 ${fmt.pct1(point.x * 100)}%，合作量比例为 ${fmt.pct1(point.y * 100)}%。两者差距越大，集中度越高。</div>
      <div class="ksj-country-grid">
        ${countryStatHTML('该国合作量', fmt.int(point.value))}
        ${countryStatHTML('该国份额', `${fmt.pct1(share * 100)}%`)}
        ${countryStatHTML('累计国家比例', `${fmt.pct1(point.x * 100)}%`)}
        ${countryStatHTML('累计合作比例', `${fmt.pct1(point.y * 100)}%`)}
      </div>
      <div class="ksj-bullet-panel">
        <div class="ksj-bullet-title">累计点说明</div>
        <ul class="ksj-bullet-list">
          <li>累计国家比例表示已纳入国家数占样本国家总数的比例，此处为 ${fmt.pct1(point.x * 100)}%。</li>
          <li>累计合作比例表示已纳入国家合作量占阶段总量的比例，此处为 ${fmt.pct1(point.y * 100)}%。</li>
          <li>若国家比例较高但合作比例较低，说明贡献集中于少数高贡献国家。</li>
        </ul>
      </div>
    `);
  }


  function renderConclusion() {
    const s1 = state.data.stages[0];
    const s2 = state.data.stages[1];
    const totalGrowth = s1.total ? s2.total / s1.total - 1 : 0;
    const giniChange = s2.gini - s1.gini;
    const top3Change = s2.top3Share - s1.top3Share;
    const top5Change = s2.top5Share - s1.top5Share;
    const hhiChange = s2.hhi - s1.hhi;
    const top3Names = s2.values.slice(0, 3).map(row => row.countryCn).join('、');
    const moreEven = giniChange < 0 && top5Change < 0 && hhiChange < 0;

    const sentence = moreEven
      ? '合作规模扩大，同时集中度有所下降，分布更均衡。'
      : '合作规模扩大，但合作贡献仍主要集中在头部国家。';

    d3.select('#ksj-conclusion').html(`
      <div class="ksj-conclusion-line">
        <b>集中度变化：</b>2016—2020阶段合作总量较2011—2015阶段增长 <b>${fmt.growth(totalGrowth)}</b>。
        后期TOP3合作国家（${top3Names}）合计占比为 <b>${fmt.pct1(s2.top3Share * 100)}%</b>，较前期 <b class="${statToneClass(formatPP(top3Change))}">${formatPP(top3Change)}</b>；
        TOP5合作国家占比较前期 <b class="${statToneClass(formatPP(top5Change))}">${formatPP(top5Change)}</b>。
        ${sentence}
      </div>
    `);
  }


  function setCountryHover(event, d) {
    state.view.hoveredCountry = d.country;
    applyHighlighting();
    showCountryTooltip(event, d);
    renderSelectedCard(d, true);
    renderBalanceCard(d, true);
    renderBalanceLinkCard(d);
    syncLorenzFromCountry(d.country);
  }

  function clearCountryHover() {
    state.view.hoveredCountry = null;
    hideTooltip();
    applyHighlighting();
    if (state.view.selectedCountry) {
      const selected = state.data.countries.find(d => d.country === state.view.selectedCountry);
      renderSelectedCard(selected);
      renderBalanceCard(selected);
      renderBalanceLinkCard(selected);
      syncLorenzFromCountry(selected.country);
    } else {
      renderSelectedCard(null);
      renderBalanceCard(null);
      renderBalanceLinkCard(null);
      renderLorenzCard(null);
      hideLorenzFocus();
    }
  }

  function selectCountry(d) {
    state.view.selectedCountry = state.view.selectedCountry === d.country ? null : d.country;
    const active = state.view.selectedCountry ? d : null;
    renderSelectedCard(active);
    renderBalanceCard(active);
    renderBalanceLinkCard(active);
    if (active) syncLorenzFromCountry(active.country);
    else { renderLorenzCard(null); hideLorenzFocus(); }
    applyHighlighting();
  }

  function renderSelectedCard(d, temporary = false) {
    const el = d3.select('#ksj-selected-card');
    if (el.empty()) return;
    if (!d) {
      el.html(`
        <div class="ksj-mini-title">国家结构卡片</div>
        <div class="ksj-muted ksj-card-lead">悬停或点击图2中的国家后，右侧卡片会更新为对应国家。</div>
        <div class="ksj-country-grid ksj-clean-grid ksj-selected-grid">
          ${countryStatHTML('前期', '2011–2015')}
          ${countryStatHTML('后期', '2016–2020')}
          ${countryStatHTML('线条', '新增量')}
          ${countryStatHTML('点击', '锁定国家')}
        </div>
        ${countryTypeDefinitionHTML()}
      `);
      return;
    }
    const rankText = d.rankChange > 0 ? `上升 ${d.rankChange} 位` : d.rankChange < 0 ? `下降 ${Math.abs(d.rankChange)} 位` : '排名不变';
    el.html(`
      <div class="ksj-mini-title">${temporary ? '悬停国家' : '选中国家'}</div>
      <div class="ksj-country-name">${d.countryCn}</div>
      <div class="ksj-country-type">${d.typeLabel}</div>
      <div class="ksj-muted ksj-card-lead">后期排名第 ${d.rank2}，较前期${rankText}。</div>
      <div class="ksj-country-grid ksj-clean-grid ksj-selected-grid">
        ${countryStatHTML('2011–2015', `${fmt.int(d.p1)} 篇`)}
        ${countryStatHTML('2016–2020', `${fmt.int(d.p2)} 篇`)}
        ${countryStatHTML('新增合作量', `${d.diff >= 0 ? '+' : ''}${fmt.int(d.diff)} 篇`)}
        ${countryStatHTML('排名变化', rankText)}
      </div>
      ${countryTypeDefinitionHTML(d.type)}
    `);
  }


  function renderBalanceCard(d, temporary = false) {
    const el = d3.select('#ksj-balance-card');
    if (el.empty()) return;
    const stageKey = state.view.stage;
    const stage = state.data.stages.find(s => s.key === stageKey) || state.data.stages[1];
    const stageLabel = stageKey === 'p1' ? '2011–2015' : '2016–2020';
    if (!d) {
      el.html(`
        <div class="ksj-mini-title">结构总览</div>
        <div class="ksj-card-big-value">Top5 ${fmt.pct1(stage.top5Share * 100)}%</div>
        <div class="ksj-muted">Top5占比表示前五个国家的合计份额。数值越高，头部集中度越高。</div>
        <div class="ksj-country-grid">
          ${countryStatHTML('Top3占比', `${fmt.pct1(stage.top3Share * 100)}%`)}
          ${countryStatHTML('Top5占比', `${fmt.pct1(stage.top5Share * 100)}%`)}
          ${countryStatHTML('第一名国家', stage.top1.countryCn)}
          ${countryStatHTML('阶段总量', fmt.int(stage.total))}
        </div>
        <div class="ksj-bullet-panel">
          <div class="ksj-bullet-title">指标说明</div>
          <ul class="ksj-bullet-list">
            <li>气泡面积表示国家阶段合作量。气泡越大，贡献越高。</li>
            <li>如果大气泡集中在少数国家，说明头部集中度较高。</li>
            <li>可结合 Top3 和 Top5 占比判断头部集中程度。</li>
          </ul>
        </div>
      `);
      return;
    }
    const rows = state.data.countries.slice().sort((a, b) => d3.ascending(a[stageKey], b[stageKey]));
    const total = d3.sum(rows, x => x[stageKey]);
    let acc = 0;
    let cumulative = 0;
    let order = 0;
    rows.forEach((row, i) => {
      acc += row[stageKey];
      if (row.country === d.country) {
        cumulative = total ? acc / total : 0;
        order = i + 1;
      }
    });
    const value = d[stageKey];
    const share = total ? value / total : 0;
    el.html(`
      <div class="ksj-mini-title">${temporary ? '悬停国家' : '选中国家'}：气泡解读</div>
      <div class="ksj-country-name">${d.countryCn}</div>
      <div class="ksj-country-type">${d.typeLabel}</div>
      <div class="ksj-muted">在 ${stageLabel}，${d.countryCn}贡献 ${fmt.int(value)} 篇，占样本国家总量的 ${fmt.pct1(share * 100)}%。气泡越大，阶段贡献越高。</div>
      <div class="ksj-country-grid">
        ${countryStatHTML('阶段合作量', fmt.int(value))}
        ${countryStatHTML('阶段份额', `${fmt.pct1(share * 100)}%`)}
        ${countryStatHTML('累计顺序', `第 ${order} 个`)}
        ${countryStatHTML('累计合作比例', `${fmt.pct1(cumulative * 100)}%`)}
      </div>
      <div class="ksj-bullet-panel">
        <div class="ksj-bullet-title">结构说明</div>
        <ul class="ksj-bullet-list">
          <li>阶段份额 = 该国阶段合作量 ÷ 样本国家阶段总量，用于衡量贡献权重。</li>
          <li>份额较高的国家会明显影响 Lorenz 曲线后段走势。</li>
          <li>因此，该国对集中度判断具有较高解释价值。</li>
        </ul>
      </div>
    `);
  }

  function countryTypeDefinitionHTML(activeType = null) {
    const rows = [
      ['core', '核心国家', '后期排名前3，或后期合作份额较高，是合作结构中的主要支撑。'],
      ['middle', '稳定国家', '后期排名或份额保持在中上水平，构成相对稳定的合作主体。'],
      ['chaser', '追赶国家', '增长率较高且新增合作量为正，说明后期合作扩张较快。'],
      ['tail', '长尾国家', '合作规模或新增贡献相对较小，主要位于合作结构的外围。']
    ];
    const visibleRows = activeType ? rows.filter(([type]) => type === activeType) : rows;
    const title = activeType ? '当前类型定义' : '国家类型定义';
    return `
      <div class="ksj-bullet-panel ksj-type-definition-panel">
        <div class="ksj-bullet-title">${title}</div>
        <ul class="ksj-bullet-list">
          ${visibleRows.map(([type, label, desc]) => `<li><b>${label}</b>：${desc}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function countryStatHTML(label, value) {
    return `<div class="ksj-country-stat"><span>${label}</span><b class="${statToneClass(value)}">${value}</b></div>`;
  }

  function miniStatHTML(label, value) {
    return `<div class="ksj-link-mini-stat"><span>${label}</span><b class="${statToneClass(value)}">${value}</b></div>`;
  }

  function statToneClass(value) {
    const text = String(value ?? '').trim();
    if (/^\+/.test(text) || text.includes('上升') || text.includes('增长')) return 'ksj-stat-positive';
    if (/^-/.test(text) || text.includes('下降')) return 'ksj-stat-negative';
    return 'ksj-stat-neutral';
  }

  function typeDefinition(type) {
    return {
      core: '核心国家指后期排名前3，或后期合作份额≥13%的国家。',
      middle: '稳定国家：未进入核心，但后期排名前8，或后期合作份额≥7%。',
      chaser: '追赶国家：未进入核心或稳定范围，但增长率高于各国中位数，且新增合作量为正。',
      tail: '长尾国家指不满足以上条件，未满足核心、稳定、追赶条件，合作规模或增量较小的国家。'
    }[type] || '该类型用于说明国家在合作结构中的相对位置。';
  }


  function formatPP(value) {
    const scaled = value * 100;
    return `${scaled >= 0 ? '+' : ''}${d3.format('.1f')(scaled)}pp`;
  }

  function computeLinearTrend(data, xAccessor, yAccessor) {
    const rows = data
      .map(d => ({ x: +xAccessor(d), y: +yAccessor(d) }))
      .filter(d => Number.isFinite(d.x) && Number.isFinite(d.y));
    const n = rows.length;
    if (n < 2) return null;
    const meanX = d3.mean(rows, d => d.x);
    const meanY = d3.mean(rows, d => d.y);
    const denominator = d3.sum(rows, d => Math.pow(d.x - meanX, 2));
    if (!denominator) return null;
    const slope = d3.sum(rows, d => (d.x - meanX) * (d.y - meanY)) / denominator;
    const intercept = meanY - slope * meanX;
    const x1 = d3.min(rows, d => d.x);
    const x2 = d3.max(rows, d => d.x);
    return { x1, y1: slope * x1 + intercept, x2, y2: slope * x2 + intercept };
  }

  function countryNarrative(d) {
    if (d.type === 'core') return '该国是主要合作支撑。';
    if (d.type === 'middle') return '该国是稳定贡献主体。';
    if (d.type === 'chaser') return '该国后期增长较快，具有追赶特征。';
    return '该国合作规模或新增贡献相对较小，属于长尾结构。';
  }

  function showCountryTooltip(event, d) {
    const html = `
      <div class="ksj-tooltip-title">${d.countryCn} · ${d.typeLabel}</div>
      <div class="ksj-tooltip-row"><span>2011–2015</span><b>${fmt.int(d.p1)}</b></div>
      <div class="ksj-tooltip-row"><span>2016–2020</span><b>${fmt.int(d.p2)}</b></div>
      <div class="ksj-tooltip-row"><span>增长率</span><b>${formatGrowthRate(d.growthRate)}</b></div>
      <div class="ksj-tooltip-row"><span>后期份额</span><b>${fmt.pct1(d.share2 * 100)}%</b></div>
      <div class="ksj-tooltip-row"><span>排名变化</span><b>${d.rankChange > 0 ? '+' : ''}${d.rankChange}</b></div>
    `;
    moveTooltip(event, html);
  }

  function formatGrowthRate(rate) {
    if (!Number.isFinite(rate)) return '新增';
    return fmt.growth(rate);
  }

  function moveTooltip(event, html) {
    state.tooltip
      .html(html)
      .style('left', `${event.clientX}px`)
      .style('top', `${event.clientY}px`)
      .style('opacity', 1);
  }

  function hideTooltip() {
    if (state.tooltip) state.tooltip.style('opacity', 0);
  }

  function applyHighlighting() {
    const selected = state.view.selectedCountry;
    const hovered = state.view.hoveredCountry;
    const focus = state.view.highlightMode;
    const activeCountry = hovered || selected;
    const hasFilter = focus && focus !== 'all';

    d3.selectAll('[data-country]').each(function () {
      const country = this.getAttribute('data-country');
      const d = state.data.countries.find(x => x.country === country);
      const shouldShow = countryShouldShow(d, focus, activeCountry);
      d3.select(this)
        .classed('ksj-dim', !shouldShow)
        .classed('ksj-emphasis', !!activeCountry && country === activeCountry)
        .classed('ksj-focus-hit', !activeCountry && hasFilter && shouldShow);
    });
  }

  function countryShouldShow(d, focus, activeCountry) {
    if (!d) return true;
    if (activeCountry) return d.country === activeCountry;
    if (focus === 'all') return true;
    if (focus === 'core') return d.type === 'core';
    if (focus === 'chaser') return d.type === 'chaser';
    if (focus === 'tail') return d.type === 'tail';
    if (focus === 'top3') return d.rank2 <= 3;
    if (focus === 'top5') return d.rank2 <= 5;
    return true;
  }

  function typeColor(type) {
    return {
      core: '#1f6ed4',
      middle: '#5aa7f3',
      chaser: '#22b8a9',
      tail: '#9bbce0'
    }[type] || '#8aa6a3';
  }

  function slug(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function setupResize() {
    if (state.ro) state.ro.disconnect();
    const target = document.getElementById(TARGET_ID);
    state.ro = new ResizeObserver(() => {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(() => {
        renderMacroChart();
        renderRankFlow();
        const active = state.view.selectedCountry ? state.data.countries.find(d => d.country === state.view.selectedCountry) : null;
        renderBubbleMap();
        renderLorenzChart();
        renderLorenzCard(active ? getLorenzPointForCountry(active.country) : null);
        renderBalanceLinkCard(active);
        applyHighlighting();
      }, 150);
    });
    if (target) state.ro.observe(target);
  }

  function showLoadError(error) {
    console.error(error);
    state.root.html(`
      <div class="ksj-empty">
        <h3>数据加载失败</h3>
        <p>${escapeHtml(error.message || String(error))}</p>
        <p>请确认已正确放置 <b>area.csv</b> 和 <b>country.csv</b>，并通过 Live Server 或 GitHub Pages 访问页面。</p>
      </div>
    `);
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[c]));
  }
})();
