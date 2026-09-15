/**
 * Free cash flow (FCF) analytics — works in browsers and Node.
 *
 * Capex sign convention: positive_outflow (spend). FCF = OCF − |capex|.
 * FCF margin = FCF / revenue.
 *
 * Invalid, missing, or non-finite inputs return null — never NaN or Infinity.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.FCF = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var CAPEX_SIGN = "positive_outflow";
  var FCF_FORMULA = "FCF = OCF − |capex|";
  var MARGIN_FORMULA = "FCF / revenue";

  function toNumberOrNull(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "string" && value.trim() === "") return null;
    var n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  }

  function emptySummary() {
    return {
      monthCount: 0,
      latestMonth: null,
      latestOcf: null,
      latestCapex: null,
      latestFcf: null,
      latestRevenue: null,
      latestMargin: null,
      momFcf: null,
      momFcfPct: null,
      momMargin: null,
      momMarginPts: null,
      cumulativeFcf: null,
      vsFcfTarget: null,
      vsMarginTarget: null,
      monthsAboveFcfTarget: 0,
      monthsBelowFcfTarget: 0
    };
  }

  function emptyResult(meta, targets) {
    return {
      months: [],
      summary: emptySummary(),
      meta: meta || null,
      targets: targets || null
    };
  }

  /**
   * Free cash flow. Zero OCF or zero capex is valid (not null).
   * Null/non-finite inputs return null.
   */
  function computeFcf(ocf, capex) {
    var o = toNumberOrNull(ocf);
    var c = toNumberOrNull(capex);
    if (o === null || c === null) return null;
    var fcf = o - Math.abs(c);
    return Number.isFinite(fcf) ? fcf : null;
  }

  /**
   * FCF margin = FCF / revenue.
   * Zero or missing revenue returns null (no division by zero).
   */
  function computeFcfMargin(fcf, revenue) {
    var f = toNumberOrNull(fcf);
    var r = toNumberOrNull(revenue);
    if (f === null || r === null) return null;
    if (r === 0) return null;
    var margin = f / r;
    return Number.isFinite(margin) ? margin : null;
  }

  function momChange(current, previous) {
    var c = toNumberOrNull(current);
    var p = toNumberOrNull(previous);
    if (c === null || p === null) return null;
    var delta = c - p;
    return Number.isFinite(delta) ? delta : null;
  }

  function momChangePct(current, previous) {
    var c = toNumberOrNull(current);
    var p = toNumberOrNull(previous);
    if (c === null || p === null) return null;
    if (p === 0) return null;
    var pct = (c - p) / Math.abs(p);
    return Number.isFinite(pct) ? pct : null;
  }

  /**
   * Compare a value to a target. Higher-is-better (FCF, margin).
   * pct is null when the target is zero so we never emit Infinity.
   */
  function compareToTarget(value, target) {
    var v = toNumberOrNull(value);
    var t = toNumberOrNull(target);
    if (v === null || t === null) return null;
    var delta = v - t;
    if (!Number.isFinite(delta)) return null;
    var pct = null;
    if (t !== 0) {
      var raw = delta / Math.abs(t);
      pct = Number.isFinite(raw) ? raw : null;
    }
    return {
      actual: v,
      target: t,
      delta: delta,
      pct: pct,
      met: v >= t
    };
  }

  function analyzeSeries(input, options) {
    var opts = options || {};
    if (input == null) return emptyResult(null, opts.targets || null);

    var monthsIn = Array.isArray(input)
      ? input
      : Array.isArray(input.months)
        ? input.months
        : null;
    var targets = (input && input.targets) || opts.targets || null;
    var meta = (!Array.isArray(input) && input && input.meta) || opts.meta || null;

    if (!monthsIn || monthsIn.length === 0) {
      return emptyResult(meta, targets);
    }

    var running = null;
    var prevFcf = null;
    var prevMargin = null;
    var months = [];
    var above = 0;
    var below = 0;
    var defaultFcfTarget = targets ? toNumberOrNull(targets.fcf) : null;
    var defaultMarginTarget = targets ? toNumberOrNull(targets.fcfMargin) : null;

    for (var i = 0; i < monthsIn.length; i++) {
      var row = monthsIn[i] || {};
      var ocf = toNumberOrNull(row.ocf);
      var capex = toNumberOrNull(row.capex);
      var revenue = toNumberOrNull(row.revenue);
      var fcf;
      if (Object.prototype.hasOwnProperty.call(row, "fcf") && row.fcf !== null && row.fcf !== undefined && row.fcf !== "") {
        fcf = toNumberOrNull(row.fcf);
      } else {
        fcf = computeFcf(ocf, capex);
      }
      var margin = computeFcfMargin(fcf, revenue);

      if (fcf !== null) {
        running = (running === null ? 0 : running) + fcf;
        if (!Number.isFinite(running)) running = null;
      }

      var fcfTarget = toNumberOrNull(row.fcfTarget);
      if (fcfTarget === null) fcfTarget = defaultFcfTarget;
      var marginTarget = toNumberOrNull(row.fcfMarginTarget);
      if (marginTarget === null) marginTarget = defaultMarginTarget;

      var vsFcf = compareToTarget(fcf, fcfTarget);
      var vsMargin = compareToTarget(margin, marginTarget);
      if (vsFcf) {
        if (vsFcf.met) above += 1;
        else below += 1;
      }

      months.push({
        month: row.month || null,
        ocf: ocf,
        capex: capex,
        revenue: revenue,
        fcf: fcf,
        margin: margin,
        momFcf: momChange(fcf, prevFcf),
        momFcfPct: momChangePct(fcf, prevFcf),
        momMargin: momChange(margin, prevMargin),
        cumulativeFcf: running,
        fcfTarget: fcfTarget,
        fcfMarginTarget: marginTarget,
        vsFcfTarget: vsFcf,
        vsMarginTarget: vsMargin
      });

      prevFcf = fcf;
      prevMargin = margin;
    }

    var last = months[months.length - 1];
    return {
      months: months,
      summary: {
        monthCount: months.length,
        latestMonth: last.month,
        latestOcf: last.ocf,
        latestCapex: last.capex,
        latestFcf: last.fcf,
        latestRevenue: last.revenue,
        latestMargin: last.margin,
        momFcf: last.momFcf,
        momFcfPct: last.momFcfPct,
        momMargin: last.momMargin,
        momMarginPts: last.momMargin,
        cumulativeFcf: last.cumulativeFcf,
        vsFcfTarget: last.vsFcfTarget,
        vsMarginTarget: last.vsMarginTarget,
        monthsAboveFcfTarget: above,
        monthsBelowFcfTarget: below
      },
      meta: meta,
      targets: targets
    };
  }

  function formatMoney(value, unitLabel) {
    var n = toNumberOrNull(value);
    if (n === null) return "—";
    var unit = unitLabel == null ? "M" : unitLabel;
    var sign = n < 0 ? "−" : "";
    return sign + "$" + Math.abs(n).toFixed(1) + unit;
  }

  function formatSignedMoney(value, unitLabel) {
    var n = toNumberOrNull(value);
    if (n === null) return "—";
    var unit = unitLabel == null ? "M" : unitLabel;
    var sign = n > 0 ? "+" : n < 0 ? "−" : "";
    return sign + "$" + Math.abs(n).toFixed(1) + unit;
  }

  function formatPercent(value, digits) {
    var n = toNumberOrNull(value);
    if (n === null) return "—";
    var d = digits == null ? 1 : digits;
    return (n * 100).toFixed(d) + "%";
  }

  function formatSignedPercent(value, digits) {
    var n = toNumberOrNull(value);
    if (n === null) return "—";
    var d = digits == null ? 1 : digits;
    var pct = n * 100;
    var sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
    return sign + Math.abs(pct).toFixed(d) + "%";
  }

  function formatPts(value, digits) {
    var n = toNumberOrNull(value);
    if (n === null) return "—";
    var d = digits == null ? 1 : digits;
    var pts = n * 100;
    var sign = pts > 0 ? "+" : pts < 0 ? "−" : "";
    return sign + Math.abs(pts).toFixed(d) + " pts";
  }

  return {
    CAPEX_SIGN: CAPEX_SIGN,
    FCF_FORMULA: FCF_FORMULA,
    MARGIN_FORMULA: MARGIN_FORMULA,
    toNumberOrNull: toNumberOrNull,
    computeFcf: computeFcf,
    computeFcfMargin: computeFcfMargin,
    momChange: momChange,
    momChangePct: momChangePct,
    compareToTarget: compareToTarget,
    analyzeSeries: analyzeSeries,
    formatMoney: formatMoney,
    formatSignedMoney: formatSignedMoney,
    formatPercent: formatPercent,
    formatSignedPercent: formatSignedPercent,
    formatPts: formatPts
  };
});
