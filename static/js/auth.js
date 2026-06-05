/**
 * Giriş ekranı — app.js'den bağımsız; ekran geçişi burada garanti edilir.
 */
(function () {
  function authEl() {
    return document.getElementById("auth_screen");
  }
  function appEl() {
    return document.getElementById("app_shell");
  }
  function errEl() {
    return document.getElementById("auth_error");
  }

  function showApp() {
    const auth = authEl();
    const app = appEl();
    if (auth) auth.classList.add("is-hidden");
    if (app) app.classList.add("is-active");
    document.body.classList.add("app-ready");
  }

  function showAuth() {
    const auth = authEl();
    const app = appEl();
    if (auth) auth.classList.remove("is-hidden");
    if (app) app.classList.remove("is-active");
    document.body.classList.remove("app-ready");
  }

  function setError(msg) {
    const el = errEl();
    if (!el) return;
    if (!msg) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    el.textContent = msg;
  }

  window.RutinUI = { showApp, showAuth, setError };

  async function afterLogin(user) {
    if (!user) {
      setError("Sunucudan kullanıcı bilgisi alınamadı.");
      return;
    }
    window.__currentUser = user;
    showApp();
    if (window.RutinApp && typeof window.RutinApp.onLogin === "function") {
      try {
        await window.RutinApp.onLogin(user);
      } catch (e) {
        console.error(e);
        setError("Rutin yüklenirken hata: " + (e.message || e));
      }
    }
  }

  async function postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      /* boş gövde */
    }
    if (!res.ok) {
      throw new Error(data.error || "İşlem başarısız (" + res.status + ").");
    }
    return data;
  }

  const loginForm = document.getElementById("login_form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("");
      const btn = loginForm.querySelector('button[type="submit"]');
      const prevText = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Giriş yapılıyor…";
      }
      try {
        const data = await postJson("/api/auth/login", {
          username: document.getElementById("login_username").value.trim(),
          password: document.getElementById("login_password").value,
        });
        await afterLogin(data.user);
      } catch (err) {
        setError(err.message || "Giriş yapılamadı.");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prevText || "Giriş yap";
        }
      }
    });
  }

  const registerForm = document.getElementById("register_form");
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setError("");
      const btn = registerForm.querySelector('button[type="submit"]');
      const prevText = btn ? btn.textContent : "";
      if (btn) {
        btn.disabled = true;
        btn.textContent = "Kaydediliyor…";
      }
      try {
        const data = await postJson("/api/auth/register", {
          username: document.getElementById("reg_username").value.trim(),
          password: document.getElementById("reg_password").value,
          display_name: document.getElementById("reg_display_name").value.trim(),
        });
        await afterLogin(data.user);
      } catch (err) {
        setError(err.message || "Kayıt yapılamadı.");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = prevText || "Hesap oluştur";
        }
      }
    });
  }

  document.querySelectorAll(".auth-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.authTab;
      document.querySelectorAll(".auth-tab").forEach((b) => {
        b.classList.toggle("active", b.dataset.authTab === tab);
      });
      if (loginForm) loginForm.hidden = tab !== "login";
      if (registerForm) registerForm.hidden = tab !== "register";
      setError("");
    });
  });

  const logoutBtn = document.getElementById("btn_logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.__currentUser = null;
      const backdrop = document.getElementById("user_menu_backdrop");
      if (backdrop) backdrop.hidden = true;
      if (window.RutinApp && typeof window.RutinApp.onLogout === "function") {
        window.RutinApp.onLogout();
      }
      showAuth();
    });
  }

  (async function checkSession() {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!res.ok) {
        showAuth();
        return;
      }
      const data = await res.json();
      if (data.user) {
        await afterLogin(data.user);
      } else {
        showAuth();
      }
    } catch {
      showAuth();
    }
  })();
})();
