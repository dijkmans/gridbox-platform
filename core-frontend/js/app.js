// =====================================================
// APP.JS - Gridbox Dashboard (ROLUIK READY)
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

// -----------------------------------------------------
// INIT
// -----------------------------------------------------
async function init() {
  applyTenantBranding();
  logoutBtn.addEventListener("click", logout);

  const groups = await api.getBoxes();
  renderGroups(groups);

  filterDropdown.addEventListener("change", () => filterGroups(groups));
  searchInput.addEventListener("input", () => filterGroups(groups));

  setupPanelClosers();
  setupPictureModal();
}

// -----------------------------------------------------
// BRANDING
// -----------------------------------------------------
function applyTenantBranding() {
  const tenant = getTenant();
  if (!tenant) return;

  if (tenant.brandName) {
    document.getElementById("brandName").textContent = tenant.brandName;
    document.getElementById("pageTitle").textContent =
      tenant.brandName + " Dashboard";
  }

  if (tenant.stylesheet) {
    document.getElementById("brandStyles").href = tenant.stylesheet;
  }
}

// -----------------------------------------------------
// RENDER GROUPS + BOXES
// -----------------------------------------------------
function renderGroups(groups) {
  sectionsContainer.innerHTML = "";
  filterDropdown.innerHTML = `<option value="all">Alle groepen</option>`;

  groups.forEach(group => {
    const opt = document.createElement("option");
    opt.value = group.group;
    opt.textContent = group.group;
    filterDropdown.appendChild(opt);

    const section = document.createElement("section");
    section.className = "gb-section";
    section.dataset.group = group.group;

    section.innerHTML = `
      <h3 class="gb-section__title">
        ${group.group}
      </h3>
      <div class="gb-list"></div>
    `;

    const list = section.querySelector(".gb-list");
    group.boxes.forEach(box => {
      list.appendChild(createBoxCard(box, group.group));
    });

    sectionsContainer.appendChild(section);
  });
}

// -----------------------------------------------------
// CREATE BOX CARD (MET ROLUIK)
// -----------------------------------------------------
function createBoxCard(box, groupName) {
  const card = document.createElement("article");
  card.className = "gb-card";
  card.dataset.boxId = box.id;

  const shutterState = box.shutterState || box.door || "closed";
  const buttonText = shutterState === "open" ? "CLOSE" : "OPEN";

  card.innerHTML = `
    <div class="gb-head">
      <div class="gb-site">${groupName}</div>
      <div class="gb-box"># ${box.boxNumber}</div>
      <div class="gb-time">${box.lastOpenedText || ""}</div>
    </div>

    <div class="gb-body">

      <div class="gb-rolluik-wrapper">
        <div class="gb-rolluik"></div>
      </div>
      <div class="gb-rolluik-label">–</div>

      <div class="gb-actions">
        <button class="gb-btn" data-action="toggle">${buttonText}</button>
        <div class="gb-row">
          <button class="gb-btn--ghost" data-action="events">EVENTS</button>
          <button class="gb-btn--ghost" data-action="shares">SHARES</button>
          <button class="gb-btn--ghost" data-action="pictures">PICTURES</button>
        </div>
      </div>

    </div>
  `;

  applyRolluikState(card, shutterState);
  setupCardActions(card, box);

  return card;
}

// -----------------------------------------------------
// ROLUIK STATE (PER KAART)
// -----------------------------------------------------
function applyRolluikState(card, state) {
  const rolluik = card.querySelector(".gb-rolluik");
  const label = card.querySelector(".gb-rolluik-label");
  if (!rolluik) return;

  rolluik.classList.remove(
    "is-open",
    "is-opening",
    "is-closing"
  );

  switch (state) {
    case "open":
      rolluik.classList.add("is-open");
      label.textContent = "Open";
      break;

    case "opening":
      rolluik.classList.add("is-opening");
      label.textContent = "Bezig met openen";
      break;

    case "closing":
      rolluik.classList.add("is-closing");
      label.textContent = "Bezig met sluiten";
      break;

    case "closed":
    default:
      label.textContent = "Gesloten";
      break;
  }
}

// -----------------------------------------------------
// CARD ACTIONS
// -----------------------------------------------------
function setupCardActions(card, box) {
  const btnToggle = card.querySelector('[data-action="toggle"]');

  btnToggle.onclick = async () => {
    const currentText = btnToggle.textContent.trim();
    const nextAction = currentText === "OPEN" ? "open" : "close";

    // Optimistische UI
    btnToggle.textContent = nextAction === "open" ? "CLOSE" : "OPEN";
    applyRolluikState(card, nextAction === "open" ? "opening" : "closing");

    try {
      await api.toggleBox(box.id);
    } catch (err) {
      // rollback
      btnToggle.textContent = currentText;
      applyRolluikState(card, box.shutterState || "closed");
      alert("Gridbox niet bereikbaar");
    }
  };

  card.querySelector('[data-action="events"]').onclick =
    () => alert("Events voor " + box.id);

  card.querySelector('[data-action="shares"]').onclick =
    () => openSharesPanel(box.id);

  card.querySelector('[data-action="pictures"]').onclick =
    () => openPicturesPanel(box.id);
}

// -----------------------------------------------------
// FILTERING
// -----------------------------------------------------
function filterGroups(groups) {
  const selected = filterDropdown.value;
  const search = searchInput.value.toLowerCase();

  document.querySelectorAll(".gb-section").forEach(section => {
    let visible =
      selected === "all" || section.dataset.group === selected;

    if (
      visible &&
      search &&
      !section.textContent.toLowerCase().includes(search)
    ) {
      visible = false;
    }

    section.style.display = visible ? "" : "none";
  });
}

// -----------------------------------------------------
// PANELS + MODALS
// -----------------------------------------------------
function setupPanelClosers() {
  document.getElementById("sharesClose").onclick =
    () => panelShares.classList.remove("open");

  document.getElementById("plannerClose").onclick =
    () => panelPlanner.classList.remove("open");
}

async function openSharesPanel(boxId) {
  panelShares.classList.add("open");
  const tbody = document.querySelector("#sharesTable tbody");
  tbody.innerHTML = "<tr><td>Laden…</td></tr>";

  const shares = await api.getShares(boxId);
  tbody.innerHTML = shares.map(s => `
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
  if (index < 0 || index >= pictureList.length) return;
  pictureIndex = index;
  pmImg.src = pictureList[pictureIndex].url;
}
