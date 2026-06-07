/**
 * chart-cee-v2.js
 * 图3：中东欧深度分析
 *   左侧：中东欧地图（hover高亮）
 *   右上：16国发文量排序 + 增速徽章
 *   右下：hover国在两个阶段占中东欧整体比例（stacked bar）
 *   底部：各地区增速对比横向表格
 * Target: <div id="cee-chart"></div>
 * 依赖: D3.js v7, TopoJSON client v3
 */
(function () {
  'use strict';

  // =========================================================
  // 1. CEE 国家数据
  // =========================================================
  const CEE_DATA = [
    {cn:"波兰",    country:"POLAND",               iso3:"POL",num:"616",p11:3252,p16:6866,r11:21,r16:23},
    {cn:"捷克",    country:"CZECH REPUBLIC",        iso3:"CZE",num:"203",p11:2450,p16:5063,r11:27,r16:30},
    {cn:"希腊",    country:"GREECE",                iso3:"GRC",num:"300",p11:2086,p16:4193,r11:30,r16:37},
    {cn:"匈牙利",  country:"HUNGARY",               iso3:"HUN",num:"348",p11:1901,p16:3673,r11:34,r16:39},
    {cn:"罗马尼亚",country:"ROMANIA",               iso3:"ROU",num:"642",p11:1596,p16:3124,r11:38,r16:41},
    {cn:"塞尔维亚",country:"SERBIA",                iso3:"SRB",num:"688",p11:1295,p16:1967,r11:42,r16:47},
    {cn:"斯洛文尼亚",country:"SLOVENIA",             iso3:"SVN",num:"705",p11:1045,p16:1920,r11:46,r16:48},
    {cn:"斯洛伐克",country:"SLOVAKIA",               iso3:"SVK",num:"703",p11:896, p16:1809,r11:52,r16:50},
    {cn:"克罗地亚",country:"CROATIA",               iso3:"HRV",num:"191",p11:907, p16:1690,r11:51,r16:51},
    {cn:"保加利亚",country:"BULGARIA",              iso3:"BGR",num:"100",p11:693, p16:1621,r11:55,r16:52},
    {cn:"爱沙尼亚",country:"ESTONIA",               iso3:"EST",num:"233",p11:714, p16:1528,r11:54,r16:53},
    {cn:"拉脱维亚",country:"LATVIA",                iso3:"LVA",num:"428",p11:97,  p16:1028,r11:86,r16:64},
    {cn:"北马其顿",country:"MACEDONIA",             iso3:"MKD",num:"807",p11:70,  p16:178, r11:94,r16:99},
    {cn:"黑山",    country:"MONTENEGRO",            iso3:"MNE",num:"499",p11:11,  p16:129, r11:139,r16:108},
    {cn:"波黑",    country:"BOSNIA & HERZEGOVINA",  iso3:"BIH",num:"070",p11:17,  p16:90,  r11:132,r16:117},
    {cn:"阿尔巴尼亚",country:"ALBANIA",             iso3:"ALB",num:"008",p11:6,   p16:71,  r11:150,r16:124}
  ];

  // 区域增速对比表（预计算）
  const REGION_GROWTH = [
    { r:'北美',     p11:159497, p16:309710 },
    { r:'西欧',     p11:119600, p16:260000 },
    { r:'东亚',     p11:37244,  p16:61536  },
    { r:'东南亚',   p11:18975,  p16:44491  },
    { r:'中东欧',   p11:17036,  p16:34950  },
    { r:'中东',     p11:15248,  p16:40701  },
    { r:'南亚',     p11:8508,   p16:32592  },
    { r:'东欧',     p11:10289,  p16:21038  },
    { r:'拉丁美洲', p11:9586,   p16:20116  },
    { r:'非洲',     p11:3454,   p16:10811  },
    { r:'中亚',     p11:211,    p16:1080   }
  ].map(d => ({ ...d, growth: ((d.p16 - d.p11) / d.p11 * 100).toFixed(1) }));

  // =========================================================
  // 2. 状态
  // =========================================================
  let hoveredCountry = null;
  let worldGeoData   = null;
  let resizeTimer;
  const fmt = d3.format(',');
  const CEE_TOTAL_P11 = CEE_DATA.reduce((s, d) => s + d.p11, 0); // 17036
  const CEE_TOTAL_P16 = CEE_DATA.reduce((s, d) => s + d.p16, 0); // 34950

  const ceeByNum = {};
  CEE_DATA.forEach(d => {
    [d.num, +d.num, String(+d.num)].forEach(k => { ceeByNum[k] = d; });
  });

  // =========================================================
  // 3. Tooltip
  // =========================================================
  function initTooltip() {
    if (document.getElementById('cee2-tt')) return;
    const tt = document.createElement('div');
    tt.id = 'cee2-tt';
    tt.style.cssText = `position:fixed;display:none;pointer-events:none;z-index:9999;
      background:rgba(15,23,42,.96);color:#f8fafc;border-radius:9px;
      padding:11px 14px;font-size:12px;line-height:1.65;
      box-shadow:0 6px 24px rgba(0,0,0,.28);max-width:200px;
      font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;`;
    document.body.appendChild(tt);

    window.cee2ShowTip = function(e, d) {
      const gr = d.p11 > 0 ? ((d.p16 - d.p11) / d.p11 * 100).toFixed(1) : '—';
      const share11 = (d.p11 / CEE_TOTAL_P11 * 100).toFixed(1);
      const share16 = (d.p16 / CEE_TOTAL_P16 * 100).toFixed(1);
      tt.innerHTML = `
        <div style="font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,.12);
          padding-bottom:5px;margin-bottom:6px;">${d.cn}</div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">2011–2015</span>
          <span>${fmt(d.p11)} 篇</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">2016–2020</span>
          <span style="color:#93c5fd;font-weight:600;">${fmt(d.p16)} 篇</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">增幅</span>
          <span style="color:#6ee7b7;">+${gr}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:rgba(255,255,255,.5);">区域占比</span>
          <span style="color:#fbbf24;">${share11}% → ${share16}%</span>
        </div>`;
      tt.style.display = 'block';
      window.cee2MoveTip(e);
    };
    window.cee2MoveTip = function(e) {
      let x = e.clientX + 14, y = e.clientY + 12;
      if (x + 210 > window.innerWidth)  x = e.clientX - 220;
      if (y + 200 > window.innerHeight) y = e.clientY - 210;
      tt.style.left = x + 'px'; tt.style.top = y + 'px';
    };
    window.cee2HideTip = () => { tt.style.display = 'none'; };
  }

  // =========================================================
  // 4. 注入 HTML 骨架
  // =========================================================
  function injectHTML() {
    const el = document.getElementById('cee-chart');
    if (!el) return;
    el.style.fontFamily = "'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif";

    el.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:20px 22px;
        box-shadow:0 2px 10px rgba(0,0,0,.07);border:1px solid #dde4ec;">

        <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;">
          中东欧16国深度分析
        </div>
        <div style="font-size:11.5px;color:#64748b;margin-bottom:16px;">
          悬停地图国家 → 右侧面板联动高亮 ·
          <span style="color:#d97706;font-weight:600;">橙色</span>深浅 = 发文量高低
        </div>

        <!-- 主体双栏 -->
        <div id="cee2-main" style="display:grid;grid-template-columns:340px 1fr;gap:18px;
          align-items:start;margin-bottom:18px;">

          <!-- 左：地图 -->
          <div style="background:#f0f6fb;border-radius:10px;overflow:hidden;position:relative;">
            <svg id="cee2-map-svg" style="width:100%;display:block;"></svg>
            <div style="font-size:10.5px;color:#94a3b8;padding:6px 10px;
              text-align:center;">悬停查看各国数据</div>
          </div>

          <!-- 右：上下分栏 -->
          <div style="display:flex;flex-direction:column;gap:14px;">

            <!-- 右上：排名 + 增速 -->
            <div>
              <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;
                letter-spacing:.06em;margin-bottom:8px;">16国发文量排序（2016–2020）· 右侧为增速</div>
              <svg id="cee2-rank-svg" style="display:block;width:100%;overflow:visible;"></svg>
            </div>

            <!-- 右下：stacked 占比 -->
            <div>
              <div id="cee2-share-header" style="font-size:11px;font-weight:700;color:#94a3b8;
                text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
                悬停国家的区域占比（两阶段对比）
              </div>
              <div id="cee2-share-wrap" style="min-height:48px;"></div>
            </div>

          </div>
        </div>

        <!-- 底部：区域增速对比表 -->
        <div>
          <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;
            letter-spacing:.06em;margin-bottom:10px;">各地区增速对比（2011–2015 → 2016–2020）</div>
          <div id="cee2-table" style="overflow-x:auto;"></div>
        </div>

      </div>
    `;
  }

  // =========================================================
  // 5. 加载 TopoJSON
  // =========================================================
  function loadTopojson() {
    if (window.topojson) return Promise.resolve();
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';
      s.onload = res;
      document.head.appendChild(s);
    });
  }

  // =========================================================
  // 6. 渲染 CEE 地图
  // =========================================================
  async function drawMap() {
    if (!worldGeoData) {
      await loadTopojson();
      const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      worldGeoData = topojson.feature(world, world.objects.countries);
    }
    const wrap = document.getElementById('cee2-map-svg');
    if (!wrap) return;
    const container = wrap.parentElement;
    const W = container.clientWidth || 340;
    const H = Math.round(W * 1.15);

    const svg = d3.select('#cee2-map-svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .style('height', H + 'px');
    svg.selectAll('*').remove();

    // 聚焦 CEE 区域
    const ceeFeatures = worldGeoData.features.filter(f => ceeByNum[f.id]);
    const proj = d3.geoMercator();
    const PAD  = 20;
    proj.fitExtent([[PAD, PAD], [W - PAD, H - PAD]],
      { type: 'FeatureCollection', features: ceeFeatures });
    const path = d3.geoPath().projection(proj);

    svg.append('rect').attr('width', W).attr('height', H).attr('fill', '#dceefa');
    svg.append('path').datum(d3.geoGraticule().step([5,5])())
      .attr('d', path).attr('fill','none').attr('stroke','#c5d8eb').attr('stroke-width',0.4);

    // 所有国家（背景）
    svg.append('g').attr('class','bg-countries')
      .selectAll('path').data(worldGeoData.features).join('path')
      .attr('d', path)
      .attr('fill', f => ceeByNum[f.id] ? '' : '#e4edf5')
      .attr('stroke', '#c8d6e4').attr('stroke-width', 0.3)
      .filter(f => !ceeByNum[f.id]);

    // CEE 国家
    const colorScale = d3.scaleSequentialLog(d3.interpolateOranges)
      .domain([d3.min(CEE_DATA, d => Math.max(d.p16, 1)), d3.max(CEE_DATA, d => d.p16)]);

    svg.append('g').attr('class','cee-countries')
      .selectAll('path').data(ceeFeatures).join('path')
      .attr('d', path)
      .attr('fill', f => {
        const d = ceeByNum[f.id];
        return d ? colorScale(d.p16) : '#e8eef3';
      })
      .attr('stroke', '#b45309').attr('stroke-width', 1.2)
      .attr('cursor','pointer')
      .on('mouseover', function(e, f) {
        const d = ceeByNum[f.id];
        if (!d) return;
        hoveredCountry = d.cn;
        d3.select(this).attr('stroke','#0f172a').attr('stroke-width', 2.5).raise();
        window.cee2ShowTip(e, d);
        updateRankHighlight(d.cn);
        updateSharePanel(d);
      })
      .on('mousemove', window.cee2MoveTip)
      .on('mouseout', function(e, f) {
        const d = ceeByNum[f.id];
        hoveredCountry = null;
        d3.select(this).attr('stroke','#b45309').attr('stroke-width',1.2);
        window.cee2HideTip();
        clearRankHighlight();
        resetSharePanel();
      });

    // 国家名标注（仅大国）
    const abbr = {'北马其顿':'北马','波黑':'波黑','黑山':'黑山','阿尔巴尼亚':'阿尔巴',
                  '斯洛文尼亚':'斯洛文','斯洛伐克':'斯洛伐'};
    svg.append('g').attr('class','labels')
      .selectAll('text').data(ceeFeatures).join('text')
      .attr('x', f => path.centroid(f)[0])
      .attr('y', f => path.centroid(f)[1] + 4)
      .attr('text-anchor','middle')
      .attr('font-size', f => {
        const d = ceeByNum[f.id];
        return d && d.p16 > 3000 ? 11 : 9;
      })
      .attr('font-weight','600').attr('fill','#fff')
      .attr('paint-order','stroke').attr('stroke','rgba(0,0,0,.3)').attr('stroke-width',2.5)
      .attr('pointer-events','none')
      .text(f => {
        const d = ceeByNum[f.id];
        if (!d) return '';
        const [cx, cy] = path.centroid(f);
        if (isNaN(cx)) return '';
        return abbr[d.cn] || d.cn;
      });
  }

  // =========================================================
  // 7. 渲染右上排名图
  // =========================================================
  function renderRankBars() {
    const el = document.getElementById('cee2-rank-svg');
    if (!el) return;
    const W   = el.parentElement.clientWidth || 380;
    const mL  = 68, mR = 72, mT = 4, mB = 6;
    const ROW = 26;
    const data = [...CEE_DATA].sort((a, b) => b.p16 - a.p16);
    const H    = data.length * ROW + mT + mB;
    const max  = d3.max(data, d => d.p16) * 1.05;
    const x    = d3.scaleLinear().domain([0, max]).range([0, W - mL - mR]);

    const colorScale = d3.scaleSequentialLog(d3.interpolateOranges)
      .domain([d3.min(CEE_DATA, d => Math.max(d.p16, 1)), d3.max(CEE_DATA, d => d.p16)]);

    const svg = d3.select('#cee2-rank-svg').attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`);

    data.forEach((d, i) => {
      const y  = i * ROW;
      const iW = W - mL - mR;
      const gr = d.p11 > 0 ? ((d.p16 - d.p11) / d.p11 * 100).toFixed(0) : '—';

      // 斑马纹
      g.append('rect').attr('x', -mL).attr('y', y).attr('width', W).attr('height', ROW)
        .attr('fill', i % 2 === 0 ? '#fafbfc' : '#fff').attr('class', `rk-row-${d.cn.replace(/\s/g,'_')}`);

      // 条形
      g.append('rect')
        .attr('x', 0).attr('y', y + 5).attr('width', 0).attr('height', ROW - 12).attr('rx', 3)
        .attr('fill', colorScale(d.p16)).attr('class', `rk-bar-${d.cn.replace(/\s/g,'_')}`)
        .transition().duration(400).delay(i * 25)
        .attr('width', x(d.p16));

      // 国家名
      g.append('text').attr('x', -5).attr('y', y + ROW/2 + 4.5)
        .attr('text-anchor','end').attr('font-size', 11.5).attr('fill','#374151')
        .attr('class', `rk-label-${d.cn.replace(/\s/g,'_')}`)
        .text(d.cn);

      // 数值
      g.append('text').attr('x', x(d.p16) + 5).attr('y', y + ROW/2 + 4.5)
        .attr('font-size', 10.5).attr('fill','#b45309')
        .text(fmt(d.p16));

      // 增速徽章
      const grVal = +gr;
      const grColor = grVal >= 500 ? '#7c3aed' : grVal >= 100 ? '#059669' : '#94a3b8';
      g.append('text').attr('x', iW + mR - 4).attr('y', y + ROW/2 + 4.5)
        .attr('text-anchor','end').attr('font-size', 10).attr('font-weight','700')
        .attr('fill', grColor)
        .text(gr !== '—' ? `+${gr}%` : '—');

      // 热区
      g.append('rect').attr('x', -mL).attr('y', y).attr('width', W).attr('height', ROW)
        .attr('fill','transparent').attr('cursor','default')
        .on('mouseover', e => { hoveredCountry = d.cn; window.cee2ShowTip(e, d); updateMapHighlight(d); updateSharePanel(d); })
        .on('mousemove', window.cee2MoveTip)
        .on('mouseout',  () => { hoveredCountry = null; window.cee2HideTip(); clearMapHighlight(); resetSharePanel(); });
    });
  }

  // =========================================================
  // 8. 高亮辅助
  // =========================================================
  function updateRankHighlight(cn) {
    const safe = cn.replace(/\s/g,'_');
    d3.selectAll(`[class*="rk-bar-"]`).attr('fill-opacity', 0.25);
    d3.select(`.rk-bar-${safe}`).attr('fill-opacity', 1);
    d3.selectAll(`[class*="rk-label-"]`).attr('font-weight','400').attr('fill','#9ca3af');
    d3.select(`.rk-label-${safe}`).attr('font-weight','700').attr('fill','#0f172a');
  }

  function clearRankHighlight() {
    d3.selectAll(`[class*="rk-bar-"]`).attr('fill-opacity', 1);
    d3.selectAll(`[class*="rk-label-"]`).attr('font-weight','400').attr('fill','#374151');
  }

  function updateMapHighlight(d) {
    d3.select('#cee2-map-svg').select('g.cee-countries').selectAll('path')
      .attr('fill-opacity', f => ceeByNum[f.id]?.cn === d.cn ? 1 : 0.3);
  }

  function clearMapHighlight() {
    d3.select('#cee2-map-svg').select('g.cee-countries').selectAll('path')
      .attr('fill-opacity', 1);
  }

  // =========================================================
  // 9. 右下占比面板（stacked bar）
  // =========================================================
  function updateSharePanel(d) {
    const hdr  = document.getElementById('cee2-share-header');
    const wrap = document.getElementById('cee2-share-wrap');
    if (!wrap) return;
    if (hdr) hdr.innerHTML = `<span style="color:#b45309;">${d.cn}</span> 在中东欧整体中的占比（两阶段）`;

    const share11 = d.p11 / CEE_TOTAL_P11;
    const share16 = d.p16 / CEE_TOTAL_P16;

    const rows = [
      { label: '2011–2015', total: CEE_TOTAL_P11, val: d.p11, share: share11 },
      { label: '2016–2020', total: CEE_TOTAL_P16, val: d.p16, share: share16 }
    ];

    wrap.innerHTML = rows.map(r => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;
          color:#64748b;margin-bottom:4px;">
          <span>${r.label}</span>
          <span>${fmt(r.val)} / ${fmt(r.total)} 篇 = <strong style="color:#b45309;">${(r.share*100).toFixed(1)}%</strong></span>
        </div>
        <div style="height:18px;border-radius:4px;overflow:hidden;background:#f1f5f9;position:relative;">
          <div style="height:100%;width:${(r.share*100).toFixed(2)}%;background:#d97706;
            border-radius:4px;transition:width .4s ease;"></div>
          <div style="position:absolute;left:${(r.share*100).toFixed(2)}%;top:0;
            height:100%;background:#e5e7eb;right:0;border-radius:0 4px 4px 0;"></div>
        </div>
      </div>
    `).join('');
  }

  function resetSharePanel() {
    const hdr  = document.getElementById('cee2-share-header');
    const wrap = document.getElementById('cee2-share-wrap');
    if (hdr)  hdr.textContent = '悬停国家的区域占比（两阶段对比）';
    if (wrap) wrap.innerHTML  = `<div style="font-size:12px;color:#94a3b8;padding:10px 0;">
      ← 悬停左侧地图或上方柱状图，查看该国在区域整体中的占比变化</div>`;
  }

  // =========================================================
  // 10. 底部区域增速对比表
  // =========================================================
  function renderTable() {
    const el = document.getElementById('cee2-table');
    if (!el) return;

    const globalGrowth = ((911293 - 427285) / 427285 * 100).toFixed(1);
    const maxGrowth    = d3.max(REGION_GROWTH, d => +d.growth);
    const rows         = [...REGION_GROWTH].sort((a, b) => +b.growth - +a.growth);

    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;">
            <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:600;font-size:11px;">地区</th>
            <th style="text-align:right;padding:8px 10px;color:#64748b;font-weight:600;font-size:11px;">2011–2015</th>
            <th style="text-align:right;padding:8px 10px;color:#64748b;font-weight:600;font-size:11px;">2016–2020</th>
            <th style="text-align:left;padding:8px 12px;color:#64748b;font-weight:600;font-size:11px;">增速（增幅条）</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((d, i) => {
            const isCEE = d.r === '中东欧';
            const barW  = (+d.growth / maxGrowth * 100).toFixed(1);
            const grColor = +d.growth >= 200 ? '#7c3aed' : +d.growth >= 100 ? '#059669' : '#64748b';
            return `
              <tr style="border-bottom:1px solid #f1f5f9;
                background:${isCEE ? '#fef3c7' : i%2===0?'#fafbfc':'#fff'};">
                <td style="padding:8px 10px;font-weight:${isCEE?'700':'400'};
                  color:${isCEE?'#92400e':'#374151'};">
                  ${d.r}${isCEE?' ★':''}
                </td>
                <td style="padding:8px 10px;text-align:right;color:#94a3b8;">
                  ${d.p11 >= 10000 ? d3.format('.0s')(d.p11) : fmt(d.p11)}
                </td>
                <td style="padding:8px 10px;text-align:right;font-weight:600;
                  color:${isCEE?'#b45309':'#374151'};">
                  ${d.p16 >= 10000 ? d3.format('.0s')(d.p16) : fmt(d.p16)}
                </td>
                <td style="padding:8px 12px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:10px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                      <div style="height:100%;width:${barW}%;background:${isCEE?'#d97706':grColor};
                        border-radius:3px;"></div>
                    </div>
                    <span style="font-weight:700;color:${isCEE?'#b45309':grColor};
                      font-size:11px;min-width:48px;text-align:right;">+${d.growth}%</span>
                  </div>
                </td>
              </tr>`;
          }).join('')}
          <tr style="border-top:2px solid #e2e8f0;background:#f8fafc;">
            <td style="padding:8px 10px;font-weight:700;color:#1e293b;">全球平均</td>
            <td style="padding:8px 10px;text-align:right;color:#94a3b8;">427,285</td>
            <td style="padding:8px 10px;text-align:right;font-weight:600;color:#1e293b;">911,293</td>
            <td style="padding:8px 12px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:10px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${(+globalGrowth/maxGrowth*100).toFixed(1)}%;
                    background:#2563eb;border-radius:3px;"></div>
                </div>
                <span style="font-weight:700;color:#1e40af;font-size:11px;min-width:48px;text-align:right;">+${globalGrowth}%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // =========================================================
  // 11. 初始化
  // =========================================================
  function init() {
    initTooltip();
    injectHTML();

    function tryDraw(n) {
      const wrap = document.getElementById('cee2-map-svg');
      if (wrap && wrap.parentElement && wrap.parentElement.clientWidth > 0) {
        Promise.all([drawMap()]).then(() => {
          renderRankBars();
          resetSharePanel();
          renderTable();
        }).catch(console.error);
      } else if (n < 20) {
        setTimeout(() => tryDraw(n + 1), 100);
      }
    }
    setTimeout(() => tryDraw(0), 80);

    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (worldGeoData) {
          drawMap().then(() => renderRankBars()).catch(() => {});
        }
      }, 180);
    });
    const c = document.getElementById('cee-chart');
    if (c) ro.observe(c);

    function applyResp() {
      const main = document.getElementById('cee2-main');
      if (main) main.style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : '320px 1fr';
    }
    applyResp();
    window.addEventListener('resize', applyResp);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();