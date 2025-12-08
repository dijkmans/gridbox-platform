// ---------------------------------------
// Basis config
// ---------------------------------------
export const API_BASE = "https://jouw-cloud-run-url/api";

// Controleren of we op login.html staan
const isLoginPage =
  location.pathname.includes("login.html") ||
  location.pathname.endsWith("/login") ||
  location.pathname === "/login";

// ---------------------------------------
// Login logica
// ---------------------------------------
if (isLoginPage) {
  const btn = document.getElementById("btnLogin");
  const errorMsg = document.getElementById("errorMsg");

  btn.addEventListener("click", async () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    errorMsg.textContent = "";

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

      localStorage.setItem("token", data.token);
      localStorage.setItem("tenant", JSON.stringify(data.tenant));

      location.href = "index.html";
    } catch (err) {
      errorMsg.textContent = "Netwerkfout";
    }
  });
}

// ---------------------------------------
// Token helpers
// ---------------------------------------
export function getToken() {
  return localStorage.getItem("token");
}

export function getTenant() {
  const raw = localStorage.getItem("tenant");
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("tenant");
  location.href = "login.html";
}

// ---------------------------------------
// Dashboard beveiligen
// ---------------------------------------
if (!isLoginPage) {
  const token = getToken();
  if (!token) location.href = "login.html";
}
