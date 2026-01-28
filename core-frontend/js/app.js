// =====================================================
// APP.JS - Gridbox Dashboard (Optimized Version)
// =====================================================

import { api } from "./api.js";
import { getTenant, logout } from "./auth.js";

// HTML-elementen
const sectionsContainer = document.getElementById("sections");
const filterDropdown = document.getElementById("filter");
const searchInput = document.getElementById("search");
const logoutBtn = document.getElementById("logoutBtn");

// Panels
const panelShares = document.getElementById("shares");
const panelPlanner = document.getElementById("planner");

// Pictures modal
const pm = document.getElementById("pictureModal");
const pmImg = document.getElementById("pmImage");
const pmPrev = document.getElementById("pmPrev");
const pmNext = document.getElementById("pmNext");
const pmClose = document.getElementById("pmClose");

let pictureList = [];
let pictureIndex = 0;

// -----------------------------------------------------
// INITIALISATIE
// -----------------------------------------------------

init();

async function init() {
  applyTenantBranding();
  logoutBtn.addEventListener("click", logout);

  const groups = await api.getBoxes();
  renderGroups(groups);

  // Planner knoppen automatisch koppelen
  document.querySelectorAll("[data-plan-group]").forEach(btn => {
    btn.onclick = () => openPlannerForGroup(btn.dataset.planGroup);
  });

  filterDropdown.addEventListener("change", () => filterGroups(groups));
  searchInput.addEventListener("input", () => filterGroups(groups));

  setupPanelClosers();
  setupPictureModal();
}

// -----------------------------------------------------
// 1. TENANT BRANDING
// -----------------------------------------------------

function applyTenantBranding() {
  const tenant = getTenant();
  if (!tenant) return;

  if (tenant.brandName) {
    document.getElementById("brandName").textContent = tenant.brandName;
    document.getElementById("pageTitle").textContent = tenant.brandName + " Dashboard";
  }

  if (tenant.stylesheet) {
    document.getElementById("brandStyles").href = tenant.stylesheet;
  }
}

// -----------------------------------------------------
// 2. GROEPEN RENDEREN
// -----------------------------------------------------

function renderGroups(groups) {
  sectionsContainer.innerHTML = "";
  filterDropdown.innerHTML = `<option value="all">Alle groepen</option>`;

  groups.forEach(group => {
    const opt = document.createElement("option");
    opt.value = group.group;
    opt.textContent = group.group;
    filterDropdown.appendChild(opt);
  });

  groups.forEach(group => {
    const section = document.createElement("section");
    section.classList.add("gb-section");
    section.dataset.group = group.group;

    section.innerHTML = `
      <h3 class="gb-section__title">
        <button class="gb-groupbtn" data-plan-group="${group.group}">
          ${group.group} <span class="badge" hidden>0</span>
        </button>
      </h3>
      <div class="gb-list"></div>
    `;

    const list = section.querySelector(".gb-list");
    group.boxes.forEach(box => list.appendChild(createBoxCard(box, group.group)));

    sectionsContainer.appendChild(section);
  });
}

// -----------------------------------------------------
// 3. BOX-CARD AANMAKEN
// -----------------------------------------------------

function createBoxCard(box, groupName) {
  const card = document.createElement("article");
  card.classList.add("gb-card");
  card.dataset.site = groupName;
  card.dataset.boxId = box.id;
  card.dataset.boxNumber = box.boxNumber;

  // We bepalen de initiële tekst op basis van de status van de box
  const initialAction = (box.shutterState === 'open') ? 'CLOSE' : 'OPEN';

  card.innerHTML = `
    <div class="gb-head">
      <div class="gb-site">${groupName}</div>
      <div class="gb-box"># ${box.boxNumber}</div>
      <div class="gb-time">${box.lastOpenedText || ""}</div>
    </div>

    <ul class="gb-phones" data-phones></ul>

    <div class="gb-actions">
      <button class="gb-btn" data-action="toggle">${initialAction}</button>
      <div class="gb-row">
        <button class="gb-btn--ghost" data-action="events">EVENTS</button>
        <button class="gb-btn--ghost" data-action="shares">SHARES</button>
        <button class="gb-btn--ghost" data-action="pictures">PICTURES</button>
      </div>
    </div>
  `;

  setupCardActions(card, box, groupName);
  return card;
}

// -----------------------------------------------------
// 4. BOX ACTIES (Aangepast voor directe feedback)
// -----------------------------------------------------

function setupCardActions(card, box, groupName) {
  const btnToggle = card.querySelector('[data-action="toggle"]');
  const btnEvents = card.querySelector('[data-action="events"]');
  const btnShares = card.querySelector('[data-action="shares"]');
  const btnPictures = card.querySelector('[data-action="pictures"]');

  btnToggle.addEventListener("click", async () => {
    // 1. Bewaar de huidige staat en bepaal de nieuwe tekst
    const currentStatus = btnToggle.textContent.trim().toUpperCase();
    const nextStatus = (currentStatus === 'OPEN') ? 'CLOSE' : 'OPEN';

    // 2. Directe visuele feedback (Optimistic UI)
    btnToggle.textContent = "..."; // Kort tonen dat er actie is
    btnToggle.disabled = true;

    try {
      // 3. Stuur de instructie naar de API
      await api.toggleBox(box.id);
      
      // 4. Update de knop direct naar de volgende gewenste actie
      btnToggle.textContent = nextStatus;
      btnToggle.disabled = false;
      
      // Optioneel: subtiele melding in console
      console.log(`Gridbox ${box.id} opdracht verzonden: ${currentStatus}`);

    } catch (error) {
      // 5. Herstel bij fout (Rollback)
      console.error("Fout bij aansturen box:", error);
      btnToggle.textContent = currentStatus; 
      btnToggle.disabled = false;
      alert("Fout: Kon de Gridbox niet bereiken. Controleer de verbinding.");
    }
  });

  btnEvents.addEventListener("click", () => openEventsPanel(box.id));
  btnShares.addEventListener("click", () => openSharesPanel(box.id));
  btnPictures.addEventListener("click", () => openPicturesPanel(box.id));
}

// -----------------------------------------------------
// 5. FILTER / ZOEKEN
// -----------------------------------------------------

function filterGroups(groups) {
  const selected = filterDropdown.value;
  const search = searchInput.value.toLowerCase();

  document.querySelectorAll(".gb-section").forEach(section => {
    const group = section.dataset.group;
    let visible = true;

    if (selected !== "all" && group !== selected) visible = false;

    if (visible && search.length > 0) {
      const text = section.textContent.toLowerCase();
      if (!text.includes(search)) visible = false;
    }

    section.style.display = visible ? "" : "none";
  });
}

// -----------------------------------------------------
// 6. PANEL MANAGEMENT
// -----------------------------------------------------

function setupPanelClosers() {
  document.getElementById("sharesClose").onclick = () => closePanel(panelShares);
  document.getElementById("plannerClose").onclick = () => closePanel(panelPlanner);
}

function openPanel(panel) {
  panel.classList.add("open");
}

function closePanel(panel) {
  panel.classList.remove("open");
}

// -----------------------------------------------------
// 7. SHARES PANEL
// -----------------------------------------------------

async function openSharesPanel(boxId) {
  openPanel(panelShares);
  document.getElementById("shareBox").value = boxId;

  const tableBody = document.querySelector("#sharesTable tbody");
  tableBody.innerHTML = "<tr><td colspan='5'>Laden...</td></tr>";

  const shares = await api.getShares(boxId);
  tableBody.innerHTML = "";

  shares.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.time}</td>
      <td>${s.phone}</td>
      <td>${s.comment || ""}</td>
      <td>${s.status}</td>
      <td>×</td>
    `;
    tableBody.appendChild(tr);
  });

  document.getElementById("shareAdd").onclick = async () => {
    const body = {
      phone: document.getElementById("sharePhone").value,
      comment: document.getElementById("shareComment").value,
      authorized: document.getElementById("shareAuth").checked
    };

    await api.addShare(boxId, body);
    openSharesPanel(boxId); 
  };
}

// -----------------------------------------------------
// 8. EVENTS PANEL
// -----------------------------------------------------

async function openEventsPanel(boxId) {
  alert("Events worden geladen voor box: " + boxId);
}

// -----------------------------------------------------
// 9. PICTURES FULLSCREEN VIEWER
// -----------------------------------------------------

async function openPicturesPanel(boxId) {
  pictureList = await api.getPictures(boxId);
  pictureIndex = 0;

  if (!pictureList || !pictureList.length) {
    alert("Geen foto's beschikbaar voor deze box.");
    return;
  }

  showPicture(0);
  pm.hidden = false;
}

function setupPictureModal() {
  pmClose.onclick = () => (pm.hidden = true);
  pmPrev.onclick = () => showPicture(pictureIndex - 1);
  pmNext.onclick = () => showPicture(pictureIndex + 1);
}

function showPicture(index) {
  if (index < 0 || index >= pictureList.length) return;
  pictureIndex = index;
  pmImg.src = pictureList[pictureIndex].url;
}

// -----------------------------------------------------
// 10. PLANNER PANEL
// -----------------------------------------------------

async function openPlannerForGroup(groupName) {
  document.getElementById("planGroup").value = groupName;
  openPanel(panelPlanner);

  const rows = await api.getPlanning(groupName);

  const tbody = document.querySelector("#planTable tbody");
  tbody.innerHTML = "";

  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${r.phone}</td>
      <td>${r.box || ""}</td>
      <td>${r.comment || ""}</td>
      <td>${r.status}</td>
      <td>×</td>
    `;
    tbody.appendChild(tr);
  });
}
