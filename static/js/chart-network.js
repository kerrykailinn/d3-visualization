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

  const C = {
    china: "#2563eb",
    chinaLt: "#93c5fd",
    cee: "#ea580c",
    ceeLt: "#fdba74",
    up: "#dc2626",
    down: "#2563eb",
    stable: "#94a3b8",
    text: "#1e293b",
    muted: "#64748b",
    border: "#e2e8f0",
    bg: "#ffffff",
    bg2: "#f8fafc",
    panel: "#f1f5f9",
    tip: "#1e293b",
    font: "'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif",
    fade: 0.2,
    dur: 400
  };

  function panelTextStyle(extra = "") {
    return `font-size:15px;line-height:1.75;color:${C.text};${extra}`;
  }

  function panelMutedStyle(extra = "") {
    return `font-size:15px;line-height:1.75;color:${C.muted};${extra}`;
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
    meso: "state",
    sort: "abs_share",
    sortDir: { abs_share: "abs", rank_change: "abs", papers: "abs" },
    mesoSel: { china: null, cee: null },
    mesoHover: { china: null, cee: null },
    paretoSeries: null,
    sankeySel: { china: null, cee: null },
    sankeyPreview: { china: null, cee: null }
  };
  const bus = d3.dispatch("change");

  const MESO_SORT_SPECS = {
    abs_share: {
      label: "份额变化",
      options: [
        { dir: "abs", label: "默认" },
        { dir: "up", label: "份额增长" },
        { dir: "down", label: "份额减少" }
      ]
    },
    rank_change: {
      label: "排名变化",
      options: [
        { dir: "abs", label: "默认" },
        { dir: "up", label: "排名上升" },
        { dir: "down", label: "排名下降" }
      ]
    },
    papers: {
      label: "论文变化",
      options: [
        { dir: "abs", label: "默认" },
        { dir: "up", label: "论文增长" },
        { dir: "down", label: "论文减少" }
      ]
    }
  };

  let mesoSortMenuOpen = null;

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
    const cee = { top5: "#c2410c", p5_10: "#ea580c", p10_20: "#fb923c", p20_100: "#fdba74" };
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
    return Math.max(n.getBoundingClientRect().width || n.clientWidth || 720, 320);
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
  function parseRow(row, region) {
    const rank2015 = +row["2011_2015_rank"] || 0;
    const rank2020 = +row["2016_2020_rank"] || 0;
    return {
      id: `${region}::${row.institution}`,
      institution: row.institution,
      institution_cn: row.institution_cn || "",
      country: row.country,
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

  function top15(rows) {
    return rows
      .filter((d) => d.rank_2020 >= 1 && d.rank_2020 <= TOP_N)
      .slice()
      .sort((a, b) => a.rank_2020 - b.rank_2020);
  }

  function elitePool(rows) {
    return rows.filter(
      (d) =>
        (d.rank_2015 >= 1 && d.rank_2015 <= TOP_N) ||
        (d.rank_2020 >= 1 && d.rank_2020 <= TOP_N)
    );
  }

  function eliteRankSlot(rank) {
    return rank >= 1 && rank <= TOP_N ? rank : TOP_N + 1;
  }

  function buildEliteTrajectories(rows) {
    return elitePool(rows).map((d) => ({
      id: d.id,
      inst: d,
      rank15: eliteRankSlot(d.rank_2015),
      rank20: eliteRankSlot(d.rank_2020),
      share15: d.share_2015,
      share20: d.share_2020
    }));
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

  function mesoSortDir(key) {
    return S.sortDir[key || S.sort] || "abs";
  }

  function mesoSortLegendNote() {
    const key = S.sort;
    const dir = mesoSortDir(key);
    if (dir === "abs") {
      if (key === "abs_share") return " · 按份额变化幅度 Top15";
      if (key === "papers") return " · 按论文变化幅度 Top15";
      if (key === "rank_change") return " · 按排名变化幅度 Top15";
      return "";
    }
    const spec = MESO_SORT_SPECS[key];
    const opt = spec?.options.find((o) => o.dir === dir);
    return opt ? ` · ${opt.label} Top15` : "";
  }

  function closeMesoSortMenus() {
    mesoSortMenuOpen = null;
    if (mesoSec) mesoSec.selectAll(".meso-sort-menu").style("display", "none");
  }

  function applyMesoSort(key, dir) {
    S.sort = key;
    S.sortDir[key] = dir;
    closeMesoSortMenus();
    updateMesoSort();
  }

  function mesoSortValue(d, key) {
    if (key === "abs_share") return shareDelta(d);
    if (key === "rank_change") return d.rank_change;
    return papersDelta(d);
  }

  function sortRows(rows) {
    const key = S.sort;
    const dir = mesoSortDir(key);
    const val = (d) => mesoSortValue(d, key);
    const EPS = 1e-12;
    let c = rows.slice();

    if (dir === "up") {
      c = c.filter((d) => val(d) > EPS);
      return c.sort((a, b) => d3.descending(val(a), val(b)));
    }
    if (dir === "down") {
      c = c.filter((d) => val(d) < -EPS);
      return c.sort((a, b) => d3.descending(Math.abs(val(a)), Math.abs(val(b))));
    }
    return c.sort((a, b) => d3.descending(Math.abs(val(a)), Math.abs(val(b))));
  }

  function powerShiftPool(region) {
    return region === "china" ? data.china : data.cee;
  }

  function powerShiftRows(region) {
    return sortRows(powerShiftPool(region)).slice(0, TOP_N);
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

  function panelRankChangeHtml(d) {
    const line = `${panelRankLabel(d.rank_2015)} → ${panelRankLabel(d.rank_2020)}`;
    const rc = d.rank_change;
    if (!rc) return `${line} <span style="color:${C.muted}">—</span>`;
    const color = rankChangeColor(rc);
    return `${line} <span style="color:${color};font-weight:600">${rankChangeArrow(rc)}</span>`;
  }

  function panelPapersHtml(d) {
    const line = `${num(d.papers_2015)} → ${num(d.papers_2020)}`;
    const dp = d.papers_2020 - d.papers_2015;
    if (!dp) return `${line} <span style="color:${C.muted}">—</span>`;
    const color = dp > 0 ? PANEL_GAIN : PANEL_LOSS;
    const sign = dp > 0 ? "+" : "";
    return `${line} <span style="color:${color};font-weight:600">${sign}${num(dp)}</span>`;
  }

  function panelShareHtml(d) {
    const line = `${pct2(d.share_2015)} → ${pct2(d.share_2020)}`;
    const sg = shareDelta(d);
    if (Math.abs(sg) < 0.000005) return `${line} <span style="color:${C.muted}">—</span>`;
    const color = sg > 0 ? C.up : C.down;
    const sign = sg > 0 ? "+" : "";
    return `${line} <span style="color:${color};font-weight:600">${sign}${pct2(sg)}</span>`;
  }

  function detailExplain(d) {
    const net = d.region === "china" ? "中国—中东欧合作网络" : "中东欧—中国合作网络";
    if (d.g === "up" && d.rank_change > 3) {
      return `${d.institution} 在后期逐渐成为${net}中的重要枢纽，排名与份额同步提升。`;
    }
    if (d.g === "up") {
      return `${d.institution} 的合作份额扩张显著，在 Top15 精英层中的结构影响力持续上升。`;
    }
    if (d.g === "down" && d.papers_2020 > d.papers_2015) {
      return `${d.institution} 论文总量有所增长，但合作份额下降，说明整体合作结构正在扩散而非进一步集中。`;
    }
    if (d.g === "down") {
      return `${d.institution} 相对地位下降，合作资源向其他核心机构转移。`;
    }
    return `${d.institution} 在 Top15 中维持稳定位置，持续参与核心合作网络。`;
  }

  function instShortName(name) {
    return name.length > 28 ? `${name.slice(0, 27)}…` : name;
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

  function mesoPanelBlock(title, body, last) {
    const border = last ? "" : `padding-bottom:14px;margin-bottom:14px;border-bottom:1px solid ${C.border};`;
    return (
      `<div style="${border}">` +
      (title ? `<div style="${panelMutedStyle("font-weight:600;margin-bottom:8px;")}">${title}</div>` : "") +
      `<div style="${panelTextStyle()}">${body}</div></div>`
    );
  }

  function buildDataset(rawCn, rawCee) {
    const china = enrich(rawCn.map((r) => parseRow(r, "china")));
    const cee = enrich(rawCee.map((r) => parseRow(r, "cee")));

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
        cee: top15(cee),
        pool: { china: elitePool(china), cee: elitePool(cee) },
        elite: { china: buildEliteTrajectories(china), cee: buildEliteTrajectories(cee) }
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
      byId: new Map([...china, ...cee].map((d) => [d.id, d]))
    };
  }

  function stateInsight() {
    const cnStable = data.top15.china.filter((d) => Math.abs(d.rank_change) <= 2).length;
    const ceShift = data.top15.cee.filter((d) => Math.abs(d.rank_change) > 3).length;
    return (
      `中国 Top15 中 ${cnStable} 家机构排名变化较小，核心层整体保持稳定；` +
      (ceShift >= 4
        ? `中东欧 Top15 在后期出现更明显更新，${ceShift} 家机构排名变动显著。`
        : "中东欧 Top15 结构变动相对温和。")
    );
  }

  function transitionInsight() {
    const cnRiser = data.china
      .filter((d) => d.g === "up")
      .sort((a, b) => d3.descending(b.share_growth, a.share_growth))[0];
    const ceRiser = data.cee
      .filter((d) => d.g === "up")
      .sort((a, b) => d3.descending(b.share_growth, a.share_growth))[0];
    let txt = "份额变化是衡量结构影响力的关键：论文增长仅表示合作增多，份额增长才意味着在合作体系中的权重上升。";
    if (cnRiser) txt += ` 中国侧 ${instShortName(cnRiser.institution)} 份额扩张最为显著。`;
    if (ceRiser) txt += ` 中东欧侧 ${instShortName(ceRiser.institution)} 上升明显。`;
    return txt;
  }

  function buildMesoOverviewSide(region) {
    if (S.meso === "state") {
      if (region === "china") {
        const cnStable = data.top15.china.filter((d) => Math.abs(d.rank_change) <= 2).length;
        return `中国 Top15 中 ${cnStable} 家机构排名变化较小，核心层整体保持稳定。`;
      }
      const ceShift = data.top15.cee.filter((d) => Math.abs(d.rank_change) > 3).length;
      return ceShift >= 4
        ? `中东欧 Top15 在后期出现更明显更新，${ceShift} 家机构排名变动显著。`
        : "中东欧 Top15 结构变动相对温和。";
    }
    const pool = region === "china" ? data.china : data.cee;
    const riser = pool.filter((d) => d.g === "up").sort((a, b) => d3.descending(b.share_growth, a.share_growth))[0];
    if (region === "china") {
      return riser
        ? `份额变化是衡量结构影响力的关键。中国侧 ${instShortName(riser.institution)} 份额扩张最为显著。`
        : "份额变化是衡量结构影响力的关键：论文增长仅表示合作增多，份额增长才意味着在合作体系中的权重上升。";
    }
    return riser
      ? `中东欧侧 ${instShortName(riser.institution)} 上升明显，结构再分配更为活跃。`
      : "关注份额变化而非论文绝对量，以识别真正的结构权力转移。";
  }

  function mesoPanelTitle(region) {
    const lb = region === "china" ? "中国" : "中东欧";
    if (S.mesoSel[region] && data.byId.has(S.mesoSel[region])) {
      return data.byId.get(S.mesoSel[region]).institution;
    }
    return `${lb} · 结构注释`;
  }

  function mesoDetailHtml(d) {
    return (
      mesoPanelBlock("排名变化", panelRankChangeHtml(d)) +
      mesoPanelBlock("论文数", panelPapersHtml(d)) +
      mesoPanelBlock("合作份额", panelShareHtml(d)) +
      mesoPanelBlock("结构解读", detailExplain(d), true)
    );
  }

  function setMesoDetailSide(region, d) {
    if (!mesoSec) return;
    const cls = region === "china" ? "meso-panel-china" : "meso-panel-cee";
    const sec = mesoSec.select(`.${cls}`);
    if (sec.empty()) return;
    const accent = region === "china" ? C.china : C.cee;
    sec
      .style("border-color", accent)
      .style("box-shadow", "0 4px 16px rgb(0 0 0 / 0.08)")
      .style("background", C.bg);
    sec.select(".meso-panel-title").text(mesoPanelTitle(region));
    sec.select(".meso-panel-body").html(d ? mesoDetailHtml(d) : compactNote(buildMesoOverviewSide(region)));
    sec.select(".meso-panel-x").style("display", d ? null : "none");
  }

  function resetMesoDetailSide(region) {
    setMesoDetailSide(region, null);
    if (!mesoSec) return;
    const cls = region === "china" ? "meso-panel-china" : "meso-panel-cee";
    mesoSec
      .select(`.${cls}`)
      .style("border-color", C.border)
      .style("box-shadow", "none")
      .style("background", C.bg2);
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

  function createMesoDetailPanel(parent, region, chartOffsetTop) {
    const isCn = region === "china";
    const accent = isCn ? C.china : C.cee;
    const cls = isCn ? "meso-panel-china" : "meso-panel-cee";
    const panel = parent
      .append("aside")
      .attr("class", cls)
      .style("font-family", C.font)
      .style("background", C.bg2)
      .style("border", `1px solid ${C.border}`)
      .style("border-radius", "4px")
      .style("padding", isCn ? "14px 10px 16px 16px" : "14px 16px 16px 10px")
      .style("min-height", "0")
      .style("position", "sticky")
      .style("top", "12px")
      .style("margin-top", chartOffsetTop ? `${chartOffsetTop}px` : "0")
      .style("align-self", chartOffsetTop ? "start" : null)
      .style("transition", `border-color ${C.dur}ms, background ${C.dur}ms, box-shadow ${C.dur}ms`)
      .style("border-left", isCn ? `2px solid ${accent}` : null)
      .style("border-right", isCn ? null : `2px solid ${accent}`);
    panel
      .append("div")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "flex-start")
      .style("margin-bottom", "12px")
      .style("padding-bottom", "10px")
      .style("border-bottom", `1px solid ${C.border}`)
      .html(
        `<div class="meso-panel-title" style="${panelTextStyle("font-weight:600;line-height:1.35;")}"></div>` +
          `<button type="button" class="meso-panel-x button is-small is-light" style="display:none;">✕</button>`
      );
    panel.append("div").attr("class", "meso-panel-body il-prose").style("font-size", "15px").style("line-height", "1.75");
    panel.select(".meso-panel-x").on("click", (ev) => {
      ev.stopPropagation();
      clearMesoSelectionSide(region);
    });
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

  function sankeyChinaNote() {
    const mob = regionMobilityActive("china");
    const giniDrop = data.macro.cn15.gini - data.macro.cn20.gini;

    let body =
      `<strong>中国侧仍保持较强的核心层级稳定性</strong>，多数头部机构在两个时期之间维持原有层级。`;
    if (mob.up > mob.down * 1.2) {
      body +=
        `与此同时，部分中层机构开始向上迁移，说明合作体系在保持中心结构的同时，也出现一定程度的<strong>结构更新</strong>。`;
    } else if (giniDrop > 0.005) {
      body += `合作参与面有所扩大，但核心层级的边界并未出现明显松动。`;
    }
    return body;
  }

  function sankeyCeeNote() {
    const giniDrop = data.macro.ce15.gini - data.macro.ce20.gini;
    const cnGiniDrop = data.macro.cn15.gini - data.macro.cn20.gini;

    let body =
      giniDrop > cnGiniDrop + 0.01
        ? `相比中国，中东欧合作结构在后期呈现出更明显的<strong>结构扩散趋势</strong>。`
        : `中东欧合作结构的层级分布在后一期出现一定调整。`;
    body +=
      `更多机构开始进入中层合作网络，层级之间的流动性更强，合作体系的<strong>结构开放性</strong>明显提升。`;
    return body;
  }

  function sankeyCompareNote() {
    const cnGini = data.macro.cn20.gini;
    const ceGini = data.macro.ce20.gini;
    const ceGiniDrop = data.macro.ce15.gini - data.macro.ce20.gini;
    const cnGiniDrop = data.macro.cn15.gini - data.macro.cn20.gini;
    const cnMob = regionMobilityActive("china");
    const ceMob = regionMobilityActive("cee");

    if (cnGini > ceGini + 0.03 && ceGiniDrop > cnGiniDrop + 0.01) {
      return (
        `整体来看，<strong>中国合作体系仍具有更明显的中心化特征</strong>，` +
        `而中东欧则表现出更强的结构开放性与层级流动性。`
      );
    }
    if (cnMob.stable > ceMob.stable && cnMob.up > ceMob.up) {
      return (
        `中国的<strong>核心层级稳定性更强</strong>，` +
        `而中东欧机构之间的结构重组更加明显，合作网络的去中心化倾向更为突出。`
      );
    }
    return (
      `两侧均出现一定程度的结构扩散，` +
      `但中国侧核心层级的<strong>结构惯性</strong>更强，中东欧侧则呈现更明显的层级再配置。`
    );
  }

  function macroNarrative() {
    const m = data.macro;
    const cnHhiDrop = m.cn15.hhi - m.cn20.hhi;
    const ceHhiDrop = m.ce15.hhi - m.ce20.hhi;
    return (
      `<p>Gini 基尼系数：用于衡量合作份额的分布是否均衡。数值越高，说明合作越集中在少数机构手中；数值越低，则说明更多机构参与合作，整体结构更加分散。</p>` +
      `<p>HHI 赫芬达尔—赫希曼指数：用于衡量头部机构的主导程度。数值越高，代表少数核心机构占据了更大的合作份额；数值下降，则意味着合作正在从「少数机构主导」逐渐走向更广泛的参与。</p>` +
      `<p>左图为机构合作份额的 Pareto curve（帕累托曲线）。曲线越陡，说明少数头部机构贡献了更高比例的合作论文，合作结构越集中；曲线越平缓，则说明合作正在向更多机构扩散。</p>` +
      `<p>2015年后，中国与中东欧两侧的合作结构均出现明显扩散趋势。Top15 机构的合作份额均有所下降：中国由 ${pct(m.cn15.top15)} 降至 ${pct(m.cn20.top15)}，中东欧由 ${pct(m.ce15.top15)} 降至 ${pct(m.ce20.top15)}，<strong>说明合作正在逐渐从少数核心机构向更广泛的机构群体扩散。</strong></p>` +
      `<p>这一变化也体现在 Gini coefficient 与 HHI index 的下降上。中国的 Gini 从 ${m.cn15.gini.toFixed(2)} 降至 ${m.cn20.gini.toFixed(2)}，中东欧从 ${m.ce15.gini.toFixed(2)} 降至 ${m.ce20.gini.toFixed(2)}；与此同时，两侧 HHI 均下降约 ${((cnHhiDrop + ceHhiDrop) / 2).toFixed(2)}。</p>` +
      `<p>但整体而言，<strong>中国侧仍保持相对更强的核心机构主导特征，而中东欧机构在后期则呈现出更明显的扩散与开放化趋势。</strong></p>`
    );
  }

  function mesoNarrative() {
    if (S.meso === "state") {
      return "纵轴 = 排名位次，柱长 = 合作份额。细线连接同一机构在两期之间的层级轨迹；点击机构打开详情面板。";
    }
    return "从全部机构中按所选指标筛选并排序：默认取变化幅度最大的 Top15；增长/减少视图仅保留份额增加、排名上升或论文增加（及其反向）的机构，再取 Top15。柱长随当前指标变化：份额变化 = 合作份额，排名变化 = 排名位次，论文变化 = 论文量。中心为变化区，外侧为 2011–2015 基线。";
  }

  function updatePowerShiftLegend() {
    if (!mesoSec) return;
    mesoSec
      .select(".trans-legend-wrap")
      .style("display", "flex")
      .style("gap", "18px")
      .style("flex-wrap", "wrap")
      .style("justify-content", "flex-start")
      .style("margin-top", "10px")
      .style("font-size", "11px")
      .style("color", C.muted)
      .style("font-family", C.font)
      .html(powerShiftLegendHtml());
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
      .style("background", C.bg)
      .style("color", C.text)
      .style("padding", "12px 14px")
      .style("border-radius", "10px")
      .style("border", `1px solid ${C.border}`)
      .style("font-family", C.font)
      .style("font-size", "13px")
      .style("line-height", "1.6")
      .style("max-width", "280px")
      .style("box-shadow", "0 4px 12px rgb(0 0 0 / 0.1)");
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

  function nearestParetoPoint(pts, xVal) {
    if (!pts.length) return pts[0];
    let best = pts[0];
    let min = Infinity;
    pts.forEach((p) => {
      const d = Math.abs(p.x - xVal);
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
      `<div style="font-weight:700;margin-bottom:8px;font-size:14px;color:${s.color};">${s.leg}</div>
       <div>机构排名（百分位）：<strong>${d3.format(".1f")(pt.x)}%</strong></div>
       <div>累计论文份额：<strong>${pct(pt.y)}</strong></div>
       <div style="margin-top:8px;">Gini：<strong>${st.gini.toFixed(2)}</strong></div>
       <div>HHI：<strong>${st.hhi.toFixed(2)}</strong></div>
       <div style="margin-top:8px;color:${C.muted};">结构解释：${st.conc}</div>`
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
      `<div style="padding:6px 0;${border}${panelTextStyle()}">` +
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

  function pctReadable(share) {
    if (share >= 0.995) return "几乎全部";
    if (share >= 0.75) return `超过${Math.floor(share * 100)}%`;
    if (share >= 0.45 && share <= 0.55) return "约一半";
    const p = Math.round(share * 100);
    return p > 0 ? `${p}%` : "极少数";
  }

  function overviewOneLiner(region) {
    const { a15, a20 } = regionMacroPair(region);
    const giniDrop = a15.gini - a20.gini;
    const mob = regionMobilityActive(region);

    if (giniDrop > 0.008 && mob.up >= mob.down) {
      return `2015 年后，更多机构开始进入中层合作网络，但${binTag("top5")}仍保持较强稳定性。`;
    }
    if (giniDrop > 0.008) {
      return `2015 年后，合作参与面有所扩大，结构出现一定程度扩散。`;
    }
    if (mob.up > mob.down * 1.3) {
      return `向上流动多于向下流动，合作体系在稳定中发生有限结构更新。`;
    }
    const name = region === "china" ? "中国" : "中东欧";
    return `2015 年前后结构变化相对温和，${name}合作网络仍以层级稳定为主。`;
  }

  function buildOverviewAnnot(region) {
    const mob = regionMobilityActive(region);
    const nActive = activeInstCount(region);

    return (
      compactMetrics([
        { label: "向上流动", count: mob.up, share: mobilityPct(mob.up, nActive) },
        { label: "层级稳定", count: mob.stable, share: mobilityPct(mob.stable, nActive) },
        { label: "向下流动", count: mob.down, share: mobilityPct(mob.down, nActive) }
      ]) + compactNote(overviewOneLiner(region))
    );
  }

  function binOutflowOneLiner(region, binId, out) {
    const name = region === "china" ? "中国" : "中东欧";
    const total = out.total || 1;
    const stableShare = out.stable / total;
    const bi = binIdx(binId);

    if (bi === 0 && stableShare >= 0.7) {
      return (
        `${binTag(binId)}整体保持较强稳定性，${pctReadable(stableShare)} 的机构在后期仍停留于同一层级，` +
        `${name}合作网络仍呈现明显中心化特征。`
      );
    }
    if (stableShare >= 0.75) {
      return `${binTag(binId)}整体保持较强稳定性，${pctReadable(stableShare)} 的机构在后期仍停留于同一层级。`;
    }
    if (out.up > out.down && out.up > 0) {
      return `部分机构向上跨层迁移，${binTag(binId)}向更高层级输送新的合作参与者。`;
    }
    if (out.down > out.up && out.down > 0) {
      return `部分机构向下流出，${binTag(binId)}内部排序出现调整。`;
    }
    return `${binTag(binId)}在两期之间流出结构变化不大。`;
  }

  function binInflowOneLiner(region, binId, inf) {
    const total = inf.total || 1;
    const retainShare = inf.retained / total;
    const upInShare = inf.upIn / total;
    const bi = binIdx(binId);

    if (bi === 0 && retainShare >= 0.5) {
      return `${binTag(binId)}以原有机构为主，核心骨架在 2015 年后基本保持稳定。`;
    }
    if (retainShare >= 0.55) {
      return `${pctReadable(retainShare)} 的机构保留在本层，主体构成延续性较强。`;
    }
    if (upInShare >= 0.3 && inf.upIn > 0) {
      return `${pctReadable(upInShare)} 的机构来自更低层级，${binTag(binId)}正在吸纳新的合作参与者。`;
    }
    if (inf.downIn > inf.upIn && inf.downIn > 0) {
      return `部分机构自更高层级流入，高位机构之间出现一定再分配。`;
    }
    return `${binTag(binId)}的来源构成在两期之间变化不大。`;
  }

  function flowOneLiner(region, from, to, count) {
    if (!count) return `该路径在两期之间暂无机构迁移。`;
    const fi = binIdx(from);
    const ti = binIdx(to);

    if (from === "p20_100" && to === "p10_20") {
      return `更多边缘机构开始进入中层合作网络，合作结构的开放性明显增强。`;
    }
    if (from === "p20_100" && ti < fi) {
      return `更多边缘机构进入更高合作层级，合作结构的开放性明显增强。`;
    }
    if (from === "p10_20" && to === "top5") {
      return `部分活跃机构进入核心层，中层向核心的上升通道仍然开放。`;
    }
    if (from === "p5_10" && to === "top5") {
      return `上层核心向核心层集中，核心圈层的边界正在重新划定。`;
    }
    if (ti > fi) {
      return `部分高位机构相对地位下降，核心层出现一定再分配。`;
    }
    if (ti < fi) {
      return `机构向更高层级移动，合作网络的分层边界正在调整。`;
    }
    return `该层级内部保持稳定，跨层重组未在此路径集中发生。`;
  }

  function buildLeftBinAnnot(slot, region) {
    const c15 = data.sankey.bins[region].y2015[slot.id] || 0;
    const out = binOutflowDetail(region, slot.id);
    const total = out.total || 1;

    return (
      `<div style="${panelMutedStyle("margin-bottom:8px;")}">2011–2015</div>` +
      `<div style="${panelTextStyle("font-weight:600;margin-bottom:8px;")}">${num(c15)} 个机构</div>` +
      compactMetrics([
        { label: "保持原层级", count: out.stable, share: out.stable / total },
        { label: "向上迁移", count: out.up, share: out.up / total },
        { label: "向下迁移", count: out.down, share: out.down / total }
      ]) +
      compactNote(binOutflowOneLiner(region, slot.id, out))
    );
  }

  function buildRightBinAnnot(slot, region) {
    const c20 = data.sankey.bins[region].y2020[slot.id] || 0;
    const inf = binInflowDetail(region, slot.id);
    const total = inf.total || 1;

    return (
      `<div style="${panelMutedStyle("margin-bottom:8px;")}">2016–2020</div>` +
      `<div style="${panelTextStyle("font-weight:600;margin-bottom:8px;")}">${num(c20)} 个机构</div>` +
      compactMetrics([
        { label: "保留原层级", count: inf.retained, share: inf.retained / total },
        { label: "来自更低层级", count: inf.upIn, share: inf.upIn / total },
        { label: "来自更高层级", count: inf.downIn, share: inf.downIn / total }
      ]) +
      compactNote(binInflowOneLiner(region, slot.id, inf))
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
      `<div style="${panelTextStyle("font-weight:600;margin-bottom:8px;")}">` +
      `${binTag(f.from)} → ${binTag(f.to)}` +
      `</div>` +
      (f.count > 0
        ? `<div style="${panelTextStyle()}">` +
          `${num(f.count)} 个机构完成这一迁移<br>` +
          `<span style="color:${C.muted};">（占全部机构的 ${pct(allShare)}，占原${binTag(f.from)}的 ${pct(fromShare)}）</span>` +
          `</div>`
        : `<div style="${panelMutedStyle()}">暂无机构迁移</div>`) +
      compactNote(flowOneLiner(f.region, f.from, f.to, f.count))
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
    const cls = region === "china" ? "sankey-annot-china" : "sankey-annot-cee";
    const sec = d3.select(`.s2-sankey .${cls}`);
    if (sec.empty()) return;
    const accent = region === "china" ? C.china : C.cee;
    const locked = !!S.sankeySel[region];
    const previewing = !!isPreview && !S.sankeySel[region];
    const body = sec.select(".sankey-annot-body");
    const fadeMs = Math.round(C.dur * 0.35);
    const titleMeta = bTag ? { binTag: bTag, binLabel } : null;

    sec
      .style("border-color", locked || previewing ? accent : C.border)
      .style(
        "box-shadow",
        locked ? "0 4px 16px rgb(0 0 0 / 0.08)" : previewing ? "0 2px 10px rgb(0 0 0 / 0.05)" : "none"
      )
      .style("background", locked || previewing ? C.bg : C.bg2);

    body.interrupt().style("opacity", body.style("opacity") || 1);
    body
      .transition()
      .duration(fadeMs)
      .style("opacity", previewing ? 0.88 : 0.4)
      .on("end", () => {
        sec.select(".sankey-annot-title").text(sankeyPanelTitle(region, mode, titleMeta));
        body.html(html);
        body.transition().duration(fadeMs).style("opacity", previewing ? 0.88 : 1);
      });
  }

  function resetSankeyAnnotSide(region) {
    const cls = region === "china" ? "sankey-annot-china" : "sankey-annot-cee";
    d3.select(`.s2-sankey .${cls}`).style("opacity", 1);
    setSankeyAnnot(buildOverviewAnnot(region), region, { mode: "overview" });
  }

  function resetSankeyAnnot() {
    resetSankeyAnnotSide("china");
    resetSankeyAnnotSide("cee");
  }

  function createSankeyAnnotPanel(parent, region, chartOffsetTop) {
    const isCn = region === "china";
    const accent = isCn ? C.china : C.cee;
    const cls = isCn ? "sankey-annot-china" : "sankey-annot-cee";
    parent
      .append("aside")
      .attr("class", cls)
      .style("font-family", C.font)
      .style("background", C.bg2)
      .style("border", `1px solid ${C.border}`)
      .style("border-radius", "4px")
      .style("padding", isCn ? "14px 10px 16px 16px" : "14px 16px 16px 10px")
      .style("min-height", "0")
      .style("position", "sticky")
      .style("top", "12px")
      .style("margin-top", chartOffsetTop ? `${chartOffsetTop}px` : "0")
      .style("align-self", chartOffsetTop ? "start" : null)
      .style("transition", `border-color ${C.dur}ms, background ${C.dur}ms`)
      .style("border-left", isCn ? `2px solid ${accent}` : null)
      .style("border-right", isCn ? null : `2px solid ${accent}`)
      .html(
        `<div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid ${C.border};">` +
          `<div class="sankey-annot-title" style="${panelTextStyle("font-weight:600;")}"></div>` +
          `</div>` +
          `<div class="sankey-annot-body il-prose" style="opacity:1;transition:opacity ${C.dur}ms ease;${panelTextStyle()}"></div>`
      );
    resetSankeyAnnotSide(region);
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
    cancelClearSankeyPreview(region);
    S.sankeyPreview[region] = preview;
    syncSankeyRegionFocus(region);
    updateSankeyPanelForPreview(preview);
  }

  function clearSankeyPreview(region) {
    if (S.sankeySel[region]) return;
    cancelClearSankeyPreview(region);
    sankeyPreviewClearTimers[region] = setTimeout(() => {
      sankeyPreviewClearTimers[region] = null;
      if (S.sankeySel[region]) return;
      S.sankeyPreview[region] = null;
      syncSankeyRegionFocus(region);
      resetSankeyAnnotSide(region);
    }, 100);
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
    resetSankeyAnnotSide(region);
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

  function tipInstState(ev, d, placement) {
    const r15 = panelRankLabel(d.rank_2015);
    const r20 = panelRankLabel(d.rank_2020);
    showTip(
      ev,
      `<div style="font-weight:600;margin-bottom:6px;font-size:13px;color:${C.text};">${d.institution}</div>` +
        `<div style="font-size:12px;line-height:1.7;color:${C.muted};">` +
        `排名 · 2011–2015 ${r15} · 2016–2020 ${r20}<br/>` +
        `论文数 · ${num(d.papers_2015)} / ${num(d.papers_2020)}<br/>` +
        `合作份额 · ${pct2(d.share_2015)} / ${pct2(d.share_2020)}` +
        `</div>`,
      placement
    );
  }

  function tipSignedSuffix(val, fmt, active) {
    if (!val) return ` <span style="color:${C.muted}">—</span>`;
    const sign = val > 0 ? "+" : "";
    const text = `${sign}${fmt(val)}`;
    if (active) {
      const color = val > 0 ? PANEL_GAIN : PANEL_LOSS;
      return ` <span style="color:${color}">${text}</span>`;
    }
    return ` <span style="color:${C.muted}">${text}</span>`;
  }

  function tipRankDetailHtml(d, active) {
    const r15 = panelRankLabel(d.rank_2015);
    const r20 = panelRankLabel(d.rank_2020);
    const rc = d.rank_change;
    if (!rc) {
      return ` <span style="color:${C.muted}">${r15} → ${r20} · —</span>`;
    }
    const arrow = rankChangeArrow(rc);
    if (active) {
      const color = rankChangeColor(rc);
      return (
        ` <span style="color:${C.muted}">${r15} → ${r20}</span>` +
        ` <span style="color:${color}">${arrow}</span>`
      );
    }
    return ` <span style="color:${C.muted}">${r15} → ${r20} ${arrow}</span>`;
  }

  function tipShareDeltaHtml(d, active) {
    const sg = shareDelta(d);
    if (Math.abs(sg) < 0.000005) {
      return `<span style="color:${C.muted}">—</span>`;
    }
    const sign = sg > 0 ? "+" : "";
    const text = `${sign}${pct2(sg)}`;
    if (active) {
      const color = sg > 0 ? PANEL_GAIN : PANEL_LOSS;
      return `<span style="color:${color}">${text}</span>`;
    }
    return `<span style="color:${C.muted}">${text}</span>`;
  }

  function tipInstTrans(ev, d, placement) {
    const dp = d.papers_2020 - d.papers_2015;
    const shareSort = S.sort === "abs_share";
    const rankSort = S.sort === "rank_change";
    const papersSort = S.sort === "papers";

    showTip(
      ev,
      `<div style="font-weight:600;margin-bottom:6px;font-size:13px;color:${C.text};">${d.institution}</div>` +
        `<div style="font-size:12px;line-height:1.7;color:${C.muted};">` +
        `论文数 · ${num(d.papers_2015)} → ${num(d.papers_2020)}${tipSignedSuffix(dp, num, papersSort)}<br/>` +
        `合作份额 · ${pct2(d.share_2015)} → ${pct2(d.share_2020)}<br/>` +
        `份额变化 · ${tipShareDeltaHtml(d, shareSort)}<br/>` +
        `排名变化 ·${tipRankDetailHtml(d, rankSort)}` +
        `</div>`,
      placement
    );
  }

  // ─── interaction ───────────────────────────────────────────────────────────
  function mesoLabelStyle(sel) {
    sel
      .style("font-size", "10.5px")
      .style("font-weight", "500")
      .style("pointer-events", "none");
  }

  function appendMesoBarHit(row, x, y, w, barH) {
    const hw = Math.max(w, 8);
    row
      .append("rect")
      .attr("class", "meso-hit")
      .attr("x", x - 3)
      .attr("y", y - barH / 2 - 5)
      .attr("width", hw + 6)
      .attr("height", barH + 10)
      .attr("fill", "transparent")
      .style("pointer-events", "all");
  }

  function bindInst(sel, mode) {
    const tipPlacement = mode === "state" || mode === "transition" ? "meso" : "default";

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
        if (mode === "state") tipInstState(ev, m, tipPlacement);
        else tipInstTrans(ev, m, tipPlacement);
      };
      const onMove = (ev) => {
        if (tipPlacement === "meso") moveMesoTip(ev);
        else moveTip(ev, tipPlacement);
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
    const instFocus = focusId();
    d3.selectAll(".macro-curve").each(function () {
      const el = d3.select(this);
      const leg = el.attr("data-series");
      const active = !!sel && leg === sel;
      const dimmed = !!sel && leg !== sel;
      el.transition()
        .duration(C.dur)
        .attr("opacity", active ? 1 : dimmed ? 0.06 : instFocus ? 0.35 : 1)
        .attr("stroke-width", active ? 3.5 : 1.5)
        .style("filter", active ? "drop-shadow(0 1px 3px rgb(0 0 0 / 0.22))" : null);
    });
    d3.selectAll(".pareto-hit").style("pointer-events", function () {
      const leg = d3.select(this).attr("data-series");
      return !sel || leg === sel ? "stroke" : "none";
    }).style("cursor", function () {
      const leg = d3.select(this).attr("data-series");
      return !sel || leg === sel ? "pointer" : "default";
    });
    d3.selectAll(".pareto-leg-item").each(function () {
      const el = d3.select(this);
      const leg = el.attr("data-series");
      const color = el.attr("data-color");
      const active = leg === sel;
      el.style("font-weight", active ? "700" : "500")
        .style("opacity", !sel || active ? 1 : 0.3)
        .style("background", active ? C.panel : "transparent")
        .style("box-shadow", active ? `inset 0 0 0 2px ${color}` : "none")
        .style("border-radius", "6px");
    });
    const focusG = d3.select(".pareto-focus");
    if (!focusG.empty()) {
      focusG
        .select("line")
        .attr("stroke-width", sel ? 2 : 1)
        .attr("stroke-opacity", sel ? 1 : 0.85);
      focusG.select("circle").attr("r", sel ? 6 : 4).attr("stroke-width", sel ? 2.5 : 1.5);
    }
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
      const mode = bar.attr("data-mode");
      const part = bar.attr("data-part");
      const baseFill = bar.attr("data-base-fill") || MESO.neutral;
      const baseOp = +bar.attr("data-base-opacity") || 0.85;
      const accent = region === "china" ? MESO.chinaBarDk : MESO.ceeBarDk;

      if (mode === "trans") {
        if (!id) {
          bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", baseOp);
        } else if (active) {
          bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", 1);
        } else {
          bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", baseOp * dim);
        }
        return;
      }

      if (!id) {
        bar.transition().duration(C.dur).attr("fill", baseFill).attr("opacity", baseOp);
        return;
      }
      if (active) {
        const hiFill =
          mode === "state"
            ? bar.attr("data-period") === "2015"
              ? region === "china"
                ? MESO.chinaBar
                : MESO.ceeBar
              : accent
            : part === "gain" || part === "loss"
              ? accent
              : baseFill;
        bar.transition().duration(C.dur).attr("fill", hiFill).attr("opacity", mode === "trans" ? 0.95 : 0.92);
      } else {
        bar.transition().duration(C.dur).attr("fill", MESO.neutral).attr("opacity", baseOp * dim);
      }
    });

    d3.selectAll(".meso-traj").transition().duration(C.dur).attr("opacity", function () {
      const g = d3.select(this.parentNode);
      const region = g.attr("data-region");
      const id = mesoFocusId(region);
      if (!id) return 0.72;
      return g.attr("data-id") === id ? 0.95 : dim * 0.4;
    }).attr("stroke-width", function () {
      const g = d3.select(this.parentNode);
      const region = g.attr("data-region");
      const id = mesoFocusId(region);
      if (!id) return 0.85;
      return g.attr("data-id") === id ? 1.35 : 0.85;
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
  function section(parent, cls, title, sub) {
    const s = parent.append("section").attr("class", `il ${cls}`).style("margin-bottom", "40px");
    s.append("h3")
      .style("font-family", C.font)
      .style("font-size", "20px")
      .style("font-weight", "700")
      .style("color", C.text)
      .style("margin", "0 0 8px")
      .text(title);
    if (sub) {
      s.append("p")
        .attr("class", "il-section-sub")
        .style("font-family", C.font)
        .style("font-size", "17px")
        .style("color", C.muted)
        .style("margin", "0 0 14px")
        .style("line-height", "1.7")
        .text(sub);
    }
    const card = s
      .append("div")
      .attr("class", "il-chart")
      .style("background", C.bg)
      .style("border", "none")
      .style("padding", "0");
    return { sec: s, card };
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
      .style("font-size", "15px")
      .style("line-height", "1.75")
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
      .style("background", C.panel)
      .style("border-radius", "10px")
      .style("border-left", `4px solid ${C.china}`)
      .style("font-family", C.font)
      .style("font-size", "14px")
      .style("line-height", "1.75")
      .style("color", C.muted)
      .html(`<strong style="color:${C.text};">${title}</strong> ${text}`);
  }

  function statsTable(parent) {
    const m = data.macro;
    const rows = [
      ["中国", C.china, m.cn15, m.cn20],
      ["中东欧", C.cee, m.ce15, m.ce20]
    ];

    function changeCell(from, to, fmt, diff) {
      const diffStr = diff >= 0 ? `+${fmt(diff)}` : fmt(diff);
      const color = diff < 0 ? C.up : diff > 0 ? C.down : C.muted;
      return `${fmt(from)} → ${fmt(to)} <span style="color:${color};">（${diffStr}）</span>`;
    }

    const wrap = parent.append("div").style("overflow-x", "auto");
    const table = wrap
      .append("table")
      .style("width", "100%")
      .style("border-collapse", "collapse")
      .style("font-family", C.font)
      .style("font-size", "13px");

    table
      .append("thead")
      .html(
        `<tr style="background:${C.bg};border-bottom:2px solid ${C.border};">
          <th style="text-align:center;padding:8px 10px;color:${C.muted};font-weight:600;">区域</th>
          <th style="text-align:center;padding:8px 10px;color:${C.muted};font-weight:600;">Top15 份额</th>
          <th style="text-align:center;padding:8px 10px;color:${C.muted};font-weight:600;">Gini</th>
          <th style="text-align:center;padding:8px 10px;color:${C.muted};font-weight:600;">HHI</th>
        </tr>`
      );

    const tbody = table.append("tbody");
    rows.forEach(([name, color, s15, s20]) => {
      const topDiff = s20.top15 - s15.top15;
      const gDiff = s20.gini - s15.gini;
      const hDiff = s20.hhi - s15.hhi;
      tbody
        .append("tr")
        .style("border-bottom", `1px solid ${C.border}`)
        .html(
          `<td style="padding:8px 10px;text-align:center;font-weight:600;color:${color};">${name}</td>
           <td style="padding:8px 10px;text-align:center;">${changeCell(s15.top15, s20.top15, pct, topDiff)}</td>
           <td style="padding:8px 10px;text-align:center;">${changeCell(s15.gini, s20.gini, (v) => v.toFixed(2), gDiff)}</td>
           <td style="padding:8px 10px;text-align:center;">${changeCell(s15.hhi, s20.hhi, (v) => v.toFixed(2), hDiff)}</td>`
        );
    });
  }

  function macroSidePanel(parent) {
    prose(parent, macroNarrative(), { maxWidth: "none", marginBottom: "16px" });
    statsTable(parent);
  }

  // ─── SECTION 1: Macro Pareto ───────────────────────────────────────────────
  function drawMacro(parent, w) {
    const { sec, card } = section(
      parent,
      "s1-macro",
      "一、分布结构：整体集中度",
      "合作是否仍集中于少数核心机构？中国与中东欧两侧的合作结构，是否正在从集中走向扩散？"
    );

    const layout = card
      .append("div")
      .attr("class", "macro-layout")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "24px 28px")
      .style("align-items", "flex-start");

    const chartCol = layout.append("div").attr("class", "macro-chart-col").style("flex", "1 1 340px").style("min-width", "0");
    const sideCol = layout.append("div").attr("class", "macro-side-col").style("flex", "1 1 340px").style("min-width", "0");

    macroSidePanel(sideCol);

    const chartW = Math.max(Math.floor((w - 28) / 2), 320);
    const m = { t: 16, r: 12, b: 48, l: 52 };
    const h = 500;
    const iw = chartW - m.l - m.r;
    const ih = h - m.t - m.b;

    const svg = whiteSvg(chartCol, chartW, h, `0 0 ${chartW} ${h}`);
    const g = svg.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const x = d3.scaleLinear().domain([0, 100]).range([0, iw]);
    const y = d3.scaleLinear().domain([0, 1]).range([ih, 0]);

    g.append("rect")
      .attr("class", "pareto-bg")
      .attr("width", iw)
      .attr("height", ih)
      .attr("fill", "transparent")
      .style("cursor", "default");

    const yAxisGrid = d3.axisLeft(y).ticks(6).tickSize(-iw).tickFormat("");
    const yAxisLabels = d3.axisLeft(y).ticks(6).tickFormat(d3.format(".0%"));

    g.append("g")
      .attr("class", "y-grid")
      .style("pointer-events", "none")
      .call(yAxisGrid)
      .call((sel) => sel.select(".domain").remove())
      .selectAll("line")
      .attr("stroke", C.border)
      .attr("stroke-opacity", 0.55);

    g.append("g")
      .attr("class", "y-axis")
      .style("pointer-events", "none")
      .call(yAxisLabels)
      .call((sel) => sel.select(".domain").attr("stroke", C.border))
      .selectAll("text")
      .attr("fill", C.muted)
      .style("font-size", "11px")
      .style("font-family", C.font);

    const xTicks = d3.range(0, 101, 10);
    const xAxisGrid = d3.axisBottom(x).tickValues(xTicks).tickSize(-ih).tickFormat("");
    const xAxisLabels = d3.axisBottom(x).tickValues(xTicks).tickFormat((d) => `${d}%`);

    g.append("g")
      .attr("class", "x-grid")
      .style("pointer-events", "none")
      .attr("transform", `translate(0,${ih})`)
      .call(xAxisGrid)
      .call((sel) => sel.select(".domain").remove())
      .selectAll("line")
      .attr("stroke", C.border)
      .attr("stroke-opacity", 0.55);

    g.append("g")
      .attr("class", "x-axis")
      .style("pointer-events", "none")
      .attr("transform", `translate(0,${ih})`)
      .call(xAxisLabels)
      .call((sel) => sel.select(".domain").attr("stroke", C.border))
      .selectAll("text")
      .attr("fill", C.muted)
    .style("font-size", "10px")
      .style("font-family", C.font);

    g.append("text")
      .attr("x", iw / 2)
      .attr("y", ih + 36)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "11px")
      .style("font-family", C.font)
      .style("pointer-events", "none")
      .text("机构排名（百分位）");
    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -ih / 2)
      .attr("y", -38)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "11px")
      .style("font-family", C.font)
      .style("pointer-events", "none")
      .text("累计论文份额");

    const line = d3
      .line()
      .x((d) => x(d.x))
      .y((d) => y(d.y))
      .curve(d3.curveMonotoneX);

    const series = [
      { pts: data.pareto.cn15.pts, color: C.chinaLt, dash: "5,4", stat: data.macro.cn15, leg: "中国 2011–2015" },
      { pts: data.pareto.cn20.pts, color: C.china, dash: null, stat: data.macro.cn20, leg: "中国 2016–2020" },
      { pts: data.pareto.ce15.pts, color: C.ceeLt, dash: "5,4", stat: data.macro.ce15, leg: "中东欧 2011–2015" },
      { pts: data.pareto.ce20.pts, color: C.cee, dash: null, stat: data.macro.ce20, leg: "中东欧 2016–2020" }
    ];

    const focus = g.append("g").attr("class", "pareto-focus").style("display", "none").style("pointer-events", "none");
    const vLine = focus
      .append("line")
      .attr("stroke", C.border)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,3");
    const dot = focus.append("circle").attr("r", 4).attr("stroke", C.bg).attr("stroke-width", 1.5);

    function hideParetoFocus() {
      if (S.paretoSeries) return;
      focus.style("display", "none");
      hideTip();
      applyParetoOpacity();
    }

    g.select(".pareto-bg").on("click", () => {
      if (S.paretoSeries) clearParetoSeries();
      else hideParetoFocus();
    });

    series.forEach((s) => {
      g.append("path")
        .attr("class", "macro-curve")
        .attr("data-series", s.leg)
        .attr("data-color", s.color)
        .datum(s.pts)
        .attr("fill", "none")
        .attr("stroke", s.color)
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", s.dash || "none")
        .attr("d", line)
        .style("pointer-events", "none");

      g.append("path")
        .attr("class", "pareto-hit")
        .attr("data-series", s.leg)
        .datum(s.pts)
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 16)
        .attr("d", line)
        .style("cursor", "pointer")
        .on("mousemove", (ev) => {
          if (S.paretoSeries && S.paretoSeries !== s.leg) return;
          showParetoPoint(ev, g.node(), s, x, y, ih, focus, vLine, dot);
        })
        .on("click", (ev) => {
          ev.stopPropagation();
          if (S.paretoSeries && S.paretoSeries !== s.leg) return;
          toggleParetoSeries(s.leg);
          if (S.paretoSeries === s.leg) {
            showParetoPoint(ev, g.node(), s, x, y, ih, focus, vLine, dot);
          }
        })
        .on("mouseout", hideParetoFocus);
    });

    g.on("mouseleave", hideParetoFocus);

    const leg = chartCol
      .append("div")
      .attr("class", "pareto-legend")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("gap", "10px")
      .style("margin-top", "10px")
      .style("font-size", "13px")
      .style("color", C.muted)
      .style("font-family", C.font);

    leg
      .append("span")
      .style("width", "100%")
      .style("font-size", "12px")
      .style("color", C.muted)
      .text("悬停查看数值 · 点击曲线或图例选定 · 再次点击或点击空白取消");

    series.forEach((s) => {
      leg
        .append("button")
        .attr("type", "button")
        .attr("class", "pareto-leg-item button is-small is-light")
        .attr("data-series", s.leg)
        .attr("data-color", s.color)
        .style("cursor", "pointer")
        .style("border", "none")
        .style("padding", "6px 10px")
        .style("font-family", C.font)
        .style("font-size", "13px")
        .style("color", C.text)
        .on("click", (ev) => {
          ev.stopPropagation();
          toggleParetoSeries(s.leg);
        })
        .html(
          `<span style="display:inline-block;width:18px;height:3px;background:${s.color};vertical-align:middle;margin-right:6px;"></span>${s.leg}`
        );
    });

    applyParetoOpacity();
  }

  // ─── SECTION 2: Sankey ─────────────────────────────────────────────────────
  function drawSankey(parent, w) {
    S.sankeySel = { china: null, cee: null };
    S.sankeyPreview = { china: null, cee: null };

    const { sec, card } = section(
      parent,
      "s2-sankey",
      "二、流动结构：层级迁移",
      "机构之间是否出现新的层级流动？原本位于边缘的机构，是否正在进入更核心的位置？"
    );

    const h = 580;
    const layoutGap = 0;
    const tripleCol = w >= 880;
    const m = { t: 32, r: tripleCol ? 0 : 12, b: 40, l: tripleCol ? 0 : 12 };
    const panelW = Math.min(260, Math.max(200, Math.round(w * 0.16)));
    const layout = card
      .append("div")
      .attr("class", "sankey-layout")
      .style("width", "100%")
      .style("align-items", "start");

    if (tripleCol) {
      layout
        .style("display", "grid")
        .style("grid-template-columns", `${panelW}px 1fr ${panelW}px`)
        .style("gap", `${layoutGap}px`);
      createSankeyAnnotPanel(layout, "china", m.t);
    }

    const chartCol = layout
      .append("div")
      .attr("class", "sankey-chart-col")
      .style("min-width", "0")
      .style("margin", "0");
    const chartW = tripleCol ? w - 2 * panelW - 2 * layoutGap : w;
    const svg = whiteSvg(chartCol, chartW, h);
    bindSankeyBlankClear(svg, chartCol);

    if (tripleCol) {
      createSankeyAnnotPanel(layout, "cee", m.t);
    } else {
      const panelRow = card
        .append("div")
        .attr("class", "sankey-panels-row")
        .style("display", "grid")
        .style("grid-template-columns", "1fr 1fr")
        .style("gap", `${layoutGap}px`)
        .style("margin-top", "18px");
      createSankeyAnnotPanel(panelRow, "china");
      createSankeyAnnotPanel(panelRow, "cee");
    }

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
    const aligned = layoutBinsAligned(
      [cnCounts.y2015, cnCounts.y2020, ceCounts.y2015, ceCounts.y2020],
      ih,
      binGap
    );

    function assignFlowBands(flowList, slots) {
      const outSum = Object.fromEntries(BINS.map((b) => [b.id, 0]));
      const inSum = Object.fromEntries(BINS.map((b) => [b.id, 0]));
      flowList.forEach((f) => {
        outSum[f.from] += f.count;
        inSum[f.to] += f.count;
      });
      const outOff = Object.fromEntries(BINS.map((b) => [b.id, 0]));
      const inOff = Object.fromEntries(BINS.map((b) => [b.id, 0]));
      const sorted = flowList.slice().sort((a, b) => {
        const d = binIdx(a.from) - binIdx(b.from);
        return d || binIdx(a.to) - binIdx(b.to);
      });
      return sorted
        .map((f) => {
          const from = slotOf(slots, f.from);
          const to = slotOf(slots, f.to);
          if (!from || !to) return null;
          const pad = 3;
          const outTot = outSum[f.from] || f.count;
          const inTot = inSum[f.to] || f.count;
          const bandOut = (f.count / outTot) * Math.max(from.h - pad * 2, 4);
          const bandIn = (f.count / inTot) * Math.max(to.h - pad * 2, 4);
          const y1 = from.y + pad + outOff[f.from] + bandOut / 2;
          const y2 = to.y + pad + inOff[f.to] + bandIn / 2;
          outOff[f.from] += bandOut;
          inOff[f.to] += bandIn;
          return { f, y1, y2, sw: Math.max(1.5, Math.min(bandOut, bandIn) * 0.92) };
        })
        .filter(Boolean);
    }

    function drawFlows(flowList, x15, x20, region) {
      const maxC = d3.max(flowList, (f) => f.count) || 1;
      const sx = x15 + cw;
      const tx = x20;
      const span = tx - sx;
      const cp1 = sx + span * 0.58;
      const cp2 = tx - span * 0.58;

      assignFlowBands(flowList, aligned).forEach(({ f, y1, y2, sw }) => {
        const op = 0.2 + (f.count / maxC) * 0.65;
        const key = sankeyFlowKey(f);
        g.append("path")
          .attr("class", "sankey-flow")
          .attr("data-key", key)
          .attr("data-region", region)
          .attr("data-from", f.from)
          .attr("data-to", f.to)
          .attr("data-default-opacity", op)
          .attr("data-sw", sw)
          .attr("d", `M${sx},${y1} C${cp1},${y1} ${cp2},${y2} ${tx},${y2}`)
          .attr("fill", "none")
          .attr("stroke", binColor(f.to, region))
          .attr("stroke-width", sw)
          .attr("opacity", op)
          .attr("stroke-linecap", "butt")
          .style("cursor", "pointer")
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

    appendSankeyFootnote(chartCol);
  }

  // ─── SECTION 3: MESO ───────────────────────────────────────────────────────
  let mesoG = null;
  let mesoSvg = null;
  let mesoSec = null;
  let mesoLeftG = null;
  let mesoRightG = null;
  let mesoPowG = null;
  let mesoChartWrap = null;

  function drawMesoControls(sec) {
    sec.select(".meso-ctrl").remove();
    const c = sec
      .append("div")
      .attr("class", "meso-ctrl")
      .style("display", "flex")
      .style("flex-wrap", "wrap")
      .style("align-items", "center")
      .style("gap", "8px")
      .style("margin-bottom", "10px")
      .style("font-family", C.font);

    [
      { k: "state", lb: "当前核心结构" },
      { k: "transition", lb: "权力变迁" }
    ].forEach(({ k, lb }) => {
      c.append("button")
        .attr("type", "button")
        .attr("class", "button is-small")
        .classed("is-dark", S.meso === k)
        .classed("is-light", S.meso !== k)
        .text(lb)
        .on("click", (ev) => {
          ev.stopPropagation();
          if (S.meso === k) return;
          setState({ meso: k });
          buildMeso(true);
        });
    });

    if (S.meso === "transition") {
      drawMesoSortControls(c.append("div").style("display", "flex").style("gap", "6px").style("margin-left", "4px"));
    }
  }

  function drawMesoSortControls(sw) {
    const reopenKey = mesoSortMenuOpen;
    mesoSortMenuOpen = null;

    Object.entries(MESO_SORT_SPECS).forEach(([key, spec]) => {
      const dir = mesoSortDir(key);
      const active = S.sort === key;
      const optLabel = spec.options.find((o) => o.dir === dir)?.label;
      const btnText = active && dir !== "abs" ? optLabel : spec.label;

      const wrap = sw.append("div").attr("class", "meso-sort-dd").style("position", "relative");

      wrap
        .append("button")
        .attr("type", "button")
        .attr("class", "button is-small is-rounded")
        .classed("is-link", active)
        .classed("is-light", !active)
        .attr("data-sort", key)
        .html(`${btnText} <span style="opacity:0.55;font-size:9px;margin-left:2px;">▾</span>`)
        .on("click", (ev) => {
          ev.stopPropagation();
          const wasOpen = mesoSortMenuOpen === key;
          if (S.sort !== key) {
            S.sort = key;
            mesoSortMenuOpen = key;
            updateMesoSort();
            return;
          }
          closeMesoSortMenus();
          if (!wasOpen) {
            wrap.select(".meso-sort-menu").style("display", "block");
            mesoSortMenuOpen = key;
          }
        });

      const menu = wrap
        .append("div")
        .attr("class", "meso-sort-menu")
        .style("display", "none")
        .style("position", "absolute")
        .style("top", "100%")
        .style("left", "0")
        .style("margin-top", "4px")
        .style("min-width", "112px")
        .style("background", C.bg)
        .style("border", `1px solid ${C.border}`)
        .style("border-radius", "6px")
        .style("padding", "4px 0")
        .style("box-shadow", "0 4px 12px rgb(0 0 0 / 0.08)")
        .style("z-index", "20");

      spec.options.forEach((opt) => {
        menu
          .append("button")
          .attr("type", "button")
          .style("display", "block")
          .style("width", "100%")
          .style("text-align", "left")
          .style("padding", "6px 12px")
          .style("border", "none")
          .style("background", "transparent")
          .style("font-family", C.font)
          .style("font-size", "12px")
          .style("color", S.sort === key && mesoSortDir(key) === opt.dir ? C.text : C.muted)
          .style("font-weight", S.sort === key && mesoSortDir(key) === opt.dir ? "600" : "400")
          .style("cursor", "pointer")
          .text(opt.label)
          .on("click", (ev) => {
            ev.stopPropagation();
            applyMesoSort(key, opt.dir);
          })
          .on("mouseenter", function () {
            d3.select(this).style("background", C.bg2);
          })
          .on("mouseleave", function () {
            d3.select(this).style("background", "transparent");
          });
      });

      if (reopenKey === key) {
        menu.style("display", "block");
        mesoSortMenuOpen = key;
      }
    });
  }

  const ELITE_ROWS = TOP_N + 1;
  const MESO_ROW_H_STATE = 38;
  const MESO_ROW_H_POWER = 36;

  function eliteSlotY(slot, rowH, index, total) {
    const base = (slot - 0.5) * rowH;
    if (total <= 1) return base;
    const spread = rowH * 0.72;
    return base - spread / 2 + (index + 0.5) * (spread / total);
  }

  function drawEliteStateSide(g, trajectories, region, panelW, plotH) {
    const barLt = region === "china" ? MESO.chinaBar : MESO.ceeBar;
    const barDk = region === "china" ? MESO.chinaBarDk : MESO.ceeBarDk;
    const maxShare =
      d3.max(trajectories, (t) => Math.max(t.share15, t.share20)) || 0.01;
    const rowH = plotH / ELITE_ROWS;
    const gutterW = 108;
    const gap = 6;
    const barMaxW = (panelW - gutterW - gap) / 2;
    const xShare = d3.scaleLinear().domain([0, maxShare]).range([0, barMaxW]);
    const x15End = barMaxW;
    const x20Start = barMaxW + gutterW + gap;
    const rankCx = barMaxW + gutterW / 2;
    const barH = Math.max(14, rowH * 0.58);

    const overflow15 = trajectories.filter((t) => t.rank15 === ELITE_ROWS);
    const overflow20 = trajectories.filter((t) => t.rank20 === ELITE_ROWS);
    const idx15 = new Map(overflow15.map((t, i) => [t.id, i]));
    const idx20 = new Map(overflow20.map((t, i) => [t.id, i]));

    for (let r = 1; r <= TOP_N; r++) {
      g.append("text")
        .attr("x", rankCx)
        .attr("y", eliteSlotY(r, rowH, 0, 1))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", C.muted)
        .style("font-size", "10px")
        .style("font-weight", "500")
        .style("pointer-events", "none")
        .text(r);
    }
    g.append("text")
      .attr("x", rankCx)
      .attr("y", eliteSlotY(ELITE_ROWS, rowH, 0, 1))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", C.muted)
      .style("font-size", "9px")
      .style("font-weight", "500")
      .style("pointer-events", "none")
      .text("16+");

    g.append("text")
      .attr("x", barMaxW / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text("2011–2015");
    g.append("text")
      .attr("x", x20Start + barMaxW / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "10px")
      .style("pointer-events", "none")
      .text("2016–2020");

    const groups = g
      .selectAll(`.st-${region}`)
      .data(trajectories, (t) => t.id)
      .join("g")
      .attr("class", `st-${region} inst-entity`)
      .attr("data-id", (t) => t.id)
      .attr("data-region", region);

    groups.each(function (t) {
      const d = t.inst;
      const row = d3.select(this);
      const y15 = eliteSlotY(
        t.rank15,
        rowH,
        idx15.get(t.id) ?? 0,
        t.rank15 === ELITE_ROWS ? overflow15.length : 1
      );
      const y20 = eliteSlotY(
        t.rank20,
        rowH,
        idx20.get(t.id) ?? 0,
        t.rank20 === ELITE_ROWS ? overflow20.length : 1
      );
      const w15 = xShare(t.share15);
      const w20 = xShare(t.share20);
      const mx = (x15End + x20Start) / 2;

      row
        .append("path")
        .attr("class", "meso-traj")
        .attr(
          "d",
          `M${x15End},${y15} C${mx},${y15} ${mx},${y20} ${x20Start},${y20}`
        )
        .attr("fill", "none")
        .attr("stroke", MESO.traj)
        .attr("stroke-width", 0.85)
        .attr("opacity", 0.72)
        .style("pointer-events", "none");

      row
        .append("rect")
        .attr("class", "meso-bar")
        .attr("data-mode", "state")
        .attr("data-period", "2015")
        .attr("data-base-fill", barLt)
        .attr("data-base-opacity", 0.92)
        .attr("x", x15End - w15)
        .attr("y", y15 - barH / 2)
        .attr("width", Math.max(0, w15))
        .attr("height", barH)
        .attr("fill", barLt)
        .attr("opacity", 0.92)
        .attr("rx", 2)
        .style("pointer-events", "none");

      row
        .append("rect")
        .attr("class", "meso-bar")
        .attr("data-mode", "state")
        .attr("data-period", "2020")
        .attr("data-base-fill", barDk)
        .attr("data-base-opacity", 0.88)
        .attr("x", x20Start)
        .attr("y", y20 - barH / 2)
        .attr("width", Math.max(0, w20))
        .attr("height", barH)
        .attr("fill", barDk)
        .attr("opacity", 0.88)
        .attr("rx", 2)
        .style("pointer-events", "none");

      row
        .append("text")
        .attr("class", "meso-lbl meso-lbl-15")
        .attr("x", x15End)
        .attr("y", y15)
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .attr("fill", C.text)
        .text(instShortName(d.institution));
      mesoLabelStyle(row.select(".meso-lbl-15"));

      row
        .append("text")
        .attr("class", "meso-lbl meso-lbl-20")
        .attr("x", x20Start)
        .attr("y", y20)
        .attr("text-anchor", "start")
        .attr("dominant-baseline", "middle")
        .attr("fill", C.text)
        .text(instShortName(d.institution));
      mesoLabelStyle(row.select(".meso-lbl-20"));

      row
        .append("path")
        .attr("class", "meso-hit meso-hit-traj")
        .attr("d", `M${x15End},${y15} C${mx},${y15} ${mx},${y20} ${x20Start},${y20}`)
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 16)
        .style("pointer-events", "stroke");

      appendMesoBarHit(row, x15End - w15, y15, w15, barH);
      appendMesoBarHit(row, x20Start, y20, w20, barH);
    });

    bindInst(groups, "state");
    return groups;
  }

  function powerShiftMetric(d) {
    if (S.sort === "rank_change") {
      const r15 = d.rank_2015 >= 1 ? d.rank_2015 : 1;
      const r20 = d.rank_2020 >= 1 ? d.rank_2020 : 1;
      return { base: r15, current: r20, delta: d.rank_change, mode: "rank" };
    }
    if (S.sort === "papers") {
      return { base: d.papers_2015, current: d.papers_2020, delta: papersDelta(d), mode: "papers" };
    }
    return { base: d.share_2015, current: d.share_2020, delta: shareDelta(d), mode: "share" };
  }

  function powerShiftChangeColor(metric) {
    return metric.delta > 0 ? MESO.psGain : metric.delta < 0 ? MESO.psLoss : MESO.psBaseline;
  }

  function powerShiftGrowingVisual(metric) {
    return metric.delta > 0;
  }

  function powerShiftMaxMetric() {
    const rows = [...powerShiftRows("china"), ...powerShiftRows("cee")];
    if (S.sort === "rank_change") {
      return d3.max(rows, (d) => Math.max(d.rank_2015, d.rank_2020, 1)) || TOP_N;
    }
    if (S.sort === "papers") {
      return d3.max(rows, (d) => Math.max(d.papers_2015, d.papers_2020, 1)) || 1;
    }
    return d3.max(rows, (d) => Math.max(d.share_2015, d.share_2020)) || 0.01;
  }

  function powerShiftBaselineLabel() {
    if (S.sort === "rank_change") return "2011–2015 排名";
    if (S.sort === "papers") return "2011–2015 论文量";
    return "2011–2015 基线份额";
  }

  function powerShiftLegendHtml() {
    const baseline = powerShiftBaselineLabel();
    const metric =
      S.sort === "rank_change"
        ? "排名"
        : S.sort === "papers"
          ? "论文量"
          : "份额";
    return (
      `<span><span style="display:inline-block;width:10px;height:10px;background:${MESO.psBaseline};border-radius:1px;margin-right:5px;vertical-align:-1px;"></span>${baseline}（外侧）</span>` +
      `<span><span style="display:inline-block;width:10px;height:10px;background:${MESO.psGain};border-radius:1px;margin-right:5px;vertical-align:-1px;"></span>${S.sort === "rank_change" ? "排名上升" : "正向变化"}</span>` +
      `<span><span style="display:inline-block;width:10px;height:10px;background:${MESO.psLoss};border-radius:1px;margin-right:5px;vertical-align:-1px;"></span>${S.sort === "rank_change" ? "排名下降" : "负向变化"}</span>` +
      `<span>柱长 = ${metric} · 中心 = 结构变化区${mesoSortLegendNote()}</span>`
    );
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

  function drawPowerShiftSide(g, rows, region, layout, xScale) {
    const { plotH, centerX, barMaxW, rankW, nameW, sideMargin, mirror } = layout;
    const isChina = mirror === "left";
    const rowH = plotH / TOP_N;
    const barH = Math.max(14, rowH * 0.56);
    const nameXChina = sideMargin + rankW + 4;
    const nameXCee = centerX + barMaxW + nameW - 4;
    const rankXCee = centerX + barMaxW + nameW + rankW / 2;

    for (let i = 0; i < rows.length; i++) {
      const rankX = isChina ? sideMargin + rankW / 2 : rankXCee;
      g.append("text")
        .attr("class", "meso-rank-axis")
        .attr("x", rankX)
        .attr("y", (i + 0.5) * rowH)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", C.muted)
        .style("font-size", "10px")
        .style("font-weight", "500")
        .style("pointer-events", "none")
        .text(i + 1);
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
      const metric = powerShiftMetric(d);
      const w15 = xScale(metric.base);
      const w20 = xScale(metric.current);
      const wDelta = xScale(Math.abs(metric.delta));
      const changeFill = powerShiftChangeColor(metric);
      const growing = powerShiftGrowingVisual(metric);
      const yBar = cy - barH / 2;

      row
        .append("rect")
        .attr("class", "meso-hit")
        .attr("x", isChina ? sideMargin : centerX - 2)
        .attr("y", 0)
        .attr("width", isChina ? centerX - sideMargin + 4 : barMaxW + nameW + rankW + 10)
        .attr("height", rowH)
        .attr("fill", "transparent")
        .style("pointer-events", "all");

      if (isChina) {
        if (growing) {
          appendPowerShiftBar(row, "base", MESO.psBaseline, 0.72, centerX - w15 - wDelta, yBar, w15, barH);
          appendPowerShiftBar(row, "change", changeFill, 0.9, centerX - wDelta, yBar, wDelta, barH);
        } else {
          appendPowerShiftBar(row, "base", MESO.psBaseline, 0.72, centerX - w15, yBar, w20, barH);
          appendPowerShiftBar(row, "change", changeFill, 0.88, centerX - wDelta, yBar, wDelta, barH);
        }
        row
          .append("text")
          .attr("class", "meso-lbl")
          .attr("x", nameXChina)
          .attr("y", cy)
          .attr("text-anchor", "start")
          .attr("dominant-baseline", "middle")
          .attr("fill", C.text)
          .text(instShortName(d.institution));
      } else {
        if (growing) {
          appendPowerShiftBar(row, "change", changeFill, 0.9, centerX, yBar, wDelta, barH);
          appendPowerShiftBar(row, "base", MESO.psBaseline, 0.72, centerX + wDelta, yBar, w15, barH);
        } else {
          appendPowerShiftBar(row, "change", changeFill, 0.88, centerX, yBar, wDelta, barH);
          appendPowerShiftBar(row, "base", MESO.psBaseline, 0.72, centerX + wDelta, yBar, w20, barH);
        }
        row
          .append("text")
          .attr("class", "meso-lbl")
          .attr("x", nameXCee)
          .attr("y", cy)
          .attr("text-anchor", "end")
          .attr("dominant-baseline", "middle")
          .attr("fill", C.text)
          .text(instShortName(d.institution));
      }
      mesoLabelStyle(row.select(".meso-lbl"));
    });

    bindInst(groups, "transition");
    return groups;
  }

  function drawPowerShiftView(g, plotH, chartW) {
    const margin = 24;
    const centerGap = 10;
    const plotW = chartW - 2 * margin;
    const halfW = (plotW - centerGap) / 2;
    const chinaCenterX = margin + halfW;
    const ceeCenterX = chinaCenterX + centerGap;
    const rankW = 16;
    const nameW = 76;
    const barMaxW = Math.max(40, halfW - rankW - nameW - 8);
    const maxVal = powerShiftMaxMetric();
    const xScale = d3.scaleLinear().domain([0, maxVal * 1.06]).range([0, barMaxW]);
    const baselineLb = powerShiftBaselineLabel();

    g.append("line")
      .attr("class", "ps-center-axis")
      .attr("x1", chinaCenterX)
      .attr("x2", ceeCenterX)
      .attr("y1", 0)
      .attr("y2", plotH)
      .attr("stroke", C.border)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "2,4")
      .attr("opacity", 0.55)
      .style("pointer-events", "none");

    g.append("text")
      .attr("x", (chinaCenterX + ceeCenterX) / 2)
      .attr("y", plotH + 14)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "9px")
      .style("font-weight", "500")
      .style("pointer-events", "none")
      .text("结构变化区");

    g.append("text")
      .attr("x", margin + (halfW - barMaxW) / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "9px")
      .style("pointer-events", "none")
      .text(`${baselineLb} ←`);

    g.append("text")
      .attr("x", ceeCenterX + barMaxW + (halfW - barMaxW) / 2)
      .attr("y", -12)
      .attr("text-anchor", "middle")
      .attr("fill", C.muted)
      .style("font-size", "9px")
      .style("pointer-events", "none")
      .text(`→ ${baselineLb}`);

    const chinaLayout = {
      plotH,
      centerX: chinaCenterX,
      barMaxW,
      rankW,
      nameW,
      sideMargin: margin,
      mirror: "left"
    };
    const ceeLayout = {
      plotH,
      centerX: ceeCenterX,
      barMaxW,
      rankW,
      nameW,
      sideMargin: margin,
      mirror: "right"
    };

    drawPowerShiftSide(g, powerShiftRows("china"), "china", chinaLayout, xScale);
    drawPowerShiftSide(g, powerShiftRows("cee"), "cee", ceeLayout, xScale);
  }

  function buildMeso(rebuildSection) {
    const panelW = 228;
    const layoutGap = 12;
    const w = widthOf();
    const tripleCol = w >= 880;
    const chartW = tripleCol ? Math.max(320, w - 2 * panelW - 2 * layoutGap) : Math.max(320, w - 16);
    const half = (chartW - 48) / 2;
    const plotHState = ELITE_ROWS * MESO_ROW_H_STATE + 20;
    const plotHPow = TOP_N * MESO_ROW_H_POWER + 20;
    const plotH = S.meso === "state" ? plotHState : plotHPow;
    const h = plotH + 60;
    const chartTop = 40;

    if (rebuildSection || !mesoSec) {
      if (mesoSec) mesoSec.remove();
      const { sec, card } = section(
        d3.select(`${ROOT} .il-root`),
        "s3-meso",
        "三、权力结构：Top15 核心机构",
        "哪些机构持续主导合作网络？哪些机构正在快速上升，并重新塑造合作结构？"
      );
      mesoSec = sec;
      sec
        .append("p")
        .attr("class", "meso-hint")
        .style("font-family", C.font)
        .style("font-size", "13px")
        .style("color", C.muted)
        .style("margin", "0 0 10px")
        .style("line-height", "1.55")
        .text(mesoNarrative());

      drawMesoControls(sec);

      const layout = card
        .append("div")
        .attr("class", "meso-layout")
        .style("width", "100%")
        .style("align-items", "start");

      if (tripleCol) {
        layout
          .style("display", "grid")
          .style("grid-template-columns", `${panelW}px 1fr ${panelW}px`)
          .style("gap", `${layoutGap}px`);
        createMesoDetailPanel(layout, "china", chartTop);
        mesoChartWrap = layout.append("div").attr("class", "meso-chart-wrap").style("min-width", "0");
        createMesoDetailPanel(layout, "cee", chartTop);
      } else {
        mesoChartWrap = layout.append("div").attr("class", "meso-chart-wrap");
        const panelRow = card
          .append("div")
          .attr("class", "meso-panels-row")
          .style("display", "grid")
          .style("grid-template-columns", "1fr 1fr")
          .style("gap", `${layoutGap}px`)
          .style("margin-top", "14px");
        createMesoDetailPanel(panelRow, "china");
        createMesoDetailPanel(panelRow, "cee");
      }

      mesoSvg = whiteSvg(mesoChartWrap, chartW, h);
      mesoG = mesoSvg.append("g").attr("transform", "translate(24,40)");

      card.append("div").attr("class", "trans-legend-wrap");
    } else {
      mesoSvg.attr("width", chartW).attr("height", h);
      mesoChartWrap.select("svg").attr("width", chartW);
      mesoG.selectAll("*").remove();
      mesoSec.select(".meso-hint").text(mesoNarrative());
      mesoSec.select(".trans-legend-wrap").selectAll("*").remove();
      drawMesoControls(mesoSec);
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

    const margin = 24;
    const centerGap = 10;
    const plotW = chartW - 2 * margin;
    const halfW = (plotW - centerGap) / 2;
    const chinaCenterX = margin + halfW;
    const ceeCenterX = chinaCenterX + centerGap;

    mesoG
      .insert("rect", "rect:nth-child(2)")
      .attr("class", "meso-bg-china")
      .attr("x", -24)
      .attr("y", -40)
      .attr("width", chinaCenterX + 24)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .style("pointer-events", "all");
    bindMesoRegionBg(mesoG.select(".meso-bg-china"), "china");

    mesoG
      .insert("rect", "rect:nth-child(3)")
      .attr("class", "meso-bg-cee")
      .attr("x", ceeCenterX)
      .attr("y", -40)
      .attr("width", chartW - ceeCenterX + 24)
      .attr("height", h)
      .attr("fill", "transparent")
      .style("cursor", "default")
      .style("pointer-events", "all");
    bindMesoRegionBg(mesoG.select(".meso-bg-cee"), "cee");

    mesoG
      .append("text")
      .attr("class", "meso-region-title")
      .attr("x", S.meso === "state" ? half / 2 : (margin + chinaCenterX) / 2)
      .attr("y", -16)
      .attr("text-anchor", "middle")
      .attr("fill", C.china)
      .style("font-weight", "600")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .text("中国");
    mesoG
      .append("text")
      .attr("class", "meso-region-title")
      .attr("x", S.meso === "state" ? half + half / 2 : (ceeCenterX + chartW - margin) / 2)
      .attr("y", -16)
      .attr("text-anchor", "middle")
      .attr("fill", C.cee)
      .style("font-weight", "600")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .text("中东欧");

    mesoLeftG = null;
    mesoRightG = null;
    mesoPowG = null;

    if (S.meso === "state") {
      mesoLeftG = mesoG.append("g");
      mesoRightG = mesoG.append("g").attr("transform", `translate(${half + 24},0)`);
      drawEliteStateSide(mesoLeftG, data.top15.elite.china, "china", half - 12, plotH);
      drawEliteStateSide(mesoRightG, data.top15.elite.cee, "cee", half - 12, plotH);
    } else {
      mesoPowG = mesoG.append("g").attr("class", "meso-pow");
      drawPowerShiftView(mesoPowG, plotH, chartW);
      updatePowerShiftLegend();
    }

    restoreMesoPanels();
    syncFocus();
  }

  function updateMesoSort() {
    if (S.meso !== "transition" || !mesoPowG) {
      buildMeso(true);
      return;
    }

    const panelW = 228;
    const layoutGap = 12;
    const w = widthOf();
    const tripleCol = w >= 880;
    const chartW = tripleCol ? Math.max(320, w - 2 * panelW - 2 * layoutGap) : Math.max(320, w - 16);
    const plotH = TOP_N * MESO_ROW_H_POWER + 20;

    drawMesoControls(mesoSec);
    mesoSec.select(".meso-hint").text(mesoNarrative());

    mesoPowG.selectAll("*").remove();
    drawPowerShiftView(mesoPowG, plotH, chartW);
    updatePowerShiftLegend();

    restoreMesoPanels();
    syncFocus();
  }

  // ─── orchestration ─────────────────────────────────────────────────────────
  function render() {
    const w = widthOf();
    $root.select(".il-root").remove();

    const root = $root
    .append("div")
      .attr("class", "il-root")
      .style("position", "relative")
      .style("font-family", C.font)
      .style("width", "100%");

    const intro = root
      .append("div")
      .attr("class", "il-intro")
      .style("margin", "0 0 28px")
      .style("line-height", "1.75")
      .style("font-size", "15px")
      .style("color", C.text)
      .style("font-family", C.font);

    intro
      .append("p")
      .style("margin", "0 0 14px")
      .text(
        "本节并非简单展示机构排名，而是试图从结构层面理解中国—中东欧学术合作中的机构格局如何变化：哪些机构长期处于核心位置，哪些机构正在崛起，以及合作体系是否正在从少数头部机构主导，逐渐走向更广泛的参与。"
      );

    intro
      .append("p")
      .style("margin", "0")
      .text(
        "我们从整体分布出发，逐步下钻到具体机构，观察合作结构如何演化、层级如何流动，以及不同机构在系统中的位置如何发生变化。"
      );

    drawMacro(root, w);
    drawSankey(root, w);
    mesoSec = null;
    mesoG = null;
    mesoSvg = null;
    buildMeso(true);
  }

  function init() {
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
      d3.csv("static/data/cee_institution.csv")
    ])
      .then(([cn, ce]) => {
        data = buildDataset(cn, ce);
        $root.select(".il-loading").remove();
        render();

        $root.on("click", () => {
          closeMesoSortMenus();
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
