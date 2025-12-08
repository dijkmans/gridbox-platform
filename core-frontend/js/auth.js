// ============================================
// AUTH.JS
// Login, tokenbeheer, tenant info & branding
// ============================================

// Zet dit op jouw echte Cloud Run URL
export const API_BASE = "https://jouw-cloud-run-url/api";

// Bepalen of we op de loginpagina staan
const isLoginPage =
  location.pathname.includes("login.html") ||
  location.pathname.endsWith("/") ||
  location.pathname.endsWith("/login");

// -------------------------------------------------
// LOGIN-FLOW
// -------------------------------------------------
if (isLoginPage) {
  const btn = document.getElementById("btnLogin");
  const errorMsg = document.getElementById("errorMsg");

  // Toon branding indien al bekend
  loadTenantBranding();

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

      // Tenant opslaan
      if (data.tenant) {
        localStorage.setItem("tenant", JSON.stringify(data.tenant));

        // Branding opslaan (voor loginpagina)
        localStorage.setItem("tenantBranding", JSON.stringify({
          brandName: data.tenant.brandName,
          stylesheet: data.tenant.stylesheet || null
        }));
      }

      // Ga naar dashboard
      location.href = "index.html";

    } catch (err) {
      console.error("Login fout:", err);
      errorMsg.textContent = "Netwerkfout. Probeer opnieuw.";
    }
  });
}

// -------------------------------------------------
// FUNCTIES: Token & Tenant ophalen
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
  localStorage.removeItem("tenantBranding");
  location.href = "login.html";
}

// -------------------------------------------------
// BEVEILIGING: Dashboard beschermen
// -------------------------------------------------
if (!isLoginPage) {
  const token = getToken();
  if (!token) location.href = "login.html";
}

// -------------------------------------------------
// BRANDING: tenant naam + stylesheet tonen
// -------------------------------------------------
export function loadTenantBranding() {
  const raw = localStorage.getItem("tenantBranding");
  if (!raw) return;

  const tenant = JSON.parse(raw);

  // Brand naam zetten
  if (tenant.brandName && document.getElementById("brandName")) {
    document.getElementById("brandName").textContent = tenant.brandName;
  }

  // Titel aanpassen
  if (tenant.brandName && document.getElementById("pageTitle")) {
    document.getElementById("pageTitle").textContent = tenant.brandName + " Login";
  }

  // Stylesheet inladen
  if (tenant.stylesheet) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = tenant.stylesheet;
    document.head.appendChild(link);
  }
}
