// ============================================
// AUTH.JS
// Login, tokenbeheer, tenant info, beveiliging
// ============================================

// Vervang deze URL door jouw echte Cloud Run API URL
export const API_BASE = "https://jouw-cloud-run-url/api";

// Bepalen of we op de loginpagina zitten
const isLoginPage =
  location.pathname.includes("login.html") ||
  location.pathname.endsWith("/login") ||
  location.pathname === "/login";

// -------------------------------------------------
// LOGIN-FLOW
// -------------------------------------------------
if (isLoginPage) {
  const btn = document.getElementById("btnLogin");
  const errorMsg = document.getElementById("errorMsg");

  btn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    errorMsg.textContent = "";

    if (!username || !password) {
      errorMsg.textContent = "Vul je gegevens in";
      return;
    }

    try {
      const res = await fetch(API_BASE + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.ok) {
        errorMsg.textContent = "Ongeldige login";
        return;
      }

      const data = await res.json();

      // Token opslaan
      localStorage.setItem("token", data.token);

      // Tenant opslaan (branding, toegangsrechten, klant-specifieke instellingen)
      if (data.tenant) {
        localStorage.setItem("tenant", JSON.stringify(data.tenant));
      }

      // Redirect naar dashboard
      location.href = "index.html";
    } catch (err) {
      console.error(err);
      errorMsg.textContent = "Netwerkfout. Probeer opnieuw.";
    }
  });
}

// -------------------------------------------------
// TOKEN HELPERS
// -------------------------------------------------
export function getToken() {
  return localStorage.getItem("token");
}

export function getTenant() {
  const t = localStorage.getItem("tenant");
  return t ? JSON.parse(t) : null;
}

// -------------------------------------------------
// LOGOUT
// -------------------------------------------------
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("tenant");
  location.href = "login.html";
}

// -------------------------------------------------
// BEVEILIGEN VAN DASHBOARD
// -------------------------------------------------
if (!isLoginPage) {
  const token = getToken();
  if (!token) {
    location.href = "login.html";
  }
}

