/**
 * chart-overview-v2.js
 * 图1：全球合作版图（三档分类配色 · 扩充数据 · 大地图）
 * Target: <div id="overview-chart"></div>
 * 依赖: D3.js v7, TopoJSON client v3
 */
(function () {
  'use strict';

  window.RAW_DATA = [
    {country:"USA",cn:"美国",iso3:"USA",num:"840",p11:137380,p16:264560,r16:1,region:"北美",cee:false,r11:1},
    {country:"UNITED KINGDOM",cn:"英国",iso3:"GBR",num:"826",p11:29966,p16:71470,r16:2,region:"西欧",cee:false,r11:2},
    {country:"AUSTRALIA",cn:"澳大利亚",iso3:"AUS",num:"036",p11:25829,p16:62277,r16:3,region:"大洋洲",cee:false,r11:3},
    {country:"CANADA",cn:"加拿大",iso3:"CAN",num:"124",p11:22117,p16:45150,r16:4,region:"北美",cee:false,r11:5},
    {country:"GERMANY",cn:"德国",iso3:"DEU",num:"276",p11:20930,p16:41267,r16:5,region:"西欧",cee:false,r11:6},
    {country:"JAPAN",cn:"日本",iso3:"JPN",num:"392",p11:25308,p16:38773,r16:6,region:"东亚",cee:false,r11:4},
    {country:"SINGAPORE",cn:"新加坡",iso3:"SGP",num:"702",p11:13447,p16:26630,r16:7,region:"东南亚",cee:false,r11:8},
    {country:"FRANCE",cn:"法国",iso3:"FRA",num:"250",p11:13617,p16:26522,r16:8,region:"西欧",cee:false,r11:7},
    {country:"SOUTH KOREA",cn:"韩国",iso3:"KOR",num:"410",p11:11676,p16:21979,r16:9,region:"东亚",cee:false,r11:9},
    {country:"ITALY",cn:"意大利",iso3:"ITA",num:"380",p11:7181,p16:16689,r16:10,region:"西欧",cee:false,r11:11},
    {country:"PAKISTAN",cn:"巴基斯坦",iso3:"PAK",num:"586",p11:3190,p16:16284,r16:11,region:"南亚",cee:false,r11:22},
    {country:"NETHERLANDS",cn:"荷兰",iso3:"NLD",num:"528",p11:7325,p16:16015,r16:12,region:"西欧",cee:false,r11:10},
    {country:"SWEDEN",cn:"瑞典",iso3:"SWE",num:"752",p11:6886,p16:14561,r16:13,region:"西欧",cee:false,r11:12},
    {country:"SPAIN",cn:"西班牙",iso3:"ESP",num:"724",p11:5870,p16:13333,r16:14,region:"西欧",cee:false,r11:13},
    {country:"INDIA",cn:"印度",iso3:"IND",num:"356",p11:4458,p16:13051,r16:15,region:"南亚",cee:false,r11:16},
    {country:"RUSSIA",cn:"俄罗斯",iso3:"RUS",num:"643",p11:5008,p16:11963,r16:16,region:"东欧",cee:false,r11:15},
    {country:"SWITZERLAND",cn:"瑞士",iso3:"CHE",num:"756",p11:5349,p16:11049,r16:17,region:"西欧",cee:false,r11:14},
    {country:"SAUDI ARABIA",cn:"沙特阿拉伯",iso3:"SAU",num:"682",p11:3739,p16:10941,r16:18,region:"中东",cee:false,r11:19},
    {country:"DENMARK",cn:"丹麦",iso3:"DNK",num:"208",p11:4453,p16:10117,r16:19,region:"西欧",cee:false,r11:17},
    {country:"BELGIUM",cn:"比利时",iso3:"BEL",num:"056",p11:3912,p16:8675,r16:20,region:"西欧",cee:false,r11:18},
    {country:"BRAZIL",cn:"巴西",iso3:"BRA",num:"076",p11:3415,p16:7195,r16:21,region:"拉丁美洲",cee:false,r11:20},
    {country:"FINLAND",cn:"芬兰",iso3:"FIN",num:"246",p11:2995,p16:7089,r16:22,region:"西欧",cee:false,r11:23},
    {country:"POLAND",cn:"波兰",iso3:"POL",num:"616",p11:3252,p16:6866,r16:23,region:"中东欧",cee:true,r11:21},
    {country:"NEW ZEALAND",cn:"新西兰",iso3:"NZL",num:"554",p11:2518,p16:6357,r16:24,region:"大洋洲",cee:false,r11:26},
    {country:"AUSTRIA",cn:"奥地利",iso3:"AUT",num:"040",p11:2981,p16:6304,r16:25,region:"西欧",cee:false,r11:25},
    {country:"MALAYSIA",cn:"马来西亚",iso3:"MYS",num:"458",p11:1757,p16:5919,r16:26,region:"东南亚",cee:false,r11:36},
    {country:"NORWAY",cn:"挪威",iso3:"NOR",num:"578",p11:2991,p16:5887,r16:27,region:"西欧",cee:false,r11:24},
    {country:"IRAN",cn:"伊朗",iso3:"IRN",num:"364",p11:1427,p16:5659,r16:28,region:"中东",cee:false,r11:39},
    {country:"EGYPT",cn:"埃及",iso3:"EGY",num:"818",p11:1314,p16:5420,r16:29,region:"中东",cee:false,r11:41},
    {country:"CZECH REPUBLIC",cn:"捷克",iso3:"CZE",num:"203",p11:2450,p16:5063,r16:30,region:"中东欧",cee:true,r11:27},
    {country:"TURKEY",cn:"土耳其",iso3:"TUR",num:"792",p11:2228,p16:4975,r16:31,region:"中东",cee:false,r11:29},
    {country:"IRELAND",cn:"爱尔兰",iso3:"IRL",num:"372",p11:2084,p16:4955,r16:32,region:"西欧",cee:false,r11:31},
    {country:"SOUTH AFRICA",cn:"南非",iso3:"ZAF",num:"710",p11:2003,p16:4865,r16:33,region:"非洲",cee:false,r11:32},
    {country:"PORTUGAL",cn:"葡萄牙",iso3:"PRT",num:"620",p11:2229,p16:4796,r16:34,region:"西欧",cee:false,r11:28},
    {country:"THAILAND",cn:"泰国",iso3:"THA",num:"764",p11:1811,p16:4683,r16:35,region:"东南亚",cee:false,r11:35},
    {country:"ISRAEL",cn:"以色列",iso3:"ISR",num:"376",p11:1969,p16:4448,r16:36,region:"中东",cee:false,r11:33},
    {country:"GREECE",cn:"希腊",iso3:"GRC",num:"300",p11:2086,p16:4193,r16:37,region:"中东欧",cee:true,r11:30},
    {country:"VIETNAM",cn:"越南",iso3:"VNM",num:"704",p11:967,p16:3731,r16:38,region:"东南亚",cee:false,r11:49},
    {country:"HUNGARY",cn:"匈牙利",iso3:"HUN",num:"348",p11:1901,p16:3673,r16:39,region:"中东欧",cee:true,r11:34},
    {country:"MEXICO",cn:"墨西哥",iso3:"MEX",num:"484",p11:1716,p16:3436,r16:40,region:"拉丁美洲",cee:false,r11:37},
    {country:"ROMANIA",cn:"罗马尼亚",iso3:"ROU",num:"642",p11:1596,p16:3124,r16:41,region:"中东欧",cee:true,r11:38},
    {country:"CHILE",cn:"智利",iso3:"CHL",num:"152",p11:1081,p16:2794,r16:42,region:"拉丁美洲",cee:false,r11:44},
    {country:"UKRAINE",cn:"乌克兰",iso3:"UKR",num:"804",p11:1226,p16:2516,r16:43,region:"东欧",cee:false,r11:43},
    {country:"COLOMBIA",cn:"哥伦比亚",iso3:"COL",num:"170",p11:1343,p16:2312,r16:44,region:"拉丁美洲",cee:false,r11:40},
    {country:"QATAR",cn:"卡塔尔",iso3:"QAT",num:"634",p11:757,p16:2211,r16:45,region:"中东",cee:false,r11:53},
    {country:"UNITED ARAB EMIRATES",cn:"阿联酋",iso3:"ARE",num:"784",p11:387,p16:2123,r16:46,region:"中东",cee:false,r11:62},
    {country:"SERBIA",cn:"塞尔维亚",iso3:"SRB",num:"688",p11:1295,p16:1967,r16:47,region:"中东欧",cee:true,r11:42},
    {country:"SLOVENIA",cn:"斯洛文尼亚",iso3:"SVN",num:"705",p11:1045,p16:1920,r16:48,region:"中东欧",cee:true,r11:46},
    {country:"ARGENTINA",cn:"阿根廷",iso3:"ARG",num:"032",p11:1042,p16:1836,r16:49,region:"拉丁美洲",cee:false,r11:47},
    {country:"SLOVAKIA",cn:"斯洛伐克",iso3:"SVK",num:"703",p11:896,p16:1809,r16:50,region:"中东欧",cee:true,r11:52},
    {country:"CROATIA",cn:"克罗地亚",iso3:"HRV",num:"191",p11:907,p16:1690,r16:51,region:"中东欧",cee:true,r11:51},
    {country:"BULGARIA",cn:"保加利亚",iso3:"BGR",num:"100",p11:693,p16:1621,r16:52,region:"中东欧",cee:true,r11:55},
    {country:"ESTONIA",cn:"爱沙尼亚",iso3:"EST",num:"233",p11:714,p16:1528,r16:53,region:"中东欧",cee:true,r11:54},
    {country:"LITHUANIA",cn:"立陶宛",iso3:"LTU",num:"440",p11:607,p16:1522,r16:54,region:"东欧",cee:false,r11:56},
    {country:"BELARUS",cn:"白俄罗斯",iso3:"BLR",num:"112",p11:977,p16:1481,r16:55,region:"东欧",cee:false,r11:48},
    {country:"NIGERIA",cn:"尼日利亚",iso3:"NGA",num:"566",p11:365,p16:1446,r16:56,region:"非洲",cee:false,r11:63},
    {country:"INDONESIA",cn:"印度尼西亚",iso3:"IDN",num:"360",p11:422,p16:1446,r16:57,region:"东南亚",cee:false,r11:61},
    {country:"BANGLADESH",cn:"孟加拉国",iso3:"BGD",num:"050",p11:314,p16:1428,r16:58,region:"南亚",cee:false,r11:66},
    {country:"ARMENIA",cn:"亚美尼亚",iso3:"ARM",num:"051",p11:1063,p16:1403,r16:59,region:"东欧",cee:false,r11:45},
    {country:"REPUBLIC OF GEORGIA",cn:"格鲁吉亚",iso3:"GEO",num:"268",p11:938,p16:1347,r16:60,region:"东欧",cee:false,r11:50},
    {country:"LATVIA",cn:"拉脱维亚",iso3:"LVA",num:"428",p11:97,p16:1028,r16:64,region:"中东欧",cee:true,r11:86},
    {country:"MACEDONIA",cn:"北马其顿",iso3:"MKD",num:"807",p11:70,p16:178,r16:99,region:"中东欧",cee:true,r11:94},
    {country:"BOSNIA & HERZEGOVINA",cn:"波黑",iso3:"BIH",num:"070",p11:17,p16:90,r16:117,region:"中东欧",cee:true,r11:132},
    {country:"MONTENEGRO",cn:"黑山",iso3:"MNE",num:"499",p11:11,p16:129,r16:108,region:"中东欧",cee:true,r11:139},
    {country:"ALBANIA",cn:"阿尔巴尼亚",iso3:"ALB",num:"008",p11:6,p16:71,r16:124,region:"中东欧",cee:true,r11:150},
    {country:"PHILIPPINES",cn:"菲律宾",iso3:"PHL",num:"608",p11:473,p16:1341,r16:61,region:"东南亚",cee:false,r11:60},
    {country:"GHANA",cn:"加纳",iso3:"GHA",num:"288",p11:230,p16:1103,r16:62,region:"非洲",cee:false,r11:64},
    {country:"SRI LANKA",cn:"斯里兰卡",iso3:"LKA",num:"144",p11:340,p16:1055,r16:63,region:"南亚",cee:false,r11:65},
    {country:"KENYA",cn:"肯尼亚",iso3:"KEN",num:"404",p11:334,p16:955,r16:65,region:"非洲",cee:false,r11:67},
    {country:"ALGERIA",cn:"阿尔及利亚",iso3:"DZA",num:"012",p11:117,p16:904,r16:66,region:"中东",cee:false,r11:83},
    {country:"IRAQ",cn:"伊拉克",iso3:"IRQ",num:"368",p11:195,p16:885,r16:67,region:"中东",cee:false,r11:74},
    {country:"CYPRUS",cn:"塞浦路斯",iso3:"CYP",num:"196",p11:488,p16:868,r16:68,region:"西欧",cee:false,r11:60},
    {country:"MOROCCO",cn:"摩洛哥",iso3:"MAR",num:"504",p11:582,p16:864,r16:69,region:"中东",cee:false,r11:58},
    {country:"ECUADOR",cn:"厄瓜多尔",iso3:"ECU",num:"218",p11:220,p16:857,r16:70,region:"拉丁美洲",cee:false,r11:72},
    {country:"AZERBAIJAN",cn:"阿塞拜疆",iso3:"AZE",num:"031",p11:470,p16:806,r16:71,region:"东欧",cee:false,r11:61},
    {country:"NEPAL",cn:"尼泊尔",iso3:"NPL",num:"524",p11:206,p16:774,r16:72,region:"南亚",cee:false,r11:73},
    {country:"KAZAKHSTAN",cn:"哈萨克斯坦",iso3:"KAZ",num:"398",p11:112,p16:712,r16:73,region:"中亚",cee:false,r11:84},
    {country:"SUDAN",cn:"苏丹",iso3:"SDN",num:"729",p11:184,p16:708,r16:74,region:"非洲",cee:false,r11:76},
    {country:"ETHIOPIA",cn:"埃塞俄比亚",iso3:"ETH",num:"231",p11:90,p16:708,r16:75,region:"非洲",cee:false,r11:89},
    {country:"PERU",cn:"秘鲁",iso3:"PER",num:"604",p11:258,p16:655,r16:76,region:"拉丁美洲",cee:false,r11:70},
    {country:"TUNISIA",cn:"突尼斯",iso3:"TUN",num:"788",p11:131,p16:582,r16:77,region:"中东",cee:false,r11:81},
    {country:"LUXEMBOURG",cn:"卢森堡",iso3:"LUX",num:"442",p11:178,p16:502,r16:78,region:"西欧",cee:false,r11:75},
    {country:"MYANMAR",cn:"缅甸",iso3:"MMR",num:"104",p11:40,p16:495,r16:79,region:"东南亚",cee:false,r11:104},
    {country:"JORDAN",cn:"约旦",iso3:"JOR",num:"400",p11:77,p16:494,r16:80,region:"中东",cee:false,r11:91},
    {country:"MONGOLIA",cn:"蒙古",iso3:"MNG",num:"496",p11:137,p16:478,r16:81,region:"东亚",cee:false,r11:80},
    {country:"LEBANON",cn:"黎巴嫩",iso3:"LBN",num:"422",p11:130,p16:468,r16:82,region:"中东",cee:false,r11:82},
    {country:"TANZANIA",cn:"坦桑尼亚",iso3:"TZA",num:"834",p11:77,p16:454,r16:83,region:"非洲",cee:false,r11:92},
    {country:"ICELAND",cn:"冰岛",iso3:"ISL",num:"352",p11:173,p16:432,r16:84,region:"西欧",cee:false,r11:78},
    {country:"CUBA",cn:"古巴",iso3:"CUB",num:"192",p11:232,p16:421,r16:85,region:"拉丁美洲",cee:false,r11:71},
    {country:"OMAN",cn:"阿曼",iso3:"OMN",num:"512",p11:100,p16:409,r16:86,region:"中东",cee:false,r11:87},
    {country:"UZBEKISTAN",cn:"乌兹别克斯坦",iso3:"UZB",num:"860",p11:99,p16:368,r16:88,region:"中亚",cee:false,r11:88},
    {country:"CAMEROON",cn:"喀麦隆",iso3:"CMR",num:"120",p11:97,p16:344,r16:89,region:"非洲",cee:false,r11:90},
    {country:"KUWAIT",cn:"科威特",iso3:"KWT",num:"414",p11:95,p16:318,r16:90,region:"中东",cee:false,r11:90},
    {country:"NORTH KOREA",cn:"朝鲜",iso3:"PRK",num:"408",p11:123,p16:306,r16:91,region:"东亚",cee:false,r11:85},
    {country:"UGANDA",cn:"乌干达",iso3:"UGA",num:"800",p11:74,p16:228,r16:93,region:"非洲",cee:false,r11:93},
    {country:"URUGUAY",cn:"乌拉圭",iso3:"URY",num:"858",p11:101,p16:224,r16:94,region:"拉丁美洲",cee:false,r11:86},
    {country:"VENEZUELA",cn:"委内瑞拉",iso3:"VEN",num:"862",p11:102,p16:205,r16:95,region:"拉丁美洲",cee:false,r11:86},
    {country:"PANAMA",cn:"巴拿马",iso3:"PAN",num:"591",p11:76,p16:181,r16:97,region:"拉丁美洲",cee:false,r11:96}
  ];

  window.CEE_COUNTRIES = window.RAW_DATA.filter(d => d.cee);
  window.COUNTRIES     = window.RAW_DATA;
  window.dataByNum     = {};
  window.RAW_DATA.forEach(d => {
    if (d.num) {
      [d.num, +d.num, String(+d.num)].forEach(k => { window.dataByNum[k] = d; });
    }
  });
  window.fmt = d3.format(',');

  const TIERS = [
    { min: 5000, fill: '#1e3a8a', stroke: '#1d4ed8', label: '深度合作 ≥5,000篇'   },
    { min: 500,  fill: '#3b82f6', stroke: '#2563eb', label: '中度合作 500–4,999篇' },
    { min: 1,    fill: '#93c5fd', stroke: '#60a5fa', label: '少量合作 <500篇'       },
    { min: 0,    fill: '#dde4ed', stroke: '#c5cdd9', label: '无合作记录'             }
  ];

  function getTier(val) {
    if (!val || val <= 0) return TIERS[3];
    if (val >= 5000)  return TIERS[0];
    if (val >= 500)   return TIERS[1];
    return TIERS[2];
  }

  // 默认时段改为 p11（2011–2015）
  let currentPeriod = 'p11';
  let worldGeoData  = null;
  let resizeTimer;

  function initTooltip() {
    if (document.getElementById('ov2-tt')) return;
    const tt = document.createElement('div');
    tt.id = 'ov2-tt';
    tt.style.cssText = `
      position:fixed;display:none;pointer-events:none;z-index:9999;
      background:rgba(15,23,42,.96);color:#f8fafc;border-radius:10px;
      padding:12px 16px;font-size:12.5px;line-height:1.7;
      box-shadow:0 8px 32px rgba(0,0,0,.3);max-width:230px;
      font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;
      border:1px solid rgba(255,255,255,.08);
    `;
    document.body.appendChild(tt);

    window.ov2ShowTip = function(e, d) {
      const p = currentPeriod;
      const pLabel = p === 'p16' ? '2016–2020' : '2011–2015';
      const prev   = p === 'p16' ? 'p11' : 'p16';
      const growth = d[prev] > 0 ? ((d[p]-d[prev])/d[prev]*100).toFixed(1) : '—';
      const rank   = d[p==='p16'?'r16':'r11'];
      tt.innerHTML = `
        <div style="font-weight:700;font-size:13.5px;border-bottom:1px solid rgba(255,255,255,.12);
          padding-bottom:5px;margin-bottom:7px;">
          ${d.cn} <span style="opacity:.4;font-weight:400;font-size:11px;">${d.country}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">所属区域</span><span>${d.region}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">${pLabel}</span>
          <span style="font-weight:600;color:#93c5fd;">${window.fmt(d[p])} 篇</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">
          <span style="color:rgba(255,255,255,.5);">增幅</span>
          <span style="color:#6ee7b7;">${growth !== '—' ? '+'+growth+'%' : '—'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:12px;">
          <span style="color:rgba(255,255,255,.5);">全球排名</span>
          <span style="color:#fbbf24;font-weight:700;">#${rank}</span>
        </div>
        ${d.cee ? `<div style="margin-top:8px;background:#92400e;
          border-radius:5px;padding:2px 8px;font-size:11px;font-weight:600;display:inline-block;">
          ★ 中东欧16国</div>` : ''}
      `;
      tt.style.display = 'block';
      window.ov2MoveTip(e);
    };
    window.ov2MoveTip = function(e) {
      let x = e.clientX + 14, y = e.clientY + 12;
      if (x + 240 > window.innerWidth)  x = e.clientX - 252;
      if (y + 220 > window.innerHeight) y = e.clientY - 232;
      tt.style.left = x + 'px'; tt.style.top = y + 'px';
    };
    window.ov2HideTip = () => { tt.style.display = 'none'; };
  }

  function injectHTML() {
    const el = document.getElementById('overview-chart');
    if (!el) return;
    el.style.fontFamily = "'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif";

    el.innerHTML = `
      <div id="ov2-statbar" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;
        margin-bottom:18px;"></div>

      <div id="ov2-wrap" style="display:grid;grid-template-columns:1fr 290px;gap:18px;align-items:start;">
        <div style="background:#fff;border-radius:14px;padding:18px 20px 14px;
          box-shadow:0 2px 10px rgba(0,0,0,.07);border:1px solid #dde4ec;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;
            flex-wrap:wrap;gap:10px;margin-bottom:14px;">
            <div>
              <div style="font-size:16px;font-weight:700;color:#0f172a;margin-bottom:3px;">
                中国科研合作全球版图
              </div>
              <div style="font-size:11.5px;color:#64748b;">
                按合作发文量三档分类着色 ·
                <span style="color:#e07b27;font-weight:600;">橙框</span> = 中东欧16国
              </div>
            </div>
            <div style="display:inline-flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <button id="ov2-p11" style="padding:5px 14px;font-size:12px;font-weight:600;
                border:none;background:#1e40af;color:#fff;cursor:pointer;">2011–2015</button>
              <button id="ov2-p16" style="padding:5px 14px;font-size:12px;font-weight:500;
                border:none;background:#f8fafc;color:#64748b;cursor:pointer;">2016–2020</button>
            </div>
          </div>

          <div id="ov2-mapwrap" style="position:relative;border-radius:10px;overflow:hidden;
            background:#cde5f4;min-height:320px;">
            <svg id="ov2-svg" style="width:100%;display:block;"></svg>
          </div>

          <div id="ov2-legend" style="display:flex;flex-wrap:wrap;gap:10px 18px;
            margin-top:11px;align-items:center;"></div>
        </div>

        <div style="display:flex;flex-direction:column;gap:14px;">
          <div id="ov2-tiers" style="background:#fff;border-radius:14px;padding:16px;
            box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid #dde4ec;"></div>
          <div id="ov2-insight" style="background:#fff;border-radius:14px;padding:16px;
            box-shadow:0 2px 8px rgba(0,0,0,.06);border:1px solid #dde4ec;"></div>
        </div>
      </div>
    `;

    document.getElementById('ov2-p11').onclick = () => switchPeriod('p11');
    document.getElementById('ov2-p16').onclick = () => switchPeriod('p16');
  }

  function updateStats() {
    const G = currentPeriod === 'p11' ? 427285 : 911293;
    const ceeTot = d3.sum(window.CEE_COUNTRIES, d => d[currentPeriod]);
    const pct    = (ceeTot / G * 100).toFixed(2);
    const top    = window.CEE_COUNTRIES.reduce((a,b) => b[currentPeriod]>a[currentPeriod]?b:a);
    const lbl    = currentPeriod === 'p11' ? '2011–2015' : '2016–2020';
    const cards  = [
      { t: `全球合作总量（${lbl}）`, v: window.fmt(G),       u:'篇', c:'#1e40af' },
      { t: '中东欧合作总量',         v: window.fmt(ceeTot), u:'篇', c:'#e07b27' },
      { t: '中东欧占全球比例',        v: pct,                u:'%',  c:'#e07b27' },
      { t: '中东欧领头羊',           v: top.cn,             u:`#${top[currentPeriod==='p11'?'r11':'r16']}`, c:'#2563eb' }
    ];
    document.getElementById('ov2-statbar').innerHTML = cards.map(c=>`
      <div style="background:#fff;border-radius:10px;padding:13px 16px;text-align:center;
        box-shadow:0 1px 4px rgba(0,0,0,.06);border:1px solid #dde4ec;">
        <div style="font-size:10px;color:#64748b;margin-bottom:4px;">${c.t}</div>
        <div style="font-size:20px;font-weight:700;color:${c.c};">${c.v}
          <span style="font-size:11px;font-weight:400;color:#94a3b8;margin-left:2px;">${c.u}</span>
        </div>
      </div>
    `).join('');
  }

  function updateRight() {
    const p = currentPeriod;
    const cntHigh = window.RAW_DATA.filter(d => d[p] >= 5000).length;
    const cntMed  = window.RAW_DATA.filter(d => d[p] >= 500 && d[p] < 5000).length;
    const cntLow  = window.RAW_DATA.filter(d => d[p] > 0 && d[p] < 500).length;

    document.getElementById('ov2-tiers').innerHTML = `
      <div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;
        letter-spacing:.07em;margin-bottom:10px;">合作层级分布</div>
      ${TIERS.slice(0,3).map((t,i) => {
        const cnt = [cntHigh,cntMed,cntLow][i];
        return `<div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;">
          <div style="width:13px;height:13px;border-radius:3px;background:${t.fill};flex-shrink:0;"></div>
          <div style="flex:1;font-size:11.5px;color:#374151;">${t.label}</div>
          <div style="font-size:13px;font-weight:700;color:${t.fill};min-width:28px;text-align:right;">${cnt}</div>
        </div>`;
      }).join('')}
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px;">
        <div style="width:13px;height:13px;border-radius:3px;background:#dde4ed;flex-shrink:0;"></div>
        <div style="flex:1;font-size:11.5px;color:#94a3b8;">无合作记录</div>
        <div style="font-size:13px;font-weight:700;color:#94a3b8;">—</div>
      </div>
      <div style="display:flex;align-items:center;gap:9px;margin-top:6px;padding-top:9px;
        border-top:1px solid #f1f5f9;">
        <div style="width:13px;height:9px;border:2px solid #e07b27;border-radius:2px;flex-shrink:0;"></div>
        <div style="font-size:11.5px;color:#374151;">中东欧16国（橙框标注）</div>
      </div>
    `;

    const isP16 = p === 'p16';
    document.getElementById('ov2-insight').innerHTML = `
      <div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;
        letter-spacing:.07em;margin-bottom:10px;">核心发现</div>
      <div style="font-size:12px;color:#475569;line-height:1.75;">
        ${isP16 ? `
        <p style="margin:0 0 9px;"><strong style="color:#0f172a;">规模跃升</strong><br>
        2016–2020年全球合作达<strong style="color:#1e40af;">91.1万篇</strong>，
        增长<strong style="color:#059669;">+113%</strong>；中东欧升至
        <strong style="color:#e07b27;">34,950篇</strong>，增幅+105%。</p>
        <p style="margin:0 0 9px;"><strong style="color:#0f172a;">区域定位</strong><br>
        中东欧占全球<strong style="color:#e07b27;">3.84%</strong>，
        作为地理连片区域处于全球中上游地位。</p>
        <p style="margin:0;"><strong style="color:#0f172a;">内部分化</strong><br>
        波兰·捷克·希腊三国合计占中东欧约<strong>46%</strong>，
        尾部国家仍有极大<strong style="color:#e07b27;">扩展空间</strong>。</p>
        ` : `
        <p style="margin:0 0 9px;"><strong style="color:#0f172a;">版图初成</strong><br>
        2011–2015年合作<strong style="color:#1e40af;">42.7万篇</strong>，
        中东欧16国贡献<strong style="color:#e07b27;">17,036篇</strong>（占比3.99%）。</p>
        <p style="margin:0 0 9px;"><strong style="color:#0f172a;">头部格局</strong><br>
        波兰3,252篇、捷克2,450篇、希腊2,086篇，三国合计占区域46%。</p>
        <p style="margin:0;"><strong style="color:#0f172a;">尾部潜力</strong><br>
        黑山（11篇）、阿尔巴尼亚（6篇）等国合作量极低，
        结构性<strong style="color:#e07b27;">扩展空间</strong>巨大。</p>
        `}
      </div>
    `;
  }

  function loadTopojson() {
    if (window.topojson) return Promise.resolve();
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js';
      s.onload = res;
      document.head.appendChild(s);
    });
  }

  async function drawMap() {
    if (!worldGeoData) {
      await loadTopojson();
      const world = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
      worldGeoData = topojson.feature(world, world.objects.countries);
    }
    const wrap = document.getElementById('ov2-mapwrap');
    if (!wrap) return;

    const W = wrap.clientWidth || 720;
    // 使用标准 NaturalEarth1 比例（约 0.5 宽高比），垂直居中向上微移
    const H = Math.round(W * 0.58);

    const svg = d3.select('#ov2-svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .style('height', H + 'px');
    svg.selectAll('*').remove();

    // scale = W/6.28 是 NaturalEarth1 标准比例；translateY 向上偏移 4% 使陆地块视觉居中
    const proj = d3.geoNaturalEarth1()
      .scale(W / 5.55)
      .translate([W / 2, H / 2 + 8]);
    const path = d3.geoPath().projection(proj);

    const root = svg.append('g');
    root.append('rect').attr('width', W).attr('height', H).attr('fill', '#cde5f4');
    root.append('path').datum(d3.geoGraticule()())
      .attr('d', path).attr('fill', 'none')
      .attr('stroke', '#b0d0e6').attr('stroke-width', 0.3);

    buildLayers(root, path);
    renderLegend();
    updateStats();
    updateRight();
  }

  function buildLayers(root, path) {
    const p = currentPeriod;
    root.selectAll('path.cp').data(worldGeoData.features).join('path')
      .attr('class', 'cp')
      .attr('d', path)
      .attr('fill', f => getTier(window.dataByNum[f.id]?.[p] ?? 0).fill)
      .attr('stroke', f => window.dataByNum[f.id]?.cee ? '#e07b27' : 'rgba(255,255,255,.55)')
      .attr('stroke-width', f => window.dataByNum[f.id]?.cee ? 1.5 : 0.3)
      .on('mouseover', function(e, f) {
        const d = window.dataByNum[f.id];
        if (!d || !d[p]) return;
        d3.select(this).attr('stroke', '#0f172a').attr('stroke-width', 2).raise();
        window.ov2ShowTip(e, d);
      })
      .on('mousemove', window.ov2MoveTip)
      .on('mouseout', function(e, f) {
        const d = window.dataByNum[f.id];
        d3.select(this)
          .attr('stroke', d?.cee ? '#e07b27' : 'rgba(255,255,255,.55)')
          .attr('stroke-width', d?.cee ? 1.5 : 0.3);
        window.ov2HideTip();
      });
  }

  function redrawColors() {
    const p = currentPeriod;
    d3.select('#ov2-svg').selectAll('path.cp')
      .transition().duration(500)
      .attr('fill', f => getTier(window.dataByNum[f.id]?.[p] ?? 0).fill);
    updateStats();
    updateRight();
  }

  function renderLegend() {
    const el = document.getElementById('ov2-legend');
    if (!el) return;
    el.innerHTML = TIERS.map((t, i) => `
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#4b5563;">
        <div style="width:13px;height:13px;border-radius:3px;background:${t.fill};
          border:1px solid ${i<3?t.stroke:'#b8c4cf'};flex-shrink:0;"></div>
        ${t.label}
      </div>
    `).join('') + `
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:#4b5563;">
        <div style="width:13px;height:9px;border:2px solid #e07b27;border-radius:2px;"></div>
        中东欧16国边框标注
      </div>
    `;
  }

  function switchPeriod(p) {
    if (currentPeriod === p) return;
    currentPeriod = p;
    const b11 = document.getElementById('ov2-p11');
    const b16 = document.getElementById('ov2-p16');
    if (p === 'p16') {
      b16.style.background = '#1e40af'; b16.style.color = '#fff'; b16.style.fontWeight = '600';
      b11.style.background = '#f8fafc'; b11.style.color = '#64748b'; b11.style.fontWeight = '500';
    } else {
      b11.style.background = '#1e40af'; b11.style.color = '#fff'; b11.style.fontWeight = '600';
      b16.style.background = '#f8fafc'; b16.style.color = '#64748b'; b16.style.fontWeight = '500';
    }
    if (worldGeoData) redrawColors(); else drawMap();
  }

  function init() {
    initTooltip();
    injectHTML();

    function tryDraw(n) {
      const wrap = document.getElementById('ov2-mapwrap');
      if (!wrap) return;
      if (wrap.clientWidth > 0) drawMap().catch(console.error);
      else if (n < 20) setTimeout(() => tryDraw(n+1), 100);
    }
    setTimeout(() => tryDraw(0), 80);

    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (worldGeoData) drawMap().catch(()=>{}); }, 180);
    });
    const c = document.getElementById('overview-chart');
    if (c) ro.observe(c);

    function applyResp() {
      const g = document.getElementById('ov2-wrap');
      const s = document.getElementById('ov2-statbar');
      if (g) g.style.gridTemplateColumns = window.innerWidth < 900 ? '1fr' : '1fr 290px';
      if (s) s.style.gridTemplateColumns = window.innerWidth < 600 ? '1fr 1fr' : 'repeat(4,1fr)';
    }
    applyResp();
    window.addEventListener('resize', applyResp);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();