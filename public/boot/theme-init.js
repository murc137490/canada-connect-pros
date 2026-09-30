/**
 * Runs before paint. Sets boot theme and html lang from the same keys as LanguageProvider.
 * Legacy storage keys are read so returning visitors keep their saved language.
 */
(function () {
  try {
    var stored = localStorage.getItem("altshift-locale") || localStorage.getItem("premiere-locale");
    if (stored !== "en" && stored !== "fr") {
      var cookie = document.cookie || "";
      var current = cookie.match(/(?:^|; )altshift-locale=(fr|en)(?:;|$)/);
      var legacy = cookie.match(/(?:^|; )premiere-locale=(fr|en)(?:;|$)/);
      stored = (current && current[1]) || (legacy && legacy[1]) || "fr";
    }
    document.documentElement.lang = stored === "en" ? "en" : "fr";
  } catch (e) {
    document.documentElement.lang = "fr";
  }

  try {
    var theme = localStorage.getItem("altshift-theme");
    var dark =
      theme === "dark" ||
      ((theme === "system" || theme === null) &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-boot-theme", dark ? "dark" : "light");
  } catch (e) {
    document.documentElement.setAttribute("data-boot-theme", "light");
  }
})();
