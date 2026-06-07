/**
 * chart-ranking-v2.js  (fixed)
 * 修复：
 *  1. 右侧国家图真正实现排名升降位移动画（不清空SVG，用D3 update模式）
 *  2. 切换时段时左侧对齐位置不再跳动（固定 mL，箭头列始终占位）
 *  3. SVG 高度不随时段变化（国家数量恒定）
 */
(function () {
  'use strict';

  // =========================================================
  // 1. 数据
  // =========================================================
  const COUNTRIES_DATA = window.RAW_DATA || [
    {country:"USA",cn:"美国",p11:137380,p16:264560,region:"北美",cee:false},
    {country:"UNITED KINGDOM",cn:"英国",p11:29966,p16:71470,region:"西欧",cee:false},
    {country:"AUSTRALIA",cn:"澳大利亚",p11:25829,p16:62277,region:"大洋洲",cee:false},
    {country:"CANADA",cn:"加拿大",p11:22117,p16:45150,region:"北美",cee:false},
    {country:"GERMANY",cn:"德国",p11:20930,p16:41267,region:"西欧",cee:false},
    {country:"JAPAN",cn:"日本",p11:25308,p16:38773,region:"东亚",cee:false},
    {country:"SINGAPORE",cn:"新加坡",p11:13447,p16:26630,region:"东南亚",cee:false},
    {country:"FRANCE",cn:"法国",p11:13617,p16:26522,region:"西欧",cee:false},
    {country:"SOUTH KOREA",cn:"韩国",p11:11676,p16:21979,region:"东亚",cee:false},
    {country:"ITALY",cn:"意大利",p11:7181,p16:16689,region:"西欧",cee:false},
    {country:"PAKISTAN",cn:"巴基斯坦",p11:3190,p16:16284,region:"南亚",cee:false},
    {country:"NETHERLANDS",cn:"荷兰",p11:7325,p16:16015,region:"西欧",cee:false},
    {country:"SWEDEN",cn:"瑞典",p11:6886,p16:14561,region:"西欧",cee:false},
    {country:"SPAIN",cn:"西班牙",p11:5870,p16:13333,region:"西欧",cee:false},
    {country:"INDIA",cn:"印度",p11:4458,p16:13051,region:"南亚",cee:false},
    {country:"RUSSIA",cn:"俄罗斯",p11:5008,p16:11963,region:"东欧",cee:false},
    {country:"SWITZERLAND",cn:"瑞士",p11:5349,p16:11049,region:"西欧",cee:false},
    {country:"SAUDI ARABIA",cn:"沙特阿拉伯",p11:3739,p16:10941,region:"中东",cee:false},
    {country:"DENMARK",cn:"丹麦",p11:4453,p16:10117,region:"西欧",cee:false},
    {country:"BELGIUM",cn:"比利时",p11:3912,p16:8675,region:"西欧",cee:false},
    {country:"BRAZIL",cn:"巴西",p11:3415,p16:7195,region:"拉丁美洲",cee:false},
    {country:"FINLAND",cn:"芬兰",p11:2995,p16:7089,region:"西欧",cee:false},
    {country:"POLAND",cn:"波兰",p11:3252,p16:6866,region:"中东欧",cee:true},
    {country:"NEW ZEALAND",cn:"新西兰",p11:2518,p16:6357,region:"大洋洲",cee:false},
    {country:"AUSTRIA",cn:"奥地利",p11:2981,p16:6304,region:"西欧",cee:false},
    {country:"MALAYSIA",cn:"马来西亚",p11:1757,p16:5919,region:"东南亚",cee:false},
    {country:"NORWAY",cn:"挪威",p11:2991,p16:5887,region:"西欧",cee:false},
    {country:"IRAN",cn:"伊朗",p11:1427,p16:5659,region:"中东",cee:false},
    {country:"EGYPT",cn:"埃及",p11:1314,p16:5420,region:"中东",cee:false},
    {country:"CZECH REPUBLIC",cn:"捷克",p11:2450,p16:5063,region:"中东欧",cee:true},
    {country:"TURKEY",cn:"土耳其",p11:2228,p16:4975,region:"中东",cee:false},
    {country:"IRELAND",cn:"爱尔兰",p11:2084,p16:4955,region:"西欧",cee:false},
    {country:"SOUTH AFRICA",cn:"南非",p11:2003,p16:4865,region:"非洲",cee:false},
    {country:"PORTUGAL",cn:"葡萄牙",p11:2229,p16:4796,region:"西欧",cee:false},
    {country:"THAILAND",cn:"泰国",p11:1811,p16:4683,region:"东南亚",cee:false},
    {country:"ISRAEL",cn:"以色列",p11:1969,p16:4448,region:"中东",cee:false},
    {country:"GREECE",cn:"希腊",p11:2086,p16:4193,region:"中东欧",cee:true},
    {country:"VIETNAM",cn:"越南",p11:967,p16:3731,region:"东南亚",cee:false},
    {country:"HUNGARY",cn:"匈牙利",p11:1901,p16:3673,region:"中东欧",cee:true},
    {country:"MEXICO",cn:"墨西哥",p11:1716,p16:3436,region:"拉丁美洲",cee:false},
    {country:"ROMANIA",cn:"罗马尼亚",p11:1596,p16:3124,region:"中东欧",cee:true},
    {country:"CHILE",cn:"智利",p11:1081,p16:2794,region:"拉丁美洲",cee:false},
    {country:"UKRAINE",cn:"乌克兰",p11:1226,p16:2516,region:"东欧",cee:false},
    {country:"COLOMBIA",cn:"哥伦比亚",p11:1343,p16:2312,region:"拉丁美洲",cee:false},
    {country:"QATAR",cn:"卡塔尔",p11:757,p16:2211,region:"中东",cee:false},
    {country:"UNITED ARAB EMIRATES",cn:"阿联酋",p11:387,p16:2123,region:"中东",cee:false},
    {country:"SERBIA",cn:"塞尔维亚",p11:1295,p16:1967,region:"中东欧",cee:true},
    {country:"SLOVENIA",cn:"斯洛文尼亚",p11:1045,p16:1920,region:"中东欧",cee:true},
    {country:"ARGENTINA",cn:"阿根廷",p11:1042,p16:1836,region:"拉丁美洲",cee:false},
    {country:"SLOVAKIA",cn:"斯洛伐克",p11:896,p16:1809,region:"中东欧",cee:true},
    {country:"CROATIA",cn:"克罗地亚",p11:907,p16:1690,region:"中东欧",cee:true},
    {country:"BULGARIA",cn:"保加利亚",p11:693,p16:1621,region:"中东欧",cee:true},
    {country:"ESTONIA",cn:"爱沙尼亚",p11:714,p16:1528,region:"中东欧",cee:true},
    {country:"LITHUANIA",cn:"立陶宛",p11:607,p16:1522,region:"东欧",cee:false},
    {country:"BELARUS",cn:"白俄罗斯",p11:977,p16:1481,region:"东欧",cee:false},
    {country:"NIGERIA",cn:"尼日利亚",p11:365,p16:1446,region:"非洲",cee:false},
    {country:"INDONESIA",cn:"印度尼西亚",p11:422,p16:1446,region:"东南亚",cee:false},
    {country:"BANGLADESH",cn:"孟加拉国",p11:314,p16:1428,region:"南亚",cee:false},
    {country:"ARMENIA",cn:"亚美尼亚",p11:1063,p16:1403,region:"东欧",cee:false},
    {country:"REPUBLIC OF GEORGIA",cn:"格鲁吉亚",p11:938,p16:1347,region:"东欧",cee:false},
    {country:"LATVIA",cn:"拉脱维亚",p11:97,p16:1028,region:"中东欧",cee:true},
    {country:"MACEDONIA",cn:"北马其顿",p11:70,p16:178,region:"中东欧",cee:true},
    {country:"BOSNIA & HERZEGOVINA",cn:"波黑",p11:17,p16:90,region:"中东欧",cee:true},
    {country:"MONTENEGRO",cn:"黑山",p11:11,p16:129,region:"中东欧",cee:true},
    {country:"ALBANIA",cn:"阿尔巴尼亚",p11:6,p16:71,region:"中东欧",cee:true},
    {country:"PHILIPPINES",cn:"菲律宾",p11:473,p16:1341,region:"东南亚",cee:false},
    {country:"GHANA",cn:"加纳",p11:230,p16:1103,region:"非洲",cee:false},
    {country:"SRI LANKA",cn:"斯里兰卡",p11:340,p16:1055,region:"南亚",cee:false},
    {country:"KENYA",cn:"肯尼亚",p11:334,p16:955,region:"非洲",cee:false},
    {country:"ALGERIA",cn:"阿尔及利亚",p11:117,p16:904,region:"中东",cee:false},
    {country:"IRAQ",cn:"伊拉克",p11:195,p16:885,region:"中东",cee:false},
    {country:"CYPRUS",cn:"塞浦路斯",p11:488,p16:868,region:"西欧",cee:false},
    {country:"MOROCCO",cn:"摩洛哥",p11:582,p16:864,region:"中东",cee:false},
    {country:"ECUADOR",cn:"厄瓜多尔",p11:220,p16:857,region:"拉丁美洲",cee:false},
    {country:"AZERBAIJAN",cn:"阿塞拜疆",p11:470,p16:806,region:"东欧",cee:false},
    {country:"NEPAL",cn:"尼泊尔",p11:206,p16:774,region:"南亚",cee:false},
    {country:"KAZAKHSTAN",cn:"哈萨克斯坦",p11:112,p16:712,region:"中亚",cee:false},
    {country:"SUDAN",cn:"苏丹",p11:184,p16:708,region:"非洲",cee:false},
    {country:"ETHIOPIA",cn:"埃塞俄比亚",p11:90,p16:708,region:"非洲",cee:false},
    {country:"PERU",cn:"秘鲁",p11:258,p16:655,region:"拉丁美洲",cee:false},
    {country:"MONGOLIA",cn:"蒙古",p11:137,p16:478,region:"东亚",cee:false},
    {country:"CUBA",cn:"古巴",p11:232,p16:421,region:"拉丁美洲",cee:false},
    {country:"UZBEKISTAN",cn:"乌兹别克斯坦",p11:99,p16:368,region:"中亚",cee:false},
    {country:"TANZANIA",cn:"坦桑尼亚",p11:77,p16:454,region:"非洲",cee:false}
  ];

  // =========================================================
  // 2. 区域聚合
  // =========================================================
  const REGION_COLOR = {
    '北美':'#1e3a8a','西欧':'#1d4ed8','东亚':'#0369a1','东南亚':'#0891b2',
    '中东欧':'#d97706','中东':'#7c3aed','南亚':'#db2777','东欧':'#059669',
    '拉丁美洲':'#65a30d','非洲':'#dc2626','大洋洲':'#2563eb','中亚':'#78716c'
  };

  // 全球汇总（用于增速表底部全球平均行）
  const GLOBAL_TOTALS = {
    p11: COUNTRIES_DATA.reduce((s, d) => s + (d.p11 || 0), 0),
    p16: COUNTRIES_DATA.reduce((s, d) => s + (d.p16 || 0), 0)
  };

  function buildRegions(period) {
    const map = {};
    COUNTRIES_DATA.forEach(d => {
      const r = d.region || '其他';
      if (!map[r]) map[r] = { region: r, p11: 0, p16: 0, countries: [] };
      map[r].p11 += d.p11 || 0;
      map[r].p16 += d.p16 || 0;
      map[r].countries.push(d);
    });
    return Object.values(map).sort((a, b) => b[period] - a[period]);
  }

  // =========================================================
  // 3. 状态
  // =========================================================
  let currentPeriod  = 'p11';
  let selectedRegion = '中东欧';
  let isAnimating    = false;
  const fmt = d3.format(',');

  // =========================================================
  // 4. Tooltip
  // =========================================================
  function initTooltip() {
    if (document.getElementById('rk2-tt')) return;
    const tt = document.createElement('div');
    tt.id = 'rk2-tt';
    tt.style.cssText = `position:fixed;display:none;pointer-events:none;z-index:9999;
      background:rgba(15,23,42,.95);color:#f8fafc;border-radius:9px;
      padding:11px 14px;font-size:12px;line-height:1.65;
      box-shadow:0 6px 24px rgba(0,0,0,.28);max-width:210px;
      font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;`;
    document.body.appendChild(tt);

    window.rk2ShowTip = function(e, d, isRegion) {
      const p = currentPeriod;
      if (isRegion) {
        const growth = d.p11 > 0 ? ((d.p16 - d.p11) / d.p11 * 100).toFixed(1) : '—';
        tt.innerHTML = `
          <div style="font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:5px;margin-bottom:6px;">${d.region}</div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
            <span style="color:rgba(255,255,255,.5);">2011–2015</span><span>${fmt(d.p11)} 篇</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
            <span style="color:rgba(255,255,255,.5);">2016–2020</span>
            <span style="color:#93c5fd;font-weight:600;">${fmt(d.p16)} 篇</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span style="color:rgba(255,255,255,.5);">增幅</span>
            <span style="color:#6ee7b7;">+${growth}%</span>
          </div>`;
      } else {
        const growth = d.p11 > 0 ? ((d.p16 - d.p11) / d.p11 * 100).toFixed(1) : '—';
        tt.innerHTML = `
          <div style="font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,.12);padding-bottom:5px;margin-bottom:6px;">${d.cn}</div>
          <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
            <span style="color:rgba(255,255,255,.5);">${p==='p16'?'2016–2020':'2011–2015'}</span>
            <span style="color:#93c5fd;font-weight:600;">${fmt(d[p])} 篇</span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <span style="color:rgba(255,255,255,.5);">增幅</span>
            <span style="color:#6ee7b7;">+${growth}%</span>
          </div>
          ${d.cee?`<div style="margin-top:6px;background:#92400e;border-radius:4px;padding:2px 7px;font-size:11px;font-weight:600;">★ 中东欧</div>`:''}`;
      }
      tt.style.display = 'block';
      window.rk2MoveTip(e);
    };
    window.rk2MoveTip = function(e) {
      let x = e.clientX + 14, y = e.clientY + 12;
      if (x + 220 > window.innerWidth)  x = e.clientX - 228;
      if (y + 180 > window.innerHeight) y = e.clientY - 190;
      tt.style.left = x + 'px'; tt.style.top = y + 'px';
    };
    window.rk2HideTip = () => { tt.style.display = 'none'; };
  }

  // =========================================================
  // 5. 注入 HTML 骨架
  // =========================================================
  function injectHTML() {
    const el = document.getElementById('trend-chart');
    if (!el) return;
    el.style.fontFamily = "'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif";

    el.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:20px 22px;
        box-shadow:0 2px 10px rgba(0,0,0,.07);border:1px solid #dde4ec;">

        <!-- 标题栏 -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;
          flex-wrap:wrap;gap:10px;margin-bottom:16px;">
          <div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:3px;">
              中国科研合作国家排名
            </div>
            <div style="font-size:11.5px;color:#64748b;">
              左栏：按地区汇总 · 右栏：点击地区查看内部国家排名 ·
              <span style="color:#d97706;font-weight:600;">橙色</span> = 中东欧国家
            </div>
          </div>
          <div style="display:inline-flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <button id="rk2-p11" style="padding:5px 14px;font-size:12px;font-weight:500;
              border:none;background:#1e40af;color:#fff;cursor:pointer;">2011–2015</button>
            <button id="rk2-p16" style="padding:5px 14px;font-size:12px;font-weight:500;
              border:none;background:#f8fafc;color:#64748b;cursor:pointer;">2016–2020</button>
          </div>
        </div>

        <!-- 双栏 -->
        <div id="rk2-grid" style="display:grid;grid-template-columns:38fr 62fr;gap:20px;align-items:start;">
          <!-- 左：区域排名 -->
          <div>
            <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;
              letter-spacing:.06em;margin-bottom:8px;">按地区汇总合作量</div>
            <svg id="rk2-region-svg" style="display:block;width:100%;overflow:visible;"></svg>
          </div>
          <!-- 右：国家排名 -->
          <div style="overflow:hidden;">
            <div id="rk2-country-header" style="font-size:11px;font-weight:700;color:#94a3b8;
              text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;"></div>
            <div style="overflow:hidden;">
              <svg id="rk2-country-svg" style="display:block;width:100%;overflow:visible;"></svg>
            </div>
          </div>
        </div>

        <!-- CEE 说明板 -->
        <div id="rk2-callout" style="margin-top:18px;border-radius:10px;padding:14px 16px;
          background:linear-gradient(135deg,#fef3c7,#fffbeb);
          border:1.5px solid #f59e0b;"></div>

      </div>
    `;

    document.getElementById('rk2-p11').onclick = () => switchPeriod('p11');
    document.getElementById('rk2-p16').onclick = () => switchPeriod('p16');
  }

  // =========================================================
  // 6. 渲染区域条形图（整体重绘，无动画问题）
  // =========================================================
  function renderRegionBars() {
    const p = currentPeriod;
    const regions = buildRegions(p);
    const el = document.getElementById('rk2-region-svg');
    if (!el) return;
    const W = el.parentElement.clientWidth || 380;

    const mL = 58, mR = 86, mT = 4, mB = 6;
    const ROW = 30;
    const H   = regions.length * ROW + mT + mB;
    const iW  = W - mL - mR;

    const showGrowth = p === 'p16';
    const max = d3.max(regions, d => d[p]);
    const x   = d3.scaleLinear().domain([0, max * 1.05]).range([0, iW]);
    const svg = d3.select('#rk2-region-svg').attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('transform', `translate(${mL},${mT})`);

    regions.forEach((d, i) => {
      const y       = i * ROW;
      const isCEE   = d.region === '中东欧';
      const isSel   = d.region === selectedRegion;
      const color   = isCEE ? '#d97706' : (REGION_COLOR[d.region] || '#6b7280');
      const growth  = d.p11 > 0 ? ((d.p16 - d.p11) / d.p11 * 100).toFixed(1) : null;
      const grColor = !growth ? '#94a3b8'
        : isCEE ? '#b45309'
        : +growth >= 200 ? '#7c3aed'
        : +growth >= 100 ? '#059669'
        : '#64748b';

      if (isSel) {
        g.append('rect').attr('x', -mL).attr('y', y+1).attr('width', W).attr('height', ROW-2)
          .attr('fill', isCEE ? '#fef3c7' : '#f0f7ff').attr('rx', 5);
      }

      g.append('rect')
        .attr('x', 0).attr('y', y + 6)
        .attr('width', 0).attr('height', ROW - 14).attr('rx', 3)
        .attr('fill', color).attr('fill-opacity', isSel ? 1 : 0.65)
        .transition().duration(500).delay(i * 30)
        .attr('width', x(d[p]));

      g.append('text')
        .attr('x', -5).attr('y', y + ROW/2 + 4.5)
        .attr('text-anchor', 'end').attr('font-size', isSel ? 12.5 : 11.5)
        .attr('font-weight', isSel ? '700' : '500')
        .attr('fill', isSel ? (isCEE ? '#b45309' : '#1e293b') : '#6b7280')
        .text(d.region);

      g.append('text')
        .attr('x', x(d[p]) + 5).attr('y', y + ROW/2 + 4.5)
        .attr('font-size', 10.5).attr('font-weight', isSel ? '700' : '400')
        .attr('fill', isCEE ? '#b45309' : '#64748b')
        .text(d[p] >= 10000 ? d3.format('.0s')(d[p]) : fmt(d[p]));

      // 增幅标注：仅 p16 时段显示，淡入效果
      if (growth !== null) {
        g.append('text')
          .attr('x', iW + mR - 4).attr('y', y + ROW/2 + 4.5)
          .attr('text-anchor', 'end').attr('font-size', isSel ? 11.5 : 10.5)
          .attr('font-weight', '700').attr('fill', grColor)
          .attr('opacity', 0)
          .text(`+${growth}%`)
          .transition().duration(400).delay(showGrowth ? i * 30 + 300 : 0)
          .attr('opacity', showGrowth ? 1 : 0);
      }

      g.append('rect')
        .attr('x', -mL).attr('y', y).attr('width', W).attr('height', ROW)
        .attr('fill', 'transparent').attr('cursor', 'pointer')
        .on('click', () => {
          if (isAnimating) return;
          selectedRegion = d.region;
          renderRegionBars();
          initCountrySvg(selectedRegion);
        })
        .on('mouseover', e => window.rk2ShowTip(e, d, true))
        .on('mousemove', window.rk2MoveTip)
        .on('mouseout',  window.rk2HideTip);
    });
  }

  // =========================================================
  // 7. 固定布局常量（两个时段共用，消除抖动根源）
  // =========================================================
  // 始终保留箭头列宽度，p11 时箭头透明隐藏
  const ARROW_W  = 36;   // 箭头列宽度（固定）
  const NAME_W   = 62;   // 国家名列宽度（固定）
  const ML_FIXED = ARROW_W + NAME_W;  // = 98，始终不变
  const GROWTH_W = 50;   // 增幅列宽度（固定）
  const MR_FIXED = 6 + GROWTH_W;     // = 56，始终不变
  const ROW_H    = 26;   // 行高（固定）
  const MT       = 4;
  const EASE     = d3.easeCubicInOut;
  const ANIM_DUR = 900;

  // =========================================================
  // 8. 初始化国家 SVG（切换地区时调用，重建元素）
  // =========================================================
  function initCountrySvg(region) {
    const el  = document.getElementById('rk2-country-svg');
    const hdr = document.getElementById('rk2-country-header');
    if (!el) return;

    const regionData = buildRegions('p11').find(r => r.region === region);
    if (!regionData) return;
    const countries = regionData.countries; // 国家列表（顺序固定，只是数据容器）
    const n = countries.length;

    const isCEE = region === '中东欧';
    if (hdr) hdr.innerHTML = `<span style="color:${isCEE?'#d97706':'#1e40af'};">${region}</span> 地区内各国排名`;

    const W  = el.parentElement.clientWidth || 400;
    const iW = W - ML_FIXED - MR_FIXED;
    const H  = n * ROW_H + MT + 8;

    const svg = d3.select('#rk2-country-svg').attr('width', W).attr('height', H);
    svg.selectAll('*').remove();

    const g = svg.append('g').attr('class', 'rk2c-main').attr('transform', `translate(${ML_FIXED},${MT})`);

    // 斑马背景（按初始顺序，静态，不动）
    g.append('g').attr('class', 'rk2c-zebra');
    // 条形层
    g.append('g').attr('class', 'rk2c-bars');
    // 文字层：国家名
    g.append('g').attr('class', 'rk2c-names');
    // 文字层：数值
    g.append('g').attr('class', 'rk2c-vals');
    // 文字层：箭头
    g.append('g').attr('class', 'rk2c-arrows');
    // 文字层：增幅
    g.append('g').attr('class', 'rk2c-growths');
    // 热区层
    g.append('g').attr('class', 'rk2c-hots');

    // 用当前时段渲染一次（无动画）
    updateCountrySvg(region, false);
  }

  // =========================================================
  // 9. 更新国家 SVG（时段切换时调用，带位移动画）
  // =========================================================
  function updateCountrySvg(region, animate) {
    const p   = currentPeriod;
    const el  = document.getElementById('rk2-country-svg');
    if (!el) return;

    const regionData = buildRegions(p).find(r => r.region === region);
    if (!regionData) return;

    // 按当前时段排序
    const countries = [...regionData.countries].sort((a, b) => b[p] - a[p]);
    const n = countries.length;

    const W  = +el.getAttribute('width') || (el.parentElement.clientWidth || 400);
    const iW = W - ML_FIXED - MR_FIXED;

    // x 比例尺：用两个时段最大值，避免切换时条形长度抖动
    const maxVal = d3.max(regionData.countries, d => Math.max(d.p11 || 0, d.p16 || 0));
    const x = d3.scaleLinear().domain([0, maxVal * 1.05]).range([0, iW]);

    // 目标 y 位置
    const targetY = {};
    countries.forEach((d, i) => { targetY[d.cn] = i * ROW_H; });

    const svg = d3.select('#rk2-country-svg');
    const g   = svg.select('g.rk2c-main');

    const barColor = d => d.cee ? '#d97706' : (REGION_COLOR[d.region] || '#6b7280');

    // ── 计算区域内排名变化（用于箭头）──
    const sorted11 = [...regionData.countries].sort((a, b) => b.p11 - a.p11);
    const sorted16 = [...regionData.countries].sort((a, b) => b.p16 - a.p16);
    const rank11 = {}, rank16 = {};
    sorted11.forEach((d, i) => { rank11[d.cn] = i + 1; });
    sorted16.forEach((d, i) => { rank16[d.cn] = i + 1; });

    const dur = animate ? ANIM_DUR : 0;

    // ── 斑马背景（按目标顺序静态渲染）──
    const zebraG = g.select('g.rk2c-zebra');
    zebraG.selectAll('rect').remove();
    countries.forEach((d, i) => {
      zebraG.append('rect')
        .attr('x', -ML_FIXED).attr('width', W)
        .attr('y', targetY[d.cn]).attr('height', ROW_H)
        .attr('fill', i % 2 === 0 ? 'rgba(0,0,0,0.018)' : 'transparent');
    });

    // ── 条形 ──
    g.select('g.rk2c-bars').selectAll('rect.rk2c-bar')
      .data(countries, d => d.cn)
      .join(
        enter => enter.append('rect').attr('class', 'rk2c-bar')
          .attr('rx', 3).attr('x', 0)
          .attr('height', ROW_H - 6)
          .attr('fill', barColor).attr('fill-opacity', 0.85)
          .attr('width', d => x(d[p]))
          .attr('y', d => targetY[d.cn] + 3),
        update => {
          const sel = update.attr('fill', barColor).attr('fill-opacity', 0.85);
          if (dur > 0) {
            sel.transition().duration(dur).ease(EASE)
              .attr('y', d => targetY[d.cn] + 3)
              .attr('width', d => x(d[p]));
          } else {
            sel.attr('y', d => targetY[d.cn] + 3)
               .attr('width', d => x(d[p]));
          }
        }
      );

    // ── 国家名 ──
    g.select('g.rk2c-names').selectAll('text.rk2c-name')
      .data(countries, d => d.cn)
      .join(
        enter => enter.append('text').attr('class', 'rk2c-name')
          .attr('x', -6).attr('text-anchor', 'end')
          .attr('font-size', 11)
          .attr('fill', d => d.cee ? '#b45309' : '#374151')
          .attr('font-weight', d => d.cee ? '700' : '400')
          .text(d => d.cn.length > 5 ? d.cn.slice(0,5)+'…' : d.cn)
          .attr('y', d => targetY[d.cn] + ROW_H/2 + 4),
        update => {
          const sel = update;
          if (dur > 0) {
            sel.transition().duration(dur).ease(EASE)
              .attr('y', d => targetY[d.cn] + ROW_H/2 + 4);
          } else {
            sel.attr('y', d => targetY[d.cn] + ROW_H/2 + 4);
          }
        }
      );

    // ── 数值标注 ──
    g.select('g.rk2c-vals').selectAll('text.rk2c-val')
      .data(countries, d => d.cn)
      .join(
        enter => enter.append('text').attr('class', 'rk2c-val')
          .attr('font-size', 10.5)
          .attr('fill', d => d.cee ? '#b45309' : '#64748b')
          .text(d => d[p] >= 1000 ? d3.format('.1s')(d[p]) : fmt(d[p]))
          .attr('x', d => x(d[p]) + 5)
          .attr('y', d => targetY[d.cn] + ROW_H/2 + 4),
        update => {
          const sel = update
            .text(d => d[p] >= 1000 ? d3.format('.1s')(d[p]) : fmt(d[p]))
            .attr('x', d => x(d[p]) + 5);
          if (dur > 0) {
            sel.transition().duration(dur).ease(EASE)
              .attr('y', d => targetY[d.cn] + ROW_H/2 + 4);
          } else {
            sel.attr('y', d => targetY[d.cn] + ROW_H/2 + 4);
          }
        }
      );

    // ── 箭头（固定占位，p11 时透明）──
    const showArrow = p === 'p16';
    g.select('g.rk2c-arrows').selectAll('text.rk2c-arrow')
      .data(countries, d => d.cn)
      .join(
        enter => enter.append('text').attr('class', 'rk2c-arrow')
          .attr('x', -NAME_W - 4).attr('text-anchor', 'end')
          .attr('font-size', 10).attr('font-weight', 700)
          .attr('opacity', showArrow ? 1 : 0)
          .text(d => {
            const delta = rank11[d.cn] - rank16[d.cn];
            if (delta > 0) return `↑${delta}`;
            if (delta < 0) return `↓${Math.abs(delta)}`;
            return '—';
          })
          .attr('fill', d => {
            const delta = rank11[d.cn] - rank16[d.cn];
            return delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#94a3b8';
          })
          .attr('y', d => targetY[d.cn] + ROW_H/2 + 4),
        update => {
          const sel = update
            .text(d => {
              const delta = rank11[d.cn] - rank16[d.cn];
              if (delta > 0) return `↑${delta}`;
              if (delta < 0) return `↓${Math.abs(delta)}`;
              return '—';
            })
            .attr('fill', d => {
              const delta = rank11[d.cn] - rank16[d.cn];
              return delta > 0 ? '#16a34a' : delta < 0 ? '#dc2626' : '#94a3b8';
            });
          if (dur > 0) {
            sel.transition().duration(dur).ease(EASE)
              .attr('y', d => targetY[d.cn] + ROW_H/2 + 4)
              .attr('opacity', showArrow ? 1 : 0);
          } else {
            sel.attr('y', d => targetY[d.cn] + ROW_H/2 + 4)
               .attr('opacity', showArrow ? 1 : 0);
          }
        }
      );

    // ── 增幅列（固定占位，p11 时透明）──
    const showGrowth = p === 'p16';
    g.select('g.rk2c-growths').selectAll('text.rk2c-growth')
      .data(countries, d => d.cn)
      .join(
        enter => enter.append('text').attr('class', 'rk2c-growth')
          .attr('x', iW + GROWTH_W - 2).attr('text-anchor', 'end')
          .attr('font-size', 10).attr('font-weight', 600)
          .attr('opacity', showGrowth ? 1 : 0)
          .attr('fill', d => {
            if (!d.p11) return '#94a3b8';
            return (d.p16-d.p11)/d.p11*100 >= 100 ? '#059669' : '#64748b';
          })
          .text(d => d.p11 ? `+${((d.p16-d.p11)/d.p11*100).toFixed(0)}%` : '')
          .attr('y', d => targetY[d.cn] + ROW_H/2 + 4),
        update => {
          if (dur > 0) {
            update.transition().duration(dur).ease(EASE)
              .attr('y', d => targetY[d.cn] + ROW_H/2 + 4)
              .attr('opacity', showGrowth ? 1 : 0);
          } else {
            update.attr('y', d => targetY[d.cn] + ROW_H/2 + 4)
                  .attr('opacity', showGrowth ? 1 : 0);
          }
        }
      );

    // ── 热区 ──
    g.select('g.rk2c-hots').selectAll('rect.rk2c-hot')
      .data(countries, d => d.cn)
      .join(
        enter => enter.append('rect').attr('class', 'rk2c-hot')
          .attr('x', -ML_FIXED).attr('width', W)
          .attr('height', ROW_H)
          .attr('fill', 'transparent').attr('cursor', 'default')
          .attr('y', d => targetY[d.cn])
          .on('mouseover', (e, d) => window.rk2ShowTip(e, d, false))
          .on('mousemove', window.rk2MoveTip)
          .on('mouseout',  window.rk2HideTip),
        update => {
          if (dur > 0) {
            update.transition().duration(dur).ease(EASE)
              .attr('y', d => targetY[d.cn]);
          } else {
            update.attr('y', d => targetY[d.cn]);
          }
        }
      );

    if (dur > 0) {
      isAnimating = true;
      setTimeout(() => { isAnimating = false; }, dur + 150);
    }
  }

  // =========================================================
  // 10. CEE 说明板
  // =========================================================
  function updateCallout() {
    const el = document.getElementById('rk2-callout');
    if (!el) return;
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;">
        <div style="flex:1;min-width:200px;">
          <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:6px;">
            🔍 为什么聚焦中东欧？
          </div>
          <div style="font-size:12px;color:#78350f;line-height:1.75;">
            <strong>中东欧16国</strong>合作量在全球区域排名中位于
            <strong>第5位</strong>（2016–2020），绝对量虽低于北美、西欧等发达区域，
            但其<strong>政策层面价值</strong>突出：
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;min-width:260px;">
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:15px;">📋</span>
            <div style="font-size:12px;color:#78350f;line-height:1.65;">
              <strong>17+1机制（2012）</strong>：中国与17个中东欧国家建立合作机制，
              形成制度化科研合作框架，合作增速与政策时间高度吻合。
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:15px;">🔗</span>
            <div style="font-size:12px;color:#78350f;line-height:1.65;">
              <strong>区域战略枢纽</strong>：中东欧作为欧盟成员国群体与中国之间的
              "桥梁区域"，其科研合作具有独特的地缘政治意义。
            </div>
          </div>
          <div style="display:flex;align-items:flex-start;gap:8px;">
            <span style="font-size:15px;">📈</span>
            <div style="font-size:12px;color:#78350f;line-height:1.65;">
              <strong>增幅+105%</strong>：与全球平均+113%基本持平，
              但16国内部高度分化，潜在增长空间巨大。
            </div>
          </div>
        </div>
      </div>
    `;
  }
  



  function switchPeriod(p) {
    if (currentPeriod === p || isAnimating) return;
    currentPeriod = p;

    const b11 = document.getElementById('rk2-p11');
    const b16 = document.getElementById('rk2-p16');
    if (p === 'p11') {
      b11.style.background = '#1e40af'; b11.style.color = '#fff';
      b16.style.background = '#f8fafc'; b16.style.color = '#64748b';
    } else {
      b16.style.background = '#1e40af'; b16.style.color = '#fff';
      b11.style.background = '#f8fafc'; b11.style.color = '#64748b';
    }

    renderRegionBars();
    // 带动画更新国家图（true = 触发位移动画）
    updateCountrySvg(selectedRegion, true);
    updateCallout();
  }

  // =========================================================
  // 12. 初始化
  // =========================================================
  function renderAll() {
    renderRegionBars();
    initCountrySvg(selectedRegion);
    updateCallout();
  }

  function init() {
    initTooltip();
    injectHTML();

    function tryRender(n) {
      const el = document.getElementById('rk2-region-svg');
      if (el && el.parentElement && el.parentElement.clientWidth > 0) {
        renderAll();
      } else if (n < 20) {
        setTimeout(() => tryRender(n + 1), 100);
      }
    }
    setTimeout(() => tryRender(0), 80);

    let resTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resTimer);
      resTimer = setTimeout(renderAll, 200);
    });

    function applyResp() {
      const grid = document.getElementById('rk2-grid');
      if (grid) grid.style.gridTemplateColumns = window.innerWidth < 800 ? '1fr' : '38fr 62fr';
    }
    applyResp();
    window.addEventListener('resize', applyResp);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();