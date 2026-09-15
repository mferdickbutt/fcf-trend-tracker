#!/usr/bin/env node
/**
 * Bake FCF summary metrics and the monthly table into index.html.
 * First paint must work with no JavaScript.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var FCF = require("../js/fcf.js");

var root = path.join(__dirname, "..");
var dataPath = path.join(root, "data", "fcf.json");
var outPath = path.join(root, "index.html");

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cls(delta, kind) {
  var n = FCF.toNumberOrNull(delta);
  if (n === null) return "";
  var shown = kind === "pts" ? Math.round(n * 1000) / 10 : Math.round(n * 10) / 10;
  if (shown === 0) return "";
  return shown > 0 ? "up" : "down";
}

function targetClass(cmp) {
  if (!cmp) return "";
  return cmp.met ? "met" : "miss";
}

function vsLabel(cmp, asPercent) {
  if (!cmp) return "—";
  var delta = asPercent ? FCF.formatPts(cmp.delta) : FCF.formatSignedMoney(cmp.delta);
  return (cmp.met ? "Above target " : "Below target ") + delta;
}

var data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
var analyzed = FCF.analyzeSeries(data);
var summary = analyzed.summary;
var meta = data.meta || {};
var entity = meta.entity || "FCF tracker";
var unit = meta.unitLabel || "$M";

var maxAbs = 1;
analyzed.months.forEach(function (row) {
  var n = FCF.toNumberOrNull(row.fcf);
  if (n !== null) maxAbs = Math.max(maxAbs, Math.abs(n));
});

var bars = analyzed.months
  .map(function (row) {
    var n = FCF.toNumberOrNull(row.fcf) || 0;
    var h = Math.max(4, Math.round((Math.abs(n) / maxAbs) * 72));
    var below = row.vsFcfTarget && !row.vsFcfTarget.met ? " below" : "";
    return (
      '<div class="bar' +
      below +
      '" style="height:' +
      h +
      'px" title="' +
      esc(row.month || "") +
      " FCF " +
      esc(FCF.formatMoney(row.fcf)) +
      '"></div>'
    );
  })
  .join("");

var monthRows = analyzed.months
  .map(function (row) {
    var vs = row.vsFcfTarget
      ? (row.vsFcfTarget.met ? "Met " : "Missed ") + FCF.formatSignedMoney(row.vsFcfTarget.delta)
      : "—";
    return [
      '<tr data-month="' + esc(row.month || "") + '">',
      "<td>" + esc(row.month || "—") + "</td>",
      "<td>" + esc(FCF.formatMoney(row.ocf, "")) + "</td>",
      "<td>" + esc(FCF.formatMoney(row.capex, "")) + "</td>",
      "<td>" + esc(FCF.formatMoney(row.fcf, "")) + "</td>",
      "<td>" + esc(FCF.formatPercent(row.margin)) + "</td>",
      '<td class="' + cls(row.momFcf) + '">' + esc(FCF.formatSignedMoney(row.momFcf, "")) + "</td>",
      '<td class="' + cls(row.momMargin, "pts") + '">' + esc(FCF.formatPts(row.momMargin)) + "</td>",
      "<td>" + esc(FCF.formatMoney(row.cumulativeFcf, "")) + "</td>",
      '<td class="' + targetClass(row.vsFcfTarget) + '">' + esc(vs) + "</td>",
      "</tr>"
    ].join("");
  })
  .join("\n");

var html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Free Cash Flow Trend Tracker — ${esc(entity)}</title>
  <meta name="description" content="Static first-paint FCF tracker: OCF, capex, FCF, FCF margin, MoM change, cumulative FCF, and target comparison.">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <a class="skip" href="#monthly-table">Skip to monthly table</a>
  <header>
    <h1>Free Cash Flow Trend Tracker</h1>
    <p class="lede">${esc(entity)} · ${esc(meta.currency || "USD")} ${esc(meta.unit || "millions")} (${esc(unit)}) · ${esc(String(summary.monthCount))} months (${esc(meta.seriesStart || "")}–${esc(meta.seriesEnd || "")})</p>
  </header>

  <section class="metrics" aria-label="FCF summary metrics">
    <article class="metric">
      <h2>Operating cash flow (OCF)</h2>
      <div class="value">${esc(FCF.formatMoney(summary.latestOcf))}</div>
      <div class="sub">Latest month ${esc(summary.latestMonth || "—")}</div>
    </article>
    <article class="metric">
      <h2>Capex</h2>
      <div class="value">${esc(FCF.formatMoney(summary.latestCapex))}</div>
      <div class="sub">Positive outflow (spend)</div>
    </article>
    <article class="metric">
      <h2>Free cash flow (FCF)</h2>
      <div class="value">${esc(FCF.formatMoney(summary.latestFcf))}</div>
      <div class="sub">${esc(FCF.FCF_FORMULA)}</div>
    </article>
    <article class="metric">
      <h2>FCF margin</h2>
      <div class="value">${esc(FCF.formatPercent(summary.latestMargin))}</div>
      <div class="sub">${esc(FCF.MARGIN_FORMULA)}</div>
    </article>
    <article class="metric">
      <h2>MoM change on FCF</h2>
      <div class="value ${cls(summary.momFcf)}">${esc(FCF.formatSignedMoney(summary.momFcf))}</div>
      <div class="sub">${esc(FCF.formatSignedPercent(summary.momFcfPct))} vs prior month</div>
    </article>
    <article class="metric">
      <h2>MoM change on margin</h2>
      <div class="value ${cls(summary.momMargin, "pts")}">${esc(FCF.formatPts(summary.momMargin))}</div>
      <div class="sub">Percentage-point change</div>
    </article>
    <article class="metric">
      <h2>Cumulative FCF</h2>
      <div class="value">${esc(FCF.formatMoney(summary.cumulativeFcf))}</div>
      <div class="sub">Sum of monthly FCF over the series</div>
    </article>
    <article class="metric ${targetClass(summary.vsFcfTarget)}">
      <h2>Target comparison</h2>
      <div class="value">${esc(vsLabel(summary.vsFcfTarget, false))}</div>
      <div class="sub">FCF target ${esc(FCF.formatMoney(summary.vsFcfTarget && summary.vsFcfTarget.target))} · margin ${esc(vsLabel(summary.vsMarginTarget, true))}</div>
    </article>
  </section>

  <h2 class="section">Monthly FCF trend</h2>
  <div class="bars" aria-hidden="true">${bars}</div>

  <div class="table-wrap">
    <table id="monthly-table">
      <caption>Monthly OCF, capex, FCF, FCF margin, MoM change, cumulative FCF, and target comparison</caption>
      <thead>
        <tr>
          <th scope="col">Month</th>
          <th scope="col">OCF</th>
          <th scope="col">Capex</th>
          <th scope="col">FCF</th>
          <th scope="col">FCF margin</th>
          <th scope="col">MoM FCF</th>
          <th scope="col">MoM margin</th>
          <th scope="col">Cumulative FCF</th>
          <th scope="col">vs FCF target</th>
        </tr>
      </thead>
      <tbody>
${monthRows}
      </tbody>
    </table>
  </div>

  <section id="formulas">
    <h2 class="section">Formulas and conventions</h2>
    <ul>
      <li><strong>Capex sign convention:</strong> ${esc(meta.capexSignConventionNote || "Capex is a positive cash outflow.")}</li>
      <li><strong>Free cash flow:</strong> ${esc(meta.fcfFormula || FCF.FCF_FORMULA)}</li>
      <li><strong>FCF margin:</strong> ${esc(meta.fcfMarginFormulaNote || FCF.MARGIN_FORMULA)}</li>
      <li><strong>MoM change:</strong> current − previous. Percent change uses |previous| as the denominator and returns null when previous is zero.</li>
      <li><strong>Cumulative FCF:</strong> running sum of monthly free cash flow.</li>
      <li><strong>Target comparison:</strong> actual − target; a month meets the FCF target when actual ≥ target (${esc(FCF.formatMoney(data.targets && data.targets.fcf))} FCF, ${esc(FCF.formatPercent(data.targets && data.targets.fcfMargin))} margin).</li>
    </ul>
    <p class="note">${esc(String(summary.monthsAboveFcfTarget))} of ${esc(String(summary.monthCount))} months met the FCF target. Null, empty, or non-finite inputs return null rather than NaN or Infinity.</p>
  </section>

  <p id="js-hint" class="js-only note"></p>

  <footer>
    <p>Static first-paint HTML — no JavaScript required to read OCF, capex, FCF, margin, or cumulative FCF. Re-render with <code>node scripts/render-static.js</code>.</p>
  </footer>
  <script src="js/fcf.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
`;

fs.writeFileSync(outPath, html);
process.stdout.write("Wrote " + outPath + " (" + summary.monthCount + " months)\n");
