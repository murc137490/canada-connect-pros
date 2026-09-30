(function () {
  var boot = document.getElementById("altshift-boot");
  if (!boot) return;

  var finished = false;
  var MAX_MS = 11000;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function finish() {
    if (finished) return;
    finished = true;
    boot.classList.add("is-done");
    window.setTimeout(function () {
      if (boot.parentNode) boot.parentNode.removeChild(boot);
    }, 450);
  }

  window.addEventListener("altshift-app-ready", finish);
  window.__altshiftMarkAppReady = finish;
  window.setTimeout(finish, reduceMotion ? 300 : MAX_MS);
})();
