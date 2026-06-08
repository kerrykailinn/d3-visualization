/**
 * Institution Layer — 结构分析型 narrative visualization
 * MACRO → MACRO DYNAMIC → MESO → DETAIL
 * #network-chart | D3.js v7
 */
(function () {
  "use strict";

  const ROOT = "#network-chart";
  const TOP_N = 15;
  const BINS = [
    { id: "top5", label: "前 5%", tag: "核心层" },
    { id: "p5_10", label: "5–10%", tag: "上层核心" },
    { id: "p10_20", label: "10–20%", tag: "活跃机构" },
    { id: "p20_100", label: "20–100%", tag: "长尾机构" }
  ];

  const CARD_PAD_X = 48;
  const MACRO_SIDE_W = 340;
  const MACRO_BODY_GAP = 8;

  const IL_SECTIONS = {
    macro: {
      figure: "图 06",
      ordinal: "一",
      label: "分布结构",
      title: "整体集中度",
      sub: "合作是否仍集中于少数核心机构？中国与中东欧两侧的合作结构，是否正在从集中走向扩散？"
    },
    sankey: {
      figure: "图 07",
      ordinal: "二",
      label: "流动结构",
      title: "层级迁移",
      sub: "机构之间是否出现新的层级流动？原本位于边缘的机构，是否正在进入更核心的位置？"
    },
    bubble: {
      figure: "图 08",
      ordinal: "三",
      label: "份额结构",
      title: "机构结构份额迁移",
      sub: "哪些机构是稳定头部？哪些是新兴增长机构？哪些在退场？以两期合作份额对照观察。"
    },
    meso: {
      figure: "图 09",
      ordinal: "四",
      label: "权力结构",
      title: "Top15 核心机构",
      sub: "核心机构的合作份额是在上升还是下降？新进入 Top15 的机构，是否正在改写中国与中东欧的合作权力格局？"
    }
  };

  const C = {
    china: "#2563eb",
    chinaLt: "#93c5fd",
    chinaDk: "#1e40af",
    cee: "#d97706",
    ceeLt: "#fdba74",
    ceeDk: "#b45309",
    up: "#dc2626",
    down: "#2563eb",
    stable: "#94a3b8",
    text: "#0f172a",
    muted: "#64748b",
    label: "#94a3b8",
    border: "#dde4ec",
    bg: "#ffffff",
    bg2: "#f8fafc",
    panel: "#f1f5f9",
    font: "'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif",
    fade: 0.2,
    dur: 400
  };

  const TIP = {
    dim: "rgba(255,255,255,.5)",
    hi: "#93c5fd",
    gain: "#6ee7b7",
    loss: "#fca5a5",
    warn: "#fbbf24"
  };

  function sankeySideTextStyle(extra = "") {
    return `font-size:12px;line-height:1.75;color:#475569;${extra}`;
  }

  function sankeySideMutedStyle(extra = "") {
    return `font-size:12px;line-height:1.75;color:${C.muted};${extra}`;
  }

  function sankeyRegionAccent(region) {
    return region === "china" ? C.chinaDk : C.cee;
  }

  function sankeyInsightHi(text, region) {
    return `<strong style="color:${sankeyRegionAccent(region)};font-weight:600;">${text}</strong>`;
  }

  function panelTextStyle(extra = "") {
    return `font-size:13px;line-height:1.7;color:${C.text};${extra}`;
  }

  function panelMutedStyle(extra = "") {
    return `font-size:13px;line-height:1.7;color:${C.muted};${extra}`;
  }

  function tipTitleHtml(text, accent) {
    const color = accent ? `color:${accent};` : "";
    return (
      `<div style="font-weight:700;font-size:13px;border-bottom:1px solid rgba(255,255,255,.12);` +
      `padding-bottom:5px;margin-bottom:7px;${color}">${text}</div>`
    );
  }

  function tipRowHtml(label, value, valueStyle) {
    const valAttr = valueStyle ? ` style="${valueStyle}"` : "";
    return (
      `<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">` +
      `<span style="color:${TIP.dim};">${label}</span><span${valAttr}>${value}</span></div>`
    );
  }

  const MESO = {
    neutral: "#e2e8f0",
    neutralLt: "#f1f5f9",
    neutralDk: "#cbd5e1",
    shareBase: "#f1f5f9",
    shareGain: "#94a3b8",
    shareLoss: "#e2e8f0",
    traj: "#94a3b8",
    chinaBar: "#dbeafe",
    chinaBarDk: "#93c5fd",
    ceeBar: "#ffedd5",
    ceeBarDk: "#fdba74",
    psBaseline: "#e8eaed",
    psGain: "#5c8d89",
    psLoss: "#c07a6d"
  };

  let $root, $tip, data, ro;
  const S = {
    mesoSel: { china: null, cee: null },
    mesoHover: { china: null, cee: null },
    paretoSeries: null,
    sankeySel: { china: null, cee: null },
    sankeyPreview: { china: null, cee: null },
    sankeyActiveRegion: "china",
    sankeyLastRegion: "china",
    sankeyMobilityFilter: "all",
    sankeyAnnotSeq: 0,
    bubbleHover: null,
    bubbleSel: null,
    bubbleOverviewMode: "count",
    bubbleRegionFilter: "all",
    bubbleTopListMode: "change",
    bubbleSearchQuery: "",
    bubbleSearchHoverId: null,
    macroMode: "time",
    macroPeriod: "p20",
    macroRegion: "china",
    macroHoverTier: null,
    macroHoverSeries: null,
    macroChartW: 320,
    macroViewsReady: false
  };
  const bus = d3.dispatch("change");

  // ─── utilities ───────────────────────────────────────────────────────────
  const pct = d3.format(".1%");
  const pct2 = d3.format(".2%");
  const num = d3.format(",");

  function binOfPercentile(rank, nAll) {
    // nAll = 区域全部机构数；无合作记录（rank≤0）归入长尾
    if (!rank || rank <= 0) return "p20_100";
    const pct = (rank / nAll) * 100;
    if (pct <= 5) return "top5";
    if (pct <= 10) return "p5_10";
    if (pct <= 20) return "p10_20";
    return "p20_100";
  }

  function binIdx(id) {
    return BINS.findIndex((b) => b.id === id);
  }

  function binTag(id) {
    return (BINS.find((b) => b.id === id) || { tag: "" }).tag;
  }

  function binColor(binId, region) {
    const china = { top5: "#1d4ed8", p5_10: "#3b82f6", p10_20: "#60a5fa", p20_100: "#93c5fd" };
    const cee = { top5: "#b45309", p5_10: "#d97706", p10_20: "#f59e0b", p20_100: "#fdba74" };
    return (region === "china" ? china : cee)[binId] || C.muted;
  }

  function binTextColor() {
    return "#fff";
  }

  function binCounts(rows, period) {
    const key = period === 2015 ? "bin_2015" : "bin_2020";
    const counts = Object.fromEntries(BINS.map((b) => [b.id, 0]));
    rows.forEach((d) => {
      if (counts[d[key]] !== undefined) counts[d[key]] += 1;
    });
    return counts;
  }

  function flowMobilityDir(from, to) {
    const fi = binIdx(from);
    const ti = binIdx(to);
    if (ti < fi) return "up";
    if (ti > fi) return "down";
    return "stable";
  }

  const SANKEY_FLOW_DEFAULT = {
    china: "#a8cffe",
    cee: "#fdc078"
  };

  const SANKEY_FLOW_DIR = {
    china: { baseline: "#d4d4d8", growth: "#2563eb", decline: "#93c5fd" },
    cee: { baseline: "#d4d4d8", growth: "#d97706", decline: "#fdba74" }
  };

  function sankeyFlowDirPalette(region) {
    return SANKEY_FLOW_DIR[region] || SANKEY_FLOW_DIR.china;
  }

  function sankeyFlowMobilityColor(region, dir) {
    const pal = sankeyFlowDirPalette(region);
    if (dir === "up") return pal.growth;
    if (dir === "down") return pal.decline;
    return pal.baseline;
  }

  function sankeyFlowNeutralColor(region) {
    return SANKEY_FLOW_DEFAULT[region] || SANKEY_FLOW_DEFAULT.china;
  }

  function sankeyMobilityLegendHtml() {
    const cn = SANKEY_FLOW_DIR.china;
    const ce = SANKEY_FLOW_DIR.cee;
    const stable = cn.baseline;
    return (
      `<span style="color:${cn.growth};">●</span><span style="color:${C.label};">↑蓝</span> ` +
      `<span style="color:${ce.growth};">●</span><span style="color:${C.label};">↑橙</span> ` +
      `<span style="color:${stable};">●</span><span style="color:${C.label};">—</span> ` +
      `<span style="color:${cn.decline};">●</span><span style="color:${C.label};">↓蓝</span> ` +
      `<span style="color:${ce.decline};">●</span><span style="color:${C.label};">↓橙</span>` +
      `<span style="margin-left:10px;color:${C.label};">（选「全部」且无选中/悬停时保持区域默认色）</span>`
    );
  }

  function sankeyDirectionModeForRegion(region) {
    if (S.sankeyMobilityFilter !== "all") return true;
    if (S.sankeySel[region]) return true;
    return !!S.sankeyPreview[region];
  }

  function sankeyDirectionModeActive() {
    if (S.sankeyMobilityFilter !== "all") return true;
    return sankeyDirectionModeForRegion("china") || sankeyDirectionModeForRegion("cee");
  }

  function flowPassesMobilityFilter(dir) {
    return S.sankeyMobilityFilter === "all" || S.sankeyMobilityFilter === dir;
  }

  function syncSankeyMobilityToggleUI() {
    d3.select(".s2-sankey").selectAll(".macro-db-filter-btn[data-filter-key='mobility']").each(function () {
      const btn = d3.select(this);
      styleFilterBtn(btn, btn.attr("data-filter-val") === S.sankeyMobilityFilter);
    });
    const leg = d3.select(".s2-sankey .sankey-mobility-legend");
    if (!leg.empty()) {
      leg.style("opacity", sankeyDirectionModeActive() ? 1 : 0.55);
    }
  }

  function setSankeyMobilityFilter(filter) {
    if (S.sankeyMobilityFilter === filter) return;
    S.sankeyMobilityFilter = filter;
    syncSankeyMobilityToggleUI();
    syncSankeyFocus();
  }

  function appendSankeyMobilityToggle(parent) {
    const bar = parent
      .append("div")
      .attr("class", "sankey-mobility-bar")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("justify-content", "space-between")
      .style("gap", "10px 14px")
      .style("margin-bottom", "12px");

    const toggles = bar
      .append("div")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("gap", "10px 14px");

    appendFilterToggleGroup(toggles, "流向", "mobility", [
      { id: "all", text: "全部" },
      { id: "up", text: "向上" },
      { id: "down", text: "向下" },
      { id: "stable", text: "稳定" }
    ], S.sankeyMobilityFilter, setSankeyMobilityFilter);

    bar
      .append("span")
      .attr("class", "sankey-mobility-legend")
      .style("font-size", "10px")
      .style("color", C.muted)
      .style("font-family", C.font)
      .style("line-height", "1.45")
      .html(sankeyMobilityLegendHtml());

    syncSankeyMobilityToggleUI();
  }

  function sankeyRibbonPath(sx, tx, y1Top, y1Bot, y2Top, y2Bot, cp1, cp2) {
    return (
      `M${sx},${y1Top}C${cp1},${y1Top} ${cp2},${y2Top} ${tx},${y2Top}` +
      `L${tx},${y2Bot}C${cp2},${y2Bot} ${cp1},${y1Bot} ${sx},${y1Bot}Z`
    );
  }

  function assignSankeyFlowBands(flowList, slots) {
    const pad = 0;
    const active = flowList.filter((f) => f.count > 0);
    if (!active.length) return [];

    const outSum = Object.fromEntries(BINS.map((b) => [b.id, 0]));
    const inSum = Object.fromEntries(BINS.map((b) => [b.id, 0]));
    active.forEach((f) => {
      outSum[f.from] += f.count;
      inSum[f.to] += f.count;
    });

    const sorted = active.slice().sort((a, b) => {
      const d = binIdx(a.from) - binIdx(b.from);
      return d || binIdx(a.to) - binIdx(b.to);
    });

    const items = sorted
      .map((f) => {
        const from = slotOf(slots, f.from);
        const to = slotOf(slots, f.to);
        if (!from || !to) return null;
        const outTot = outSum[f.from];
        const inTot = inSum[f.to];
        if (!outTot || !inTot) return null;
        const fromInner = from.h - pad * 2;
        const toInner = to.h - pad * 2;
        return {
          f,
          from,
          to,
          bandOut: (f.count / outTot) * fromInner,
          bandIn: (f.count / inTot) * toInner,
          shareOut: f.count / outTot
        };
      })
      .filter(Boolean);

    BINS.forEach((b) => {
      const fromGrp = items.filter((it) => it.f.from === b.id);
      const from = slotOf(slots, b.id);
      if (fromGrp.length && from) {
        const target = from.h - pad * 2;
        const sum = d3.sum(fromGrp, (g) => g.bandOut);
        fromGrp[fromGrp.length - 1].bandOut += target - sum;
      }
      const toGrp = items.filter((it) => it.f.to === b.id);
      const to = slotOf(slots, b.id);
      if (toGrp.length && to) {
        const target = to.h - pad * 2;
        const sum = d3.sum(toGrp, (g) => g.bandIn);
        toGrp[toGrp.length - 1].bandIn += target - sum;
      }
    });

    const outOff = Object.fromEntries(BINS.map((b) => [b.id, pad]));
    const inOff = Object.fromEntries(BINS.map((b) => [b.id, pad]));

    return items
      .map((it) => {
        const y1Top = it.from.y + outOff[it.f.from];
        const y1Bot = y1Top + it.bandOut;
        outOff[it.f.from] += it.bandOut;

        const y2Top = it.to.y + inOff[it.f.to];
        const y2Bot = y2Top + it.bandIn;
        inOff[it.f.to] += it.bandIn;

        if (it.bandOut < 0.2 || it.bandIn < 0.2) return null;
        return {
          f: it.f,
          y1Top,
          y1Bot,
          y2Top,
          y2Bot,
          shareOut: it.shareOut,
          bandOut: it.bandOut
        };
      })
      .filter(Boolean);
  }

  function layoutBinsEqual(totalH, binGap) {
    const usable = totalH - binGap * (BINS.length - 1);
    const h = usable / BINS.length;
    let y = 0;
    const slots = [];
    BINS.forEach((bin) => {
      slots.push({ id: bin.id, bin, y, h, cy: y + h / 2 });
      y += h + binGap;
    });
    return slots;
  }

  function layoutBinsAligned(countsList, totalH, binGap) {
    const sqrtW = BINS.map((b) =>
      Math.sqrt(Math.max(0, ...countsList.map((c) => c[b.id] || 0)))
    );
    const sum = d3.sum(sqrtW) || 1;
    const usable = totalH - binGap * (BINS.length - 1);
    let y = 0;
    const slots = [];
    BINS.forEach((bin, i) => {
      const h = Math.max(18, (sqrtW[i] / sum) * usable);
      slots.push({ id: bin.id, bin, y, h, cy: y + h / 2 });
      y += h + binGap;
    });
    return slots;
  }

  function mobilityStats(rows) {
    let up = 0;
    let down = 0;
    let stable = 0;
    rows.forEach((d) => {
      const fi = binIdx(d.bin_2015);
      const ti = binIdx(d.bin_2020);
      if (ti < fi) up += 1;
      else if (ti > fi) down += 1;
      else stable += 1;
    });
    return { up, down, stable };
  }

  function isActiveInst(d) {
    return (d.papers_2015 > 0 && d.rank_2015 > 0) || (d.papers_2020 > 0 && d.rank_2020 > 0);
  }

  function activeInstRows(region) {
    return (region === "china" ? data.china : data.cee).filter(isActiveInst);
  }

  function activeInstCount(region) {
    return activeInstRows(region).length;
  }

  function regionMobilityActive(region) {
    return mobilityStats(activeInstRows(region));
  }

  function mobilityPct(count, n) {
    return n ? count / n : 0;
  }

  function slotOf(slots, id) {
    return slots.find((s) => s.id === id);
  }

  function binLabel(id) {
    return (BINS.find((b) => b.id === id) || { label: id }).label;
  }

  function growth(v) {
    if (v > 0.00005) return "up";
    if (v < -0.00005) return "down";
    return "stable";
  }

  function growthCn(g) {
    if (g === "up") return "显著上升";
    if (g === "down") return "显著下降";
    return "基本稳定";
  }

  function growthFill(g) {
    if (g === "up") return C.up;
    if (g === "down") return C.down;
    return C.stable;
  }

  function concLabel(gini) {
    if (gini >= 0.65) return "高度集中结构";
    if (gini >= 0.5) return "中度集中结构";
    if (gini >= 0.35) return "轻度集中结构";
    return "分散型结构";
  }

  function widthOf() {
    const n = $root.node();
    const raw = Math.max(n.getBoundingClientRect().width || n.clientWidth || 720, 320);
    return Math.max(raw - CARD_PAD_X, 320);
  }

  function focusId() {
    return null;
  }

  function mesoFocusId(region) {
    return S.mesoSel[region] || S.mesoHover[region];
  }

  function mesoAnyLocked() {
    return !!(S.mesoSel.china || S.mesoSel.cee);
  }

  function setState(p) {
    Object.assign(S, p);
    bus.call("change");
  }

  // ─── data ──────────────────────────────────────────────────────────────────
  function parseRow(row, region, countryCnMap) {
    const rank2015 = +row["2011_2015_rank"] || 0;
    const rank2020 = +row["2016_2020_rank"] || 0;
    const countryKey = (row.country || "").trim().toUpperCase();
    return {
      id: `${region}::${row.institution}`,
      institution: row.institution,
      institution_cn: row.institution_cn || "",
      country: row.country,
      country_cn: countryCnMap.get(countryKey) || row.country,
      region,
      papers_2015: +row["2011_2015_papers"] || 0,
      papers_2020: +row["2016_2020_papers"] || 0,
      rank_2015: rank2015,
      rank_2020: rank2020,
      // rank_2015 − rank_2020：正 = 排名上升，负 = 排名下降（不用 CSV rank_change 列，其符号相反）
      rank_change: rank2015 - rank2020,
      share_growth: +row.share_growth || 0
    };
  }

  function enrich(rows) {
    const t15 = d3.sum(rows, (d) => d.papers_2015) || 1;
    const t20 = d3.sum(rows, (d) => d.papers_2020) || 1;
    const nAll = rows.length || 1;
    return rows.map((d) => ({
      ...d,
      share_2015: d.papers_2015 / t15,
      share_2020: d.papers_2020 / t20,
      bin_2015: binOfPercentile(d.rank_2015, nAll),
      bin_2020: binOfPercentile(d.rank_2020, nAll),
      g: growth(d.share_growth)
  }));
}

  function pareto(rows, key) {
    const sorted = rows.filter((d) => d[key] > 0).sort((a, b) => d3.descending(a[key], b[key]));
    const total = d3.sum(sorted, (d) => d[key]) || 1;
    let cum = 0;
    const pts = [{ x: 0, y: 0 }];
    const shares = [];
    sorted.forEach((d, i) => {
      cum += d[key];
      shares.push(d[key] / total);
      pts.push({ x: ((i + 1) / sorted.length) * 100, y: cum / total });
    });
    return { pts, shares, sorted };
  }

  function gini(shares) {
    const s = shares.filter((x) => x > 0).sort(d3.ascending);
    const n = s.length;
    if (!n) return 0;
    let sum = 0;
    s.forEach((v, i) => {
      sum += (2 * (i + 1) - n - 1) * v;
    });
    return sum / (n * d3.sum(s));
  }

  function hhi(shares) {
    return d3.sum(shares, (s) => s * s);
  }

  function topNShare(shares, n) {
    return d3.sum(shares.slice().sort(d3.descending).slice(0, n));
  }

  /** 前 pctInst% 机构（按论文量排序）的累计合作份额 */
  function topInstPctShare(paretoResult, pctInst) {
    const shares = paretoResult.shares;
    const n = shares.length;
    if (!n) return 0;
    const k = Math.max(1, Math.ceil(n * (pctInst / 100)));
    return d3.sum(shares.slice(0, k));
  }

  const CONC_TIER_PCTS = [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const CONC_TIERS = CONC_TIER_PCTS.map((pct) => ({
    pct,
    label: `Top ${pct}%`
  }));
  const MACRO_KEY_TIERS = [5, 10, 20];
  const MACRO_TIER_SNAP_R = 26;
  let macroChartCtx = null;
  const MACRO_TIER_TRACK_MIN = 0.5;

  function macroDumbbellPanels() {
    return [
      {
        id: "china",
        name: "中国",
        color: C.china,
        colorLt: C.chinaLt,
        p15: data.pareto.cn15,
        p20: data.pareto.cn20
      },
      {
        id: "cee",
        name: "中东欧",
        color: C.cee,
        colorLt: C.ceeLt,
        p15: data.pareto.ce15,
        p20: data.pareto.ce20
      }
    ].map((panel) => ({
      ...panel,
      rows: CONC_TIERS.map((t) => {
        const v15 = topInstPctShare(panel.p15, t.pct);
        const v20 = topInstPctShare(panel.p20, t.pct);
        return { label: t.label, tierPct: t.pct, v15, v20, delta: v20 - v15 };
      })
    }));
  }

  function top15(rows) {
    return rows
      .filter((d) => d.rank_2020 >= 1 && d.rank_2020 <= TOP_N)
      .slice()
      .sort((a, b) => a.rank_2020 - b.rank_2020);
  }

  function papersDelta(d) {
    return d.papers_2020 - d.papers_2015;
  }

  function papersChangeAbs(d) {
    return Math.abs(papersDelta(d));
  }

  function shareDelta(d) {
    return d.share_2020 - d.share_2015;
  }

  /** 以 2011–2015 合作份额为基准的增速：(后期 − 前期) / 前期 */
  function mesoShareGrowthRate(d) {
    if (d.share_2015 <= 1e-10) {
      if (d.share_2020 <= 1e-10) return 0;
      return null;
    }
    return (d.share_2020 - d.share_2015) / d.share_2015;
  }

  /** 2011–2015 未进 Top15，2016–2020 进入 Top15 */
  function mesoIsNewTop15(d) {
    return d.rank_2020 >= 1 && d.rank_2020 <= TOP_N && (d.rank_2015 < 1 || d.rank_2015 > TOP_N);
  }

  /** 两期均在 Top15（2011–2015 已入榜，2016–2020 仍在 Top15） */
  function mesoIsIncumbentTop15(d) {
    return d.rank_2015 >= 1 && d.rank_2015 <= TOP_N;
  }

  function fmtMesoGrowthRate(rate, d) {
    if (d && mesoIsNewTop15(d) && (d.share_2015 <= 1e-10 || rate === null)) return "新入Top15";
    if (rate === null || !Number.isFinite(rate)) return "—";
    if (Math.abs(rate) < 0.00005) return "0.0%";
    const sign = rate > 0 ? "+" : "";
    return `${sign}${pct(rate)}`;
  }

  function mesoMobilityColor(d) {
    const pal = SANKEY_FLOW_DIR[d.region] || SANKEY_FLOW_DIR.china;
    const mob = mesoShareMobility(d);
    if (mob === "up" || mob === "new") return pal.growth;
    if (mob === "down") return pal.decline;
    return pal.baseline;
  }

  function mesoShareGrowthRateColor(d) {
    return mesoMobilityColor(d);
  }

  function mesoShareMobilityByRate(d) {
    const rate = mesoShareGrowthRate(d);
    if (rate === null || !Number.isFinite(rate)) {
      const delta = shareDelta(d);
      if (delta > 1e-10) return "up";
      if (delta < -1e-10) return "down";
      return "flat";
    }
    if (rate > 1e-5) return "up";
    if (rate < -1e-5) return "down";
    return "flat";
  }

  function mesoShareMobility(d) {
    if (mesoIsNewTop15(d)) return "new";
    return mesoShareMobilityByRate(d);
  }

  function mesoTop15Rows(region) {
    return region === "china" ? data.top15.china : data.top15.cee;
  }

  function mesoRegionTrendSummary(region) {
    const rows = mesoTop15Rows(region);
    let up = 0;
    let down = 0;
    let incumbent = 0;
    let newcomer = 0;
    rows.forEach((d) => {
      if (mesoIsNewTop15(d)) newcomer += 1;
      else if (mesoIsIncumbentTop15(d)) incumbent += 1;
      const mob = mesoShareMobilityByRate(d);
      if (mob === "up") up += 1;
      else if (mob === "down") down += 1;
    });
    return { up, down, incumbent, newcomer, total: rows.length };
  }

  function flows(rows, region) {
    const m = new Map();
    rows.forEach((d) => {
      const k = `${d.bin_2015}|${d.bin_2020}`;
      if (!m.has(k)) {
        m.set(k, { from: d.bin_2015, to: d.bin_2020, region, count: 0 });
      }
      m.get(k).count += 1;
    });
    return [...m.values()];
  }

  const PANEL_GAIN = "#16a34a";
  const PANEL_LOSS = "#dc2626";

  function panelRankLabel(rank) {
    return rank >= 1 ? `#${rank}` : "—";
  }

  // CSV: rank_change = rank_2015 − rank_2020（正 = 排名上升，负 = 排名下降）
  function rankImproved(rc) {
    return rc > 0;
  }

  function rankChangeArrow(rc) {
    if (!rc) return "—";
    return rankImproved(rc) ? `↑ ${Math.abs(rc)}` : `↓ ${Math.abs(rc)}`;
  }

  function rankChangeColor(rc) {
    if (!rc) return C.muted;
    return rankImproved(rc) ? PANEL_GAIN : PANEL_LOSS;
  }

  function instShortName(name) {
    return name.length > 28 ? `${name.slice(0, 27)}…` : name;
  }

  function instShortDisplayName(d) {
    const name = instDisplayName(d);
    return name.length > 16 ? `${name.slice(0, 15)}…` : name;
  }

  function structuralChangeLine(d) {
    const rc = d.rank_change;
    const rcTxt = rc > 0 ? `排名上升 ${rc} 位` : rc < 0 ? `排名下降 ${Math.abs(rc)} 位` : "排名保持不变";
    const sg = d.share_growth;
    if (d.g === "up") {
      return `${d.institution} 在2015年后出现明显上升，合作份额增长 ${pct2(Math.abs(sg))}，${rcTxt}，结构影响力增强。`;
    }
    if (d.g === "down") {
      return `${d.institution} 合作份额下降 ${pct2(Math.abs(sg))}，${rcTxt}，在精英层中的相对权重有所减弱。`;
    }
    return `${d.institution} 两期排名与份额变化不大，在 Top15 中保持结构性稳定。`;
  }

  function isValidCountryCnLabel(text) {
    return /[\u4e00-\u9fff]/.test(text || "");
  }

  function buildCountryCnMap(countryRows) {
    const fallback = {
      "CHINA MAINLAND": "中国大陆",
      ALBANIA: "阿尔巴尼亚",
      "BOSNIA & HERZEGOVINA": "波黑",
      BULGARIA: "保加利亚",
      CROATIA: "克罗地亚",
      "CZECH REPUBLIC": "捷克",
      ESTONIA: "爱沙尼亚",
      GREECE: "希腊",
      HUNGARY: "匈牙利",
      LATVIA: "拉脱维亚",
      MACEDONIA: "北马其顿",
      MONTENEGRO: "黑山",
      POLAND: "波兰",
      ROMANIA: "罗马尼亚",
      SERBIA: "塞尔维亚",
      SLOVAKIA: "斯洛伐克",
      SLOVENIA: "斯洛文尼亚"
    };
    const m = new Map(Object.entries(fallback));
    (countryRows || []).forEach((r) => {
      const key = (r.country || "").trim().toUpperCase();
      const cn = (r.country_cn || "").trim();
      if (key && isValidCountryCnLabel(cn)) m.set(key, cn);
    });
    return m;
  }

  function regionRankTotals(rows) {
    return {
      p15: d3.max(rows, (d) => d.rank_2015) || 0,
      p20: d3.max(rows, (d) => d.rank_2020) || 0
    };
  }

  function buildDataset(rawCn, rawCee, rawCountries) {
    const countryCnMap = buildCountryCnMap(rawCountries);
    const china = enrich(rawCn.map((r) => parseRow(r, "china", countryCnMap)));
    const cee = enrich(rawCee.map((r) => parseRow(r, "cee", countryCnMap)));

    const p = {
      cn15: pareto(china, "papers_2015"),
      cn20: pareto(china, "papers_2020"),
      ce15: pareto(cee, "papers_2015"),
      ce20: pareto(cee, "papers_2020")
    };

    const stats = (key, curve, label) => ({
      key,
      label,
      top10: topNShare(curve.shares, 10),
      top15: topNShare(curve.shares, TOP_N),
      gini: gini(curve.shares),
      hhi: hhi(curve.shares),
      conc: concLabel(gini(curve.shares))
    });

    const macro = {
      cn15: stats("cn15", p.cn15, "China 2011–2015"),
      cn20: stats("cn20", p.cn20, "China 2016–2020"),
      ce15: stats("ce15", p.ce15, "中东欧 2011–2015"),
      ce20: stats("ce20", p.ce20, "中东欧 2016–2020")
    };

    const upward = [...flows(china, "china"), ...flows(cee, "cee")].filter(
      (f) => binIdx(f.to) < binIdx(f.from)
    );
    const upwardTotal = d3.sum(upward, (f) => f.count);

    return {
      china,
      cee,
      top15: {
        china: top15(china),
        cee: top15(cee)
      },
      pareto: p,
      macro,
      sankey: {
        china: flows(china, "china"),
        cee: flows(cee, "cee"),
        bins: {
          china: { y2015: binCounts(china, 2015), y2020: binCounts(china, 2020) },
          cee: { y2015: binCounts(cee, 2015), y2020: binCounts(cee, 2020) }
        },
        mobility: {
          china: mobilityStats(china),
          cee: mobilityStats(cee)
        }
      },
      upwardTotal,
      rankTotal: {
        china: regionRankTotals(china),
        cee: regionRankTotals(cee)
      },
      byId: new Map([...china, ...cee].map((d) => [d.id, d]))
    };
  }

  function mesoMobilityLabel(d) {
    if (mesoIsNewTop15(d)) return "新入 Top15";
    const mob = mesoShareMobility(d);
    if (mob === "up") return "正增速";
    if (mob === "down") return "负增速";
    return "份额持平";
  }

  function mesoShareGrowthRateHtml(d) {
    if (mesoIsNewTop15(d) && d.share_2015 <= 1e-10) {
      return `<span style="color:${PANEL_GAIN};font-weight:600;">新入 Top15</span>`;
    }
    const rate = mesoShareGrowthRate(d);
    if (rate === null || !Number.isFinite(rate)) return "—";
    if (Math.abs(rate) < 0.00005) {
      return `<span style="color:${C.muted};">0.0%</span>`;
    }
    const color = mesoShareGrowthRateColor(d);
    return `<span style="color:${color};font-weight:600;">${fmtMesoGrowthRate(rate, d)}</span>`;
  }

  function mesoTop15InstProse(d) {
    const name = instDisplayName(d);
    const rateTxt = fmtMesoGrowthRate(mesoShareGrowthRate(d), d);
    const rcTxt = bubbleRankChangeText(d);
    const r15 = bubbleRankLabel(d, "p15");
    const r20 = bubbleRankLabel(d, "p20");
    if (mesoIsNewTop15(d)) {
      return `<strong>${name}</strong> 2011–2015 未入 Top15（${r15}），2016–2020 新进入 Top15（${r20}，${rcTxt}）。`;
    }
    const mob = mesoShareMobility(d);
    if (mob === "up") {
      return `作为 Top15 核心机构，<strong>${name}</strong> 相对基准份额增速 ${rateTxt}（${rcTxt}），结构权重上升。`;
    }
    if (mob === "down") {
      return `<strong>${name}</strong> 仍位列 Top15，份额增速 ${rateTxt}（${rcTxt}），相对权重有所减弱。`;
    }
    return `<strong>${name}</strong> 份额增速 ${rateTxt}（${rcTxt}），两期结构权重基本持平。`;
  }

  function buildMesoOverviewSideHtml(region) {
    const st = mesoRegionTrendSummary(region);
    const pal = bubbleRegionStatPalette(region);
    return (
      `<div class="meso-overview-stats">` +
      bubbleSideStatCard("正增速", st.up, "家", pal.growth) +
      bubbleSideStatCard("负增速", st.down, "家", pal.decline) +
      bubbleSideStatCard("新入 Top15", st.newcomer, "家", pal.emerging) +
      bubbleSideStatCard("持续 Top15", st.incumbent, "家", pal.stable) +
      `</div>`
    );
  }

  function setMesoDetailSide(region, d) {
    if (!mesoSec) return;
    const cls = region === "china" ? "meso-panel-china" : "meso-panel-cee";
    const panel = mesoSec.select(`.${cls}`);
    if (panel.empty()) return;
    const overview = panel.select(".meso-side-overview");
    const insight = panel.select(".meso-side-insight");
    if (d) {
      overview.style("display", "none");
      insight.style("display", "").html(buildMesoInstInsightHtml(d));
    } else {
      overview.style("display", "").html(buildMesoOverviewSideHtml(region));
      insight.style("display", "none").html("");
    }
  }

  function resetMesoDetailSide(region) {
    setMesoDetailSide(region, null);
  }

  function clearMesoSelectionSide(region) {
    S.mesoSel[region] = null;
    S.mesoHover[region] = null;
    resetMesoDetailSide(region);
    hideTip();
    bus.call("change");
  }

  function clearMesoSelection() {
    S.mesoSel.china = null;
    S.mesoSel.cee = null;
    S.mesoHover.china = null;
    S.mesoHover.cee = null;
    resetMesoDetailSide("china");
    resetMesoDetailSide("cee");
    hideTip();
    bus.call("change");
  }

  function createMesoDetailPanel(parent, region) {
    const isCn = region === "china";
    const cls = isCn ? "meso-panel-china" : "meso-panel-cee";
    const title = isCn ? "中国 · 结构解读" : "中东欧 · 结构解读";
    const panel = parent
      .append("aside")
      .attr("class", `${cls} bubble-side-card meso-side-card`);
    panel.append("div").attr("class", "meso-panel-head").text(title);
    panel.append("div").attr("class", "meso-side-overview");
    panel.append("div").attr("class", "meso-side-insight").style("display", "none");
    resetMesoDetailSide(region);
  }

  function bindMesoRegionBg(rectSel, region) {
    let clickTimer = null;
    rectSel
      .on("click", (ev) => {
        ev.stopPropagation();
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          clickTimer = null;
          clearMesoSelection();
        }, 260);
      })
      .on("dblclick", (ev) => {
        ev.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        clearMesoSelectionSide(region);
      });
  }

  function restoreMesoPanels() {
    ["china", "cee"].forEach((region) => {
      if (S.mesoSel[region] && data.byId.has(S.mesoSel[region])) {
        setMesoDetailSide(region, data.byId.get(S.mesoSel[region]));
      } else {
        resetMesoDetailSide(region);
      }
    });
  }

  function sankeyFootnoteHtml() {
    return (
      `<p>${sankeyChinaNote()}</p>` +
      `<p>${sankeyCeeNote()}</p>` +
      `<p>${sankeyCompareNote()}</p>`
    );
  }

  function appendSankeyFootnote(parent) {
    const wrap = parent
      .append("div")
      .attr("class", "sankey-footnote")
      .style("margin-top", "18px")
      .style("padding-top", "16px")
      .style("border-top", `1px solid ${C.border}`);
    prose(wrap, sankeyFootnoteHtml(), { maxWidth: "none", marginBottom: "0" });
  }

  function sankeyRegionSummary(region) {
    const { a15, a20 } = regionMacroPair(region);
    const mob = regionMobilityActive(region);
    const n = activeInstCount(region);
    const giniDrop = a15.gini - a20.gini;
    const churn = n ? (mob.up + mob.down) / n : 0;
    return {
      mob,
      n,
      giniDrop,
      g15: a15.gini,
      g20: a20.gini,
      churn,
      stableShare: mobilityPct(mob.stable, n),
      upShare: mobilityPct(mob.up, n),
      downShare: mobilityPct(mob.down, n)
    };
  }

  function sankeyChinaNote() {
    const s = sankeyRegionSummary("china");
    let body = `约 ${pct(s.stableShare)} 的机构维持原合作层级，${sankeyInsightHi("层级惯性较强", "china")}。`;
    if (s.mob.up > s.mob.down * 1.1) {
      body += sankeyInsightHi("向上迁移略多于向下迁移", "china") + "。";
    } else if (s.mob.down > s.mob.up * 1.1) {
      body += sankeyInsightHi("向下迁移略多于向上迁移", "china") + "。";
    } else if (s.mob.up + s.mob.down > 0) {
      body += "向上与向下迁移规模大致相当，结构在稳定中微调。";
    }
    return body;
  }

  function sankeyCeeNote() {
    const s = sankeyRegionSummary("cee");
    const cn = sankeyRegionSummary("china");
    let body =
      `约 ${pct(s.stableShare)} 的机构维持原层级，` +
      `${sankeyInsightHi("层级稳定性高于中国侧", "cee")}（${pct(cn.stableShare)}）。`;
    if (s.mob.up > s.mob.down * 1.1) {
      body += sankeyInsightHi("向上迁移略多于向下迁移", "cee") + "。";
    } else if (s.mob.down > s.mob.up * 1.1) {
      body += sankeyInsightHi("向下迁移略多于向上迁移", "cee") + "。";
    } else if (s.mob.up + s.mob.down > 0) {
      body += "向上与向下迁移规模大致相当，结构在稳定中微调。";
    }
    return body;
  }

  function sankeyCompareNote() {
    const cn = sankeyRegionSummary("china");
    const ce = sankeyRegionSummary("cee");

    if (ce.g20 > cn.g20 + 0.02 && ce.giniDrop > cn.giniDrop + 0.01) {
      return (
        `中东欧在早期更为集中，但 2015 年后集中度下降幅度明显大于中国，两侧差距有所缩小。` +
        `就层级迁移而言，中国侧跨层变动比例（${pct(cn.churn)}）高于中东欧（${pct(ce.churn)}），` +
        `中东欧则表现出更强的层级惯性（${pct(ce.stableShare)} 维持原层级）。`
      );
    }
    if (cn.churn > ce.churn + 0.02) {
      return (
        `中国侧机构跨层迁移比例更高（${pct(cn.churn)} vs ${pct(ce.churn)}），` +
        `层级再配置更为活跃；中东欧则以维持原层级为主（${pct(ce.stableShare)}）。`
      );
    }
    return (
      `两侧均出现一定程度的结构扩散，` +
      `但中国侧层级流动略为活跃，中东欧侧层级惯性更强。`
    );
  }

  function styleMacroPeriodBtn(btn, active) {
    btn
      .style("padding", "3px 10px")
      .style("font-size", "11px")
      .style("line-height", "1.25")
      .style("font-family", C.font)
      .style("font-weight", active ? "600" : "500")
      .style("border", "none")
      .style("background", active ? C.chinaDk : C.bg2)
      .style("color", active ? "#fff" : C.muted)
      .style("cursor", "pointer");
  }

  function styleFilterBtn(btn, active) {
    styleMacroPeriodBtn(btn, active);
  }

  function appendFilterToggleGroup(parent, label, key, options, activeId, onPick) {
    const group = parent
      .append("div")
      .attr("class", "macro-db-filter-group")
      .style("display", "inline-flex")
      .style("align-items", "center")
      .style("gap", "8px")
      .style("flex-wrap", "wrap");

    if (label) {
      group
        .append("span")
        .attr("class", "macro-db-filter-label")
        .style("font-size", "10px")
        .style("color", C.label)
        .style("font-family", C.font)
        .style("font-weight", "600")
        .text(label);
    }

    const toggle = group
      .append("div")
      .attr("class", "macro-db-filter-toggle")
      .style("display", "inline-flex")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "6px")
      .style("overflow", "hidden");

    options.forEach(({ id, text }) => {
      const btn = toggle
        .append("button")
        .attr("type", "button")
        .attr("class", "macro-db-filter-btn")
        .attr("data-filter-key", key)
        .attr("data-filter-val", id)
        .text(text)
        .on("click", (ev) => {
          ev.stopPropagation();
          onPick(id);
        });
      styleFilterBtn(btn, activeId === id);
    });
  }

  function fmtMacroPp(delta) {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${(delta * 100).toFixed(1)} pp`;
  }

  function macroTimeDeltaColor(delta) {
    if (Math.abs(delta) < 1e-8) return C.muted;
    return delta > 0 ? PANEL_GAIN : PANEL_LOSS;
  }

  function macroRegionMeta(region) {
    return region === "china"
      ? { id: "china", name: "中国", color: C.china, colorLt: C.chinaLt, prefix: "cn" }
      : { id: "cee", name: "中东欧", color: C.cee, colorLt: C.ceeLt, prefix: "ce" };
  }

  function macroParetoSeries() {
    if (S.macroMode === "region") {
      const pk = S.macroPeriod === "p15" ? "15" : "20";
      return ["china", "cee"].map((rid) => {
        const meta = macroRegionMeta(rid);
        return {
          id: rid,
          leg: meta.name,
          color: meta.color,
          pareto: data.pareto[`${meta.prefix}${pk}`],
          stat: data.macro[`${meta.prefix}${pk}`]
        };
      });
    }
    const meta = macroRegionMeta(S.macroRegion);
    return [
      {
        id: `${meta.id}-p15`,
        leg: "2011–2015",
        color: C.stable,
        pareto: data.pareto[`${meta.prefix}15`],
        stat: data.macro[`${meta.prefix}15`],
        period: "p15"
      },
      {
        id: `${meta.id}-p20`,
        leg: "2016–2020",
        color: meta.color,
        pareto: data.pareto[`${meta.prefix}20`],
        stat: data.macro[`${meta.prefix}20`],
        period: "p20"
      }
    ];
  }

  function macroTierShare(region, period, tierPct) {
    const meta = macroRegionMeta(region);
    const pk = period === "p15" ? "15" : "20";
    return topInstPctShare(data.pareto[`${meta.prefix}${pk}`], tierPct);
  }

  function macroTierPanelRows() {
    return MACRO_KEY_TIERS.map((tierPct) => {
      const label = `Top ${tierPct}%`;
      if (S.macroMode === "region") {
        const period = S.macroPeriod;
        const vCn = macroTierShare("china", period, tierPct);
        const vCe = macroTierShare("cee", period, tierPct);
        return {
          tierPct,
          label,
          mode: "region",
          vA: vCn,
          vB: vCe,
          delta: vCn - vCe,
          nameA: "中国",
          nameB: "中东欧",
          colorA: C.china,
          colorB: C.cee
        };
      }
      const region = S.macroRegion;
      const meta = macroRegionMeta(region);
      const v15 = macroTierShare(region, "p15", tierPct);
      const v20 = macroTierShare(region, "p20", tierPct);
      return {
        tierPct,
        label,
        mode: "time",
        v15,
        v20,
        delta: v20 - v15,
        region,
        regionName: meta.name,
        color: meta.color
      };
    });
  }

  function macroStatCardsForRegion(region) {
    const meta = macroRegionMeta(region);
    const period = S.macroMode === "region" ? S.macroPeriod : "p20";
    const pk = period === "p15" ? "15" : "20";
    const st = data.macro[`${meta.prefix}${pk}`];
    const st15 = data.macro[`${meta.prefix}15`];
    const showDelta = S.macroMode === "time";
    const idPrefix = S.macroMode === "region" ? `${meta.prefix}-` : "";
    return [
      {
        id: `${idPrefix}top15`,
        title: `${meta.name}·Top15 份额`,
        sub: "头部机构贡献",
        value: st.top15,
        diff: st.top15 - st15.top15,
        fmt: pct,
        fmtDiff: (v) => fmtMacroPp(v),
        showDelta,
        color: meta.color
      },
      {
        id: `${idPrefix}gini`,
        title: `${meta.name}·Gini`,
        sub: "整体不均衡程度",
        value: st.gini,
        diff: st.gini - st15.gini,
        fmt: (v) => v.toFixed(2),
        fmtDiff: (v) => (v >= 0 ? "+" : "") + v.toFixed(2),
        showDelta,
        color: meta.color
      },
      {
        id: `${idPrefix}hhi`,
        title: `${meta.name}·HHI`,
        sub: "集中度补充指标",
        value: st.hhi,
        diff: st.hhi - st15.hhi,
        fmt: (v) => v.toFixed(3),
        fmtDiff: (v) => (v >= 0 ? "+" : "") + v.toFixed(3),
        showDelta,
        color: meta.color
      }
    ];
  }

  function tweenMacroStatNumber(from, to, fmt) {
    const interp = d3.interpolateNumber(from, to);
    return function () {
      return (t) => {
        d3.select(this).text(fmt(interp(t)));
      };
    };
  }

  function macroStatStoredValue(el) {
    const raw = el.attr("data-value");
    if (raw === null || raw === undefined || raw === "") return null;
    const n = +raw;
    return Number.isFinite(n) ? n : null;
  }

  function renderMacroStatCardRow(grid, cards, opts = {}) {
    const { animate = false } = opts;
    const dur = animate ? C.dur : 0;
    const deltaDur = animate ? Math.round(C.dur * 1.75) : 0;

    const card = grid.selectAll(".macro-stat-card").data(cards, (d) => d.id);
    const cardEnter = card.enter().append("div").attr("class", "macro-stat-card").attr("data-id", (d) => d.id);
    const innerEnter = cardEnter.append("div").attr("class", "macro-stat-card-inner");

    innerEnter.append("div").attr("class", "macro-stat-title");
    innerEnter.append("div").attr("class", "macro-stat-sub");
    const valueRow = innerEnter.append("div").attr("class", "macro-stat-value-row");
    valueRow.append("span").attr("class", "macro-stat-value");
    valueRow.append("span").attr("class", "macro-stat-delta");

    const merged = card.merge(cardEnter);

    merged.attr("data-id", (d) => d.id).each(function (d) {
      const wrap = d3.select(this).select(".macro-stat-card-inner");
      wrap.select(".macro-stat-title").text(d.title);
      wrap.select(".macro-stat-sub").text(d.sub);

      const valueEl = wrap.select(".macro-stat-value");
      const deltaEl = wrap.select(".macro-stat-delta");
      const metricId = d.id.replace(/^(cn|ce)-/, "");
      const stored = macroStatStoredValue(valueEl);
      const fromVal = stored !== null ? stored : d.value;

      valueEl.style("color", d.color).interrupt();

      if (animate && stored !== null && Math.abs(fromVal - d.value) > 1e-12) {
        valueEl
          .transition()
          .duration(dur)
          .ease(d3.easeCubicOut)
          .tween("text", tweenMacroStatNumber(fromVal, d.value, d.fmt))
          .on("end", function () {
            d3.select(this).attr("data-value", d.value);
          });
      } else if (animate && stored === null) {
        valueEl
          .attr("data-value", 0)
          .text(d.fmt(0))
          .transition()
          .duration(dur)
          .ease(d3.easeCubicOut)
          .tween("text", tweenMacroStatNumber(0, d.value, d.fmt))
          .on("end", function () {
            d3.select(this).attr("data-value", d.value);
          });
      } else {
        valueEl.text(d.fmt(d.value)).attr("data-value", d.value);
      }

      deltaEl.interrupt();

      if (d.showDelta) {
        deltaEl.style("display", "inline").style("color", macroStatDiffColor(d.diff));

        if (animate) {
          deltaEl
            .style("opacity", 0)
            .text(macroStatDiffText(d, 0))
            .transition()
            .delay(Math.round(dur * 0.35))
            .duration(deltaDur)
            .ease(d3.easeCubicOut)
            .style("opacity", 1)
            .tween("text", tweenMacroStatNumber(0, d.diff, (v) => macroStatDiffText(d, v)));
        } else {
          deltaEl.style("opacity", 1).text(macroStatDiffText(d));
        }
      } else if (animate) {
        deltaEl
          .transition()
          .duration(Math.round(dur * 0.55))
          .ease(d3.easeCubicIn)
          .style("opacity", 0)
          .on("end", function () {
            d3.select(this).style("display", "none");
          });
      } else {
        deltaEl.style("display", "none").style("opacity", 0);
      }
    });

    card.exit().each(function () {
      if (!animate) {
        d3.select(this).remove();
        return;
      }
      d3.select(this)
        .transition()
        .duration(Math.round(C.dur * 0.45))
        .ease(d3.easeCubicIn)
        .style("opacity", 0)
        .on("end", function () {
          d3.select(this).remove();
        });
    });
  }

  function renderMacroStatCards(root, opts = {}) {
    const { animate = false } = opts;
    root.classed("macro-stat-wrap--region", S.macroMode === "region");

    if (S.macroMode === "region") {
      root.selectAll(".macro-statbar").filter(function () {
        return this.parentNode === root.node();
      }).remove();
      const regionBlocks = root.selectAll(".macro-stat-region").data(["china", "cee"], (d) => d);
      regionBlocks.exit().remove();
      const regionEnter = regionBlocks
        .enter()
        .append("div")
        .attr("class", (d) => `macro-stat-region macro-stat-region--${d}`);
      regionEnter.append("div").attr("class", "macro-statbar");
      regionBlocks.merge(regionEnter).each(function (region) {
        renderMacroStatCardRow(
          d3.select(this).select(".macro-statbar"),
          macroStatCardsForRegion(region),
          { animate }
        );
      });
      return;
    }

    root.selectAll(".macro-stat-region").remove();
    let bar = root.selectAll(".macro-statbar").filter(function () {
      return this.parentNode === root.node();
    });
    if (bar.empty()) bar = root.append("div").attr("class", "macro-statbar");
    renderMacroStatCardRow(bar, macroStatCardsForRegion(S.macroRegion), { animate });
  }

  function macroStatDiffText(d, value) {
    const v = value !== undefined ? value : d.diff;
    const metricId = d.id.replace(/^(cn|ce)-/, "");
    if (metricId === "top15") return fmtMacroPp(v);
    return v >= 0 ? `+${d.fmtDiff(v)}` : d.fmtDiff(v);
  }

  function macroStatDiffColor(diff) {
    return macroTimeDeltaColor(diff);
  }

  function macroInsightText(tierPct) {
    const row = macroTierPanelRows().find((r) => r.tierPct === tierPct);
    if (!row) return "悬停主图节点或右侧层级，查看集中度变化解读。";
    if (row.mode === "time") {
      const dir = row.delta > 0.0005 ? "进一步向头部集中" : row.delta < -0.0005 ? "结构有所扩散" : "结构基本持平";
      const deltaTxt = fmtMacroPp(row.delta);
      return (
        `2016–2020 期间，${row.regionName}合作${dir}；` +
        `${row.label} 份额较上一期${row.delta >= 0 ? "提升" : "下降"} ${deltaTxt.replace("+", "")}。`
      );
    }
    const lead = row.delta >= 0 ? "中国" : "中东欧";
    const trail = row.delta >= 0 ? "中东欧" : "中国";
    return (
      `${S.macroPeriod === "p15" ? "2011–2015" : "2016–2020"} 同期比较：` +
      `${lead} 在 ${row.label} 的累计份额高于 ${trail}，` +
      `差距约 ${fmtMacroPp(Math.abs(row.delta)).replace("+", "")}。`
    );
  }

  function macroDefaultInsightText() {
    if (S.macroMode === "time") {
      const meta = macroRegionMeta(S.macroRegion);
      return `当前为时间比较模式：观察 ${meta.name} 在 2011–2015 与 2016–2020 两期的集中度曲线与 Top 5% / 10% / 20% 层级变化。`;
    }
    const periodLabel = S.macroPeriod === "p15" ? "2011–2015" : "2016–2020";
    return `当前为区域比较模式：在 ${periodLabel} 同期对比中国与中东欧的集中度曲线与关键层级差异。`;
  }

  function syncMacroToolbarUI() {
    d3.select(".s1-macro").selectAll(".macro-db-filter-btn").each(function () {
      const btn = d3.select(this);
      const key = btn.attr("data-filter-key");
      const val = btn.attr("data-filter-val");
      let active = false;
      if (key === "mode") active = S.macroMode === val;
      else if (key === "region") active = S.macroRegion === val;
      else if (key === "period") active = S.macroPeriod === val;
      styleFilterBtn(btn, active);
    });
    d3.select(".s1-macro .macro-period-toggle-wrap").style("display", S.macroMode === "region" ? "" : "none");
    d3.select(".s1-macro .macro-region-toggle-wrap").style("display", S.macroMode === "time" ? "" : "none");
  }

  function refreshMacroViews(options = {}) {
    const sec = d3.select(".s1-macro");
    if (sec.empty()) return;
    const stackLayout = S.macroChartW < 900;
    sec.select(".macro-body").classed("macro-body--stack", stackLayout);
    syncMacroToolbarUI();
    const animateStats = options.animateStats ?? S.macroViewsReady;
    S.macroViewsReady = true;
    sec.select(".macro-side .macro-stat-wrap").each(function () {
      renderMacroStatCards(d3.select(this), { animate: animateStats });
    });
    const mainW = stackLayout
      ? S.macroChartW
      : Math.max(320, S.macroChartW - MACRO_SIDE_W - MACRO_BODY_GAP);
    renderMacroPareto(sec.select(".macro-pareto-viz"), mainW);
    const side = sec.select(".macro-side");
    ensureMacroSideStructure(side);
    renderMacroTierPanel(side.select(".macro-tier-panel-host"));
    syncMacroHighlight();
    if (S.macroHoverTier) {
      d3.select(".s1-macro .macro-insight-text").text(macroInsightText(S.macroHoverTier));
      syncMacroParetoFocus(S.macroHoverTier, S.macroHoverSeries);
    }
  }

  function setMacroMode(mode) {
    if (S.macroMode === mode) return;
    S.macroMode = mode;
    S.macroHoverTier = null;
    S.macroHoverSeries = null;
    S.paretoSeries = null;
    hideTip();
    refreshMacroViews();
  }

  function setMacroRegion(region) {
    if (S.macroRegion === region) return;
    S.macroRegion = region;
    S.macroHoverTier = null;
    S.macroHoverSeries = null;
    S.paretoSeries = null;
    hideTip();
    refreshMacroViews();
  }

  function setMacroPeriod(period) {
    if (S.macroPeriod === period) return;
    S.macroPeriod = period;
    S.macroHoverTier = null;
    S.macroHoverSeries = null;
    hideTip();
    refreshMacroViews();
  }

  function setMacroHoverTier(tierPct, seriesId = null) {
    if (!tierPct) {
      clearMacroTierFocus();
      return;
    }
    focusMacroTier(null, tierPct, seriesId);
  }

  function clearMacroTierFocus(hideTipToo = true) {
    S.macroHoverTier = null;
    S.macroHoverSeries = null;
    syncMacroHighlight();
    syncMacroParetoFocus(null);
    const insight = d3.select(".s1-macro .macro-insight-text");
    if (!insight.empty()) insight.text(macroDefaultInsightText());
    if (hideTipToo) hideTip();
  }

  function focusMacroTier(ev, tierPct, seriesId = null) {
    S.macroHoverTier = tierPct;
    S.macroHoverSeries = seriesId || null;
    syncMacroHighlight();
    syncMacroParetoFocus(tierPct, seriesId);
    const insight = d3.select(".s1-macro .macro-insight-text");
    if (!insight.empty()) insight.text(macroInsightText(tierPct));
    if (ev) macroTierTip(ev, tierPct, seriesId);
  }

  function nearestMacroTierTarget(mx, my) {
    if (!macroChartCtx) return null;
    const { x, y, series, iw, ih } = macroChartCtx;
    if (mx < 0 || my < 0 || mx > iw || my > ih) return null;
    let best = null;
    let bestDist = Infinity;
    MACRO_KEY_TIERS.forEach((tierPct) => {
      series.forEach((s) => {
        const share = topInstPctShare(s.pareto, tierPct);
        const cx = x(share);
        const cy = y(tierPct);
        const dist = Math.hypot(cx - mx, cy - my);
        if (dist < bestDist) {
          bestDist = dist;
          best = { tierPct, seriesId: s.id, dist };
        }
      });
    });
    if (!best || best.dist > MACRO_TIER_SNAP_R) return null;
    return best;
  }

  function syncMacroParetoFocus(tierPct, seriesId) {
    if (!macroChartCtx?.focusG) return;
    const { focusG, focusLine, x, y, series, iw } = macroChartCtx;
    focusG.selectAll("circle.macro-pareto-curve-dot").remove();
    if (!tierPct) {
      focusG.style("display", "none");
      return;
    }
    const accent = seriesId ? series.find((s) => s.id === seriesId)?.color : C.border;
    focusG.style("display", null);
    focusLine
      .attr("x1", 0)
      .attr("x2", iw)
      .attr("y1", y(tierPct))
      .attr("y2", y(tierPct))
      .attr("stroke", accent || C.border)
      .attr("stroke-opacity", seriesId ? 0.9 : 0.55);

    focusG
      .selectAll("circle.macro-pareto-focus-dot")
      .data(series, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "macro-pareto-focus-dot")
            .attr("fill", "#fff")
            .style("pointer-events", "none"),
        (update) => update,
        (exit) => exit.remove()
      )
      .each(function (s) {
        const share = topInstPctShare(s.pareto, tierPct);
        const active = !seriesId || s.id === seriesId;
        d3.select(this)
          .attr("cx", x(share))
          .attr("cy", y(tierPct))
          .attr("r", active ? (seriesId ? 6.5 : 5.5) : 4.5)
          .attr("stroke", s.color)
          .attr("stroke-width", active ? 2.5 : 1.5)
          .attr("opacity", active ? 1 : 0.45);
      });
  }

  function showMacroCurvePoint(ev, s, pt) {
    if (!macroChartCtx?.focusG) return;
    const { focusG, focusLine, x, y, iw } = macroChartCtx;
    focusG.selectAll("circle.macro-pareto-focus-dot").remove();
    focusG.style("display", null);
    focusLine
      .attr("x1", 0)
      .attr("x2", iw)
      .attr("y1", y(pt.x))
      .attr("y2", y(pt.x))
      .attr("stroke", s.color)
      .attr("stroke-opacity", 0.85);
    focusG
      .selectAll("circle.macro-pareto-curve-dot")
      .data([0])
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "macro-pareto-curve-dot")
            .attr("fill", "#fff")
            .style("pointer-events", "none"),
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("cx", x(pt.y))
      .attr("cy", y(pt.x))
      .attr("r", 5)
      .attr("stroke", s.color)
      .attr("stroke-width", 2);
    showTip(
      ev,
      tipTitleHtml(`${s.leg} · 前 ${d3.format(".0f")(pt.x)}% 机构`, s.color) +
        tipRowHtml("累计合作份额", pct(pt.y), `font-weight:600;color:${TIP.hi};`)
    );
  }

  function appendMacroToolbar(parent) {
    const bar = parent.append("div").attr("class", "macro-toolbar");
    const left = bar.append("div").attr("class", "macro-toolbar-left");
    appendFilterToggleGroup(
      left,
      null,
      "mode",
      [
        { id: "region", text: "区域比较" },
        { id: "time", text: "时间比较" }
      ],
      S.macroMode,
      setMacroMode
    );

    const right = bar.append("div").attr("class", "macro-toolbar-right");
    const periodWrap = right.append("div").attr("class", "macro-period-toggle-wrap");
    appendFilterToggleGroup(
      periodWrap,
      "时期",
      "period",
      [
        { id: "p15", text: "2011–2015" },
        { id: "p20", text: "2016–2020" }
      ],
      S.macroPeriod,
      setMacroPeriod
    );

    const regionWrap = right.append("div").attr("class", "macro-region-toggle-wrap");
    appendFilterToggleGroup(
      regionWrap,
      "区域",
      "region",
      [
        { id: "china", text: "中国" },
        { id: "cee", text: "中东欧" }
      ],
      S.macroRegion,
      setMacroRegion
    );

    syncMacroToolbarUI();
  }

  function statsBar(parent) {
    parent.append("div").attr("class", "macro-stat-wrap");
  }

  function ensureMacroSideStructure(side) {
    if (side.select(".macro-tier-panel-host").empty()) {
      side.append("div").attr("class", "macro-tier-panel-host");
    }
    if (side.select(".macro-stat-wrap").empty()) {
      statsBar(side);
    }
  }

  function macroTierTip(ev, tierPct, seriesId) {
    const row = macroTierPanelRows().find((r) => r.tierPct === tierPct);
    if (!row) return;
    if (row.mode === "time") {
      const accent = macroRegionMeta(row.region).color;
      showTip(
        ev,
        tipTitleHtml(`${row.regionName} · ${row.label}`, accent) +
          tipRowHtml("2011–2015", pct(row.v15)) +
          tipRowHtml("2016–2020", pct(row.v20), "font-weight:600;") +
          tipRowHtml(
            "变化",
            fmtMacroPp(row.delta),
            `color:${macroTimeDeltaColor(row.delta)};font-weight:600;`
          )
      );
      return;
    }
    const periodLabel = S.macroPeriod === "p15" ? "2011–2015" : "2016–2020";
    showTip(
      ev,
      tipTitleHtml(`${periodLabel} · ${row.label}`, C.china) +
        tipRowHtml("中国", pct(row.vA), `color:${C.china};font-weight:600;`) +
        tipRowHtml("中东欧", pct(row.vB), `color:${C.cee};font-weight:600;`) +
        tipRowHtml(
          "差距（中国−中东欧）",
          fmtMacroPp(row.delta),
          `color:${row.delta >= 0 ? TIP.warn : TIP.hi};font-weight:600;`
        )
    );
    if (seriesId) void seriesId;
  }

  function syncMacroHighlight() {
    const tier = S.macroHoverTier;
    const seriesId = S.macroHoverSeries;
    d3.select(".s1-macro .macro-tier-row").classed("macro-tier-row--hi", function () {
      return +this.getAttribute("data-tier") === tier;
    });
    d3.select(".s1-macro .macro-stat-card").classed("macro-stat-card--hi", function () {
      if (!tier) return false;
      const id = this.getAttribute("data-id") || "";
      if (S.macroMode === "region") {
        if (seriesId) {
          const prefix = seriesId === "china" ? "cn-" : "ce-";
          return id.startsWith(prefix);
        }
        return id.startsWith("cn-") || id.startsWith("ce-");
      }
      return true;
    });
    d3.select(".s1-macro .macro-tier-node").each(function () {
      const el = d3.select(this);
      const nodeTier = +el.attr("data-tier");
      const nodeSeries = el.attr("data-series");
      const tierMatch = tier && nodeTier === tier;
      const seriesMatch = !seriesId || nodeSeries === seriesId;
      const active = tierMatch && seriesMatch;
      const peer = tierMatch && !seriesMatch;
      el
        .attr("r", active ? 7 : peer ? 5.5 : 4.5)
        .attr("stroke-width", active ? 2.5 : 1.5)
        .attr("opacity", tierMatch ? 1 : 0.28);
    });
    d3.select(".s1-macro .macro-curve").attr("opacity", function () {
      if (seriesId) {
        return d3.select(this).attr("data-series") === seriesId ? 1 : 0.18;
      }
      if (!S.paretoSeries) return 1;
      return d3.select(this).attr("data-series") === S.paretoSeries ? 1 : 0.15;
    });
  }

  function renderMacroTierPanel(parent) {
    parent.selectAll("*").remove();
    const card = parent.append("div").attr("class", "macro-side-card");
    card.append("div").attr("class", "macro-side-label").text("关键层级变化");
    card
      .append("div")
      .attr("class", "macro-side-sub")
      .text("右侧摘要跟随主图节点联动");

    const legend = card.append("div").attr("class", "macro-tier-legend");
    if (S.macroMode === "time") {
      legend.html(
        `<span><span class="macro-leg-dot" style="background:${C.stable};"></span>2011–2015</span>` +
          `<span><span class="macro-leg-dot" style="background:${macroRegionMeta(S.macroRegion).color};"></span>2016–2020</span>`
      );
    } else {
      legend.html(
        `<span><span class="macro-leg-dot" style="background:${C.china};"></span>中国</span>` +
          `<span><span class="macro-leg-dot" style="background:${C.cee};"></span>中东欧</span>`
      );
    }

    const rowsWrap = card.append("div").attr("class", "macro-tier-rows");
    const rows = macroTierPanelRows();
    const shareMin = MACRO_TIER_TRACK_MIN;
    const shareMax = 1;

    function shareLeft(v) {
      const pct = ((v - shareMin) / (shareMax - shareMin)) * 100;
      return Math.max(0, Math.min(100, pct));
    }

    rows.forEach((row) => {
      const rowEl = rowsWrap
        .append("div")
        .attr("class", "macro-tier-row")
        .attr("data-tier", row.tierPct)
        .on("mouseenter", (ev) => {
          focusMacroTier(ev, row.tierPct, null);
        })
        .on("mousemove", (ev) => moveTip(ev))
        .on("mouseleave", () => {
          clearMacroTierFocus();
        });

      rowEl.append("div").attr("class", "macro-tier-label").text(row.label);

      const trackCell = rowEl.append("div").attr("class", "macro-tier-track-cell");
      const track = trackCell.append("div").attr("class", "macro-tier-track");
      const deltaEl = trackCell.append("div").attr("class", "macro-tier-delta");

      if (row.mode === "time") {
        const l15 = shareLeft(row.v15);
        const l20 = shareLeft(row.v20);
        track
          .append("div")
          .attr("class", "macro-tier-link")
          .style("left", `${Math.min(l15, l20)}%`)
          .style("width", `${Math.abs(l20 - l15)}%`);
        track.append("span").attr("class", "macro-tier-dot macro-tier-dot--base").style("left", `${l15}%`);
        track
          .append("span")
          .attr("class", "macro-tier-dot macro-tier-dot--curr")
          .style("left", `${l20}%`)
          .style("background", row.color);
        deltaEl.style("color", macroTimeDeltaColor(row.delta)).text(fmtMacroPp(row.delta));
      } else {
        const lA = shareLeft(row.vA);
        const lB = shareLeft(row.vB);
        track
          .append("div")
          .attr("class", "macro-tier-link")
          .style("left", `${Math.min(lA, lB)}%`)
          .style("width", `${Math.abs(lB - lA)}%`);
        track
          .append("span")
          .attr("class", "macro-tier-dot macro-tier-dot--base")
          .style("left", `${lA}%`)
          .style("background", row.colorA);
        track
          .append("span")
          .attr("class", "macro-tier-dot macro-tier-dot--curr")
          .style("left", `${lB}%`)
          .style("background", row.colorB);
        deltaEl.style("color", row.delta >= 0 ? C.china : C.cee).text(fmtMacroPp(row.delta));
      }
    });

    const scaleRow = rowsWrap.append("div").attr("class", "macro-tier-scale-row");
    scaleRow.append("div");
    const scaleAxis = scaleRow.append("div").attr("class", "macro-tier-scale-axis");
    scaleAxis.append("span").text("50%");
    scaleAxis.append("span").text("100%");

    card
      .append("div")
      .attr("class", "macro-insight-text")
      .text(macroDefaultInsightText());
  }

  function renderMacroPareto(parent, chartW) {
    parent.selectAll("*").remove();
    if (parent.empty()) return;

    const series = macroParetoSeries();
    const m = { t: 16, r: 16, b: 52, l: 48 };
    const iw = chartW - m.l - m.r;
    const ih = 480;
    const h = m.t + ih + m.b;
    const yTickStep = 10;
    const yTicks = d3.range(0, 101, yTickStep);
    const x = d3.scaleLinear().domain([0, 1]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 100]).range([ih, 0]);
    const svg = whiteSvg(parent, chartW, h, `0 0 ${chartW} ${h}`);
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    g.selectAll(".macro-grid-x")
      .data(d3.range(0, 1.001, 0.1))
      .join("line")
      .attr("class", "macro-grid-x")
      .attr("x1", (d) => x(d))
      .attr("x2", (d) => x(d))
      .attr("y1", 0)
      .attr("y2", ih)
      .attr("stroke", C.border)
      .attr("stroke-opacity", 0.45);

    g.selectAll(".macro-grid-y")
      .data(yTicks)
      .join("line")
      .attr("class", "macro-grid-y")
      .attr("x1", 0)
      .attr("x2", iw)
      .attr("y1", (d) => y(d))
      .attr("y2", (d) => y(d))
      .attr("stroke", C.border)
      .attr("stroke-opacity", 0.35);

    g.append("line")
      .attr("class", "macro-lorenz-eq")
      .attr("x1", x(0))
      .attr("y1", y(0))
      .attr("x2", x(1))
      .attr("y2", y(100))
      .attr("stroke", C.border)
      .attr("stroke-dasharray", "5 4")
      .attr("stroke-opacity", 0.55)
      .style("pointer-events", "none");

    const line = d3
      .line()
      .x((d) => x(d.y))
      .y((d) => y(d.x))
      .curve(d3.curveMonotoneX);

    series.forEach((s) => {
      g.append("path")
        .attr("class", "macro-curve")
        .attr("data-series", s.id)
        .attr("d", line(s.pareto.pts))
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 2.5)
        .attr("stroke-linejoin", "round")
        .style("pointer-events", "none");
    });

    const focusG = g.append("g").attr("class", "macro-pareto-focus").style("display", "none");
    const focusLine = focusG
      .append("line")
      .attr("stroke", C.border)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3")
      .attr("x1", 0)
      .attr("x2", iw);

    g.append("rect")
      .attr("class", "macro-pareto-hit")
      .attr("width", iw)
      .attr("height", ih)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", function (ev) {
        const [mx, my] = d3.pointer(ev, this);
        const snap = nearestMacroTierTarget(mx, my);
        if (snap) {
          focusMacroTier(ev, snap.tierPct, snap.seriesId);
          return;
        }
        if (S.macroHoverTier) clearMacroTierFocus(false);
        const shareVal = Math.max(0, Math.min(1, x.invert(mx)));
        let bestS = series[0];
        let bestPt = nearestParetoPoint(bestS.pareto.pts, shareVal, "y");
        if (series.length > 1) {
          let bestDist = Infinity;
          series.forEach((s) => {
            const pt = nearestParetoPoint(s.pareto.pts, shareVal, "y");
            const cx = x(pt.y);
            const dist = Math.abs(cx - mx);
            if (dist < bestDist) {
              bestDist = dist;
              bestS = s;
              bestPt = pt;
            }
          });
        }
        showMacroCurvePoint(ev, bestS, bestPt);
      })
      .on("mouseleave", () => {
        clearMacroTierFocus();
      });

    MACRO_KEY_TIERS.forEach((tierPct) => {
      series.forEach((s) => {
        const share = topInstPctShare(s.pareto, tierPct);
        g.append("circle")
          .attr("class", "macro-tier-node")
          .attr("data-series", s.id)
          .attr("data-tier", tierPct)
          .attr("cx", x(share))
          .attr("cy", y(tierPct))
          .attr("r", 4.5)
          .attr("fill", s.color)
          .attr("stroke", "#fff")
          .attr("stroke-width", 1.5)
          .style("cursor", "pointer")
          .on("mouseenter", (ev) => {
            ev.stopPropagation();
            focusMacroTier(ev, tierPct, s.id);
          })
          .on("mousemove", (ev) => moveTip(ev))
          .on("mouseleave", (ev) => {
            ev.stopPropagation();
            clearMacroTierFocus();
          });
      });
    });

    focusG.style("pointer-events", "none");
    focusG.raise();
    g.selectAll(".macro-tier-node").raise();

    macroChartCtx = { x, y, iw, ih, series, focusG, focusLine };
    if (S.macroHoverTier) syncMacroParetoFocus(S.macroHoverTier, S.macroHoverSeries);

    const xAxis = d3.axisBottom(x).tickValues(d3.range(0, 1.001, 0.1)).tickFormat(d3.format(".0%"));
    g.append("g")
      .attr("transform", `translate(0,${ih})`)
      .call(xAxis)
      .call((sel) =>
        sel
          .selectAll("text")
          .attr("fill", C.muted)
          .style("font-size", "9px")
          .style("font-family", C.font)
      )
      .call((sel) => sel.select(".domain").attr("stroke", C.border));

    const yAxis = d3.axisLeft(y).tickValues(yTicks).tickFormat((d) => `${d}%`);
    g.append("g")
      .call(yAxis)
      .call((sel) => sel.selectAll("text").attr("fill", C.muted).style("font-size", "9px").style("font-family", C.font))
      .call((sel) => sel.select(".domain").attr("stroke", C.border));

    svg
      .append("text")
      .attr("x", m.l + iw / 2)
      .attr("y", h - 6)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "11px")
      .style("font-family", C.font)
      .text("累计合作份额");

    svg
      .append("text")
      .attr("transform", `translate(12, ${m.t + ih / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "11px")
      .style("font-family", C.font)
      .text("机构占比");

    const leg = parent.append("div").attr("class", "macro-pareto-legend");
    let legHtml = "";
    if (S.macroMode === "region") {
      legHtml =
        `<span><span class="macro-leg-dot" style="background:${C.china};"></span>中国</span>` +
        `<span><span class="macro-leg-dot" style="background:${C.cee};"></span>中东欧</span>` +
        `<span class="macro-leg-note">${S.macroPeriod === "p15" ? "2011–2015" : "2016–2020"} 同期比较</span>`;
    } else {
      const meta = macroRegionMeta(S.macroRegion);
      legHtml =
        `<span><span class="macro-leg-dot" style="background:${C.stable};"></span>2011–2015</span>` +
        `<span><span class="macro-leg-dot" style="background:${meta.color};"></span>2016–2020</span>` +
        `<span class="macro-leg-note">${meta.name} · 两期对比</span>`;
    }
    legHtml += `<span class="macro-leg-note">虚线 = 完全均衡（无集中）</span>`;
    leg.html(legHtml);
  }

  // ─── tooltip & panel ─────────────────────────────────────────────────────────
  function tipEl() {
    if ($tip) return $tip;
    $tip = d3
      .select("body")
      .append("div")
      .attr("class", "il-tip")
      .style("position", "fixed")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .style("z-index", 10001)
      .style("background", "rgba(15,23,42,.96)")
      .style("color", "#f8fafc")
      .style("padding", "12px 15px")
      .style("border-radius", "10px")
      .style("border", "1px solid rgba(255,255,255,.08)")
      .style("font-family", C.font)
      .style("font-size", "12px")
      .style("line-height", "1.7")
      .style("max-width", "240px")
      .style("box-shadow", "0 8px 28px rgba(0,0,0,.32)");
    return $tip;
  }

  function moveTip(ev, placement) {
    if (!$tip) return;
    const el = $tip.node();
    const pad = 14;
    const tw = el.offsetWidth || 280;
    const th = el.offsetHeight || 80;
    let x;
    let y;
    if (placement === "below") {
      x = ev.clientX - tw / 2;
      y = ev.clientY + 20;
    } else if (placement === "above") {
      x = ev.clientX - tw / 2;
      y = ev.clientY - th - 16;
    } else {
      x = ev.clientX + pad;
      y = ev.clientY + pad;
      if (x + tw > innerWidth - 8) x = ev.clientX - tw - pad;
      if (y + th > innerHeight - 8) y = ev.clientY - th - pad;
    }
    if (x + tw > innerWidth - 8) x = innerWidth - tw - 8;
    if (x < 8) x = 8;
    if (y + th > innerHeight - 8) y = ev.clientY - th - 20;
    y = Math.max(8, Math.min(y, innerHeight - th - 8));
    $tip.style("left", `${x}px`).style("top", `${y}px`);
  }

  function mesoRowNode(ev) {
    let node = ev.currentTarget || ev.target;
    while (node && node !== document.body) {
      if (node.classList && node.classList.contains("inst-entity")) return node;
      node = node.parentNode;
    }
    return null;
  }

  function tipRectsOverlap(a, b, gap) {
    return !(
      a.right + gap < b.left ||
      a.left - gap > b.right ||
      a.bottom + gap < b.top ||
      a.top - gap > b.bottom
    );
  }

  function moveMesoTip(ev) {
    if (!$tip) return;
    const el = $tip.node();
    const pad = 16;
    const tw = el.offsetWidth || 280;
    const th = el.offsetHeight || 80;
    const row = mesoRowNode(ev);
    const anchor = row ? row.getBoundingClientRect() : null;

    let x;
    let y;
    if (anchor) {
      x = anchor.left + anchor.width / 2 - tw / 2;
      y = anchor.top - th - pad;

      if (y < 8) y = anchor.bottom + pad;

      if (x + tw > innerWidth - 8) x = innerWidth - tw - 8;
      if (x < 8) x = 8;

      const tipBox = () => ({ left: x, top: y, right: x + tw, bottom: y + th });
      if (tipRectsOverlap(tipBox(), anchor, 4)) {
        if (anchor.right + pad + tw <= innerWidth - 8) {
          x = anchor.right + pad;
          y = anchor.top + anchor.height / 2 - th / 2;
        } else if (anchor.left - pad - tw >= 8) {
          x = anchor.left - tw - pad;
          y = anchor.top + anchor.height / 2 - th / 2;
        } else {
          y = anchor.top - th - pad;
        }
      }
    } else {
      x = ev.clientX - tw / 2;
      y = ev.clientY - th - pad;
    }

    if (x + tw > innerWidth - 8) x = innerWidth - tw - 8;
    if (x < 8) x = 8;
    y = Math.max(8, Math.min(y, innerHeight - th - 8));
    $tip.style("left", `${x}px`).style("top", `${y}px`);
  }

  function showTip(ev, html, placement) {
    tipEl().html(html).transition().duration(150).style("opacity", 1);
    if (placement === "meso") moveMesoTip(ev);
    else moveTip(ev, placement);
  }

  function hideTip() {
    if ($tip) $tip.transition().duration(120).style("opacity", 0);
  }

  function nearestParetoPoint(pts, val, key = "x") {
    if (!pts.length) return pts[0];
    let best = pts[0];
    let min = Infinity;
    pts.forEach((p) => {
      const d = Math.abs(p[key] - val);
      if (d < min) {
        min = d;
        best = p;
      }
    });
    return best;
  }

  function tipCurvePoint(ev, s, pt) {
    const st = s.stat;
    showTip(
      ev,
      tipTitleHtml(s.leg, s.color) +
        tipRowHtml("机构排名（百分位）", `${d3.format(".1f")(pt.x)}%`, "font-weight:600;") +
        tipRowHtml("累计论文份额", pct(pt.y), `font-weight:600;color:${TIP.hi};`) +
        tipRowHtml("Gini", st.gini.toFixed(2)) +
        tipRowHtml("HHI", st.hhi.toFixed(2)) +
        `<div style="margin-top:6px;font-size:11px;color:${TIP.dim};line-height:1.5;">结构解释：${st.conc}</div>`
    );
  }

  function binPeriodTotal(counts) {
    return d3.sum(BINS, (b) => counts[b.id] || 0);
  }

  function regionInstTotal(region) {
    return (region === "china" ? data.china : data.cee).length;
  }

  function binRegionShare(region, period, binId) {
    const bins = data.sankey.bins[region];
    const counts = period === 2015 ? bins.y2015 : bins.y2020;
    const n = regionInstTotal(region);
    const count = counts[binId] || 0;
    return { count, n, share: n ? count / n : 0 };
  }

  function sankeyPanelTitle(region, mode, meta) {
    const name = region === "china" ? "中国" : "中东欧";
    if (mode === "overview") return `${name} · 总体结构概览`;
    if (mode === "flow") return `${name} · 结构迁移`;
    if (meta?.binTag) return `${name} · ${meta.binTag}（${meta.binLabel}）`;
    return `${name} · 结构解读`;
  }

  function compactMetric(label, count, share, last) {
    const border = last ? "" : `border-bottom:1px solid ${C.border};`;
    return (
      `<div style="padding:6px 0;${border}${sankeySideTextStyle()}">` +
      `${label}：${num(count)}（${pct(share)}）` +
      `</div>`
    );
  }

  function compactMetrics(items) {
    const rows = items.filter((d) => d.count > 0);
    return rows.map((d, i) => compactMetric(d.label, d.count, d.share, i === rows.length - 1)).join("");
  }

  function compactNote(text) {
    return `<p style="margin:12px 0 0;${panelTextStyle()}">${text}</p>`;
  }

  function sankeyCompactNote(text) {
    return `<p style="margin:12px 0 0;${sankeySideTextStyle()}">${text}</p>`;
  }

  function pctReadable(share) {
    if (share >= 0.995) return "几乎全部";
    if (share >= 0.75) return `超过${Math.floor(share * 100)}%`;
    if (share >= 0.45 && share <= 0.55) return "约一半";
    const p = Math.round(share * 100);
    return p > 0 ? `${p}%` : "极少数";
  }

  function overviewOneLiner(region) {
    const s = sankeyRegionSummary(region);
    const name = region === "china" ? "中国" : "中东欧";

    if (s.stableShare >= 0.88 && s.churn < 0.12) {
      return (
        `约 ${pctReadable(s.stableShare)} 的机构仍维持原合作层级，` +
        `${sankeyInsightHi(`${name}合作网络以层级稳定为主`, region)}，跨层迁移相对有限。`
      );
    }
    if (s.churn >= 0.12) {
      return (
        `约 ${pct(s.churn)} 的机构发生跨层迁移，` +
        `${sankeyInsightHi(`${name}合作网络出现较明显的层级再配置`, region)}。`
      );
    }
    if (s.mob.up >= s.mob.down) {
      return `${sankeyInsightHi("2015 年后向上迁移略多于或接近向下迁移", region)}，核心层级边界未明显松动。`;
    }
    if (s.mob.up > s.mob.down * 1.15) {
      return `${sankeyInsightHi("向上流动略多于向下流动", region)}，部分机构正在进入更高合作层级。`;
    }
    return (
      `2015 年前后层级变化相对温和，约 ${pctReadable(s.stableShare)} 的机构维持原层级，` +
      `${sankeyInsightHi(`${name}合作网络以结构稳定为主`, region)}。`
    );
  }

  function buildOverviewAnnot(region) {
    const mob = regionMobilityActive(region);
    const nActive = activeInstCount(region);
    const foot = region === "china" ? sankeyChinaNote() : sankeyCeeNote();

    return (
      compactMetrics([
        { label: "向上流动", count: mob.up, share: mobilityPct(mob.up, nActive) },
        { label: "层级稳定", count: mob.stable, share: mobilityPct(mob.stable, nActive) },
        { label: "向下流动", count: mob.down, share: mobilityPct(mob.down, nActive) }
      ]) +
      sankeyCompactNote(overviewOneLiner(region)) +
      `<p style="margin:12px 0 0;padding-top:10px;border-top:1px solid ${C.border};${sankeySideTextStyle()}">${foot}</p>`
    );
  }

  function fmtPctNum(share) {
    return (share * 100).toFixed(1);
  }

  function sankeySideStatCard(title, value, unit, color) {
    return (
      `<div class="sankey-side-stat">` +
      `<div class="sankey-side-stat-label">${title}</div>` +
      `<div class="sankey-side-stat-value" style="color:${color};">${value}` +
      (unit ? `<span class="sankey-side-stat-unit">${unit}</span>` : "") +
      `</div></div>`
    );
  }

  function sankeyCompareStatItems() {
    const cn = sankeyRegionSummary("china");
    const ce = sankeyRegionSummary("cee");
    return [
      { t: "中国 · 跨层变动", v: fmtPctNum(cn.churn), u: "%", c: C.chinaDk },
      { t: "中东欧 · 跨层变动", v: fmtPctNum(ce.churn), u: "%", c: C.cee },
      { t: "中国 · 维持原层级", v: fmtPctNum(cn.stableShare), u: "%", c: C.chinaDk },
      { t: "中东欧 · 维持原层级", v: fmtPctNum(ce.stableShare), u: "%", c: C.cee },
      { t: "中国 · 向上迁移", v: fmtPctNum(cn.upShare), u: "%", c: C.chinaDk },
      { t: "中东欧 · 向上迁移", v: fmtPctNum(ce.upShare), u: "%", c: C.cee }
    ];
  }

  function buildSankeyCompareSideHtml() {
    const cards = sankeyCompareStatItems()
      .map((c) => sankeySideStatCard(c.t, c.v, c.u, c.c))
      .join("");
    return (
      `<div style="font-size:10.5px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;">双侧对照</div>` +
      `<div class="sankey-compare-stats">${cards}</div>`
    );
  }

  function syncSankeyRegionToggleUI() {
    const region = S.sankeyLastRegion || S.sankeyActiveRegion;
    d3.select(".s2-sankey").selectAll(".sankey-region-btn").each(function () {
      const btn = d3.select(this);
      styleFilterBtn(btn, btn.attr("data-region") === region);
    });
  }

  function setSankeyActiveRegion(region) {
    S.sankeyActiveRegion = region;
    S.sankeyLastRegion = region;
    syncSankeyRegionToggleUI();
    focusSankeyPanel(region);
  }

  function focusSankeyPanel(region) {
    if (S.sankeySel[region]) {
      reapplySankeySelection(region);
      return;
    }
    if (S.sankeyPreview[region]) {
      updateSankeyPanelForPreview(S.sankeyPreview[region]);
      return;
    }
    setSankeyAnnot(buildOverviewAnnot(region), region, { mode: "overview" });
  }

  function appendSankeyRegionToggle(parent) {
    const toggle = parent
      .append("div")
      .attr("class", "sankey-region-toggle")
      .style("display", "inline-flex")
      .style("border", "1px solid #e2e8f0")
      .style("border-radius", "6px")
      .style("overflow", "hidden")
      .style("flex-shrink", "0");

    [
      { id: "china", label: "中国" },
      { id: "cee", label: "中东欧" }
    ].forEach(({ id, label }) => {
      const btn = toggle
        .append("button")
        .attr("type", "button")
        .attr("class", "sankey-region-btn")
        .attr("data-region", id)
        .text(label)
        .on("click", (ev) => {
          ev.stopPropagation();
          setSankeyActiveRegion(id);
        });
      styleFilterBtn(btn, (S.sankeyLastRegion || S.sankeyActiveRegion) === id);
    });
  }

  function binOutflowOneLiner(region, binId, out) {
    const name = region === "china" ? "中国" : "中东欧";
    const total = out.total || 1;
    const stableShare = out.stable / total;
    const bi = binIdx(binId);
    const tag = binTag(binId);

    if (bi === 0 && stableShare >= 0.7) {
      return (
        `${tag}整体保持${sankeyInsightHi("较强稳定性", region)}，${pctReadable(stableShare)} 的机构在后期仍停留于同一层级，` +
        `${name}合作网络仍呈现明显中心化特征。`
      );
    }
    if (stableShare >= 0.75) {
      return `${tag}整体保持${sankeyInsightHi("较强稳定性", region)}，${pctReadable(stableShare)} 的机构在后期仍停留于同一层级。`;
    }
    if (out.up > out.down && out.up > 0) {
      return `${sankeyInsightHi("部分机构向上跨层迁移", region)}，${tag}向更高层级输送新的合作参与者。`;
    }
    if (out.down > out.up && out.down > 0) {
      return `${sankeyInsightHi("部分机构向下流出", region)}，${tag}内部排序出现调整。`;
    }
    return `${tag}在两期之间流出结构变化不大。`;
  }

  function binInflowOneLiner(region, binId, inf) {
    const total = inf.total || 1;
    const retainShare = inf.retained / total;
    const upInShare = inf.upIn / total;
    const bi = binIdx(binId);
    const tag = binTag(binId);

    if (bi === 0 && retainShare >= 0.5) {
      return `${tag}以原有机构为主，${sankeyInsightHi("核心骨架在 2015 年后基本保持稳定", region)}。`;
    }
    if (retainShare >= 0.55) {
      return `${pctReadable(retainShare)} 的机构保留在本层，${sankeyInsightHi("主体构成延续性较强", region)}。`;
    }
    if (upInShare >= 0.3 && inf.upIn > 0) {
      return `${pctReadable(upInShare)} 的机构来自更低层级，${tag}正在${sankeyInsightHi("吸纳新的合作参与者", region)}。`;
    }
    if (inf.downIn > inf.upIn && inf.downIn > 0) {
      return `${sankeyInsightHi("部分机构自更高层级流入", region)}，高位机构之间出现一定再分配。`;
    }
    return `${tag}的来源构成在两期之间变化不大。`;
  }

  function flowOneLiner(region, from, to, count) {
    if (!count) return `该路径在两期之间暂无机构迁移。`;
    const fi = binIdx(from);
    const ti = binIdx(to);

    if (from === "p20_100" && to === "p10_20") {
      return `${sankeyInsightHi("更多边缘机构开始进入中层合作网络", region)}，合作结构的开放性明显增强。`;
    }
    if (from === "p20_100" && ti < fi) {
      return `${sankeyInsightHi("更多边缘机构进入更高合作层级", region)}，合作结构的开放性明显增强。`;
    }
    if (from === "p10_20" && to === "top5") {
      return `${sankeyInsightHi("部分活跃机构进入核心层", region)}，中层向核心的上升通道仍然开放。`;
    }
    if (from === "p5_10" && to === "top5") {
      return `${sankeyInsightHi("上层核心向核心层集中", region)}，核心圈层的边界正在重新划定。`;
    }
    if (ti > fi) {
      return `${sankeyInsightHi("部分高位机构相对地位下降", region)}，核心层出现一定再分配。`;
    }
    if (ti < fi) {
      return `${sankeyInsightHi("机构向更高层级移动", region)}，合作网络的分层边界正在调整。`;
    }
    return `${sankeyInsightHi("该层级内部保持稳定", region)}，跨层重组未在此路径集中发生。`;
  }

  function buildLeftBinAnnot(slot, region) {
    const c15 = data.sankey.bins[region].y2015[slot.id] || 0;
    const out = binOutflowDetail(region, slot.id);
    const total = out.total || 1;

    return (
      `<div style="${sankeySideMutedStyle("margin-bottom:8px;")}">2011–2015</div>` +
      `<div style="${sankeySideTextStyle("font-weight:600;margin-bottom:8px;")}">${num(c15)} 个机构</div>` +
      compactMetrics([
        { label: "保持原层级", count: out.stable, share: out.stable / total },
        { label: "向上迁移", count: out.up, share: out.up / total },
        { label: "向下迁移", count: out.down, share: out.down / total }
      ]) +
      sankeyCompactNote(binOutflowOneLiner(region, slot.id, out))
    );
  }

  function buildRightBinAnnot(slot, region) {
    const c20 = data.sankey.bins[region].y2020[slot.id] || 0;
    const inf = binInflowDetail(region, slot.id);
    const total = inf.total || 1;

    return (
      `<div style="${sankeySideMutedStyle("margin-bottom:8px;")}">2016–2020</div>` +
      `<div style="${sankeySideTextStyle("font-weight:600;margin-bottom:8px;")}">${num(c20)} 个机构</div>` +
      compactMetrics([
        { label: "保留原层级", count: inf.retained, share: inf.retained / total },
        { label: "来自更低层级", count: inf.upIn, share: inf.upIn / total },
        { label: "来自更高层级", count: inf.downIn, share: inf.downIn / total }
      ]) +
      sankeyCompactNote(binInflowOneLiner(region, slot.id, inf))
    );
  }

  function buildNodeAnnot(slot, region, period) {
    return period === "2015" ? buildLeftBinAnnot(slot, region) : buildRightBinAnnot(slot, region);
  }

  function nodeAnnotOpts(slot, extra) {
    return {
      mode: "node",
      binTag: slot.bin.tag,
      binLabel: slot.bin.label,
      ...extra
    };
  }

  function buildFlowAnnot(f) {
    const nAll = regionInstTotal(f.region);
    const fromTotal = data.sankey.bins[f.region].y2015[f.from] || 0;
    const allShare = nAll ? f.count / nAll : 0;
    const fromShare = fromTotal ? f.count / fromTotal : 0;

    return (
      `<div style="${sankeySideTextStyle("font-weight:600;margin-bottom:8px;")}">` +
      `${binTag(f.from)} → ${binTag(f.to)}` +
      `</div>` +
      (f.count > 0
        ? `<div style="${sankeySideTextStyle()}">` +
          `${num(f.count)} 个机构完成这一迁移<br>` +
          `<span style="color:${C.muted};">（占全部机构的 ${pct(allShare)}，占原${binTag(f.from)}的 ${pct(fromShare)}）</span>` +
          `</div>`
        : `<div style="${sankeySideMutedStyle()}">暂无机构迁移</div>`) +
      sankeyCompactNote(flowOneLiner(f.region, f.from, f.to, f.count))
    );
  }

  function buildCrossAnnot(region, fromBin, toBin) {
    const f = flowRecord(region, fromBin, toBin) || {
      from: fromBin,
      to: toBin,
      region,
      count: 0
    };
    return buildFlowAnnot(f);
  }

  function flowRecord(region, from, to) {
    return (region === "china" ? data.sankey.china : data.sankey.cee).find(
      (f) => f.from === from && f.to === to
    );
  }

  function regionMacroPair(region) {
    return region === "china"
      ? { a15: data.macro.cn15, a20: data.macro.cn20, other: data.macro.ce20, otherName: "中东欧" }
      : { a15: data.macro.ce15, a20: data.macro.ce20, other: data.macro.cn20, otherName: "中国" };
  }

  function binFlowCounts(rows, keyFn) {
    const counts = Object.fromEntries(BINS.map((b) => [b.id, 0]));
    rows.forEach((d) => {
      const k = keyFn(d);
      if (counts[k] !== undefined) counts[k] += 1;
    });
    return BINS.map((b) => ({ binId: b.id, count: counts[b.id] || 0 })).filter((d) => d.count > 0);
  }

  function sortComposition(binId, items) {
    return items.slice().sort((a, b) => {
      if (a.binId === binId) return -1;
      if (b.binId === binId) return 1;
      return binIdx(a.binId) - binIdx(b.binId);
    });
  }

  function binOutflowDetail(region, binId) {
    const rows = (region === "china" ? data.china : data.cee).filter((d) => d.bin_2015 === binId);
    const bi = binIdx(binId);
    let stable = 0;
    let up = 0;
    let down = 0;
    const destinations = binFlowCounts(rows, (d) => d.bin_2020);
    destinations.forEach(({ binId: dest, count }) => {
      const ti = binIdx(dest);
      if (ti === bi) stable += count;
      else if (ti < bi) up += count;
      else down += count;
    });
    const topUp = destinations.filter((d) => binIdx(d.binId) < bi).sort((a, b) => d3.descending(a.count, b.count))[0];
    return { total: rows.length, stable, up, down, destinations: sortComposition(binId, destinations), topUp };
  }

  function binInflowDetail(region, binId) {
    const rows = (region === "china" ? data.china : data.cee).filter((d) => d.bin_2020 === binId);
    const bi = binIdx(binId);
    let retained = 0;
    let upIn = 0;
    let downIn = 0;
    const sources = binFlowCounts(rows, (d) => d.bin_2015);
    sources.forEach(({ binId: src, count }) => {
      const si = binIdx(src);
      if (si === bi) retained += count;
      else if (si > bi) upIn += count;
      else downIn += count;
    });
    const topUpIn = sources.filter((d) => binIdx(d.binId) > bi).sort((a, b) => d3.descending(a.count, b.count))[0];
    return { total: rows.length, retained, upIn, downIn, sources: sortComposition(binId, sources), topUpIn };
  }

  function setSankeyAnnot(html, region, opts) {
    const { isPreview = false, mode = "overview", binTag: bTag, binLabel } = opts || {};
    const seq = ++S.sankeyAnnotSeq;
    S.sankeyActiveRegion = region;
    S.sankeyLastRegion = region;
    const sec = d3.select(".s2-sankey .sankey-side-insight");
    if (sec.empty()) return;
    syncSankeyRegionToggleUI();
    const accent = region === "china" ? C.china : C.cee;
    const locked = !!S.sankeySel[region];
    const previewing = !!isPreview && !S.sankeySel[region];
    const body = sec.select(".sankey-annot-body");
    const titleMeta = bTag ? { binTag: bTag, binLabel } : null;

    sec
      .style("border-color", locked || previewing ? accent : "#dde4ec")
      .style(
        "box-shadow",
        locked ? "0 4px 16px rgb(0 0 0 / 0.08)" : previewing ? "0 2px 10px rgb(0 0 0 / 0.05)" : "0 2px 8px rgb(0 0 0 / 0.06)"
      )
      .style("border-left", `3px solid ${accent}`);

    const title = sankeyPanelTitle(region, mode, titleMeta);

    if (isPreview) {
      body.interrupt();
      sec.select(".sankey-annot-title").text(title);
      body.html(html).style("opacity", previewing ? 0.88 : 1);
      return;
    }

    const fadeMs = Math.round(C.dur * 0.35);
    body.interrupt().style("opacity", body.style("opacity") || 1);
    body
      .transition()
      .duration(fadeMs)
      .style("opacity", 0.4)
      .on("end", () => {
        if (seq !== S.sankeyAnnotSeq) return;
        sec.select(".sankey-annot-title").text(title);
        body.html(html);
        body.transition().duration(fadeMs).style("opacity", 1);
      });
  }

  function resetSankeyAnnotSide(region) {
    d3.select(".s2-sankey .sankey-side-insight").style("opacity", 1);
    setSankeyAnnot(buildOverviewAnnot(region), region, { mode: "overview" });
  }

  function resetSankeyAnnot() {
    const region = S.sankeyActiveRegion || "china";
    S.sankeyLastRegion = region;
    d3.select(".s2-sankey .sankey-side-insight").style("opacity", 1);
    setSankeyAnnot(buildOverviewAnnot(region), region, { mode: "overview" });
  }

  function createSankeySideColumn(parent) {
    const side = parent.append("div").attr("class", "sankey-side");

    side
      .append("div")
      .attr("class", "sankey-side-card sankey-side-compare")
      .html(buildSankeyCompareSideHtml());

    const insight = side.append("div").attr("class", "sankey-side-card sankey-side-insight");
    const head = insight.append("div").attr("class", "sankey-insight-head");

    head.append("div").attr("class", "sankey-annot-title");

    appendSankeyRegionToggle(head);

    insight
      .append("div")
      .attr("class", "sankey-annot-body")
      .style("opacity", "1")
      .style("transition", `opacity ${C.dur}ms ease`);

    resetSankeyAnnot();
  }

  function sankeyFlowKey(f) {
    return `${f.region}|${f.from}|${f.to}`;
  }

  function sankeyNodeKey(region, period, binId) {
    return `${region}|${period}|${binId}`;
  }

  function sankeyFocusForRegion(region) {
    const sel = S.sankeySel[region];
    if (sel) return { ...sel, locked: true };
    const prev = S.sankeyPreview[region];
    if (prev) return { ...prev, locked: false };
    return null;
  }

  function sankeyFlowActive(focus, region, from, to, key) {
    if (!focus) return true;
    if (focus.mode === "flow") return key === focus.key;
    if (focus.mode === "cross") return focus.region === region && focus.from === from && focus.to === to;
    if (focus.mode === "node") {
      if (focus.region !== region) return false;
      if (focus.period === "2015") return from === focus.bin;
      if (focus.period === "2020") return to === focus.bin;
      return false;
    }
    return false;
  }

  function sankeyNodeActive(focus, region, bin, period) {
    if (!focus) return true;
    if (focus.mode === "flow") {
      return focus.region === region && ((period === "2015" && bin === focus.from) || (period === "2020" && bin === focus.to));
    }
    if (focus.mode === "cross") {
      return focus.region === region && ((period === "2015" && bin === focus.from) || (period === "2020" && bin === focus.to));
    }
    if (focus.mode === "node") {
      if (focus.region !== region) return false;
      if (focus.bin === bin && focus.period === period) return true;
      const flows = region === "china" ? data.sankey.china : data.sankey.cee;
      if (focus.period === "2015" && period === "2020") {
        return flows.some((f) => f.from === focus.bin && f.to === bin);
      }
      if (focus.period === "2020" && period === "2015") {
        return flows.some((f) => f.to === focus.bin && f.from === bin);
      }
      return false;
    }
    return false;
  }

  function sankeyNodeSelected(focus, region, bin, period) {
    if (!focus) return false;
    if (focus.mode === "node") {
      return focus.region === region && focus.bin === bin && focus.period === period;
    }
    return sankeyNodeActive(focus, region, bin, period);
  }

  function sankeyNodeOpacity(focus, def, region, bin, period, dimNode, hiNode) {
    if (!focus) return def;
    if (!sankeyNodeActive(focus, region, bin, period)) return dimNode;
    if (sankeyNodeSelected(focus, region, bin, period)) return hiNode;
    if (focus.mode === "node") return def;
    return hiNode;
  }

  function syncSankeyRegionFocus(region) {
    const focus = sankeyFocusForRegion(region);
    const fade = focus && focus.locked ? 0.04 : 0.12;
    const dimNode = focus && focus.locked ? 0.08 : 0.22;
    const hiFlow = focus && focus.locked ? 0.98 : 0.72;
    const hiNode = focus && focus.locked ? 1 : 0.88;

    d3.selectAll(`.sankey-flow[data-region="${region}"]`).each(function () {
      const el = d3.select(this);
      const dir = el.attr("data-mobility");
      const passFilter = flowPassesMobilityFilter(dir);
      if (!passFilter) {
        el.interrupt().transition().duration(C.dur).attr("opacity", 0).style("pointer-events", "none");
        return;
      }
      el.style("pointer-events", "all");
      const dirMode = sankeyDirectionModeForRegion(region);
      const fill = dirMode ? el.attr("data-dir-stroke") : el.attr("data-neutral-stroke");
      el.attr("fill", fill);
      const def = +el.attr("data-default-opacity");
      const active = sankeyFlowActive(
        focus,
        el.attr("data-region"),
        el.attr("data-from"),
        el.attr("data-to"),
        el.attr("data-key")
      );
      const op = focus ? (active ? hiFlow : fade) : def;
      el.transition().duration(C.dur).attr("opacity", op);
    });

    d3.selectAll(`.sankey-node[data-region="${region}"]`).each(function () {
      const el = d3.select(this);
      const def = +el.attr("data-default-opacity");
      const bin = el.attr("data-bin");
      const period = el.attr("data-period");
      const op = sankeyNodeOpacity(focus, def, region, bin, period, dimNode, hiNode);
      el.transition().duration(C.dur).attr("opacity", op);
    });

    d3.selectAll(`.sankey-node[data-region="${region}"]`)
      .attr("stroke", function () {
        const el = d3.select(this);
        const bin = el.attr("data-bin");
        const period = el.attr("data-period");
        const selected = sankeyNodeSelected(focus, region, bin, period);
        if (!selected || !focus) return "none";
        return region === "china" ? C.china : C.cee;
      })
      .attr("stroke-width", function () {
        const el = d3.select(this);
        const bin = el.attr("data-bin");
        const period = el.attr("data-period");
        const selected = sankeyNodeSelected(focus, region, bin, period);
        if (!selected || !focus) return 0;
        return focus.locked ? 2.5 : 1.5;
      });
  }

  function syncSankeyFocus() {
    syncSankeyRegionFocus("china");
    syncSankeyRegionFocus("cee");
    syncSankeyMobilityToggleUI();
  }

  function updateSankeyPanelForPreview(preview) {
    if (!preview || S.sankeySel[preview.region]) return;
    if (preview.mode === "flow") {
      const f = preview.f || flowRecord(preview.region, preview.from, preview.to);
      if (f) setSankeyAnnot(buildFlowAnnot(f), preview.region, { isPreview: true, mode: "flow" });
    } else if (preview.mode === "node" && preview.slot) {
      setSankeyAnnot(buildNodeAnnot(preview.slot, preview.region, preview.period), preview.region,
        nodeAnnotOpts(preview.slot, { isPreview: true }));
    } else if (preview.mode === "cross") {
      setSankeyAnnot(buildCrossAnnot(preview.region, preview.from, preview.to), preview.region, {
        isPreview: true,
        mode: "flow"
      });
    }
  }

  function sankeySlotStub(binId) {
    const bin = BINS.find((b) => b.id === binId);
    return { id: binId, bin };
  }

  function reapplySankeySelection(region) {
    const sel = S.sankeySel[region];
    if (!sel) return;
    if (sel.mode === "flow") {
      const f =
        (region === "china" ? data.sankey.china : data.sankey.cee).find((row) => sankeyFlowKey(row) === sel.key) ||
        flowRecord(region, sel.from, sel.to) || {
          region,
          from: sel.from,
          to: sel.to,
          count: 0
        };
      setSankeyAnnot(buildFlowAnnot(f), region, { mode: "flow" });
      return;
    }
    if (sel.mode === "cross") {
      setSankeyAnnot(buildCrossAnnot(region, sel.from, sel.to), region, { mode: "flow" });
      return;
    }
    if (sel.mode === "node") {
      const slot = sankeySlotStub(sel.bin);
      setSankeyAnnot(buildNodeAnnot(slot, region, sel.period), region, nodeAnnotOpts(slot));
    }
  }

  function restoreSankeyPanelState(clearedRegion) {
    const active = S.sankeyActiveRegion || "china";
    const other = active === "china" ? "cee" : "china";

    if (S.sankeySel[active]) {
      reapplySankeySelection(active);
      return;
    }
    if (S.sankeySel[other]) {
      reapplySankeySelection(other);
      return;
    }
    const preview = S.sankeyPreview[active] || S.sankeyPreview[other];
    if (preview) {
      updateSankeyPanelForPreview(preview);
      return;
    }
    resetSankeyAnnotSide(clearedRegion || active);
  }

  const sankeyPreviewClearTimers = { china: null, cee: null };

  function cancelClearSankeyPreview(region) {
    if (region) {
      if (sankeyPreviewClearTimers[region]) {
        clearTimeout(sankeyPreviewClearTimers[region]);
        sankeyPreviewClearTimers[region] = null;
      }
      return;
    }
    cancelClearSankeyPreview("china");
    cancelClearSankeyPreview("cee");
  }

  function setSankeyPreview(preview) {
    const region = preview.region;
    if (S.sankeySel[region]) return;
    cancelClearSankeyPreview();
    S.sankeyActiveRegion = region;
    S.sankeyPreview = { china: null, cee: null };
    S.sankeyPreview[region] = preview;
    syncSankeyFocus();
    updateSankeyPanelForPreview(preview);
  }

  function clearSankeyPreview(region) {
    if (S.sankeySel[region]) return;
    cancelClearSankeyPreview(region);
    sankeyPreviewClearTimers[region] = setTimeout(() => {
      sankeyPreviewClearTimers[region] = null;
      if (S.sankeySel[region] || !S.sankeyPreview[region]) return;
      S.sankeyPreview[region] = null;
      syncSankeyRegionFocus(region);
      const livePreview = S.sankeyPreview.china || S.sankeyPreview.cee;
      if (livePreview) {
        S.sankeyActiveRegion = livePreview.region;
        updateSankeyPanelForPreview(livePreview);
        return;
      }
      restoreSankeyPanelState(region);
    }, 60);
  }

  function isSankeyInteractiveTarget(target) {
    if (!target) return false;
    if (target.closest) return !!target.closest(".sankey-node, .sankey-flow");
    const cls = target.getAttribute?.("class") || "";
    return /\bsankey-node\b/.test(cls) || /\bsankey-flow\b/.test(cls);
  }

  function bindSankeyRegionBg(rectSel, region) {
    let clickTimer = null;
    rectSel
      .on("click", (ev) => {
        ev.stopPropagation();
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
          clickTimer = null;
          clearSankeySelection();
        }, 260);
      })
      .on("dblclick", (ev) => {
        ev.stopPropagation();
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
        }
        clearSankeySelectionSide(region);
      });
  }

  function onSankeyBlankClick(ev) {
    if (isSankeyInteractiveTarget(ev.target)) return;
    const cls = ev.target.getAttribute?.("class") || "";
    if (/\bsankey-bg-(china|cee)\b/.test(cls)) return;
    clearSankeySelection();
  }

  function bindSankeyBlankClear(svg, chartCol) {
    svg.node().addEventListener("click", onSankeyBlankClick, true);
    chartCol.on("click.sankeyClear", (ev) => {
      if (isSankeyInteractiveTarget(ev.target)) return;
      clearSankeySelection();
    });
  }

  function clearSankeySelectionSide(region) {
    cancelClearSankeyPreview(region);
    S.sankeySel[region] = null;
    S.sankeyPreview[region] = null;
    syncSankeyRegionFocus(region);
    restoreSankeyPanelState(region);
  }

  function clearSankeySelection() {
    cancelClearSankeyPreview();
    S.sankeySel = { china: null, cee: null };
    S.sankeyPreview = { china: null, cee: null };
    syncSankeyFocus();
    resetSankeyAnnot();
  }

  function clickSankeyFlow(f, key) {
    const region = f.region;
    S.sankeyActiveRegion = region;
    cancelClearSankeyPreview(region);
    S.sankeyPreview[region] = null;

    const sel = S.sankeySel[region];
    const sameFlow =
      sel && (sel.mode === "flow" || sel.mode === "cross") && sel.key === key;

    if (sameFlow) {
      clearSankeySelectionSide(region);
      return;
    }

    S.sankeySel[region] = { mode: "flow", region, from: f.from, to: f.to, key };
    setSankeyAnnot(buildFlowAnnot(f), region, { mode: "flow" });
    syncSankeyRegionFocus(region);
  }

  function clickSankeyNode(region, bin, period, slot) {
    S.sankeyActiveRegion = region;
    cancelClearSankeyPreview(region);
    S.sankeyPreview[region] = null;

    const sel = S.sankeySel[region];
    const crossIntent = sel?.mode === "node" && sel.period !== period;

    if (sel && sankeyNodeActive(sel, region, bin, period) && !crossIntent) {
      clearSankeySelectionSide(region);
      return;
    }

    const nodeKey = sankeyNodeKey(region, period, bin);

    if (crossIntent) {
      const fromBin = period === "2015" ? bin : sel.bin;
      const toBin = period === "2020" ? bin : sel.bin;
      S.sankeySel[region] = {
        mode: "cross",
        region,
        from: fromBin,
        to: toBin,
        key: `${region}|${fromBin}|${toBin}`
      };
      setSankeyAnnot(buildCrossAnnot(region, fromBin, toBin), region, { mode: "flow" });
      syncSankeyRegionFocus(region);
      return;
    }

    S.sankeySel[region] = { mode: "node", region, bin, period, key: nodeKey };
    setSankeyAnnot(buildNodeAnnot(slot, region, period), region, nodeAnnotOpts(slot));
    syncSankeyRegionFocus(region);
  }

  function tipInstCore(ev, d, placement) {
    const dp = d.papers_2020 - d.papers_2015;
    const mobLabel = mesoMobilityLabel(d);
    const rate = mesoShareGrowthRate(d);
    const rateColor = mesoShareGrowthRateColor(d);

    showTip(
      ev,
      tipTitleHtml(instDisplayName(d)) +
        tipRowHtml("类型", mobLabel, "font-weight:600;") +
        tipRowHtml("2011–2015 基准份额", pct2(d.share_2015)) +
        tipRowHtml("2016–2020 份额", pct2(d.share_2020), `font-weight:600;color:${TIP.hi};`) +
        tipRowHtml("份额增速", fmtMesoGrowthRate(rate, d), `font-weight:600;color:${rateColor};`) +
        tipRowHtml("论文数", `${num(d.papers_2015)} → ${num(d.papers_2020)}${tipSignedSuffix(dp, num, false)}`) +
        `<div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:3px;">` +
        `<span style="color:${TIP.dim};">排名变化</span><span>${tipRankDetailHtml(d, true)}</span></div>`,
      placement
    );
  }

  function tipSignedSuffix(val, fmt, active) {
    if (!val) return ` <span style="color:${TIP.dim}">—</span>`;
    const sign = val > 0 ? "+" : "";
    const text = `${sign}${fmt(val)}`;
    if (active) {
      const color = val > 0 ? TIP.gain : TIP.loss;
      return ` <span style="color:${color}">${text}</span>`;
    }
    return ` <span style="color:${TIP.dim}">${text}</span>`;
  }

  function tipRankDetailHtml(d, active) {
    const r15 = panelRankLabel(d.rank_2015);
    const r20 = panelRankLabel(d.rank_2020);
    const rc = d.rank_change;
    if (!rc) {
      return ` <span style="color:${TIP.dim}">${r15} → ${r20} · —</span>`;
    }
    const arrow = rankChangeArrow(rc);
    if (active) {
      const color = rankImproved(rc) ? TIP.gain : TIP.loss;
      return (
        ` <span style="color:${TIP.dim}">${r15} → ${r20}</span>` +
        ` <span style="color:${color}">${arrow}</span>`
      );
    }
    return ` <span style="color:${TIP.dim}">${r15} → ${r20} ${arrow}</span>`;
  }

  function tipShareDeltaHtml(d, active) {
    const sg = shareDelta(d);
    if (Math.abs(sg) < 0.000005) {
      return `<span style="color:${TIP.dim}">—</span>`;
    }
    const sign = sg > 0 ? "+" : "";
    const text = `${sign}${pct2(sg)}`;
    if (active) {
      const color = sg > 0 ? TIP.gain : TIP.loss;
      return `<span style="color:${color}">${text}</span>`;
    }
    return `<span style="color:${TIP.dim}">${text}</span>`;
  }

  // ─── interaction ───────────────────────────────────────────────────────────
  function mesoLabelStyle(sel) {
    sel.style("pointer-events", "none");
  }

  function bindInst(sel) {
    const tipPlacement = "meso";

    sel
      .attr("data-id", (d) => (d.inst || d).id)
      .classed("inst-entity", true);

    sel.each(function (d) {
      const m = d.inst || d;
      const region = m.region;
      const g = d3.select(this);

      const onEnter = (ev) => {
        ev.stopPropagation();
        if (!S.mesoSel[region]) {
          S.mesoHover[region] = m.id;
          bus.call("change");
        }
        tipInstCore(ev, m, tipPlacement);
      };
      const onMove = (ev) => {
        moveMesoTip(ev);
      };
      const onLeave = (ev) => {
        const grp = g.node();
        if (ev.relatedTarget && grp.contains(ev.relatedTarget)) return;
        if (!S.mesoSel[region]) {
          S.mesoHover[region] = null;
          bus.call("change");
        }
        hideTip();
      };
      const onClick = (ev) => {
        ev.stopPropagation();
        if (S.mesoSel[region] === m.id) {
          clearMesoSelectionSide(region);
          return;
        }
        S.mesoSel[region] = m.id;
        S.mesoHover[region] = m.id;
        setMesoDetailSide(region, m);
        bus.call("change");
      };

      g.selectAll(".meso-hit")
        .style("cursor", "pointer")
        .on("mouseenter", onEnter)
        .on("mousemove", onMove)
        .on("mouseleave", onLeave)
        .on("click", onClick);
    });
  }

  function applyParetoOpacity() {
    const sel = S.paretoSeries;
    d3.select(".s1-macro .macro-curve").each(function () {
      const el = d3.select(this);
      const leg = el.attr("data-series");
      const active = !!sel && leg === sel;
      const dimmed = !!sel && leg !== sel;
      el.transition()
        .duration(C.dur)
        .attr("opacity", active ? 1 : dimmed ? 0.15 : 1)
        .attr("stroke-width", active ? 3 : 2.5);
    });
  }

  function clearParetoSeries() {
    if (!S.paretoSeries) return;
    S.paretoSeries = null;
    hideTip();
    d3.select(".pareto-focus").style("display", "none");
    applyParetoOpacity();
  }

  function toggleParetoSeries(leg) {
    if (S.paretoSeries === leg) clearParetoSeries();
    else {
      S.paretoSeries = leg;
      applyParetoOpacity();
    }
  }

  function showParetoPoint(ev, gNode, s, xScale, yScale, ih, focus, vLine, dot) {
    const [mx] = d3.pointer(ev, gNode);
    const xPct = Math.max(0, Math.min(100, xScale.invert(mx)));
    const pt = nearestParetoPoint(s.pts, xPct);

    if (S.paretoSeries) {
      d3.selectAll(".macro-curve").each(function () {
        const leg = d3.select(this).attr("data-series");
        const active = leg === s.leg;
        d3.select(this)
          .attr("opacity", active ? 1 : 0.06)
          .attr("stroke-width", active ? 3.5 : 1.5)
          .style("filter", active ? "drop-shadow(0 1px 3px rgb(0 0 0 / 0.22))" : null);
      });
    } else {
      d3.selectAll(".macro-curve").each(function () {
        const leg = d3.select(this).attr("data-series");
        const active = leg === s.leg;
        d3.select(this)
          .attr("opacity", active ? 1 : 0.14)
          .attr("stroke-width", active ? 2.5 : 1.5)
          .style("filter", null);
      });
    }

    focus.style("display", null);
    vLine
      .attr("x1", xScale(pt.x))
      .attr("x2", xScale(pt.x))
      .attr("y1", 0)
      .attr("y2", ih)
      .attr("stroke", S.paretoSeries ? s.color : C.border)
      .attr("stroke-width", S.paretoSeries ? 2 : 1);
    dot
      .attr("cx", xScale(pt.x))
      .attr("cy", yScale(pt.y))
      .attr("fill", s.color)
      .attr("r", S.paretoSeries ? 6 : 4)
      .attr("stroke-width", S.paretoSeries ? 2.5 : 1.5);
    tipCurvePoint(ev, s, pt);
    return pt;
  }

  function syncMesoBars() {
    const dim = C.fade;

    d3.selectAll(".meso-bar").each(function () {
      const bar = d3.select(this);
      const g = d3.select(this.parentNode);
      const region = g.attr("data-region");
      const id = mesoFocusId(region);
      const active = !id || g.attr("data-id") === id;
      const baseFill = bar.attr("data-base-fill") || MESO.neutral;
      const baseOp = +bar.attr("data-base-opacity") || 0.85;

      if (!id) {
        bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", baseOp);
      } else if (active) {
        bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", 1);
      } else {
        bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", baseOp * dim);
      }
    });

    d3.selectAll(".meso-rate-lbl").each(function () {
      const lbl = d3.select(this);
      const g = d3.select(this.parentNode);
      const region = g.attr("data-region");
      const id = mesoFocusId(region);
      const active = !id || g.attr("data-id") === id;
      lbl.transition().duration(C.dur).attr("opacity", active ? 1 : id ? dim : 1);
    });

    d3.selectAll(".meso-lbl").each(function () {
      const lbl = d3.select(this);
      const g = d3.select(this.parentNode);
      const region = g.attr("data-region");
      const id = mesoFocusId(region);
      const active = !id || g.attr("data-id") === id;
      const accent = region === "china" ? C.china : C.cee;
      lbl
        .transition()
        .duration(C.dur)
        .attr("opacity", active ? 1 : id ? dim : 1)
        .attr("fill", active && id ? accent : C.text)
        .style("font-weight", active && id ? "700" : "500");
    });
  }

  function syncMesoFocus() {
    const dim = C.fade;
    ["china", "cee"].forEach((region) => {
      const id = mesoFocusId(region);
      d3.selectAll(`.inst-entity[data-region="${region}"]`)
        .transition()
        .duration(C.dur)
        .style("opacity", function () {
          if (!id) return 1;
          return d3.select(this).attr("data-id") === id ? 1 : dim;
        });
    });
    syncMesoBars();
  }

  function syncFocus() {
    syncMesoFocus();
    applyParetoOpacity();
  }

  bus.on("change", syncFocus);

  // ─── layout helpers ────────────────────────────────────────────────────────
  function section(parent, cls, meta) {
    const spec = typeof meta === "string" ? { title: meta } : meta;
    const { figure, ordinal, label, title, sub } = spec;
    const heading = ordinal && title ? `${ordinal}、${title}` : title;

    const s = parent
      .append("article")
      .attr("class", `viz-card il-section ${cls}`);

    if (figure) {
      s.append("div").attr("class", "figure-chip").text(figure);
    }

    const head = s.append("div").attr("class", "viz-card__head");
    if (label) {
      head.append("span").attr("class", "viz-label").text(label);
    }
    if (heading) {
      head.append("h3").text(heading);
    }
    if (sub) {
      head
        .append("p")
        .attr("class", "il-section-sub")
        .style("margin", "8px 0 0")
        .style("font-size", "13px")
        .style("color", "var(--muted)")
        .style("line-height", "1.55")
        .style("font-family", C.font)
        .text(sub);
    }

    const card = s.append("div").attr("class", "il-chart");
    return { sec: s, card, head };
  }

  function whiteSvg(parent, w, h, viewBox) {
    const svg = parent
      .append("svg")
      .attr("width", w)
      .attr("height", h)
      .style("display", "block")
      .style("background", C.bg);
    if (viewBox) svg.attr("viewBox", viewBox);
    return svg;
  }

  function prose(parent, html, opts = {}) {
    parent
      .append("div")
      .attr("class", "il-prose")
      .style("font-family", C.font)
      .style("font-size", "13px")
      .style("line-height", "1.7")
      .style("color", C.text)
      .style("margin-bottom", opts.marginBottom ?? "16px")
      .style("max-width", opts.maxWidth ?? "820px")
      .html(html);
  }

  function insight(parent, title, text) {
    parent
      .append("div")
      .style("margin-top", "16px")
      .style("padding", "14px 16px")
      .style("background", "linear-gradient(135deg,#eff6ff,#f8fafc)")
      .style("border-radius", "10px")
      .style("border", `1px solid ${C.border}`)
      .style("border-left", `4px solid ${C.chinaDk}`)
      .style("font-family", C.font)
      .style("font-size", "13px")
      .style("line-height", "1.7")
      .style("color", C.muted)
      .html(`<strong style="color:${C.text};">${title}</strong> ${text}`);
  }

  // ─── SECTION 1: Macro concentration ────────────────────────────────────────
  function drawMacro(parent, w) {
    section(parent, "s1-macro", IL_SECTIONS.macro);
    macroChartCtx = null;

    const card = d3.select(".s1-macro .il-chart");
    S.macroChartW = Math.max(w, 320);

    appendMacroToolbar(card);

    const stackLayout = S.macroChartW < 900;
    const body = card
      .append("div")
      .attr("class", "macro-body")
      .classed("macro-body--stack", stackLayout);

    body.append("div").attr("class", "macro-main").append("div").attr("class", "macro-pareto-viz");
    ensureMacroSideStructure(body.append("div").attr("class", "macro-side"));

    S.macroViewsReady = false;
    refreshMacroViews();
  }

  // ─── SECTION 2: Sankey ─────────────────────────────────────────────────────
  function drawSankey(parent, w) {
    S.sankeySel = { china: null, cee: null };
    S.sankeyPreview = { china: null, cee: null };
    if (!S.sankeyActiveRegion) S.sankeyActiveRegion = "china";
    S.sankeyLastRegion = S.sankeyActiveRegion;
    S.sankeyMobilityFilter = "all";

    const { card } = section(parent, "s2-sankey", IL_SECTIONS.sankey);

    const sideW = 290;
    const layoutGap = 18;
    const mainPadX = 40;
    const stackLayout = w < 900;
    const mainColW = stackLayout ? w : w - sideW - layoutGap;
    const chartW = Math.max(320, mainColW - mainPadX);
    const h = 580;
    const m = { t: 32, r: 12, b: 40, l: 12 };

    const wrap = card.append("div").attr("class", "sankey-wrap");
    const main = wrap.append("div").attr("class", "sankey-main");
    appendSankeyMobilityToggle(main);
    const chartCol = main
      .append("div")
      .attr("class", "sankey-chart-col")
      .style("min-width", "0")
      .style("width", "100%");

    const svg = chartCol
      .append("svg")
      .attr("width", "100%")
      .attr("height", h)
      .attr("viewBox", `0 0 ${chartW} ${h}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block")
      .style("background", C.bg);
    bindSankeyBlankClear(svg, chartCol);
    createSankeySideColumn(wrap);

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const iw = chartW - m.l - m.r;
    const ih = h - m.t - m.b;

    g.append("rect")
      .attr("class", "sankey-bg")
      .attr("width", iw)
      .attr("height", ih)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .style("pointer-events", "all");

    const edgePad = 2;
    const minCenterGap = 8;
    const cw = 64;
    const binGap = 6;
    let innerGap = Math.max(16, (iw - 2 * edgePad - 4 * cw - minCenterGap) / 2);

    const cn15x = edgePad;
    const cn20x = cn15x + cw + innerGap;
    const ce20x = iw - edgePad - cw;
    const ce15x = ce20x - cw - innerGap;
    const centerX = iw / 2;

    const cnCounts = data.sankey.bins.china;
    const ceCounts = data.sankey.bins.cee;
    const aligned = layoutBinsEqual(ih, binGap);

    function drawFlows(flowList, x15, x20, region) {
      const sx = x15 + cw;
      const tx = x20;
      const span = tx - sx;
      const cp1 = sx + span * 0.58;
      const cp2 = tx - span * 0.58;

      assignSankeyFlowBands(flowList, aligned).forEach(({ f, y1Top, y1Bot, y2Top, y2Bot, shareOut }) => {
        const op = 0.22 + shareOut * 0.68;
        const key = sankeyFlowKey(f);
        const dir = flowMobilityDir(f.from, f.to);
        const dirStroke = sankeyFlowMobilityColor(region, dir);
        const neutralStroke = sankeyFlowNeutralColor(region);
        const fill = neutralStroke;
        g.append("path")
          .attr("class", "sankey-flow")
          .attr("data-key", key)
          .attr("data-region", region)
          .attr("data-from", f.from)
          .attr("data-to", f.to)
          .attr("data-mobility", dir)
          .attr("data-neutral-stroke", neutralStroke)
          .attr("data-dir-stroke", dirStroke)
          .attr("data-default-opacity", op)
          .attr(
            "d",
            sankeyRibbonPath(sx, tx, y1Top, y1Bot, y2Top, y2Bot, cp1, cp2)
          )
          .attr("fill", fill)
          .attr("stroke", "none")
          .attr("opacity", flowPassesMobilityFilter(dir) ? op : 0)
          .style("cursor", "pointer")
          .style("pointer-events", flowPassesMobilityFilter(dir) ? "all" : "none")
          .on("mouseover", () => {
            setSankeyPreview({ mode: "flow", key, region, from: f.from, to: f.to, f });
          })
          .on("mouseout", () => clearSankeyPreview(region))
          .on("click", (ev) => {
            ev.stopPropagation();
            clickSankeyFlow(f, key);
          });
      });
    }

    function drawBinNodes(x, region, period, counts, periodOpacity) {
      aligned.forEach((slot) => {
        const nodeKey = sankeyNodeKey(region, period, slot.id);
        g.append("rect")
          .attr("class", "sankey-node")
          .attr("data-key", nodeKey)
          .attr("data-region", region)
          .attr("data-bin", slot.id)
          .attr("data-period", period)
          .attr("data-default-opacity", periodOpacity)
          .attr("x", x)
          .attr("y", slot.y)
          .attr("width", cw)
          .attr("height", slot.h)
          .attr("rx", 4)
          .attr("fill", binColor(slot.id, region))
          .attr("opacity", periodOpacity)
          .attr("stroke", "none")
          .attr("stroke-width", 0)
          .style("cursor", "pointer")
          .on("mouseover", () => {
            setSankeyPreview({
              mode: "node",
              region,
              bin: slot.id,
              period,
              key: sankeyNodeKey(region, period, slot.id),
              slot
            });
          })
          .on("mouseout", () => clearSankeyPreview(region))
          .on("click", (ev) => {
            ev.stopPropagation();
            clickSankeyNode(region, slot.id, period, slot);
          });

        const txt = binTextColor();
        const label = g
          .append("text")
          .attr("x", x + cw / 2)
          .attr("y", slot.y + slot.h / 2)
    .attr("text-anchor", "middle")
          .attr("fill", txt)
          .style("font-size", slot.h >= 34 ? "10px" : "9px")
          .style("font-weight", "600")
          .style("pointer-events", "none");
        label
          .append("tspan")
          .attr("x", x + cw / 2)
          .attr("dy", slot.h >= 34 ? "-0.35em" : "0.35em")
          .text(slot.bin.label);
        if (slot.h >= 34) {
          label
            .append("tspan")
            .attr("x", x + cw / 2)
            .attr("dy", "1.15em")
            .style("font-size", "8px")
            .style("font-weight", "500")
            .style("opacity", 0.9)
            .text(slot.bin.tag);
        }
      });
    }

    g.append("line")
      .attr("x1", centerX)
      .attr("x2", centerX)
      .attr("y1", -4)
      .attr("y2", ih + 4)
      .attr("stroke", C.muted)
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,4")
      .style("pointer-events", "none")
      .style("opacity", 0.55);

    [
      ["china", cn15x - 8, cn20x + cw + 8],
      ["cee", ce15x - 8, ce20x + cw + 8]
    ].forEach(([region, x0, x1]) => {
      bindSankeyRegionBg(
        g.insert("rect", ":first-child")
          .attr("class", `sankey-bg-${region}`)
          .attr("data-region", region)
          .attr("x", x0)
          .attr("y", -8)
          .attr("width", x1 - x0)
          .attr("height", ih + 16)
          .attr("fill", "transparent")
          .style("cursor", "default")
          .style("pointer-events", "all"),
        region
      );
    });

    drawFlows(data.sankey.china, cn15x, cn20x, "china");
    drawFlows(data.sankey.cee, ce15x, ce20x, "cee");
    syncSankeyFocus();

    drawBinNodes(cn15x, "china", "2015", cnCounts.y2015, 0.78);
    drawBinNodes(cn20x, "china", "2020", cnCounts.y2020, 1);
    drawBinNodes(ce15x, "cee", "2015", ceCounts.y2015, 0.78);
    drawBinNodes(ce20x, "cee", "2020", ceCounts.y2020, 1);

    g.append("text")
      .attr("x", (cn15x + cn20x + cw) / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", C.china)
      .style("font-weight", "600")
      .style("font-size", "13px")
      .style("pointer-events", "none")
      .text("中国");
    g.append("text")
      .attr("x", (ce15x + ce20x + cw) / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", C.cee)
      .style("font-weight", "600")
      .style("font-size", "13px")
      .style("pointer-events", "none")
      .text("中东欧");

    [
      ["2011–2015", cn15x],
      ["2016–2020", cn20x],
      ["2011–2015", ce15x],
      ["2016–2020", ce20x]
    ].forEach(([lb, x]) => {
      g.append("text")
        .attr("x", x + cw / 2)
        .attr("y", ih + 14)
        .attr("text-anchor", "middle")
        .attr("fill", C.muted)
        .style("font-size", "10px")
        .style("pointer-events", "none")
        .text(lb);
    });

    g.select(".sankey-bg").on("click", () => clearSankeySelection());

    main
      .append("div")
      .attr("class", "sankey-chart-hint")
      .style("margin-top", "10px")
      .style("font-size", "11px")
      .style("color", C.muted)
      .style("font-family", C.font)
      .style("line-height", "1.55")
      .text("悬停或点击流带、节点查看解读；宽度 = 占原层级比例；默认保持区域色，筛选/选中/悬停时按↑主色 · —灰 · ↓浅色区分流向。");
  }

  // ─── SECTION 3: Bubble scatter ─────────────────────────────────────────────
  function instDisplayName(d) {
    const cn = (d.institution_cn || "").trim();
    if (cn && cn !== "0") return cn;
    return d.institution;
  }

  function countryDisplayName(d) {
    return d.country_cn || d.country || "—";
  }

  function bubbleRankLabel(d, period) {
    const rank = period === "p15" ? d.rank_2015 : d.rank_2020;
    if (rank < 1) return "—";
    const rt = data.rankTotal[d.region];
    const total = period === "p15" ? rt.p15 : rt.p20;
    return total ? `${rank}/${total}` : `${rank}`;
  }

  function bubbleScatterPoints() {
    return [...data.china, ...data.cee].filter((d) => d.share_2015 > 0 || d.share_2020 > 0);
  }

  /** 与第二节桑基图一致：前 5% · 核心层 + 5–10% · 上层核心 */
  function bubbleIsHeadTier(binId) {
    return binId === "top5" || binId === "p5_10";
  }

  function bubbleBinMeta(binId) {
    return BINS.find((b) => b.id === binId) || { id: binId, label: "—", tag: "—" };
  }

  function bubbleTierLabel(binId) {
    const b = bubbleBinMeta(binId);
    return b.tag === "—" ? "—" : `${b.label} · ${b.tag}`;
  }

  function bubbleTierTag(binId) {
    return bubbleBinMeta(binId).tag;
  }

  function bubbleMobilityType(d) {
    if (d.share_2020 > d.share_2015 * 1.12) return "growth";
    if (d.share_2020 < d.share_2015 * 0.88) return "decline";
    return "stable";
  }

  function bubbleMobilityLabel(type) {
    if (type === "growth") return "份额增长";
    if (type === "decline") return "份额下降";
    return "份额稳定";
  }

  function bubbleInstType(d) {
    const mobility = bubbleMobilityType(d);
    const tier15 = d.bin_2015;
    const tier20 = d.bin_2020;
    const tierDir = flowMobilityDir(tier15, tier20);
    const hi15 = bubbleIsHeadTier(tier15);
    const hi20 = bubbleIsHeadTier(tier20);

    if (d.share_2020 <= 0 && d.share_2015 > 0) return { id: "exit_zero", label: "完全退场" };
    if (d.share_2015 <= 0 && d.share_2020 > 0) return { id: "new_entry", label: "新入场机构" };

    if (mobility === "decline") {
      if (hi15 && !hi20) return { id: "exit_head", label: "头部退场" };
      if (hi15) return { id: "decline_head", label: "头部份额回落" };
      if (tier15 === "p10_20" || tier15 === "p5_10") return { id: "exit_active", label: "活跃层退场" };
      if (tierDir === "down") return { id: "decline_tier", label: "层级下滑机构" };
      return { id: "exit_tail", label: "长尾退场" };
    }

    if (mobility === "growth") {
      if (hi15 && hi20) return { id: "growth_head", label: "持续增长头部" };
      if (!hi15 && hi20) return { id: "emerging_head", label: "新兴增长头部" };
      if (tierDir === "up" && tier20 === "top5") return { id: "rise_core", label: "新晋核心机构" };
      if (tierDir === "up") return { id: "emerging", label: "新兴增长机构" };
      if (tier20 === "p10_20" || tier20 === "p5_10") return { id: "growth_active", label: "活跃层增长机构" };
      return { id: "growth_tail", label: "长尾跃升机构" };
    }

    if (tier20 === "top5") return { id: "stable_head", label: "稳定头部" };
    if (tier20 === "p5_10") return { id: "stable_upper", label: "稳定上层核心" };
    if (tier20 === "p10_20") return { id: "stable_active", label: "稳定活跃机构" };
    return { id: "stable_tail", label: "稳定长尾" };
  }

  function bubbleInstTypeLabel(d) {
    return bubbleInstType(d).label;
  }

  function bubbleInstTypeProse(d) {
    const type = bubbleInstType(d);
    const tier15 = bubbleTierTag(d.bin_2015);
    const tier20 = bubbleTierTag(d.bin_2020);

    const prose = {
      stable_head: `两期均处于${tier20}，合作份额保持高位且变化有限，属于<strong>稳定头部</strong>机构。`,
      stable_upper: `后期仍位于${tier20}，份额波动不大，在合作结构中扮演<strong>稳定上层核心</strong>角色。`,
      stable_active: `后期停留在${tier20}，份额表现相对平稳，属于<strong>稳定活跃机构</strong>。`,
      stable_tail: `后期位于${tier20}，份额变化不大，整体呈现<strong>稳定长尾</strong>特征。`,
      growth_head: `前期已是${tier15}，后期份额继续上升并维持头部地位，属于<strong>持续增长头部</strong>。`,
      emerging_head: `合作层级由${tier15}升至${tier20}（进入核心/上层核心），属于<strong>新兴增长头部</strong>。`,
      rise_core: `合作层级由${tier15}升至${tier20}，并进入核心层，属于<strong>新晋核心机构</strong>。`,
      emerging: `合作层级由${tier15}升至${tier20}，份额同步扩张，属于<strong>新兴增长机构</strong>。`,
      growth_active: `在${tier20}内实现份额增长，属于<strong>活跃层增长机构</strong>，结构参与度上升。`,
      growth_tail: `由${tier15}向${tier20}跃升，份额同步走高，属于<strong>长尾跃升机构</strong>。`,
      new_entry: `后期新进入区域合作网络，属于<strong>新入场机构</strong>。`,
      exit_zero: `后期几乎退出合作网络，属于<strong>完全退场</strong>机构。`,
      exit_head: `由${tier15}明显回落，已失去头部份额地位，属于<strong>头部退场</strong>机构。`,
      decline_head: `虽仍有一定份额，但较前期高位明显回落，属于<strong>头部份额回落</strong>类型。`,
      exit_active: `由${tier15}份额持续走低，属于<strong>活跃层退场</strong>机构。`,
      decline_tier: `合作层级由${tier15}下滑至${tier20}，属于<strong>层级下滑机构</strong>。`,
      exit_tail: `位于${tier15}且份额继续收缩，属于<strong>长尾退场</strong>机构。`
    };

    return prose[type.id] || `两期合作份额与层级发生变化（${tier15} → ${tier20}），需结合具体数值进一步解读。`;
  }

  function bubbleQuadrantLabel(d) {
    return bubbleInstTypeLabel(d);
  }

  function bubbleRegionColor(d) {
    return d.region === "china" ? C.china : C.cee;
  }

  function bubbleDotRadius(d, rScale, hiIds) {
    const base = rScale(bubbleShareMag(d));
    return Math.max(hiIds && hiIds.has(d.id) ? 3 : 2, base);
  }

  function bubbleRegionLabel(d) {
    return d.region === "china" ? "中国" : "中东欧";
  }

  function bubbleInstStats(points) {
    let growth = 0;
    let stable = 0;
    let decline = 0;
    let emerging = 0;
    let leader = 0;
    points.forEach((d) => {
      const type = bubbleMobilityType(d);
      if (type === "growth") growth += 1;
      else if (type === "decline") decline += 1;
      else stable += 1;
      const info = bubbleInstType(d);
      if (["emerging", "emerging_head", "rise_core", "new_entry", "growth_tail"].includes(info.id)) emerging += 1;
      if (["stable_head", "growth_head", "emerging_head"].includes(info.id)) leader += 1;
    });
    return { growth, stable, decline, emerging, leader, total: points.length };
  }

  function bubbleSideStatCard(title, value, unit, color) {
    return (
      `<div class="bubble-side-stat">` +
      `<div class="bubble-side-stat-label">${title}</div>` +
      `<div class="bubble-side-stat-value" style="color:${color};">${value}` +
      (unit ? `<span class="bubble-side-stat-unit">${unit}</span>` : "") +
      `</div></div>`
    );
  }

  function buildBubbleGuideHtml() {
    return (
      `<div class="bubble-side-label">读图说明</div>` +
      `<div class="bubble-side-prose">` +
      `<p>横轴 = 2011–2015 合作份额，纵轴 = 2016–2020 合作份额（对称对数刻度）；气泡大小 = 份额变化幅度 |后期 − 前期|；颜色 = 中国（蓝）/ 中东欧（橙）。份额 = 该机构论文数占<strong>本区域</strong>当期总论文的比例，不宜跨区直接比较绝对值。</p>` +
      `<p>主图前景 = 各区域高份额、份额增长、份额下降三类 Top 15 的并集；其余为背景层。切换「中国 / 中东欧」时，右侧可浏览头部机构 / 份额变化 / 增长 / 下降 Top 15 列表，并在主图以<strong>区域色光晕</strong>标出当前排行。</p>` +
      `<p>机构类型与第二节桑基图一致：按区域排名划分四档层级（前 5% 核心层 · 5–10% 上层核心 · 10–20% 活跃机构 · 20–100% 长尾机构），再结合份额变动（±12%）归类。Tooltip 与右侧结构概览采用同一口径。</p>` +
      `<p>上方搜索框可按机构中英文名检索；<strong>悬停或点击</strong>下拉结果时，主图以紫色光晕标出对应机构。点击结果或主图气泡查看详情。对角线 y = x：上方增长、附近稳定、下方下降。滚轮缩放、拖拽平移，双击或「重置」恢复视图；点击空白返回结构概览。</p>` +
      `</div>`
    );
  }

  function bubbleInstSearchHaystack(d) {
    return [instDisplayName(d), d.institution, d.institution_cn, d.country, d.country_cn]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function bubbleSearchMatches(limit) {
    const q = S.bubbleSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return bubblePointsForRegionFilter(S.bubbleRegionFilter).filter((d) => bubbleInstSearchHaystack(d).includes(q)).slice(0, limit || 12);
  }

  function bubbleSearchHighlightIds() {
    const q = S.bubbleSearchQuery.trim();
    if (!q) return new Set();
    if (S.bubbleSearchHoverId) return new Set([S.bubbleSearchHoverId]);
    if (S.bubbleSel) return new Set([S.bubbleSel.id]);
    return new Set();
  }

  function syncBubbleSearchDropdownStyles() {
    d3.select(".s3-bubble .bubble-inst-search-results")
      .selectAll(".bubble-inst-search-item")
      .classed("is-active", function () {
        const id = d3.select(this).attr("data-id");
        return S.bubbleSel && S.bubbleSel.id === id;
      })
      .classed("is-hover", function () {
        const id = d3.select(this).attr("data-id");
        return S.bubbleSearchHoverId === id;
      });
  }

  function clearBubbleSearch() {
    S.bubbleSearchQuery = "";
    S.bubbleSearchHoverId = null;
    const input = document.querySelector(".s3-bubble .bubble-inst-search-input");
    if (input) input.value = "";
    renderBubbleSearchResults();
    syncBubbleChartHighlights();
    syncBubbleFocus();
  }

  function setBubbleSearchQuery(query) {
    S.bubbleSearchQuery = query;
    S.bubbleSearchHoverId = null;
    const q = query.trim().toLowerCase();
    if (S.bubbleSel && q && !bubbleInstSearchHaystack(S.bubbleSel).includes(q)) {
      S.bubbleSel = null;
      updateBubbleSidePanel();
    }
    renderBubbleSearchResults();
    syncBubbleChartHighlights();
    syncBubbleFocus();
  }

  function setBubbleSearchHoverId(id) {
    if (S.bubbleSearchHoverId === id) return;
    S.bubbleSearchHoverId = id || null;
    syncBubbleChartHighlights();
    syncBubbleFocus();
    syncBubbleSearchDropdownStyles();
  }

  function selectBubbleInstitution(d) {
    S.bubbleSel = d || null;
    S.bubbleSearchHoverId = null;
    hideTip();
    updateBubbleSidePanel();
    syncBubbleFocus();
    syncBubbleChartHighlights();
    syncBubbleSearchDropdownStyles();
    if (S.bubbleRegionFilter !== "all") renderBubbleTopListContent();
  }

  function renderBubbleSearchResults() {
    const host = d3.select(".s3-bubble .bubble-inst-search-results");
    if (host.empty()) return;
    const q = S.bubbleSearchQuery.trim();
    if (!q) {
      host.style("display", "none").html("");
      return;
    }
    const rows = bubbleSearchMatches(10);
    if (!rows.length) {
      host.style("display", "block").html(`<div class="bubble-inst-search-empty">无匹配机构</div>`);
      return;
    }
    host.style("display", "block");
    host.html(
      rows
        .map(
          (d) =>
            `<button type="button" class="bubble-inst-search-item" data-id="${d.id}">` +
            `<span class="bubble-inst-search-name">${instDisplayName(d)}</span>` +
            `<span class="bubble-inst-search-meta">${bubbleRegionLabel(d)} · ${bubbleInstTypeLabel(d)}</span>` +
            `</button>`
        )
        .join("")
    );
    host.selectAll(".bubble-inst-search-item")
      .on("click", (ev) => {
        ev.stopPropagation();
        const id = d3.select(ev.currentTarget).attr("data-id");
        selectBubbleInstitution(data.byId.get(id));
        syncBubbleSearchDropdownStyles();
      })
      .on("mouseenter", (ev) => {
        ev.stopPropagation();
        setBubbleSearchHoverId(d3.select(ev.currentTarget).attr("data-id"));
      });
    syncBubbleSearchDropdownStyles();
  }

  function mountBubbleInstSearch(parent) {
    const wrap = parent.append("div").attr("class", "bubble-inst-search");
    const input = wrap
      .append("input")
      .attr("type", "search")
      .attr("class", "bubble-inst-search-input")
      .attr("placeholder", "搜索机构（中/英文名）")
      .attr("autocomplete", "off")
      .property("value", S.bubbleSearchQuery);
    wrap
      .append("button")
      .attr("type", "button")
      .attr("class", "bubble-inst-search-clear")
      .attr("title", "清除搜索")
      .text("×")
      .on("click", (ev) => {
        ev.stopPropagation();
        clearBubbleSearch();
      });
    wrap.append("div").attr("class", "bubble-inst-search-results").on("mouseleave", () => setBubbleSearchHoverId(null));
    input.on("input", function () {
      setBubbleSearchQuery(this.value);
    });
    input.on("keydown", (ev) => {
      if (ev.key === "Escape") clearBubbleSearch();
    });
  }

  function bubbleStatCard(title, count, total, color, mode) {
    if (mode === "pct") {
      const val = total ? pct(count / total) : "—";
      return bubbleSideStatCard(title, val, "", color);
    }
    return bubbleSideStatCard(title, count, "所", color);
  }

  function bubbleRegionStatPalette(region) {
    if (region === "china") {
      return {
        head: C.china,
        growth: C.chinaDk,
        stable: "#60a5fa",
        decline: C.chinaLt,
        emerging: C.china,
        leader: C.chinaDk,
        total: C.china
      };
    }
    return {
      head: C.cee,
      growth: "#b45309",
      stable: "#f59e0b",
      decline: C.ceeLt,
      emerging: C.cee,
      leader: "#b45309",
      total: C.cee
    };
  }

  function buildBubbleRegionStatsBlock(label, st, region, mode) {
    const pal = bubbleRegionStatPalette(region);
    return (
      `<div class="bubble-overview-region">` +
      `<div class="bubble-overview-region-head" style="color:${pal.head};">${label}</div>` +
      `<div class="bubble-compare-stats">` +
      bubbleStatCard("份额增长", st.growth, st.total, pal.growth, mode) +
      bubbleStatCard("份额稳定", st.stable, st.total, pal.stable, mode) +
      bubbleStatCard("份额下降", st.decline, st.total, pal.decline, mode) +
      bubbleStatCard("新兴增长", st.emerging, st.total, pal.emerging, mode) +
      bubbleStatCard("持续头部", st.leader, st.total, pal.leader, mode) +
      bubbleStatCard("纳入机构", st.total, st.total, pal.total, mode) +
      `</div></div>`
    );
  }

  function renderBubbleOverviewStats() {
    const host = d3.select(".s3-bubble .bubble-overview-stats");
    if (host.empty()) return;
    const mode = S.bubbleOverviewMode;
    const cnPts = bubbleScatterPoints().filter((d) => d.region === "china");
    const cePts = bubbleScatterPoints().filter((d) => d.region === "cee");
    host.html(
      buildBubbleRegionStatsBlock("中国", bubbleInstStats(cnPts), "china", mode) +
        buildBubbleRegionStatsBlock("中东欧", bubbleInstStats(cePts), "cee", mode)
    );
  }

  function bubbleTopListRows(region, mode) {
    const pts = bubbleScatterPoints().filter((d) => d.region === region);
    if (mode === "head") {
      const n = pts.length;
      return pts
        .slice()
        .sort((a, b) => d3.descending(bubbleMaxShare(a), bubbleMaxShare(b)))
        .slice(0, Math.min(15, n));
    }
    if (mode === "growth") {
      return pts
        .filter((d) => shareDelta(d) > 1e-10)
        .sort((a, b) => d3.descending(shareDelta(a), shareDelta(b)))
        .slice(0, 15);
    }
    if (mode === "decline") {
      return pts
        .filter((d) => shareDelta(d) < -1e-10)
        .sort((a, b) => d3.ascending(shareDelta(a), shareDelta(b)))
        .slice(0, 15);
    }
    return pts
      .slice()
      .sort((a, b) => d3.descending(Math.abs(shareDelta(a)), Math.abs(shareDelta(b))))
      .slice(0, 15);
  }

  function bubbleTopListIds() {
    if (S.bubbleRegionFilter === "all") return new Set();
    return new Set(bubbleTopListRows(S.bubbleRegionFilter, S.bubbleTopListMode).map((d) => d.id));
  }

  function renderBubbleTopListContent() {
    const host = d3.select(".s3-bubble .bubble-overview-stats");
    if (host.empty()) return;
    const region = S.bubbleRegionFilter;
    const rows = bubbleTopListRows(region, S.bubbleTopListMode);
    const maxShare = d3.max(rows, (d) => d.share_2020) || 1;
    const pal = bubbleRegionStatPalette(region);
    const modeLabel = {
      head: "头部机构",
      change: "份额变化",
      growth: "份额增长",
      decline: "份额下降"
    }[S.bubbleTopListMode];

    let html =
      `<div class="bubble-toplist-head" style="color:${pal.head};">${bubbleRegionLabel({ region })} · ${modeLabel} Top 15</div>` +
      `<div class="bubble-toplist-note">柱长 = 2016–2020 合作份额 · 点击条目在主图对应点显示光晕</div>` +
      `<div class="bubble-toplist">`;

    rows.forEach((d, i) => {
      const barW = maxShare ? (d.share_2020 / maxShare) * 100 : 0;
      const delta = shareDelta(d);
      const deltaColor = delta > 0 ? PANEL_GAIN : delta < 0 ? PANEL_LOSS : C.muted;
      const deltaTxt = `${delta >= 0 ? "+" : ""}${pct2(delta)}`;
      const active = S.bubbleSel && S.bubbleSel.id === d.id ? " is-active" : "";
      html +=
        `<button type="button" class="bubble-toplist-row${active}" data-id="${d.id}">` +
        `<span class="bubble-toplist-rank">${i + 1}</span>` +
        `<span class="bubble-toplist-body">` +
        `<span class="bubble-toplist-name" title="${instDisplayName(d)}">${instDisplayName(d)}</span>` +
        `<span class="bubble-toplist-bar-wrap"><span class="bubble-toplist-bar" style="width:${barW}%;background:${pal.total};"></span></span>` +
        `</span>` +
        `<span class="bubble-toplist-meta">` +
        `<span class="bubble-toplist-share">${pct2(d.share_2020)}</span>` +
        `<span class="bubble-toplist-delta" style="color:${deltaColor};">${deltaTxt}</span>` +
        `</span>` +
        `</button>`;
    });

    html += `</div>`;
    host.html(html);

    host.selectAll(".bubble-toplist-row").on("click", (ev) => {
      ev.stopPropagation();
      const id = d3.select(ev.currentTarget).attr("data-id");
      const d = data.byId.get(id);
      if (!d) return;
      S.bubbleSel = S.bubbleSel && S.bubbleSel.id === id ? null : d;
      updateBubbleSidePanel();
      syncBubbleFocus();
      syncBubbleTopListHighlightStyles();
      if (!S.bubbleSel) renderBubbleTopListContent();
    });
  }

  function syncBubbleOverviewHeadToggles() {
    const overview = d3.select(".s3-bubble .bubble-side-overview");
    if (overview.empty()) return;
    const isRegional = S.bubbleRegionFilter !== "all";
    overview.select(".bubble-overview-toggle--stats").style("display", isRegional ? "none" : "");
    overview.select(".bubble-overview-toggle--toplist").style("display", isRegional ? "" : "none");
  }

  function renderBubbleOverview() {
    syncBubbleOverviewHeadToggles();
    if (S.bubbleRegionFilter === "all") {
      syncBubbleOverviewToggleUI();
      renderBubbleOverviewStats();
    } else {
      syncBubbleTopListToggleUI();
      renderBubbleTopListContent();
    }
  }

  function syncBubbleTopListToggleUI() {
    d3.select(".s3-bubble .bubble-overview-toggle--toplist").selectAll(".macro-db-filter-btn").each(function () {
      const btn = d3.select(this);
      styleFilterBtn(btn, btn.attr("data-filter-val") === S.bubbleTopListMode);
    });
  }

  function setBubbleTopListMode(mode) {
    if (S.bubbleTopListMode === mode) return;
    S.bubbleTopListMode = mode;
    S.bubbleSel = null;
    hideTip();
    syncBubbleTopListToggleUI();
    renderBubbleTopListContent();
    updateBubbleSidePanel();
    resetBubbleZoom(false);
    renderBubbleMainChart(true);
  }

  function syncBubbleOverviewToggleUI() {
    d3.select(".s3-bubble .bubble-overview-toggle--stats").selectAll(".macro-db-filter-btn").each(function () {
      const btn = d3.select(this);
      styleFilterBtn(btn, btn.attr("data-filter-val") === S.bubbleOverviewMode);
    });
  }

  function setBubbleOverviewMode(mode) {
    if (S.bubbleOverviewMode === mode) return;
    S.bubbleOverviewMode = mode;
    syncBubbleOverviewToggleUI();
    renderBubbleOverviewStats();
  }

  function mountBubbleOverviewPanel(parent) {
    const overview = parent.append("div").attr("class", "bubble-side-card bubble-side-overview");
    const head = overview.append("div").attr("class", "bubble-overview-head");
    head.append("div").attr("class", "bubble-side-label").text("结构概览");
    appendFilterToggleGroup(
      head.append("div").attr("class", "bubble-overview-toggle bubble-overview-toggle--stats"),
      "",
      "overview",
      [
        { id: "count", text: "数字" },
        { id: "pct", text: "百分比" }
      ],
      S.bubbleOverviewMode,
      setBubbleOverviewMode
    );
    appendFilterToggleGroup(
      head.append("div").attr("class", "bubble-overview-toggle bubble-overview-toggle--toplist"),
      "",
      "toplist",
      [
        { id: "head", text: "头部机构" },
        { id: "change", text: "份额变化" },
        { id: "growth", text: "增长" },
        { id: "decline", text: "下降" }
      ],
      S.bubbleTopListMode,
      setBubbleTopListMode
    );
    overview.select(".bubble-overview-toggle--toplist").style("display", "none");
    overview.append("div").attr("class", "bubble-overview-stats bubble-overview-side");
    renderBubbleOverview();
  }

  function bubbleShareGrowthRate(d) {
    if (d.share_2015 <= 0) return d.share_2020 > 0 ? null : 0;
    return (d.share_2020 - d.share_2015) / d.share_2015;
  }

  function bubbleRankTrendLabel(d) {
    if (d.rank_change > 0) return "排名上升";
    if (d.rank_change < 0) return "排名下降";
    return "排名稳定";
  }

  function bubbleRankChangeText(d) {
    const rc = d.rank_change;
    if (rc > 0) return `上升 ${rc} 位`;
    if (rc < 0) return `下降 ${Math.abs(rc)} 位`;
    return "基本不变";
  }

  function bubbleShareChangeHtml(d) {
    const sg = shareDelta(d);
    if (Math.abs(sg) < 0.000005) {
      return `<span style="color:${C.muted};">0.00%</span>`;
    }
    const color = sg > 0 ? PANEL_GAIN : PANEL_LOSS;
    const sign = sg > 0 ? "+" : "";
    return `<span style="color:${color};font-weight:600;">${sign}${pct2(sg)}</span>`;
  }

  function bubbleShareGrowthRateHtml(d) {
    if (d.share_2015 <= 0 && d.share_2020 > 0) {
      return `<span style="color:${PANEL_GAIN};font-weight:600;">新增</span>`;
    }
    const rate = bubbleShareGrowthRate(d);
    if (rate === null) return "—";
    if (Math.abs(rate) < 0.00005) {
      return `<span style="color:${C.muted};">0.0%</span>`;
    }
    const color = rate > 0 ? PANEL_GAIN : PANEL_LOSS;
    const sign = rate > 0 ? "+" : "";
    return `<span style="color:${color};font-weight:600;">${sign}${pct(rate)}</span>`;
  }


  function buildMesoInstInsightHtml(d) {
    const accent = d.region === "china" ? C.china : C.cee;
    const r15 = bubbleRankLabel(d, "p15");
    const r20 = bubbleRankLabel(d, "p20");
    const mobLabel = mesoMobilityLabel(d);
    return (
      `<div class="bubble-insight-head">` +
      `<div class="bubble-annot-title" style="color:${accent};">${instDisplayName(d)}</div>` +
      `</div>` +
      `<div class="bubble-annot-body">` +
      `<div class="bubble-side-prose">` +
      `<p>${bubbleRegionLabel(d)} · ${countryDisplayName(d)} · ${mobLabel} · ${bubbleRankTrendLabel(d)}</p>` +
      `<p style="margin-top:10px;">` +
      `2011–2015 基准份额：${pct2(d.share_2015)}<br>` +
      `2016–2020 合作份额：${pct2(d.share_2020)}<br>` +
      `份额变化：${bubbleShareChangeHtml(d)}<br>` +
      `份额增速（相对基线）：${mesoShareGrowthRateHtml(d)}<br>` +
      `排名：${r15} → ${r20}<br>` +
      `排名变化：${bubbleRankChangeText(d)}<br>` +
      `论文数：${num(d.papers_2015)} → ${num(d.papers_2020)}` +
      `</p>` +
      `<p style="margin-top:10px;">${mesoTop15InstProse(d)}</p>` +
      `</div></div>`
    );
  }

  function buildBubbleInstInsightHtml(d) {
    const accent = bubbleRegionColor(d);
    const typeLabel = bubbleInstTypeLabel(d);
    const r15 = bubbleRankLabel(d, "p15");
    const r20 = bubbleRankLabel(d, "p20");
    return (
      `<div class="bubble-insight-head">` +
      `<div class="bubble-annot-title" style="color:${accent};">${instDisplayName(d)}</div>` +
      `</div>` +
      `<div class="bubble-annot-body">` +
      `<div class="bubble-side-prose">` +
      `<p>${bubbleRegionLabel(d)} · ${countryDisplayName(d)} · ${typeLabel} · ${bubbleRankTrendLabel(d)}</p>` +
      `<p style="margin-top:10px;">` +
      `机构类型：${typeLabel}<br>` +
      `原层级：${bubbleTierLabel(d.bin_2015)}<br>` +
      `现层级：${bubbleTierLabel(d.bin_2020)}<br>` +
      `2011–2015 合作份额：${pct2(d.share_2015)}<br>` +
      `2016–2020 合作份额：${pct2(d.share_2020)}<br>` +
      `份额变化：${bubbleShareChangeHtml(d)}<br>` +
      `份额增长率：${bubbleShareGrowthRateHtml(d)}<br>` +
      `排名：${r15} → ${r20}<br>` +
      `排名变化：${bubbleRankChangeText(d)}` +
      `</p>` +
      `<p style="margin-top:10px;">${bubbleInstTypeProse(d)}</p>` +
      `<p style="margin-top:8px;color:${C.muted};">点击空白处返回结构概览。</p>` +
      `</div></div>`
    );
  }

  function updateBubbleSidePanel() {
    const overview = d3.select(".s3-bubble .bubble-side-overview");
    const insight = d3.select(".s3-bubble .bubble-side-insight");
    if (overview.empty() || insight.empty()) return;

    const d = S.bubbleSel;
    if (d) {
      overview.style("display", "none");
      insight.style("display", "").html(buildBubbleInstInsightHtml(d));
    } else {
      overview.style("display", "");
      insight.style("display", "none");
      renderBubbleOverview();
    }
  }

  const BUBBLE_SEARCH_COLOR = "#7c3aed";

  function bubbleBgDotOpacity(d, topListIds, searchIds) {
    if (S.bubbleSel && S.bubbleSel.id === d.id) return 0.78;
    if (topListIds.has(d.id)) return 0.52;
    if (searchIds.has(d.id)) return 0.42;
    return 0.07;
  }

  function bubbleTopListHaloRadii(dotR, selected) {
    return {
      outer: dotR + (selected ? 12 : 9),
      inner: dotR + (selected ? 6 : 4)
    };
  }

  function bubbleTopListHaloOpacities(selected) {
    return selected ? { outer: 0.22, inner: 0.42 } : { outer: 0.16, inner: 0.3 };
  }

  function syncBubbleChartHighlights() {
    if (!bubbleChartCtx?.x0 || !bubbleChartCtx?.r) return;
    const synced = bubbleSyncedScales(bubbleChartCtx.currentTransform);
    refreshBubbleChartHighlights(synced.x, synced.y, bubbleChartCtx.r, null, bubbleChartCtx.hiIds);
  }

  function refreshBubbleChartHighlights(x, y, r, t, hiIds) {
    refreshBubbleSidebarHighlights(x, y, r, t, hiIds);
    refreshBubbleSearchHighlights(x, y, r, t, hiIds);
    refreshBubbleSearchHits(x, y, r, hiIds);
    if (!bubbleChartCtx?.bgG) return;
    const topListIds = bubbleTopListIds();
    const searchIds = bubbleSearchHighlightIds();
    const plotT = t || ((sel) => sel);
    plotT(bubbleChartCtx.bgG.selectAll(".bubble-dot-bg")).attr("opacity", (d) => bubbleBgDotOpacity(d, topListIds, searchIds));
  }

  function refreshBubbleSidebarHighlights(x, y, r, t, hiIds) {
    if (!bubbleChartCtx?.highlightG) return;
    const topListIds = bubbleTopListIds();
    const plotT = t || ((sel) => sel);

    if (!topListIds.size) {
      bubbleChartCtx.highlightG.selectAll("g.bubble-top-highlight").remove();
      return;
    }

    const data = bubblePointsForRegionFilter(S.bubbleRegionFilter).filter((d) => topListIds.has(d.id));
    const groups = bubbleChartCtx.highlightG
      .selectAll("g.bubble-top-highlight")
      .data(data, (d) => d.id)
      .join(
        (enter) => enter.append("g").attr("class", "bubble-top-highlight").attr("pointer-events", "none"),
        (update) => update,
        (exit) => exit.remove()
      );

    groups.each(function (d) {
      const g = d3.select(this);
      const dotR = bubbleDotRadius(d, r, hiIds);
      const selected = S.bubbleSel && S.bubbleSel.id === d.id;
      const radii = bubbleTopListHaloRadii(dotR, selected);
      const opacities = bubbleTopListHaloOpacities(selected);
      const cx = x(d.share_2015);
      const cy = y(d.share_2020);
      const fill = bubbleRegionColor(d);

      g.selectAll("circle.bubble-top-halo-outer")
        .data([0])
        .join(
          (enter) => enter.append("circle").attr("class", "bubble-top-halo-outer"),
          (update) => update,
          (exit) => exit.remove()
        )
        .call((sel) => {
          plotT(sel).attr("cx", cx).attr("cy", cy).attr("r", radii.outer).attr("fill", fill).attr("opacity", opacities.outer);
        });

      g.selectAll("circle.bubble-top-halo-inner")
        .data([0])
        .join(
          (enter) => enter.append("circle").attr("class", "bubble-top-halo-inner"),
          (update) => update,
          (exit) => exit.remove()
        )
        .call((sel) => {
          plotT(sel).attr("cx", cx).attr("cy", cy).attr("r", radii.inner).attr("fill", fill).attr("opacity", opacities.inner);
        });
    });
  }

  function refreshBubbleSearchHighlights(x, y, r, t, hiIds) {
    if (!bubbleChartCtx?.searchHighlightG) return;
    const searchIds = bubbleSearchHighlightIds();
    const plotT = t || ((sel) => sel);
    if (!searchIds.size) {
      bubbleChartCtx.searchHighlightG.selectAll("g.bubble-search-highlight").remove();
      return;
    }

    const data = bubblePointsForRegionFilter(S.bubbleRegionFilter).filter((d) => searchIds.has(d.id));
    const groups = bubbleChartCtx.searchHighlightG
      .selectAll("g.bubble-search-highlight")
      .data(data, (d) => d.id)
      .join(
        (enter) => enter.append("g").attr("class", "bubble-search-highlight").attr("pointer-events", "none"),
        (update) => update,
        (exit) => exit.remove()
      );

    groups.each(function (d) {
      const g = d3.select(this);
      const dotR = bubbleDotRadius(d, r, hiIds);
      const selected = S.bubbleSel && S.bubbleSel.id === d.id;
      const radii = bubbleTopListHaloRadii(dotR, selected);
      const opacities = bubbleTopListHaloOpacities(selected);
      const cx = x(d.share_2015);
      const cy = y(d.share_2020);

      g.selectAll("circle.bubble-search-halo-outer")
        .data([0])
        .join(
          (enter) => enter.append("circle").attr("class", "bubble-search-halo-outer"),
          (update) => update,
          (exit) => exit.remove()
        )
        .call((sel) => {
          plotT(sel)
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", radii.outer)
            .attr("fill", BUBBLE_SEARCH_COLOR)
            .attr("opacity", opacities.outer);
        });

      g.selectAll("circle.bubble-search-halo-inner")
        .data([0])
        .join(
          (enter) => enter.append("circle").attr("class", "bubble-search-halo-inner"),
          (update) => update,
          (exit) => exit.remove()
        )
        .call((sel) => {
          plotT(sel)
            .attr("cx", cx)
            .attr("cy", cy)
            .attr("r", radii.inner)
            .attr("fill", BUBBLE_SEARCH_COLOR)
            .attr("opacity", opacities.inner);
        });
    });
  }

  function bindBubbleSearchHitEvents(selection) {
    selection
      .style("cursor", "pointer")
      .on("click", (ev, d) => {
        ev.stopPropagation();
        selectBubbleInstitution(S.bubbleSel && S.bubbleSel.id === d.id ? null : d);
      });
  }

  function refreshBubbleSearchHits(x, y, r, hiIds) {
    if (!bubbleChartCtx?.searchHitG) return;
    const searchIds = bubbleSearchHighlightIds();
    if (!searchIds.size) {
      bubbleChartCtx.searchHitG.selectAll("circle").remove();
      return;
    }
    const hi = hiIds || bubbleChartCtx.hiIds || new Set();
    const data = bubblePointsForRegionFilter(S.bubbleRegionFilter).filter((d) => searchIds.has(d.id) && !hi.has(d.id));
    bubbleChartCtx.searchHitG
      .selectAll("circle.bubble-search-hit")
      .data(data, (d) => d.id)
      .join(
        (enter) => {
          const hit = enter
            .append("circle")
            .attr("class", "bubble-search-hit")
            .attr("fill", "transparent")
            .attr("stroke", "none");
          bindBubbleSearchHitEvents(hit);
          return hit;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .attr("cx", (d) => x(d.share_2015))
      .attr("cy", (d) => y(d.share_2020))
      .attr("r", (d) => bubbleDotRadius(d, r, hi) + 5);
  }

  function syncBubbleTopListHighlightStyles() {
    syncBubbleChartHighlights();
  }

  function refreshBubbleTopListHighlight(x, y, r, t, hiIds) {
    refreshBubbleChartHighlights(x, y, r, t, hiIds);
  }

  function bubbleSyncedScales(transform) {
    if (!bubbleChartCtx?.x0 || !bubbleChartCtx?.y0) return null;
    const x = transform ? transform.rescaleX(bubbleChartCtx.x0) : bubbleChartCtx.x0;
    const y = bubbleChartCtx.y0.copy().domain(x.domain());
    return { x, y };
  }

  function bubbleUpdateDiagonal(x, y, t) {
    if (!bubbleChartCtx?.diagLine) return;
    const plotT = t || ((sel) => sel);
    const [d0, d1] = x.domain();
    const tLo = Math.max(Math.min(d0, d1), 0);
    const tHi = Math.max(d0, d1);
    if (tLo >= tHi || !Number.isFinite(tLo) || !Number.isFinite(tHi)) {
      plotT(bubbleChartCtx.diagLine).attr("opacity", 0);
      plotT(bubbleChartCtx.diagText).attr("opacity", 0);
      return;
    }
    const tLabel = tLo + (tHi - tLo) * 0.72;
    plotT(bubbleChartCtx.diagLine)
      .attr("opacity", 0.85)
      .attr("x1", x(tLo))
      .attr("y1", y(tLo))
      .attr("x2", x(tHi))
      .attr("y2", y(tHi));
    plotT(bubbleChartCtx.diagText)
      .attr("opacity", 1)
      .attr("x", x(tLabel))
      .attr("y", y(tLabel) - 6);
  }

  function bubbleApplyAxes(x, y, t) {
    if (!bubbleChartCtx) return;
    const axisT = t || ((sel) => sel);
    const { ih, iw } = bubbleChartCtx;

    axisT(bubbleChartCtx.gridXAxisG)
      .call(bubbleShareGridAxis(x, "bottom", -ih))
      .call(bubbleStyleGridAxis);
    axisT(bubbleChartCtx.gridYAxisG)
      .call(bubbleShareGridAxis(y, "left", -iw))
      .call(bubbleStyleGridAxis);

    axisT(bubbleChartCtx.xAxisG)
      .call(bubbleShareLabelAxis(x, "bottom"))
      .call(bubbleStyleLabelAxis);
    axisT(bubbleChartCtx.yAxisG)
      .call(bubbleShareLabelAxis(y, "left"))
      .call(bubbleStyleLabelAxis);
  }

  function bubbleApplyPlotGeometry(x, y, r, t, topListIds, hiIds) {
    if (!bubbleChartCtx) return;
    const plotT = t || ((sel) => sel);
    const searchIds = bubbleSearchHighlightIds();
    bubbleUpdateDiagonal(x, y, t);

    plotT(bubbleChartCtx.bgG.selectAll("circle"))
      .attr("cx", (d) => x(d.share_2015))
      .attr("cy", (d) => y(d.share_2020))
      .attr("r", (d) => bubbleDotRadius(d, r, hiIds))
      .attr("opacity", (d) => bubbleBgDotOpacity(d, topListIds, searchIds));

    plotT(bubbleChartCtx.fgG.selectAll("circle"))
      .attr("cx", (d) => x(d.share_2015))
      .attr("cy", (d) => y(d.share_2020))
      .attr("r", (d) => bubbleDotRadius(d, r, hiIds));

    refreshBubbleChartHighlights(x, y, r, t, hiIds);
  }

  function bubbleHandleZoom(event) {
    if (!bubbleChartCtx?.x0 || !bubbleChartCtx?.y0) return;
    bubbleChartCtx.plotG.attr("transform", null);
    bubbleChartCtx.currentTransform =
      event.transform.k === 1 && event.transform.x === 0 && event.transform.y === 0 ? null : event.transform;
    const synced = bubbleSyncedScales(event.transform);
    if (!synced) return;
    const { x, y } = synced;
    bubbleApplyAxes(x, y);
    bubbleApplyPlotGeometry(
      x,
      y,
      bubbleChartCtx.r,
      null,
      bubbleChartCtx.topListIds || new Set(),
      bubbleChartCtx.hiIds || new Set()
    );
    syncBubbleTopListHighlightStyles();
  }

  function resetBubbleZoom(animate) {
    if (!bubbleChartCtx?.zoomG || !bubbleChartCtx?.zoom) return;
    bubbleChartCtx.currentTransform = null;
    const dur = animate ? C.dur : 0;
    const target = bubbleChartCtx.zoomG;
    if (dur) target.transition().duration(dur).call(bubbleChartCtx.zoom.transform, d3.zoomIdentity);
    else target.call(bubbleChartCtx.zoom.transform, d3.zoomIdentity);
  }

  function bubbleZoomBy(factor) {
    if (!bubbleChartCtx?.zoomG || !bubbleChartCtx?.zoom) return;
    bubbleChartCtx.zoomG.transition().duration(200).call(bubbleChartCtx.zoom.scaleBy, factor);
  }

  function mountBubbleZoomControls(parent) {
    const ctrl = parent
      .append("div")
      .attr("class", "bubble-zoom-ctrl")
      .style("display", "inline-flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("font-size", "11px")
      .style("color", C.muted);

    ctrl.append("span").attr("class", "bubble-zoom-hint").text("滚轮缩放 · 拖拽平移");

    const btnWrap = ctrl.append("div").attr("class", "bubble-zoom-btns");
    [
      { label: "−", title: "缩小", fn: () => bubbleZoomBy(1 / 1.35) },
      { label: "+", title: "放大", fn: () => bubbleZoomBy(1.35) },
      { label: "重置", title: "重置视图", fn: () => resetBubbleZoom(true) }
    ].forEach(({ label, title, fn }) => {
      btnWrap
        .append("button")
        .attr("type", "button")
        .attr("class", "bubble-zoom-btn")
        .attr("title", title)
        .text(label)
        .on("click", (ev) => {
          ev.stopPropagation();
          fn();
        });
    });
  }

  function bubbleMaxShare(d) {
    return Math.max(d.share_2015, d.share_2020);
  }

  function bubbleShareMag(d) {
    return Math.abs(shareDelta(d));
  }

  function bubblePointsForRegionFilter(filter) {
    const pts = bubbleScatterPoints();
    if (filter === "china") return pts.filter((d) => d.region === "china");
    if (filter === "cee") return pts.filter((d) => d.region === "cee");
    return pts;
  }

  function bubbleHighlightedIds(points) {
    const ids = new Set();
    [...new Set(points.map((d) => d.region))].forEach((region) => {
      const rp = points.filter((d) => d.region === region);
      const n = rp.length;
      if (!n) return;

      rp.slice()
        .sort((a, b) => d3.descending(bubbleMaxShare(a), bubbleMaxShare(b)))
        .slice(0, Math.min(15, n))
        .forEach((d) => ids.add(d.id));

      rp.filter((d) => shareDelta(d) > 1e-10)
        .sort((a, b) => d3.descending(shareDelta(a), shareDelta(b)))
        .slice(0, 15)
        .forEach((d) => ids.add(d.id));

      rp.filter((d) => shareDelta(d) < -1e-10)
        .sort((a, b) => d3.ascending(shareDelta(a), shareDelta(b)))
        .slice(0, 15)
        .forEach((d) => ids.add(d.id));
    });
    return ids;
  }

  function bubbleAxisMax(points) {
    const maxVal = Math.max(
      d3.max(points, (d) => d.share_2015) || 0,
      d3.max(points, (d) => d.share_2020) || 0,
      1e-8
    );
    return maxVal * 1.08;
  }

  function bubbleSymlogConstant(axisMax) {
    return Math.max(axisMax * 0.02, 1e-6);
  }

  function bubbleShareTickLabel(v) {
    if (Math.abs(v) < 1e-12) return "0";
    const abs = Math.abs(v);
    if (abs < 0.0001) return d3.format(".4%")(v);
    if (abs < 0.001) return d3.format(".3%")(v);
    if (abs < 0.01) return d3.format(".2%")(v);
    return pct(v);
  }

  function bubbleShareGridAxis(scale, orient, tickSize) {
    const axis = orient === "bottom" ? d3.axisBottom(scale) : d3.axisLeft(scale);
    return axis.ticks(8).tickSize(tickSize).tickFormat("");
  }

  function bubbleShareLabelAxis(scale, orient) {
    const axis = orient === "bottom" ? d3.axisBottom(scale) : d3.axisLeft(scale);
    return axis
      .ticks(8)
      .tickSizeOuter(4)
      .tickSizeInner(0)
      .tickPadding(8)
      .tickFormat(bubbleShareTickLabel);
  }

  function bubbleStyleGridAxis(sel) {
    sel.select(".domain").remove();
    sel.selectAll(".tick line").attr("stroke", "#e2e8f0");
    sel.selectAll(".tick text").remove();
  }

  function bubbleStyleLabelAxis(sel) {
    sel.select(".domain").remove();
    sel.selectAll(".tick line").attr("stroke", "#cbd5e1").attr("stroke-width", 1);
    sel
      .selectAll(".tick text")
      .attr("fill", C.muted)
      .attr("font-size", 10)
      .attr("font-family", C.font)
      .attr("clip-path", null);
  }

  function makeBubbleScales(points, iw, ih) {
    const axisMax = bubbleAxisMax(points);
    const constant = bubbleSymlogConstant(axisMax);
    const x = d3.scaleSymlog().constant(constant).domain([0, axisMax]).range([0, iw]);
    const y = d3.scaleSymlog().constant(constant).domain([0, axisMax]).range([ih, 0]);
    const maxMag = Math.max(d3.max(points, bubbleShareMag) || 0, 1e-10);
    const r = d3.scaleSqrt().domain([0, maxMag]).range([3, 14]);
    return { x, y, r, axisMax, maxMag };
  }

  let bubbleChartCtx = null;

  function syncBubbleRegionFilterUI() {
    d3.select(".s3-bubble .bubble-region-filter-toggle").selectAll(".macro-db-filter-btn").each(function () {
      const btn = d3.select(this);
      styleFilterBtn(btn, btn.attr("data-filter-val") === S.bubbleRegionFilter);
    });
  }

  function setBubbleRegionFilter(value) {
    if (S.bubbleRegionFilter === value) return;
    S.bubbleRegionFilter = value;
    S.bubbleSel = null;
    S.bubbleHover = null;
    hideTip();
    clearBubbleSearch();
    updateBubbleSidePanel();
    syncBubbleRegionFilterUI();
    renderBubbleOverview();
    resetBubbleZoom(false);
    renderBubbleMainChart(true);
  }

  function renderBubbleMainLegend(fgCount, bgCount) {
    if (!bubbleChartCtx?.leg) return;
    const leg = bubbleChartCtx.leg;
    leg.html("");

    const items =
      S.bubbleRegionFilter === "all"
        ? [
            { label: "中国", color: C.china },
            { label: "中东欧", color: C.cee }
          ]
        : S.bubbleRegionFilter === "china"
          ? [{ label: "中国", color: C.china }]
          : [{ label: "中东欧", color: C.cee }];

    items.forEach(({ label, color }) => {
      leg
        .append("span")
        .html(
          `<span style="display:inline-flex;align-items:center;gap:4px;">` +
            `<span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>` +
            `<span>${label}</span></span>`
        );
    });

    leg
      .append("span")
      .attr("class", "bubble-main-stats")
      .style("margin-left", "6px")
      .style("color", C.muted)
      .text(`突出 ${fgCount} 所 · 背景 ${bgCount} 所`);
  }

  function bindBubbleFgEvents(selection) {
    selection
      .style("cursor", "pointer")
      .on("mouseenter", (ev, d) => {
        S.bubbleHover = d;
        syncBubbleFocus();
        const rc = d.rank_change;
        const rcTxt = rc > 0 ? `↑${rc}` : rc < 0 ? `↓${Math.abs(rc)}` : "—";
        showTip(
          ev,
          tipTitleHtml(instDisplayName(d), bubbleRegionColor(d)) +
            tipRowHtml("区域", bubbleRegionLabel(d)) +
            tipRowHtml("国家", countryDisplayName(d)) +
            tipRowHtml("类型", bubbleInstTypeLabel(d), "font-weight:600;") +
            tipRowHtml("2011–2015 份额", pct2(d.share_2015), "font-weight:600;") +
            tipRowHtml("2016–2020 份额", pct2(d.share_2020), `font-weight:600;color:${TIP.hi};`) +
            tipRowHtml("份额变化", `${shareDelta(d) >= 0 ? "+" : ""}${pct2(shareDelta(d))}`) +
            tipRowHtml("排名", `${bubbleRankLabel(d, "p15")} → ${bubbleRankLabel(d, "p20")}`) +
            tipRowHtml("排名变化", rcTxt)
        );
      })
      .on("mousemove", moveTip)
      .on("mouseleave", () => {
        hideTip();
        S.bubbleHover = null;
        syncBubbleFocus();
      })
      .on("click", (ev, d) => {
        ev.stopPropagation();
        if (S.bubbleSel && S.bubbleSel.id === d.id) {
          S.bubbleSel = null;
        } else {
          S.bubbleSel = d;
        }
        updateBubbleSidePanel();
        syncBubbleFocus();
        syncBubbleTopListHighlightStyles();
        if (!S.bubbleSel && S.bubbleRegionFilter !== "all") renderBubbleTopListContent();
      });
  }

  function renderBubbleMainChart(animate) {
    if (!bubbleChartCtx) return;

    const dur = animate ? C.dur : 0;
    const points = bubblePointsForRegionFilter(S.bubbleRegionFilter);
    const hiIds = bubbleHighlightedIds(points);
    const fg = points.filter((d) => hiIds.has(d.id));
    const bg = points.filter((d) => !hiIds.has(d.id));
    const { x, y, r, axisMax } = makeBubbleScales(points, bubbleChartCtx.iw, bubbleChartCtx.ih);
    const topListIds = bubbleTopListIds();
    const t = (sel) => (animate ? sel.transition().duration(dur) : sel);

    bubbleChartCtx.x0 = x;
    bubbleChartCtx.y0 = y;
    bubbleChartCtx.r = r;
    bubbleChartCtx.axisMax = axisMax;
    bubbleChartCtx.hiIds = hiIds;
    bubbleChartCtx.topListIds = topListIds;
    const searchIds = bubbleSearchHighlightIds();

    const synced = bubbleSyncedScales(bubbleChartCtx.currentTransform);
    const zx = synced.x;
    const zy = synced.y;

    bubbleApplyAxes(zx, zy, t);

    bubbleChartCtx.bgG
      .selectAll("circle")
      .data(bg, (d) => d.id)
      .join(
        (enter) =>
          enter
            .append("circle")
            .attr("class", "bubble-dot-bg")
            .attr("fill", (d) => bubbleRegionColor(d))
            .attr("stroke", "none")
            .attr("pointer-events", "none")
            .attr("cx", (d) => zx(d.share_2015))
            .attr("cy", (d) => zy(d.share_2020))
            .attr("r", (d) => bubbleDotRadius(d, r, hiIds))
            .attr("opacity", 0.07),
        (update) => update,
        (exit) => exit.remove()
      )
      .call((sel) => {
        t(sel)
          .attr("cx", (d) => zx(d.share_2015))
          .attr("cy", (d) => zy(d.share_2020))
          .attr("r", (d) => bubbleDotRadius(d, r, hiIds))
          .attr("fill", (d) => bubbleRegionColor(d))
          .attr("opacity", (d) => bubbleBgDotOpacity(d, topListIds, searchIds));
      });

    bubbleChartCtx.fgG
      .selectAll("circle")
      .data(fg, (d) => d.id)
      .join(
        (enter) => {
          const dot = enter
            .append("circle")
            .attr("class", "bubble-dot-fg")
            .attr("data-id", (d) => d.id)
            .attr("fill", (d) => bubbleRegionColor(d))
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.8)
            .attr("cx", (d) => zx(d.share_2015))
            .attr("cy", (d) => zy(d.share_2020))
            .attr("r", (d) => bubbleDotRadius(d, r, hiIds))
            .attr("opacity", 0.72);
          bindBubbleFgEvents(dot);
          return dot;
        },
        (update) => update,
        (exit) => exit.remove()
      )
      .call((sel) => {
        t(sel)
          .attr("cx", (d) => zx(d.share_2015))
          .attr("cy", (d) => zy(d.share_2020))
          .attr("r", (d) => bubbleDotRadius(d, r, hiIds))
          .attr("fill", (d) => bubbleRegionColor(d));
      });

    bubbleUpdateDiagonal(zx, zy, t);

    renderBubbleMainLegend(fg.length, bg.length);
    refreshBubbleTopListHighlight(zx, zy, r, t, hiIds);
    syncBubbleFocus();
  }

  function syncBubbleFocus() {
    const focus = S.bubbleSel || S.bubbleHover;
    const topListIds = bubbleTopListIds();
    const searchIds = bubbleSearchHighlightIds();
    d3.selectAll(".bubble-dot-fg").each(function () {
      const el = d3.select(this);
      const id = el.attr("data-id");
      const active = focus && focus.id === id;
      const inTopList = topListIds.has(id);
      const inSearch = searchIds.has(id);
      const highlighted = inTopList || inSearch;
      el.transition()
        .duration(C.dur)
        .attr("opacity", focus ? (active ? 1 : highlighted ? 0.62 : 0.12) : highlighted ? 0.96 : 0.72)
        .attr("stroke-width", active ? 3 : highlighted ? 2.5 : 0.8)
        .attr("stroke", "#fff");
    });
  }

  function drawBubbleScatter(parent, w) {
    S.bubbleHover = null;
    S.bubbleSel = null;
    bubbleChartCtx = null;

    const { card } = section(parent, "s3-bubble", IL_SECTIONS.bubble);
    const sideW = 290;
    const layoutGap = 18;
    const mainPadX = 40;
    const stackLayout = w < 900;
    const mainColW = stackLayout ? w : w - sideW - layoutGap;
    const chartW = Math.max(320, mainColW - mainPadX);
    const h = 520;
    const m = { t: 24, r: 20, b: 64, l: 62 };

    const wrap = card.append("div").attr("class", "bubble-wrap");
    const top = wrap.append("div").attr("class", "bubble-top");
    const main = top.append("div").attr("class", "bubble-main");

    const filterBar = main
      .append("div")
      .attr("class", "bubble-region-filter-bar")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("justify-content", "space-between")
      .style("gap", "8px 12px")
      .style("margin-bottom", "10px");

    appendFilterToggleGroup(
      filterBar.append("div").attr("class", "bubble-region-filter-toggle"),
      "",
      "region",
      [
        { id: "all", text: "全部机构" },
        { id: "china", text: "中国" },
        { id: "cee", text: "中东欧" }
      ],
      S.bubbleRegionFilter,
      setBubbleRegionFilter
    );

    mountBubbleInstSearch(filterBar);
    mountBubbleZoomControls(filterBar);

    const chartCol = main.append("div").attr("class", "bubble-chart-col");

    const side = top.append("div").attr("class", "bubble-side");
    mountBubbleOverviewPanel(side);
    side
      .append("div")
      .attr("class", "bubble-side-card bubble-side-insight")
      .style("display", "none");

    const iw = chartW - m.l - m.r;
    const ih = h - m.t - m.b;

    const svg = chartCol
      .append("svg")
      .attr("width", "100%")
      .attr("height", h)
      .attr("viewBox", `0 0 ${chartW} ${h}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("display", "block")
      .style("background", C.bg);

    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);

    g.append("defs")
      .append("clipPath")
      .attr("id", "bubble-plot-clip")
      .append("rect")
      .attr("width", iw)
      .attr("height", ih)
      .attr("rx", 8);

    g.append("rect")
      .attr("width", iw)
      .attr("height", ih)
      .attr("fill", "#f8fafc")
      .attr("rx", 8);

    const xAxisG = g.append("g").attr("class", "bubble-axis-x").attr("transform", `translate(0,${ih})`);
    const yAxisG = g.append("g").attr("class", "bubble-axis-y");

    const plotG = g.append("g").attr("class", "bubble-plot").attr("clip-path", "url(#bubble-plot-clip)");
    const gridXAxisG = plotG.append("g").attr("class", "bubble-grid-x").attr("transform", `translate(0,${ih})`);
    const gridYAxisG = plotG.append("g").attr("class", "bubble-grid-y");

    const diagLine = plotG
      .append("line")
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "5,4")
      .attr("opacity", 0.85);

    const diagText = plotG
      .append("text")
      .attr("fill", C.muted)
      .attr("font-size", 10)
      .attr("font-family", C.font)
      .text("y = x");

    const bgG = plotG.append("g").attr("class", "bubble-bg-layer");
    const highlightG = plotG.append("g").attr("class", "bubble-highlight-layer");
    const searchHighlightG = plotG.append("g").attr("class", "bubble-search-highlight-layer");
    const fgG = plotG.append("g").attr("class", "bubble-fg-layer");
    const searchHitG = plotG.append("g").attr("class", "bubble-search-hit-layer");

    const zoomSurface = plotG
      .insert("rect", ":first-child")
      .attr("class", "bubble-zoom-surface")
      .attr("width", iw)
      .attr("height", ih)
      .attr("fill", "transparent")
      .style("cursor", "grab");

    const xTitle = g
      .append("text")
      .attr("class", "bubble-axis-title bubble-axis-title-x")
      .attr("x", iw / 2)
      .attr("y", ih + 38)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "10px")
      .style("font-family", C.font);
    xTitle.append("tspan").attr("x", iw / 2).attr("dy", 0).text("2011–2015 结构份额");
    xTitle
      .append("tspan")
      .attr("x", iw / 2)
      .attr("dy", "1.25em")
      .attr("fill", C.label)
      .style("font-size", "9px")
      .text("对称对数刻度 · 刻度值为原始份额");

    const yTitle = g
      .append("text")
      .attr("class", "bubble-axis-title bubble-axis-title-y")
      .attr("transform", `translate(${-50},${ih / 2}) rotate(-90)`)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "10px")
      .style("font-family", C.font);
    yTitle.append("tspan").attr("x", 0).attr("dy", 0).text("2016–2020 结构份额");
    yTitle
      .append("tspan")
      .attr("x", 0)
      .attr("dy", "1.25em")
      .attr("fill", C.label)
      .style("font-size", "9px")
      .text("对称对数刻度 · 刻度值为原始份额");

    const leg = main
      .append("div")
      .attr("class", "bubble-legend")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "8px 14px")
      .style("align-items", "center")
      .style("margin-top", "10px")
      .style("font-size", "10px")
      .style("color", C.muted)
      .style("font-family", C.font);

    bubbleChartCtx = {
      g,
      plotG,
      gridXAxisG,
      gridYAxisG,
      bgG,
      highlightG,
      searchHighlightG,
      fgG,
      searchHitG,
      zoomSurface,
      svg,
      xAxisG,
      yAxisG,
      diagLine,
      diagText,
      iw,
      ih,
      leg,
      x0: null,
      y0: null,
      r: null,
      axisMax: null,
      hiIds: null,
      topListIds: null,
      currentTransform: null,
      zoom: null,
      zoomG: null
    };

    const zoom = d3
      .zoom()
      .scaleExtent([1, 12])
      .extent([
        [0, 0],
        [iw, ih]
      ])
      .translateExtent([
        [-iw, -ih],
        [iw * 2, ih * 2]
      ])
      .filter((event) => {
        if (event.type === "wheel") return true;
        if (event.type === "mousedown") {
          const cls = event.target?.classList;
          if (cls?.contains("bubble-dot-fg") || cls?.contains("bubble-search-hit")) return false;
          return event.button === 0;
        }
        return false;
      })
      .on("start", () => {
        zoomSurface.style("cursor", "grabbing");
      })
      .on("zoom", bubbleHandleZoom)
      .on("end", () => {
        zoomSurface.style("cursor", "grab");
      });

    bubbleChartCtx.zoom = zoom;
    bubbleChartCtx.zoomG = plotG;
    plotG.call(zoom).on("dblclick.zoom", null);

    zoomSurface.on("click", (ev) => {
      if (ev.defaultPrevented) return;
      S.bubbleSel = null;
      S.bubbleHover = null;
      syncBubbleFocus();
      updateBubbleSidePanel();
      syncBubbleTopListHighlightStyles();
    });

    zoomSurface.on("dblclick", (ev) => {
      ev.stopPropagation();
      resetBubbleZoom(true);
    });

    wrap
      .append("div")
      .attr("class", "bubble-side-card bubble-guide")
      .html(buildBubbleGuideHtml());

    syncBubbleRegionFilterUI();
    renderBubbleMainChart(false);
  }

  // ─── SECTION 4: MESO ───────────────────────────────────────────────────────
  let mesoG = null;
  let mesoSvg = null;
  let mesoSec = null;
  let mesoPowG = null;
  let mesoChartWrap = null;

  const MESO_PANEL_W = 228;
  const MESO_LAYOUT_GAP = 12;
  const MESO_CENTER_GAP = 10;
  const MESO_SIDE_LAYOUT_MIN = 860;
  const MESO_RATE_LABEL_GUTTER = 46;

  function powerShiftChangeColor(d) {
    return mesoMobilityColor(d);
  }

  function powerShiftMaxRate() {
    const rows = [...mesoTop15Rows("china"), ...mesoTop15Rows("cee")];
    return (
      d3.max(rows, (d) => {
        const rate = mesoShareGrowthRate(d);
        if (rate === null || !Number.isFinite(rate)) return 0;
        return Math.abs(rate);
      }) || 0.01
    );
  }

  function mesoRateLabelAnchor(d, centerX, wBar, rate, panelLeft, panelRight) {
    const pad = 5;
    const minX = panelLeft + 4;
    const maxX = panelRight - 4;
    if (rate === null) return { x: Math.min(centerX + pad, maxX - 28), anchor: "start" };
    let x;
    let anchor;
    if (wBar > 0.3) {
      if (rate >= 0) {
        x = centerX + wBar + pad;
        anchor = "start";
      } else {
        x = centerX - wBar - pad;
        anchor = "end";
      }
    } else if (rate < 0) {
      x = centerX - pad;
      anchor = "end";
    } else {
      x = centerX + pad;
      anchor = "start";
    }
    if (anchor === "start") x = Math.min(x, maxX - 30);
    else x = Math.max(x, minX + 30);
    return { x, anchor };
  }

  function appendPowerShiftBar(row, part, fill, opacity, x, y, w, h) {
    if (w <= 0.3) return;
    row
      .append("rect")
      .attr("class", "meso-bar")
      .attr("data-mode", "trans")
      .attr("data-part", part)
      .attr("data-base-fill", fill)
      .attr("data-base-opacity", opacity)
      .attr("x", x)
      .attr("y", y)
      .attr("width", w)
      .attr("height", h)
      .attr("fill", fill)
      .attr("opacity", opacity)
      .attr("rx", 1)
      .style("pointer-events", "none");
  }

  function drawMesoRegionAxis(g, centerX, plotH) {
    g.append("line")
      .attr("class", "ps-region-axis")
      .attr("x1", centerX)
      .attr("x2", centerX)
      .attr("y1", 0)
      .attr("y2", plotH)
      .attr("stroke", C.border)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,4")
      .attr("opacity", 0.65)
      .style("pointer-events", "none");

    g.append("text")
      .attr("class", "meso-axis-dir meso-axis-dir-left")
      .attr("x", centerX - 8)
      .attr("y", -8)
      .attr("text-anchor", "end")
      .text("← 负增速");

    g.append("text")
      .attr("class", "meso-axis-dir meso-axis-dir-right")
      .attr("x", centerX + 8)
      .attr("y", -8)
      .attr("text-anchor", "start")
      .text("正增速 →");

    g.append("text")
      .attr("class", "meso-axis-baseline")
      .attr("x", centerX)
      .attr("y", plotH + 16)
      .attr("text-anchor", "middle")
      .text("增速 0");
  }

  function drawPowerShiftSide(g, rows, region, layout, xScale) {
    const { plotH, centerX, rankW, nameW, panelLeft, panelRight } = layout;
    const rowH = plotH / TOP_N;
    const barH = Math.max(14, rowH * 0.56);
    const nameX = panelLeft + rankW + 4;
    const rankX = panelLeft + rankW / 2;

    for (let i = 0; i < rows.length; i++) {
      g.append("text")
        .attr("class", "meso-rank-axis")
        .attr("x", rankX)
        .attr("y", (i + 0.5) * rowH)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .text(rows[i].rank_2020 || i + 1);
    }

    const groups = g
      .selectAll(`.ps-${region}`)
      .data(rows, (d) => d.id)
      .join("g")
      .attr("class", `ps-${region} inst-entity`)
      .attr("data-id", (d) => d.id)
      .attr("data-region", region)
      .attr("transform", (d, i) => `translate(0,${i * rowH})`);

    groups.each(function (d) {
      const row = d3.select(this);
      const cy = rowH / 2;
      const rate = mesoShareGrowthRate(d);
      const wBar = rate !== null && Number.isFinite(rate) ? xScale(Math.abs(rate)) : 0;
      const changeFill = powerShiftChangeColor(d);
      const yBar = cy - barH / 2;

      row
        .append("rect")
        .attr("class", "meso-hit")
        .attr("x", panelLeft)
        .attr("y", 0)
        .attr("width", panelRight - panelLeft)
        .attr("height", rowH)
        .attr("fill", "transparent")
        .style("pointer-events", "all");

      if (rate !== null && wBar > 0.3) {
        if (rate >= 0) {
          appendPowerShiftBar(row, "change", changeFill, 0.92, centerX, yBar, wBar, barH);
        } else {
          appendPowerShiftBar(row, "change", changeFill, 0.9, centerX - wBar, yBar, wBar, barH);
        }
      }

      row
        .append("text")
        .attr("class", "meso-lbl")
        .attr("x", nameX)
        .attr("y", cy)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", C.text)
        .attr("title", instDisplayName(d))
        .text(instShortDisplayName(d));
      mesoLabelStyle(row.select(".meso-lbl"));

      const rateFill = mesoShareGrowthRateColor(d);
      const ratePos = mesoRateLabelAnchor(d, centerX, wBar, rate, panelLeft, panelRight);
      row
        .append("text")
        .attr("class", "meso-rate-lbl")
        .attr("x", ratePos.x)
        .attr("y", cy)
        .attr("text-anchor", ratePos.anchor)
        .attr("dominant-baseline", "middle")
        .attr("fill", rateFill)
        .style("pointer-events", "none")
        .text(fmtMesoGrowthRate(mesoShareGrowthRate(d), d));
    });

    bindInst(groups);
    return groups;
  }

  function mesoRegionLayout(panelLeft, panelRight, plotH, rankW, nameW) {
    const barAreaLeft = panelLeft + rankW + nameW + 6;
    const barAreaRight = panelRight - MESO_RATE_LABEL_GUTTER;
    const centerX = (barAreaLeft + barAreaRight) / 2;
    const halfSpan = (barAreaRight - barAreaLeft) / 2;
    const barMaxW = Math.max(28, halfSpan - MESO_RATE_LABEL_GUTTER);
    return { plotH, centerX, barMaxW, rankW, nameW, panelLeft, panelRight, barAreaLeft, barAreaRight };
  }

  function drawPowerShiftView(g, plotH, chartW) {
    const margin = 24;
    const centerGap = MESO_CENTER_GAP;
    const plotW = chartW - 2 * margin;
    const halfW = (plotW - centerGap) / 2;
    const rankW = 20;
    const nameW = 108;

    const chinaPanelLeft = margin;
    const chinaPanelRight = margin + halfW;
    const ceePanelLeft = margin + halfW + centerGap;
    const ceePanelRight = margin + plotW;

    const maxRate = powerShiftMaxRate();
    const xScale = d3.scaleLinear().domain([0, maxRate * 1.06]).range([0, mesoRegionLayout(chinaPanelLeft, chinaPanelRight, plotH, rankW, nameW).barMaxW]);

    const chinaLayout = mesoRegionLayout(chinaPanelLeft, chinaPanelRight, plotH, rankW, nameW);
    const ceeLayout = mesoRegionLayout(ceePanelLeft, ceePanelRight, plotH, rankW, nameW);

    drawMesoRegionAxis(g, chinaLayout.centerX, plotH);
    drawMesoRegionAxis(g, ceeLayout.centerX, plotH);

    drawPowerShiftSide(g, mesoTop15Rows("china"), "china", chinaLayout, xScale);
    drawPowerShiftSide(g, mesoTop15Rows("cee"), "cee", ceeLayout, xScale);
  }

  const MESO_ROW_H = 40;
  const MESO_PLOT_TOP = 18;
  const MESO_PLOT_BOTTOM = 28;

  function buildMeso(rebuildSection) {
    const panelW = MESO_PANEL_W;
    const layoutGap = MESO_LAYOUT_GAP;
    const w = widthOf();
    const sideLayout = w >= MESO_SIDE_LAYOUT_MIN;
    const chartW = sideLayout ? Math.max(580, w - panelW - layoutGap) : Math.max(340, w - 16);
    const margin = 24;
    const centerGap = MESO_CENTER_GAP;
    const plotW = chartW - 2 * margin;
    const halfW = (plotW - centerGap) / 2;
    const chinaPanelRight = margin + halfW;
    const ceePanelLeft = margin + halfW + centerGap;
    const plotH = TOP_N * MESO_ROW_H + 24;
    const h = plotH + MESO_PLOT_TOP + MESO_PLOT_BOTTOM + 36;

    if (rebuildSection || !mesoSec) {
      if (mesoSec) mesoSec.remove();
      const { sec, card } = section(
        d3.select(ROOT),
        "s4-meso",
        IL_SECTIONS.meso
      );
      mesoSec = sec;

      const layout = card
        .append("div")
        .attr("class", "meso-layout")
        .classed("meso-layout--stack", !sideLayout);
      const mainCol = layout.append("div").attr("class", "meso-main-col");
      const chartCard = mainCol.append("div").attr("class", "meso-chart-card bubble-side-card");
      mesoChartWrap = chartCard.append("div").attr("class", "meso-chart-wrap");
      mesoSvg = whiteSvg(mesoChartWrap, chartW, h, `0 0 ${chartW} ${h}`);
      mesoG = mesoSvg.append("g").attr("transform", "translate(24,40)");

      const panelsCol = layout.append("div").attr("class", "meso-panels-col");
      createMesoDetailPanel(panelsCol, "china");
      createMesoDetailPanel(panelsCol, "cee");
    } else {
      mesoSvg.attr("width", chartW).attr("height", h).attr("viewBox", `0 0 ${chartW} ${h}`);
      mesoChartWrap.select("svg").attr("width", chartW).attr("height", h);
      mesoG.selectAll("*").remove();
      mesoSec.select(".meso-layout").classed("meso-layout--stack", !sideLayout);
    }

    mesoG
      .insert("rect", ":first-child")
      .attr("class", "meso-bg")
      .attr("x", -24)
      .attr("y", -40)
      .attr("width", chartW)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .style("pointer-events", "all")
      .on("click", (ev) => {
        ev.stopPropagation();
        clearMesoSelection();
      });

    const ceePanelRight = margin + plotW;

    mesoG
      .insert("rect", "rect:nth-child(2)")
      .attr("class", "meso-bg-china")
      .attr("x", -24)
      .attr("y", -40)
      .attr("width", chinaPanelRight + 24)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .style("pointer-events", "all");
    bindMesoRegionBg(mesoG.select(".meso-bg-china"), "china");

    mesoG
      .insert("rect", "rect:nth-child(3)")
      .attr("class", "meso-bg-cee")
      .attr("x", ceePanelLeft)
      .attr("y", -40)
      .attr("width", chartW - ceePanelLeft + 24)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .style("pointer-events", "all");
    bindMesoRegionBg(mesoG.select(".meso-bg-cee"), "cee");

    mesoG
      .append("text")
      .attr("class", "meso-region-title meso-region-title-china")
      .attr("x", margin)
      .attr("y", 2)
      .attr("text-anchor", "start")
      .text("中国 · Top15");
    mesoG
      .append("text")
      .attr("class", "meso-region-title meso-region-title-cee")
      .attr("x", ceePanelLeft)
      .attr("y", 2)
      .attr("text-anchor", "start")
      .text("中东欧 · Top15");

    mesoPowG = mesoG.append("g").attr("class", "meso-pow").attr("transform", `translate(0,${MESO_PLOT_TOP})`);
    drawPowerShiftView(mesoPowG, plotH, chartW);

    mesoSec.select(".meso-layout").style("--meso-chart-h", sideLayout ? `${h}px` : null);

    restoreMesoPanels();
    syncFocus();
  }

  // ─── orchestration ─────────────────────────────────────────────────────────
  function render() {
    const w = widthOf();
    $root.selectAll(".il-section, .il-loading").remove();

    drawMacro($root, w);
    drawSankey($root, w);
    drawBubbleScatter($root, w);
    mesoSec = null;
    mesoG = null;
    mesoSvg = null;
    buildMeso(true);
  }

  function init() {
    const mount = document.querySelector(ROOT);
    if (mount && mount.closest(".viz-card")) {
      const workbench = mount.closest(".viz-card");
      mount.classList.remove("viz-canvas");
      mount.classList.add("il-viz-stack");
      workbench.parentNode.insertBefore(mount, workbench.nextSibling);
      workbench.remove();
    }

    $root = d3.select(ROOT);
    if ($root.empty()) return;

    $root
      .append("div")
      .attr("class", "il-loading")
      .style("text-align", "center")
      .style("padding", "48px")
      .style("color", C.muted)
      .style("font-family", C.font)
      .text("正在加载机构结构分析…");

    Promise.all([
      d3.csv("static/data/china_institution.csv"),
      d3.csv("static/data/cee_institution.csv"),
      d3.csv("country.csv")
    ])
      .then(([cn, ce, countries]) => {
        data = buildDataset(cn, ce, countries);
        $root.select(".il-loading").remove();
        render();

        $root.on("click", () => {
          if (mesoAnyLocked()) clearMesoSelection();
        });

        window.addEventListener("resize", () => {
          clearTimeout(ro);
          ro = setTimeout(render, 250);
        });
      })
      .catch((err) => {
        $root.select(".il-loading").text("数据加载失败");
        console.error("chart-network:", err);
      });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
