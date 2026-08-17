let allData = [];
let selectedCommunities = ["OC"]; // Max 2
let currentRound = "1";
let currentSort = { column: "sno", ascending: true };
let currentPage = 1;
let pageSize = 200;
let choiceList = JSON.parse(localStorage.getItem("tnea_choices") || "[]");

let selectedColleges = [];
let selectedBranches = [];

let uniqueCollegesList = [];
let uniqueBranchesList = [];

const tableBody = document.getElementById("tableBody");
const tableHeaderRow = document.getElementById("tableHeaderRow");
const choiceCount = document.getElementById("choiceCount");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfo = document.getElementById("pageInfo");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const jumpPageInput = document.getElementById("jumpPageInput");
const roundSelect = document.getElementById("roundSelect");

// Round Selection Listener (Keeps Round 1, 2, 3, 4 dropdown functional)
if (roundSelect) {
  roundSelect.addEventListener("change", (e) => {
    currentRound = e.target.value;
    console.log("Active TNEA Round switched to:", currentRound);
    currentPage = 1;
    renderTable();
  });
}

// 1. Fetch Data via Manifest Chunks (Zero Data Loss)
async function loadData() {
  try {
    const manifestRes = await fetch("manifest.json");
    const partFiles = await manifestRes.json();
    
    allData = [];
    for (const file of partFiles) {
      const partRes = await fetch(file);
      const partData = await partRes.json();
      allData = allData.concat(partData);
    }
    
    console.log(`Successfully loaded all ${allData.length} records from chunks!`);
    setupDropdowns();
    updateTableHeader();
    renderTable();
    updateChoiceUI();
  } catch (err) {
    console.error("Error loading data chunks via manifest.json:", err);
  }
}

// Run on startup
loadData();

// 2. Community Pill Logic (Max 2)
document.querySelectorAll(".comm-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    const comm = pill.getAttribute("data-comm");
    if (selectedCommunities.includes(comm)) {
      if (selectedCommunities.length === 1) return; // Keep at least 1
      selectedCommunities = selectedCommunities.filter(c => c !== comm);
      pill.classList.remove("active");
    } else {
      if (selectedCommunities.length >= 2) {
        const first = selectedCommunities.shift();
        document.querySelector(`.comm-pill[data-comm="${first}"]`).classList.remove("active");
      }
      selectedCommunities.push(comm);
      pill.classList.add("active");
    }
    updateTableHeader();
    currentPage = 1;
    renderTable();
  });
});

function updateTableHeader() {
  const comm1 = selectedCommunities[0] || "OC";
  const comm2 = selectedCommunities[1] || "";

  let headersHtml = `
    <th data-sort="sno">S.NO</th>
    <th data-sort="college_name">COLLEGE\nNAME</th>
    <th data-sort="college_code">COLLEGE\nCODE</th>
    <th data-sort="branch_name">BRANCH\nNAME</th>
  `;

  if (selectedCommunities.length === 2) {
    headersHtml += `
      <th data-sort="closing_rank_1">CLOSING RANKS\n${comm1}</th>
      <th data-sort="closing_rank_2">CLOSING RANKS\n${comm2}</th>
    `;
  } else {
    headersHtml += `
      <th data-sort="closing_rank">CLOSING\nRANKS</th>
    `;
  }

  headersHtml += `
    <th data-sort="avg_oc">AVG OC\nCUTOFF</th>
  `;

  if (selectedCommunities.length === 2) {
    headersHtml += `
      <th data-sort="allotments_1">ALLOTMENTS\n${comm1}</th>
      <th data-sort="allotments_2">ALLOTMENTS\n${comm2}</th>
    `;
  } else {
    headersHtml += `
      <th data-sort="allotments">ALLOTMENTS\n${comm1}</th>
    `;
  }

  headersHtml += `
    <th>ACTION</th>
  `;

  tableHeaderRow.innerHTML = headersHtml;

  tableHeaderRow.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (currentSort.column === col) { currentSort.ascending = !currentSort.ascending; }
      else { currentSort.column = col; currentSort.ascending = true; }
      currentPage = 1;
      renderTable();
    });
  });
}

// 3. Searchable Dropdowns with Tag Pills
function setupDropdowns() {
  const collegesMap = new Map();
  const branchesMap = new Map();

  allData.forEach(row => {
    collegesMap.set(row.college_code.toString(), row.college_name);
    branchesMap.set(row.branch_code.toString(), row.branch_name);
  });

  uniqueCollegesList = Array.from(collegesMap.entries()).map(([code, name]) => ({ code, name }));
  uniqueBranchesList = Array.from(branchesMap.entries()).map(([code, name]) => ({ code, name }));

  setupDropdown("collegeInput", "collegeDropdownList", "collegeTags", uniqueCollegesList, selectedColleges, (selected) => {
    selectedColleges = selected;
    currentPage = 1;
    renderTable();
  });

  setupDropdown("branchInput", "branchDropdownList", "branchTags", uniqueBranchesList, selectedBranches, (selected) => {
    selectedBranches = selected;
    currentPage = 1;
    renderTable();
  });
}

function setupDropdown(inputId, listId, tagsId, items, selectedArray, onChange) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  const tagsContainer = document.getElementById(tagsId);

  const renderTags = () => {
    tagsContainer.innerHTML = "";
    selectedArray.forEach(code => {
      const item = items.find(i => i.code === code);
      const label = item ? `${item.name.substring(0, 20)}... (${code})` : code;
      const tag = document.createElement("div");
      tag.className = "tag-pill";
      tag.innerHTML = `<span>${label}</span><button type="button">&times;</button>`;
      tag.querySelector("button").addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = selectedArray.indexOf(code);
        if (idx > -1) {
          selectedArray.splice(idx, 1);
          renderTags();
          renderList(input.value.toLowerCase());
          onChange(selectedArray);
        }
      });
      tagsContainer.appendChild(tag);
    });
  };

  const renderList = (filterText = "") => {
    list.innerHTML = "";
    const filtered = items.filter(i => 
      i.name.toLowerCase().includes(filterText) || i.code.toLowerCase().includes(filterText)
    );

    filtered.forEach(item => {
      const div = document.createElement("div");
      div.className = "dropdown-item";
      const isSelected = selectedArray.includes(item.code);
      if (isSelected) div.classList.add("selected");

      div.innerHTML = `<span>${item.name} (${item.code})</span> ${isSelected ? '✓' : ''}`;
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        if (selectedArray.includes(item.code)) {
          selectedArray.splice(selectedArray.indexOf(item.code), 1);
        } else {
          selectedArray.push(item.code);
        }
        input.value = "";
        renderTags();
        renderList("");
        onChange(selectedArray);
      });
      list.appendChild(div);
    });

    list.classList.toggle("hidden", filtered.length === 0);
  };

  input.addEventListener("focus", () => renderList(input.value.toLowerCase()));
  input.addEventListener("input", () => renderList(input.value.toLowerCase()));

  document.addEventListener("click", (e) => {
    const container = input.closest(".dropdown-container");
    if (!container.contains(e.target)) {
      list.classList.add("hidden");
    }
  });

  renderTags();
}

// 4. Filtering & Sorting
function getFilteredAndSortedData() {
  let filtered = allData.filter(row => {
    const matchCollege = selectedColleges.length === 0 || selectedColleges.includes(row.college_code.toString());
    const matchBranch = selectedBranches.length === 0 || selectedBranches.includes(row.branch_code.toString());
    return matchCollege && matchBranch;
  });

  filtered.sort((a, b) => {
    let valA, valB;
    const primaryComm = selectedCommunities[0];

    switch (currentSort.column) {
      case "sno":
      case "college_code":
        valA = Number(a.college_code);
        valB = Number(b.college_code);
        break;
      case "college_name":
        valA = a.college_name;
        valB = b.college_name;
        break;
      case "branch_name":
        valA = a.branch_name;
        valB = b.branch_name;
        break;
      case "closing_rank":
      case "closing_rank_1":
        valA = a.communities[primaryComm]?.closing_rank ?? 999999;
        valB = b.communities[primaryComm]?.closing_rank ?? 999999;
        break;
      case "closing_rank_2":
        const secComm = selectedCommunities[1] || primaryComm;
        valA = a.communities[secComm]?.closing_rank ?? 999999;
        valB = b.communities[secComm]?.closing_rank ?? 999999;
        break;
      case "avg_oc":
        valA = a.avg_oc_cutoff ?? 0;
        valB = b.avg_oc_cutoff ?? 0;
        break;
      case "allotments":
      case "allotments_1":
        valA = a.communities[primaryComm]?.fill_pct ?? -1;
        valB = b.communities[primaryComm]?.fill_pct ?? -1;
        break;
      case "allotments_2":
        const secCommAllot = selectedCommunities[1] || primaryComm;
        valA = a.communities[secCommAllot]?.fill_pct ?? -1;
        valB = b.communities[secCommAllot]?.fill_pct ?? -1;
        break;
      default:
        valA = 0;
        valB = 0;
    }

    if (valA < valB) return currentSort.ascending ? -1 : 1;
    if (valA > valB) return currentSort.ascending ? 1 : -1;
    return 0;
  });

  return filtered;
}

// 5. Render Table with Pagination
function renderTable() {
  const filteredData = getFilteredAndSortedData();
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * pageSize;
  const pageData = filteredData.slice(startIdx, startIdx + pageSize);

  tableBody.innerHTML = "";

  pageData.forEach((row, index) => {
    const globalIdx = startIdx + index + 1;
    const avgOcText = row.avg_oc_cutoff ? row.avg_oc_cutoff.toFixed(2) : "-";
    const fullBranchName = `${row.branch_name} (${row.branch_code})`;

    let rankColsHtml = "";
    if (selectedCommunities.length === 2) {
      const c1 = row.communities[selectedCommunities[0]] || {};
      const c2 = row.communities[selectedCommunities[1]] || {};
      const r1Text = c1.closing_rank ? `${c1.closing_rank.toLocaleString()} (${c1.closing_cutoff ? c1.closing_cutoff.toFixed(2) : '-'})` : "-";
      const r2Text = c2.closing_rank ? `${c2.closing_rank.toLocaleString()} (${c2.closing_cutoff ? c2.closing_cutoff.toFixed(2) : '-'})` : "-";
      rankColsHtml = `
        <td><span class="rank-box">${r1Text}</span></td>
        <td><span class="rank-box">${r2Text}</span></td>
      `;
    } else {
      const c1 = row.communities[selectedCommunities[0]] || {};
      const r1Text = c1.closing_rank ? `${c1.closing_rank.toLocaleString()} (${c1.closing_cutoff ? c1.closing_cutoff.toFixed(2) : '-'})` : "-";
      rankColsHtml = `
        <td><span class="rank-box">${r1Text}</span></td>
      `;
    }

    let allotmentColsHtml = "";
    if (selectedCommunities.length === 2) {
      const c1 = row.communities[selectedCommunities[0]] || {};
      const c2 = row.communities[selectedCommunities[1]] || {};

      const filled1 = c1.filled || 0;
      const total1 = c1.total || 0;
      const pct1 = total1 > 0 ? ((filled1 / total1) * 100).toFixed(1) : 0;

      const filled2 = c2.filled || 0;
      const total2 = c2.total || 0;
      const pct2 = total2 > 0 ? ((filled2 / total2) * 100).toFixed(1) : 0;

      allotmentColsHtml = `
        <td>
          <div class="progress-pill">
            <span>${pct1}%</span>
            <span style="color: var(--text-muted); font-size: 0.8rem;">(${filled1} / ${total1})</span>
          </div>
        </td>
        <td>
          <div class="progress-pill">
            <span>${pct2}%</span>
            <span style="color: var(--text-muted); font-size: 0.8rem;">(${filled2} / ${total2})</span>
          </div>
        </td>
      `;
    } else {
      const c1 = row.communities[selectedCommunities[0]] || {};
      const filled1 = c1.filled || 0;
      const total1 = c1.total || 0;
      const pct1 = total1 > 0 ? ((filled1 / total1) * 100).toFixed(1) : 0;

      allotmentColsHtml = `
        <td>
          <div class="progress-pill">
            <span>${pct1}%</span>
            <span style="color: var(--text-muted); font-size: 0.8rem;">(${filled1} / ${total1})</span>
          </div>
        </td>
      `;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${globalIdx}</td>
      <td style="font-weight: 600;">${row.college_name}</td>
      <td><code>${row.college_code}</code></td>
      <td>${fullBranchName}</td>
      ${rankColsHtml}
      <td>${avgOcText}</td>
      ${allotmentColsHtml}
      <td>
        <button class="add-choice-btn" onclick="addToChoiceList('${row.college_code}', '${row.branch_code}')">
          + Add
        </button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${filteredData.length} entries)`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
  jumpPageInput.max = totalPages;
  jumpPageInput.value = currentPage;
}

pageSizeSelect.addEventListener("change", (e) => {
  pageSize = Number(e.target.value);
  currentPage = 1;
  renderTable();
});

prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) { currentPage--; renderTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(getFilteredAndSortedData().length / pageSize);
  if (currentPage < totalPages) { currentPage++; renderTable(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

jumpPageInput.addEventListener("change", (e) => {
  const p = Number(e.target.value);
  const totalPages = Math.ceil(getFilteredAndSortedData().length / pageSize);
  if (p >= 1 && p <= totalPages) {
    currentPage = p;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

// 6. Choice List & Drag-and-Drop Reordering
window.addToChoiceList = function(cCode, bCode) {
  const exists = choiceList.some(item => item.college_code === cCode && item.branch_code === bCode);
  if (exists) return;

  const itemData = allData.find(d => d.college_code === cCode && d.branch_code === bCode);
  if (!itemData) return;

  const primaryComm = selectedCommunities[0];
  const extraComm = selectedCommunities[1] || null;

  choiceList.push({
    college_code: itemData.college_code,
    college_name: itemData.college_name,
    branch_code: itemData.branch_code,
    branch_name: itemData.branch_name,
    avg_oc_cutoff: itemData.avg_oc_cutoff || "N/A",
    oc_rank: itemData.communities[primaryComm]?.closing_rank || "N/A",
    oc_cutoff: itemData.communities[primaryComm]?.closing_cutoff || "N/A",
    extra_comm: extraComm,
    extra_rank: extraComm ? (itemData.communities[extraComm]?.closing_rank || "N/A") : null,
    extra_cutoff: extraComm ? (itemData.communities[extraComm]?.closing_cutoff || "N/A") : null
  });

  saveChoices();
  updateChoiceUI();
};

function saveChoices() {
  localStorage.setItem("tnea_choices", JSON.stringify(choiceList));
}

function updateChoiceUI() {
  choiceCount.textContent = choiceList.length;
  const container = document.getElementById("choiceListContainer");
  if (!container) return;
  container.innerHTML = "";

  choiceList.forEach((item, index) => {
    const li = document.createElement("li");
    li.className = "choice-item";
    li.draggable = true;
    li.dataset.index = index;

    let rankText = `OC: ${item.oc_rank} (${item.oc_cutoff})`;
    if (item.extra_comm) {
      rankText += ` + ${item.extra_comm}: ${item.extra_rank} (${item.extra_cutoff})`;
    }

    li.innerHTML = `
      <div class="choice-details">
        <h4>${index + 1}. [${item.college_code}] ${item.college_name}</h4>
        <span>${item.branch_name} (${item.branch_code}) | ${rankText}</span>
      </div>
      <div class="choice-controls">
        <button onclick="moveChoice(${index}, -1)">↑</button>
        <button onclick="moveChoice(${index}, 1)">↓</button>
        <button onclick="removeChoice(${index})" style="color: var(--danger);">×</button>
      </div>
    `;

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index);
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", (e) => e.preventDefault());
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedIdx = Number(e.dataTransfer.getData("text/plain"));
      const targetIdx = index;
      if (draggedIdx !== targetIdx) {
        const movedItem = choiceList.splice(draggedIdx, 1)[0];
        choiceList.splice(targetIdx, 0, movedItem);
        saveChoices();
        updateChoiceUI();
      }
    });

    container.appendChild(li);
  });
}

window.moveChoice = function(index, dir) {
  if (index + dir < 0 || index + dir >= choiceList.length) return;
  const temp = choiceList[index];
  choiceList[index] = choiceList[index + dir];
  choiceList[index + dir] = temp;
  saveChoices();
  updateChoiceUI();
};

window.removeChoice = function(index) {
  choiceList.splice(index, 1);
  saveChoices();
  updateChoiceUI();
};

// Drawer controls
const openChoiceBtn = document.getElementById("openChoiceBtn");
if (openChoiceBtn) {
  openChoiceBtn.addEventListener("click", () => {
    document.getElementById("choiceDrawer").classList.remove("hidden");
    document.getElementById("drawerOverlay").classList.remove("hidden");
  });
}
const closeDrawer = () => {
  document.getElementById("choiceDrawer").classList.add("hidden");
  document.getElementById("drawerOverlay").classList.add("hidden");
};
const closeChoiceBtn = document.getElementById("closeChoiceBtn");
if (closeChoiceBtn) closeChoiceBtn.addEventListener("click", closeDrawer);
const drawerOverlay = document.getElementById("drawerOverlay");
if (drawerOverlay) drawerOverlay.addEventListener("click", closeDrawer);

const clearChoicesBtn = document.getElementById("clearChoicesBtn");
if (clearChoicesBtn) {
  clearChoicesBtn.addEventListener("click", () => {
    choiceList = [];
    saveChoices();
    updateChoiceUI();
  });
}
