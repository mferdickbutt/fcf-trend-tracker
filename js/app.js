/**
 * Optional enhancement only. First paint is already complete in index.html.
 * This script never replaces the summary or table with a loading shell.
 */
(function () {
  if (typeof FCF === "undefined") return;
  document.documentElement.classList.add("js-enhanced");

  var hint = document.getElementById("js-hint");
  if (hint) {
    hint.textContent =
      "JavaScript is active for progressive enhancement. Core FCF metrics and the monthly table are already in the HTML.";
  }

  var rows = document.querySelectorAll("tbody tr[data-month]");
  if (rows.length) {
    rows[rows.length - 1].setAttribute("data-latest", "true");
  }
})();
