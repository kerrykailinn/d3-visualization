/**
 * chart-ranking.js
 * 图3：中东欧16国深度分析（地图 + 排名条形图 + 双向联动）
 * Target: <div id="ranking-chart"></div>
 * 依赖: D3.js v7, TopoJSON client v3
 *
 * （原 chart-trend.js 内容，文件名已按模块职责重命名）
 */
(function () {
  'use strict';

  const CEE_DATA = [
    {cn:'波兰',    iso3:'POL', num:'616', p11:3252, p16:6866},
    {cn:'捷克',    iso3:'CZE', num:'203', p11:2450, p16:5063},
    {cn:'希腊',    iso3:'GRC', num:'300', p11:2086, p16:4193},
    {cn:'匈牙利',  iso3:'HUN', num:'348', p11:1901, p16:3673},
    {cn:'罗马尼亚',iso3:'ROU', num:'642', p11:1596, p16:3124},
    {cn:'塞尔维亚',iso3:'SRB', num:'688', p11:1295, p16:1967},
    {cn:'斯洛文尼亚',iso3:'SVN',num:'705',p11:1045, p16:1920},
    {cn:'斯洛伐克',iso3:'SVK', num:'703', p11:896,  p16:1809},
    {cn:'克罗地亚',iso3:'HRV', num:'191', p11:907,  p16:1690},
    {cn:'保加利亚',iso3:'BGR', num:'100', p11:693,  p16:1621},
    {cn:'爱沙尼亚',iso3:'EST', num:'233', p11:714,  p16:1528},
    {cn:'拉脱维亚',iso3:'LVA', num:'428', p11:97,   p16:1028},
    {cn:'北马其顿',iso3:'MKD', num:'807', p11:70,   p16:178 },
    {cn:'黑山',    iso3:'MNE', num:'499', p11:11,   p16:129 },
    {cn:'波黑',    iso3:'BIH', num:'070', p11:17,   p16:90  },
    {cn:'阿尔巴尼亚',iso3:'ALB',num:'008',p11:6,    p16:71  }
  ];

  const REGION_GROWTH = [
    {r:'中亚',    p11:211,    p16:1080  },
    {r:'南亚',    p11:8508,   p16:32592 },
    {r:'非洲',    p11:3454,   p16:10811 },
    {r:'中东',    p11:15248,  p16:40701 },
    {r:'北美',    p11:159497, p16:309710},
    {r:'西欧',    p11:119600, p16:260000},
    {r:'东南亚',  p11:18975,  p16:44491 },
    {r:'中东欧',  p11:17036,  p16:34950, isCEE:true},
    {r:'拉丁美洲',p11:9586,   p16:20116 },
    {r:'东欧',    p11:10289,  p16:21038 },
    {r:'东亚',    p11:37244,  p16:61536 }
  ].map(d=>({...d, growth:+((d.p16-d.p11)/d.p11*100).toFixed(1)}))
   .sort((a,b)=>b.growth-a.growth);

  const GLOBAL = {p11:296949, p16:609382};
  GLOBAL.growth = +((GLOBAL.p16-GLOBAL.p11)/GLOBAL.p11*100).toFixed(1);

  const CEE_T11 = CEE_DATA.reduce((s,d)=>s+d.p11,0);
  const CEE_T16 = CEE_DATA.reduce((s,d)=>s+d.p16,0);

  const ceeByNum = {};
  CEE_DATA.forEach(d=>{
    [d.num, +d.num, String(+d.num)].forEach(k=>{ ceeByNum[k]=d; });
  });

  const ROW = 30, BAR = 9, GAP = 3;
  const RANK_DATA = [...CEE_DATA].sort((a,b)=>b.p16-a.p16);

  let worldGeoData = null;
  let resizeTimer;
  const fmt = d3.format(',');

  /* ─── Tooltip ─── */
  function initTooltip() {
    if (document.getElementById('cee4-tt')) return;
    const tt = document.createElement('div');
    tt.id = 'cee4-tt';
    tt.style.cssText = `
      position:fixed;display:none;pointer-events:none;z-index:9999;
      background:rgba(15,23,42,.96);color:#f8fafc;border-radius:10px;
      padding:12px 15px;font-size:12px;line-height:1.7;
      box-shadow:0 8px 28px rgba(0,0,0,.32);max-width:220px;
      font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;
      border:1px solid rgba(255,255,255,.08);
    `;
    document.body.appendChild(tt);

    window.cee4ShowTip = function(e, d) {
      const gr = d.p11>0 ? ((d.p16-d.p11)/d.p11*100).toFixed(1) : '—';
      const s11 = (d.p11/CEE_T11*100).toFixed(1);
      const s16 = (d.p16/CEE_T16*100).toFixed(1);
      tt.innerHTML = `
        <div style="font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,.12);
          padding-bottom:5px;margin-bottom:7px;">${d.cn}</div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">2011–2015</span><span>${fmt(d.p11)} 篇</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">2016–2020</span>
          <span style="color:#93c5fd;font-weight:600;">${fmt(d.p16)} 篇</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">增幅</span>
          <span style="color:#6ee7b7;font-weight:600;">+${gr}%</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:rgba(255,255,255,.5);">区域占比</span>
          <span style="color:#fbbf24;">${s11}% → ${s16}%</span>
        </div>`;
      tt.style.display='block';
      window.cee4MoveTip(e);
    };
    window.cee4MoveTip = function(e) {
      let x=e.clientX+14, y=e.clientY+12;
      if(x+230>window.innerWidth)  x=e.clientX-238;
      if(y+220>window.innerHeight) y=e.clientY-228;
      tt.style.left=x+'px'; tt.style.top=y+'px';
    };
    window.cee4HideTip = ()=>{ tt.style.display='none'; };
  }

  /* ─── HTML 骨架 ─── */
  function injectHTML() {
    const el = document.getElementById('ranking-chart');
    if (!el) return;
    el.style.fontFamily = "'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif";

    el.innerHTML = `
      <div style="background:#fff;border-radius:14px;padding:22px 24px;
        box-shadow:0 2px 12px rgba(0,0,0,.07);border:1px solid #dde4ec;">

        <div style="margin-bottom:18px;">
          <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:4px;">
            中东欧16国深度分析
          </div>
          <div style="font-size:11.5px;color:#64748b;">
            悬停地图或排名图 → 双向联动高亮 ·
            <span style="color:#d97706;font-weight:600;">橙色</span>深浅 = 2016–2020发文量 ·
            增速在悬停时显示
          </div>
        </div>

        <!-- 主体双栏 -->
        <div id="cee4-main" style="display:grid;grid-template-columns:300px 1fr;
          gap:20px;align-items:start;margin-bottom:22px;">

          <!-- 左列：地图（高度跟随条形图） -->
          <div>
            <div style="font-size:10.5px;font-weight:700;color:#94a3b8;
              text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px;">
              地图（2016–2020 发文量着色）
            </div>
            <div id="cee4-map-wrap" style="background:#eef4fa;border-radius:10px;
              overflow:hidden;border:1px solid #dde4ec;">
              <svg id="cee4-map-svg" style="width:100%;display:block;"></svg>
              <div style="font-size:10px;color:#94a3b8;padding:5px 10px;text-align:center;">
                悬停查看各国数据
              </div>
            </div>
          </div>

          <!-- 右列：排名图 -->
          <div>
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px;flex-wrap:wrap;">
              <span style="font-size:10.5px;font-weight:700;color:#94a3b8;
                text-transform:uppercase;letter-spacing:.07em;">
                16国发文量排序（两时段对比）
              </span>
              <span style="display:flex;align-items:center;gap:12px;font-size:10.5px;">
                <span style="display:flex;align-items:center;gap:4px;">
                  <span style="display:inline-block;width:12px;height:8px;border-radius:2px;
                    background:#94a3b8;opacity:.7;"></span>
                  <span style="color:#64748b;">2011–2015</span>
                </span>
                <span style="display:flex;align-items:center;gap:4px;">
                  <span style="display:inline-block;width:12px;height:8px;border-radius:2px;
                    background:#d97706;"></span>
                  <span style="color:#64748b;">2016–2020</span>
                </span>
                <span style="color:#94a3b8;font-size:10px;">（悬停显示增速）</span>
              </span>
            </div>
            <svg id="cee4-rank-svg" style="display:block;width:100%;overflow:visible;"></svg>
          </div>

        </div>


      </div>
    `;
  }

  /* ─── TopoJSON ─── */
  function loadTopojson() {
    if (window.topojson) return Promise.resolve();
    return new Promise(res=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';
      s.onload=res; document.head.appendChild(s);
    });
  }

  /* ─── 同步地图高度到条形图高度 ─── */
  function syncMapHeight() {
    const rankSvg = document.getElementById('cee4-rank-svg');
    const mapSvg  = document.getElementById('cee4-map-svg');
    if (!rankSvg || !mapSvg) return;

    const rankH = +rankSvg.getAttribute('height') || 500;
    const footerH = 27; // "悬停查看各国数据" 行高
    const mapContentH = rankH - footerH;
    if (mapContentH < 100) return;

    const W = mapSvg.parentElement.clientWidth || 300;
    redrawMapAtSize(W, mapContentH);
  }

  /* ─── 渲染地图 ─── */
  async function drawMap() {
    if (!worldGeoData) {
      await loadTopojson();
      const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      worldGeoData = topojson.feature(world, world.objects.countries);
    }
    const wrap = document.getElementById('cee4-map-svg');
    if (!wrap) return;
    const W = wrap.parentElement.clientWidth || 300;
    const H = Math.round(W * 1.25);
    redrawMapAtSize(W, H);
    // 地图加载完后同步到条形图高度
    setTimeout(syncMapHeight, 100);
  }

  function redrawMapAtSize(W, H) {
    if (!worldGeoData) return;
    const svg = d3.select('#cee4-map-svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .style('height', H + 'px');
    svg.selectAll('*').remove();

    const ceeFeatures = worldGeoData.features.filter(f=>ceeByNum[f.id]);
    const proj = d3.geoMercator();
    proj.fitExtent([[14,14],[W-14,H-14]],
      {type:'FeatureCollection', features:ceeFeatures});
    const path = d3.geoPath().projection(proj);

    svg.append('rect').attr('width',W).attr('height',H).attr('fill','#dceefa');
    svg.append('path').datum(d3.geoGraticule().step([5,5])())
      .attr('d',path).attr('fill','none').attr('stroke','#c5d8eb').attr('stroke-width',0.4);

    svg.append('g').selectAll('path')
      .data(worldGeoData.features.filter(f=>!ceeByNum[f.id]))
      .join('path').attr('d',path)
      .attr('fill','#e4edf5').attr('stroke','#c8d6e4').attr('stroke-width',0.3);

    const colorScale = d3.scaleSequentialLog(d3.interpolateOranges)
      .domain([Math.max(d3.min(CEE_DATA,d=>d.p16),1), d3.max(CEE_DATA,d=>d.p16)]);

    svg.append('g').attr('class','cee4-map-cee')
      .selectAll('path').data(ceeFeatures).join('path')
      .attr('d',path)
      .attr('fill', f=>{ const d=ceeByNum[f.id]; return d?colorScale(d.p16):'#e8eef3'; })
      .attr('stroke','#b45309').attr('stroke-width',1.2).attr('cursor','pointer')
      .on('mouseover', function(e,f){
        const d=ceeByNum[f.id]; if(!d) return;
        window.cee4ShowTip(e,d);
        applyHighlight(d.cn);
      })
      .on('mousemove', window.cee4MoveTip)
      .on('mouseout', function(){
        window.cee4HideTip();
        clearHighlight();
      });

    const abbr = {
      '北马其顿':'北马','波黑':'波黑','黑山':'黑山',
      '阿尔巴尼亚':'阿尔巴','斯洛文尼亚':'斯洛文','斯洛伐克':'斯洛伐'
    };
    svg.append('g').selectAll('text').data(ceeFeatures).join('text')
      .attr('x', f=>path.centroid(f)[0])
      .attr('y', f=>path.centroid(f)[1]+4)
      .attr('text-anchor','middle')
      .attr('font-size', f=>{ const d=ceeByNum[f.id]; return d&&d.p16>3000?11:9; })
      .attr('font-weight','600').attr('fill','#fff')
      .attr('paint-order','stroke').attr('stroke','rgba(0,0,0,.3)').attr('stroke-width',2.5)
      .attr('pointer-events','none')
      .text(f=>{
        const d=ceeByNum[f.id]; if(!d) return '';
        const [cx]=path.centroid(f); if(isNaN(cx)) return '';
        return abbr[d.cn]||d.cn;
      });
  }

  /* ─── 渲染右侧排名条形图 ─── */
  function renderRankBars() {
    const el = document.getElementById('cee4-rank-svg');
    if (!el) return;
    const W  = el.parentElement.clientWidth || 420;
    const mL = 72;   // 国家名列宽
    const mR = 60;   // 增速列宽（默认透明，hover 时显示）
    const mT = 2;
    const iW = W - mL - mR;

    const data = RANK_DATA;
    const H    = data.length * ROW + mT + 10;
    const maxVal = d3.max(data, d=>Math.max(d.p11,d.p16));
    const x = d3.scaleLinear().domain([0, maxVal*1.05]).range([0, iW]);

    const svg = d3.select('#cee4-rank-svg').attr('width',W).attr('height',H);
    svg.selectAll('*').remove();
    const g = svg.append('g').attr('transform',`translate(${mL},${mT})`);

    data.forEach((d,i)=>{
      const y   = i * ROW;
      const gr  = d.p11>0 ? ((d.p16-d.p11)/d.p11*100).toFixed(0) : '—';
      const grV = +gr;
      const grColor = grV>=500?'#7c3aed':grV>=100?'#059669':'#64748b';

      // 斑马背景
      g.append('rect')
        .attr('x',-mL).attr('y',y).attr('width',W).attr('height',ROW)
        .attr('fill', i%2===0?'#fafbfc':'#fff');

      // 2011–2015 条（上）
      g.append('rect')
        .attr('class',`cee4-b11 cee4-bc-${i}`)
        .attr('x',0).attr('y', y+4).attr('rx',2)
        .attr('height',BAR).attr('width',0)
        .attr('fill','#94a3b8').attr('fill-opacity',.65)
        .transition().duration(500).delay(i*22)
        .attr('width', x(d.p11));

      // 2016–2020 条（下）
      g.append('rect')
        .attr('class',`cee4-b16 cee4-bc-${i}`)
        .attr('x',0).attr('y', y+4+BAR+GAP).attr('rx',2)
        .attr('height',BAR).attr('width',0)
        .attr('fill','#d97706').attr('fill-opacity',1)
        .transition().duration(500).delay(i*22)
        .attr('width', x(d.p16));

      // 国家名
      g.append('text')
        .attr('class',`cee4-lbl cee4-lbl-${i}`)
        .attr('x',-6).attr('y', y+ROW/2+5)
        .attr('text-anchor','end').attr('font-size',11.5)
        .attr('fill','#374151').attr('font-weight','400')
        .text(d.cn);

      // 2016-2020 数值标注
      g.append('text')
        .attr('class',`cee4-val cee4-val-${i}`)
        .attr('x', x(d.p16)+4).attr('y', y+4+BAR+GAP+BAR-1.5)
        .attr('font-size',9).attr('fill','#b45309')
        .text(d.p16>=1000 ? d3.format('.1s')(d.p16) : fmt(d.p16));

      // 增速标注（默认透明，hover 时显示）
      g.append('text')
        .attr('class',`cee4-gr cee4-gr-${i}`)
        .attr('x', iW + mR - 4).attr('y', y+ROW/2+5)
        .attr('text-anchor','end').attr('font-size',10.5).attr('font-weight','700')
        .attr('fill', grColor).attr('opacity', 0)
        .text(gr!=='—' ? `+${gr}%` : '—');

      // 热区
      g.append('rect')
        .attr('x',-mL).attr('y',y).attr('width',W).attr('height',ROW)
        .attr('fill','transparent').attr('cursor','default')
        .on('mouseover', e=>{
          window.cee4ShowTip(e,d);
          applyHighlight(d.cn);
        })
        .on('mousemove', window.cee4MoveTip)
        .on('mouseout', ()=>{
          window.cee4HideTip();
          clearHighlight();
        });
    });

    // 条形图完成后同步地图高度
    setTimeout(syncMapHeight, 550);
  }

  /* ─── 高亮（双向联动）─── */
  function applyHighlight(cn) {
    const idx = RANK_DATA.findIndex(d=>d.cn===cn);
    const n = RANK_DATA.length;

    for (let i=0; i<n; i++) {
      const isActive = (i === idx);
      d3.select(`rect.cee4-b11.cee4-bc-${i}`).attr('fill-opacity', isActive ? 0.65 : 0.07);
      d3.select(`rect.cee4-b16.cee4-bc-${i}`).attr('fill-opacity', isActive ? 1 : 0.07);
      d3.select(`.cee4-lbl-${i}`)
        .attr('fill', isActive ? '#0f172a' : '#c8d0da')
        .attr('font-weight', isActive ? '700' : '400');
      d3.select(`.cee4-val-${i}`).attr('fill-opacity', isActive ? 1 : 0.1);
      // 增速：只显示 active 行
      d3.select(`.cee4-gr-${i}`).attr('opacity', isActive ? 1 : 0);
    }

    // 地图
    d3.select('#cee4-map-svg').select('g.cee4-map-cee').selectAll('path')
      .attr('fill-opacity', f=> ceeByNum[f.id]?.cn===cn ? 1 : 0.15)
      .attr('stroke', f=> ceeByNum[f.id]?.cn===cn ? '#0f172a' : '#b45309')
      .attr('stroke-width', f=> ceeByNum[f.id]?.cn===cn ? 2.5 : 1.2);
  }

  function clearHighlight() {
    const n = RANK_DATA.length;
    for (let i=0; i<n; i++) {
      d3.select(`rect.cee4-b11.cee4-bc-${i}`).attr('fill-opacity', 0.65);
      d3.select(`rect.cee4-b16.cee4-bc-${i}`).attr('fill-opacity', 1);
      d3.select(`.cee4-lbl-${i}`).attr('fill','#374151').attr('font-weight','400');
      d3.select(`.cee4-val-${i}`).attr('fill-opacity',1);
      d3.select(`.cee4-gr-${i}`).attr('opacity', 0);
    }
    d3.select('#cee4-map-svg').select('g.cee4-map-cee').selectAll('path')
      .attr('fill-opacity',1)
      .attr('stroke','#b45309').attr('stroke-width',1.2);
  }

  /* ─── 底部区域增速对比表 ─── */
  function renderTable() {
    const el = document.getElementById('cee4-table');
    if (!el) return;
    const maxGrowth = d3.max([...REGION_GROWTH, GLOBAL], d=>d.growth);

    el.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="border-bottom:2px solid #e2e8f0;">
            <th style="text-align:left;padding:8px 10px;color:#64748b;font-weight:600;font-size:11px;white-space:nowrap;">地区</th>
            <th style="text-align:right;padding:8px 10px;color:#64748b;font-weight:600;font-size:11px;white-space:nowrap;">2011–2015</th>
            <th style="text-align:right;padding:8px 10px;color:#64748b;font-weight:600;font-size:11px;white-space:nowrap;">2016–2020</th>
            <th style="text-align:left;padding:8px 14px;color:#64748b;font-weight:600;font-size:11px;min-width:200px;">增速（增幅条）</th>
          </tr>
        </thead>
        <tbody>
          ${REGION_GROWTH.map((d,i)=>{
            const barW = (d.growth/maxGrowth*100).toFixed(1);
            const grColor = d.growth>=200?'#7c3aed':d.growth>=100?'#059669':'#64748b';
            const bg = d.isCEE?'#fef3c7':i%2===0?'#fafbfc':'#fff';
            return `
              <tr style="border-bottom:1px solid #f1f5f9;background:${bg};">
                <td style="padding:8px 10px;font-weight:${d.isCEE?'700':'400'};
                  color:${d.isCEE?'#92400e':'#374151'};white-space:nowrap;">
                  ${d.isCEE?'★ ':''}${d.r}
                </td>
                <td style="padding:8px 10px;text-align:right;color:#94a3b8;">
                  ${d.p11>=10000?d3.format('.0s')(d.p11):fmt(d.p11)}
                </td>
                <td style="padding:8px 10px;text-align:right;font-weight:${d.isCEE?'700':'500'};
                  color:${d.isCEE?'#b45309':'#374151'};">
                  ${d.p16>=10000?d3.format('.0s')(d.p16):fmt(d.p16)}
                </td>
                <td style="padding:8px 14px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;height:10px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                      <div style="height:100%;width:${barW}%;
                        background:${d.isCEE?'#d97706':grColor};border-radius:3px;"></div>
                    </div>
                    <span style="font-weight:700;font-size:11px;min-width:52px;text-align:right;
                      color:${d.isCEE?'#b45309':grColor};">+${d.growth}%</span>
                  </div>
                </td>
              </tr>`;
          }).join('')}
          <tr style="border-top:2px solid #e2e8f0;background:#f0f7ff;">
            <td style="padding:8px 10px;font-weight:700;color:#1e40af;">全球平均</td>
            <td style="padding:8px 10px;text-align:right;color:#94a3b8;">${d3.format('.0s')(GLOBAL.p11)}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:#1e40af;">${d3.format('.0s')(GLOBAL.p16)}</td>
            <td style="padding:8px 14px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <div style="flex:1;height:10px;background:#f1f5f9;border-radius:3px;overflow:hidden;">
                  <div style="height:100%;width:${(GLOBAL.growth/maxGrowth*100).toFixed(1)}%;
                    background:#2563eb;border-radius:3px;"></div>
                </div>
                <span style="font-weight:700;font-size:11px;min-width:52px;text-align:right;color:#1e40af;">+${GLOBAL.growth}%</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>`;
  }

  /* ─── 初始化 ─── */
  function init() {
    initTooltip();
    injectHTML();

    function tryDraw(n) {
      const el = document.getElementById('ranking-chart');
      if (el && el.parentElement && el.parentElement.clientWidth > 0) {
        renderRankBars();
        renderTable();
        drawMap().catch(console.error);
      } else if (n<20) { setTimeout(()=>tryDraw(n+1), 100); }
    }
    setTimeout(()=>tryDraw(0), 80);

    window.addEventListener('resize', ()=>{
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=>{
        renderRankBars();
        if (worldGeoData) syncMapHeight();
      }, 200);
    });

    function applyResp() {
      const main = document.getElementById('cee4-main');
      if (main) main.style.gridTemplateColumns =
        window.innerWidth < 900 ? '1fr' : '300px 1fr';
    }
    applyResp();
    window.addEventListener('resize', applyResp);
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();