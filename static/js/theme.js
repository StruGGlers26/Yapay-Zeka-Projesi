window.RutinTheme = {
  init() {
    const saved = localStorage.getItem("rutin_theme") || "light";
    this.apply(saved);
    const btn = RutinUtils.$("btn_theme_toggle");
    if (btn) {
      btn.addEventListener("click", () => {
        const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        this.apply(next);
        localStorage.setItem("rutin_theme", next);
      });
    }
  },
  apply(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    const btn = RutinUtils.$("btn_theme_toggle");
    if (btn) btn.textContent = mode === "dark" ? "🌙" : "☀️";
  },
};
