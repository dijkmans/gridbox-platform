// =====================================================
// APP.JS - Gridbox Dashboard (ULTRA-RESPONSIVE)
// =====================================================

import { api } from "./api.js";
import { getTenant, logout } from "./auth.js";

const sectionsContainer = document.getElementById("sections");
const filterDropdown = document.getElementById("filter");
const searchInput = document.getElementById("search");
const logoutBtn = document.getElementById("logoutBtn");

const panelShares = document.getElementById("shares");
const panelPlanner = document.getElementById("planner");

const pm = document.getElementById("pictureModal");
const pmImg = document.getElementById("pmImage");
const pmPrev = document.getElementById("pmPrev");
const pmNext = document.getElementById("pmNext");
const pmClose = document.getElementById("pmClose");

let pictureList = [];
let pictureIndex = 0;

init();

async function init() {
  applyTenantBranding();
  logoutBtn.addEventListener("click", logout);

  const groups = await api.getBoxes();
  renderGroups(groups);

  document.querySelectorAll("[data-plan-group]").forEach(btn => {
    btn.onclick = () => openPlannerForGroup(btn.dataset.planGroup);
  });

  filterDropdown.addEventListener("change", () => filterGroups(groups));
  searchInput.addEventListener("input", () => filterGroups(groups));

  setupPanelClosers();
  setupPictureModal();
}

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

function renderGroups(groups) {
  sectionsContainer.innerHTML = "";
  filterDropdown.innerHTML = `<option value="all">Alle groepen</option>`;

  groups.forEach(group => {
    const opt = document.createElement("option");
    opt.value = group.group;
    opt.textContent = group.group;
    filterDropdown.appendChild(opt);

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

function createBoxCard(box, groupName) {
  const card = document.createElement("article");
  card.classList.add("gb-card");
  card.dataset.boxId = box.id;

  // Bepaal start-tekst op basis van huidige status in Firestore
  const actionText = (box.shutterState === "open") ? "CLOSE" : "OPEN";

  card.innerHTML = `
    <div class="gb-head">
      <div class="gb-site">${groupName}</div>
      <div class="gb-box"># ${box.boxNumber}</div>
      <div class="gb-time">${box.lastOpenedText || ""}</div>
    </div>
    <div class="gb-actions">
      <button class="gb-btn" data-action="toggle">${actionText}</button>
      <div class="gb-row">
        <button class="gb-btn--ghost" data-action="events">EVENTS</button>
        <button class="gb-btn--ghost" data-action="shares">SHARES</button>
        <button class="gb-btn--ghost" data-action="pictures">PICTURES</button>
      </div>
    </div>
  `;

  setupCardActions(card, box);
  return card;
}

// ⭐ DE BELANGRIJKSTE WIJZIGING HIERONDER ⭐
function setupCardActions(card, box) {
  const btnToggle = card.querySelector('[data-action="toggle"]');

  btnToggle.addEventListener("click", async () => {
    const oldText = btnToggle.textContent.trim().toUpperCase();
    const newText = (oldText === "OPEN") ? "CLOSE" : "OPEN";

    // 1. Directe visuele wissel (geen "Verzenden..." tekst meer)
    btnToggle.textContent = newText;
    btnToggle.classList.add("loading"); // Optioneel: voeg een class toe voor een subtiel effect

    try {
      // 2. Stuur opdracht naar de cloud
      await api.toggleBox(box.id);
      console.log(`Succes: Instructie ${oldText} -> ${newText} gestuurd.`);
    } catch (error) {
      // 3. Alleen bij echte fout terugzetten naar oude tekst
      btnToggle.textContent = oldText;
      alert("Gridbox kon niet worden bereikt.");
    } finally {
      btnToggle.classList.remove("loading");
    }
  });

  card.querySelector('[data-action="events"]').onclick = () => alert("Events voor " + box.id);
  card.querySelector('[data-action="shares"]').onclick = () => openSharesPanel(box.id);
  card.querySelector('[data-action="pictures"]').onclick = () => openPicturesPanel(box.id);
}

function filterGroups(groups) {
  const selected = filterDropdown.value;
  const search = searchInput.value.toLowerCase();
  document.querySelectorAll(".gb-section").forEach(section => {
    const group = section.dataset.group;
    let visible = (selected === "all" || group === selected);
    if (visible && search.length > 0 && !section.textContent.toLowerCase().includes(search)) visible = false;
    section.style.display = visible ? "" : "none";
  });
}

function setupPanelClosers() {
  document.getElementById("sharesClose").onclick = () => panelShares.classList.remove("open");
  document.getElementById("plannerClose").onclick = () => panelPlanner.classList.remove("open");
}

async function openSharesPanel(boxId) {
  panelShares.classList.add("open");
  const tableBody = document.querySelector("#sharesTable tbody");
  tableBody.innerHTML = "<tr><td>Laden...</td></tr>";
  const shares = await api.getShares(boxId);
  tableBody.innerHTML = shares.map(s => `
    <tr>
      <td>${s.time}</td>
      <td>${s.phone}</td>
      <td>${s.comment || ""}</td>
      <td>${s.status}</td>
      <td>×</td>
    </tr>
  `).join("");
}

async function openPicturesPanel(boxId) {
  pictureList = await api.getPictures(boxId);
  if (!pictureList.length) return alert("Geen foto's");
  showPicture(0);
  pm.hidden = false;
}

function setupPictureModal() {
  pmClose.onclick = () => (pm.hidden = true);
  pmPrev.onclick = () => showPicture(pictureIndex - 1);
  pmNext.onclick = () => showPicture(pictureIndex + 1);
}

function showPicture(index) {
  if (index >= 0 && index < pictureList.length) {
    pictureIndex = index;
    pmImg.src = pictureList[pictureIndex].url;
  }
}

async function openPlannerForGroup(groupName) {
  panelPlanner.classList.add("open");
  const rows = await api.getPlanning(groupName);
  document.querySelector("#planTable tbody").innerHTML = rows.map(r => `
    <tr><td>${r.date}</td><td>${r.phone}</td><td>${r.box || ""}</td><td>${r.status}</td><td>×</td></tr>
  `).join("");
}
