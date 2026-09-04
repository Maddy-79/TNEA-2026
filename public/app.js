/**
 * TNEA Choice Filler & Analyzer
 * Restructured for better maintainability and cleaner state management.
 */

// ==========================================
// 1. STATE MANAGEMENT
// ==========================================
const State = {
  data: [],
  communities: ["OC"], // Max 2
  round: "1",
  sort: { column: "sno", ascending: true },
  pagination: { current: 1, size: 200 },
  filters: { colleges: [], branches: [] },
  lists: { colleges: [], branches: [] },
  choices: JSON.parse(localStorage.getItem("tnea_choices") || "[]")
};

// ==========================================
// 2. DOM ELEMENTS CACHE
// ==========================================
const DOM = {
  tableBody: document.getElementById("tableBody"),
  tableHeaderRow: document.getElementById("tableHeaderRow"),
  choiceCount: document.getElementById("choiceCount"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  pageSizeSelect: document.getElementById("pageSizeSelect"),
  jumpPageInput: document.getElementById("jumpPageInput"),
  roundSelect: document.getElementById("roundSelect"),
  choiceListContainer: document.getElementById("choiceListContainer"),
  choiceDrawer: document.getElementById("choiceDrawer"),
  drawerOverlay: document.getElementById("drawerOverlay"),
  openChoiceBtn: document.getElementById("openChoiceBtn"),
  closeChoiceBtn: document.getElementById("closeChoiceBtn"),
  clearChoicesBtn: document.getElementById("clearChoicesBtn")
};

// ==========================================
// 3. INITIALIZATION & DATA FETCHING
// ==========================================
async function initApp() {
  bindGlobalEvents();
  
  try {
    const res = await fetch("data.json");
    const rawData = await res.json();
    
    // Safely handle whether data.json is an array or an object
    State.data = Array.isArray(rawData) ? rawData : Object.values(rawData);
    
    console.log(`Successfully loaded ${State.data.length} records! Choose your engineering destiny wisely.`);
    
    setupDropdowns();
    handleURLParameters();
    updateTableHeader();
    renderTable();
    updateChoiceUI();
  } catch (err) {
    console.error("Error loading data:", err);
  }
}

function handleURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const collegeParam = urlParams.get('college');
  
  if (collegeParam) {
    const cleanCode = collegeParam.trim();
    const match = State.lists.colleges.find(c => c.code === cleanCode);
    if (match) {
      State.filters.colleges = [cleanCode];
      State.pagination.current = 1;
      
      const collegeInput = document.getElementById("collegeInput");
      if (collegeInput) {
        collegeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
}

// ==========================================
// 4. EVENT BINDINGS
// ==========================================
function bindGlobalEvents() {
  // Round Selection
  if (DOM.roundSelect) {
    DOM.roundSelect.addEventListener("change", (e) => {
      State.round = e.target.value;
      State.pagination.current = 1;
      renderTable();
    });
  }

  // Community Pills
  document.querySelectorAll(".comm-pill").forEach(pill => {
    pill.addEventListener("click", () => handleCommunitySelection(pill));
  });

  // Pagination Controls
  DOM.pageSizeSelect?.addEventListener("change", (e) => {
    State.pagination.size = Number(e.target.value);
    State.pagination.current = 1;
    renderTable();
  });

  DOM.prevPageBtn?.addEventListener("click", () => changePage(-1));
  DOM.nextPageBtn?.addEventListener("click", () => changePage(1));
  DOM.jumpPageInput?.addEventListener("change", (e) => {
    jumpToPage(Number(e.target.value));
  });

  // Drawer Controls
  const toggleDrawer = (show) => {
    DOM.choiceDrawer?.classList.toggle("hidden", !show);
    DOM.drawerOverlay?.classList.toggle("hidden", !show);
  };
  DOM.openChoiceBtn?.addEventListener("click", () => toggleDrawer(true));
  DOM.closeChoiceBtn?.addEventListener("click", () => toggleDrawer(false));
  DOM.drawerOverlay?.addEventListener("click", () => toggleDrawer(false));

  DOM.clearChoicesBtn?.addEventListener("click", () => {
    State.choices = [];
    saveChoices();
    updateChoiceUI();
  });
}

function handleCommunitySelection(pill) {
  const comm = pill.getAttribute("data-comm");
  
  if (State.communities.includes(comm)) {
    if (State.communities.length === 1) return; // Must keep at least 1
    State.communities = State.communities.filter(c => c !== comm);
    pill.classList.remove("active");
  } else {
    if (State.communities.length >= 2) {
      const first = State.communities.shift();
      document.querySelector(`.comm-pill[data-comm="${first}"]`).classList.remove("active");
    }
    State.communities.push(comm);
    pill.classList.add("active");
  }
  
  updateTableHeader();
  State.pagination.current = 1;
  renderTable();
}

// ==========================================
// 5. UI & RENDERING LOGIC
// ==========================================
function updateTableHeader() {
  if (!DOM.tableHeaderRow) return;

  const [comm1 = "OC", comm2 = ""] = State.communities;
  const isDual = State.communities.length === 2;

  let headersHtml = `
    <th data-sort="sno">S.NO</th>
    <th data-sort="college_name">COLLEGE\nNAME</th>
    <th data-sort="college_code">COLLEGE\nCODE</th>
    <th data-sort="branch_name">BRANCH\nNAME</th>
    ${isDual ? `
      <th data-sort="closing_rank_1">CLOSING RANKS\n${comm1}</th>
      <th data-sort="closing_rank_2">CLOSING RANKS\n${comm2}</th>
    ` : `<th data-sort="closing_rank">CLOSING\nRANKS</th>`}
    <th data-sort="avg_oc">AVG OC\nCUTOFF</th>
    ${isDual ? `
      <th data-sort="allotments_1">ALLOTMENTS\n${comm1}</th>
      <th data-sort="allotments_2">ALLOTMENTS\n${comm2}</th>
    ` : `<th data-sort="allotments">ALLOTMENTS\n${comm1}</th>`}
    <th>ACTION</th>
  `;

  DOM.tableHeaderRow.innerHTML = headersHtml;

  // Re-bind sort listeners
  DOM.tableHeaderRow.querySelectorAll("th[data-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (State.sort.column === col) { 
        State.sort.ascending = !State.sort.ascending; 
      } else { 
        State.sort.column = col; 
        State.sort.ascending = true; 
      }
      State.pagination.current = 1;
      renderTable();
    });
  });
}

function renderTable() {
  if (!DOM.tableBody) return;

  const filteredData = getFilteredAndSortedData();
  const totalPages = Math.ceil(filteredData.length / State.pagination.size) || 1;
  
  if (State.pagination.current > totalPages) State.pagination.current = totalPages;

  const startIdx = (State.pagination.current - 1) * State.pagination.size;
  const pageData = filteredData.slice(startIdx, startIdx + State.pagination.size);

  DOM.tableBody.innerHTML = pageData.map((row, index) => 
    generateTableRow(row, startIdx + index + 1)
  ).join('');

  updatePaginationUI(totalPages, filteredData.length);
}

function generateTableRow(row, globalIdx) {
  const isDual = State.communities.length === 2;
  const c1 = row.communities[State.communities[0]] || {};
  const c2 = isDual ? (row.communities[State.communities[1]] || {}) : null;

  // Helper for formatting Ranks
  const formatRank = (c) => c.closing_rank 
    ? `<span class="rank-box">${c.closing_rank.toLocaleString()} (${c.closing_cutoff ? c.closing_cutoff.toFixed(2) : '-'})</span>` 
    : `<span class="rank-box">-</span>`;

  // Helper for formatting Allotments
  const formatAllotment = (c) => {
    const filled = c.filled || 0;
    const total = c.total || 0;
    const pct = total > 0 ? ((filled / total) * 100).toFixed(1) : 0;
    return `
      <div class="progress-pill">
        <span>${pct}%</span>
        <span style="color: var(--text-muted); font-size: 0.8rem;">(${filled} / ${total})</span>
      </div>`;
  };

  return `
    <tr>
      <td>${globalIdx}</td>
      <td style="font-weight: 600;">${row.college_name}</td>
      <td><code>${row.college_code}</code></td>
      <td>${row.branch_name} (${row.branch_code})</td>
      <td>${formatRank(c1)}</td>
      ${isDual ? `<td>${formatRank(c2)}</td>` : ''}
      <td>${row.avg_oc_cutoff ? row.avg_oc_cutoff.toFixed(2) : "-"}</td>
      <td>${formatAllotment(c1)}</td>
      ${isDual ? `<td>${formatAllotment(c2)}</td>` : ''}
      <td>
        <button class="add-choice-btn" onclick="window.addToChoiceList('${row.college_code}', '${row.branch_code}')">
          + Add
        </button>
      </td>
    </tr>
  `;
}

// ==========================================
// 6. FILTERING, SORTING & DROPDOWNS
// ==========================================
function getFilteredAndSortedData() {
  const { filters, sort, communities } = State;
  const primaryComm = communities[0];
  const secComm = communities[1] || primaryComm;

  let filtered = State.data.filter(row => {
    const matchCollege = filters.colleges.length === 0 || filters.colleges.includes(row.college_code.toString());
    const matchBranch = filters.branches.length === 0 || filters.branches.includes(row.branch_code.toString());
    return matchCollege && matchBranch;
  });

  return filtered.sort((a, b) => {
    let valA = 0, valB = 0;

    switch (sort.column) {
      case "sno":
      case "college_code":
        valA = Number(a.college_code); valB = Number(b.college_code); break;
      case "college_name":
        valA = a.college_name; valB = b.college_name; break;
      case "branch_name":
        valA = a.branch_name; valB = b.branch_name; break;
      case "avg_oc":
        valA = a.avg_oc_cutoff ?? 0; valB = b.avg_oc_cutoff ?? 0; break;
      case "closing_rank":
      case "closing_rank_1":
        valA = a.communities[primaryComm]?.closing_rank ?? 999999;
        valB = b.communities[primaryComm]?.closing_rank ?? 999999; break;
      case "closing_rank_2":
        valA = a.communities[secComm]?.closing_rank ?? 999999;
        valB = b.communities[secComm]?.closing_rank ?? 999999; break;
      case "allotments":
      case "allotments_1":
        valA = a.communities[primaryComm]?.fill_pct ?? -1;
        valB = b.communities[primaryComm]?.fill_pct ?? -1; break;
      case "allotments_2":
        valA = a.communities[secComm]?.fill_pct ?? -1;
        valB = b.communities[secComm]?.fill_pct ?? -1; break;
    }

    if (valA < valB) return sort.ascending ? -1 : 1;
    if (valA > valB) return sort.ascending ? 1 : -1;
    return 0;
  });
}

function setupDropdowns() {
  const collegesMap = new Map();
  const branchesMap = new Map();

  State.data.forEach(row => {
    collegesMap.set(row.college_code.toString(), row.college_name);
    branchesMap.set(row.branch_code.toString(), row.branch_name);
  });

  State.lists.colleges = Array.from(collegesMap.entries()).map(([code, name]) => ({ code, name }));
  State.lists.branches = Array.from(branchesMap.entries()).map(([code, name]) => ({ code, name }));

  setupDropdown("collegeInput", "collegeDropdownList", "collegeTags", State.lists.colleges, State.filters.colleges);
  setupDropdown("branchInput", "branchDropdownList", "branchTags", State.lists.branches, State.filters.branches);
}

function setupDropdown(inputId, listId, tagsId, items, selectedArray) {
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  const tagsContainer = document.getElementById(tagsId);

  if(!input || !list || !tagsContainer) return;

  const updateAndRender = () => {
    State.pagination.current = 1;
    renderTags();
    renderList(input.value.toLowerCase());
    renderTable();
  };

  const renderTags = () => {
    tagsContainer.innerHTML = selectedArray.map(code => {
      const item = items.find(i => i.code === code);
      const label = item ? `${item.name.substring(0, 20)}... (${code})` : code;
      return `<div class="tag-pill" data-code="${code}">
                <span>${label}</span>
                <button type="button" class="remove-tag">&times;</button>
              </div>`;
    }).join("");

    // Bind remove events
    tagsContainer.querySelectorAll('.remove-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = e.target.closest('.tag-pill').dataset.code;
        const idx = selectedArray.indexOf(code);
        if (idx > -1) selectedArray.splice(idx, 1);
        updateAndRender();
      });
    });
  };

  const renderList = (filterText = "") => {
    const filtered = items.filter(i => 
      i.name.toLowerCase().includes(filterText) || i.code.toLowerCase().includes(filterText)
    );

    list.innerHTML = filtered.map(item => {
      const isSelected = selectedArray.includes(item.code);
      return `<div class="dropdown-item ${isSelected ? 'selected' : ''}" data-code="${item.code}">
                <span>${item.name} (${item.code})</span> ${isSelected ? '✓' : ''}
              </div>`;
    }).join("");

    list.classList.toggle("hidden", filtered.length === 0);

    // Bind add/remove events
    list.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = el.dataset.code;
        if (selectedArray.includes(code)) {
          selectedArray.splice(selectedArray.indexOf(code), 1);
        } else {
          selectedArray.push(code);
        }
        input.value = "";
        updateAndRender();
      });
    });
  };

  input.addEventListener("focus", () => renderList(input.value.toLowerCase()));
  input.addEventListener("input", () => renderList(input.value.toLowerCase()));

  document.addEventListener("click", (e) => {
    if (!input.closest(".dropdown-container").contains(e.target)) {
      list.classList.add("hidden");
    }
  });

  renderTags();
}

// ==========================================
// 7. PAGINATION HELPERS
// ==========================================
function updatePaginationUI(totalPages, totalEntries) {
  if (DOM.pageInfo) DOM.pageInfo.textContent = `Page ${State.pagination.current} of ${totalPages} (${totalEntries} entries)`;
  if (DOM.prevPageBtn) DOM.prevPageBtn.disabled = State.pagination.current === 1;
  if (DOM.nextPageBtn) DOM.nextPageBtn.disabled = State.pagination.current === totalPages || totalPages === 0;
  
  if (DOM.jumpPageInput) {
    DOM.jumpPageInput.max = totalPages;
    DOM.jumpPageInput.value = State.pagination.current;
  }
}

function changePage(delta) {
  const totalPages = Math.ceil(getFilteredAndSortedData().length / State.pagination.size);
  const newPage = State.pagination.current + delta;
  
  if (newPage >= 1 && newPage <= totalPages) {
    State.pagination.current = newPage;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function jumpToPage(pageNumber) {
  const totalPages = Math.ceil(getFilteredAndSortedData().length / State.pagination.size);
  if (pageNumber >= 1 && pageNumber <= totalPages) {
    State.pagination.current = pageNumber;
    renderTable();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ==========================================
// 8. CHOICE LIST MANAGEMENT (Global Access)
// ==========================================
function saveChoices() {
  localStorage.setItem("tnea_choices", JSON.stringify(State.choices));
}

function updateChoiceUI() {
  if (DOM.choiceCount) DOM.choiceCount.textContent = State.choices.length;
  if (!DOM.choiceListContainer) return;

  DOM.choiceListContainer.innerHTML = State.choices.map((item, index) => {
    let rankText = `OC: ${item.oc_rank} (${item.oc_cutoff})`;
    if (item.extra_comm) {
      rankText += ` + ${item.extra_comm}: ${item.extra_rank} (${item.extra_cutoff})`;
    }

    return `
      <li class="choice-item" draggable="true" data-index="${index}">
        <div class="choice-details">
          <h4>${index + 1}. [${item.college_code}] ${item.college_name}</h4>
          <span>${item.branch_name} (${item.branch_code}) | ${rankText}</span>
        </div>
        <div class="choice-controls">
          <button onclick="window.moveChoice(${index}, -1)">↑</button>
          <button onclick="window.moveChoice(${index}, 1)">↓</button>
          <button onclick="window.removeChoice(${index})" style="color: var(--danger);">×</button>
        </div>
      </li>
    `;
  }).join("");

  // Bind Drag & Drop logic
  DOM.choiceListContainer.querySelectorAll('.choice-item').forEach(li => {
    const index = Number(li.dataset.index);
    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", index);
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", (e) => e.preventDefault());
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      const draggedIdx = Number(e.dataTransfer.getData("text/plain"));
      if (draggedIdx !== index) {
        const movedItem = State.choices.splice(draggedIdx, 1)[0];
        State.choices.splice(index, 0, movedItem);
        saveChoices();
        updateChoiceUI();
      }
    });
  });
}

// Attached to window so inline HTML onclick="" handlers don't break
window.addToChoiceList = function(cCode, bCode) {
  const exists = State.choices.some(item => item.college_code === cCode && item.branch_code === bCode);
  if (exists) return;

  const itemData = State.data.find(d => d.college_code === cCode && d.branch_code === bCode);
  if (!itemData) return;

  const primaryComm = State.communities[0];
  const extraComm = State.communities[1] || null;

  State.choices.push({
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

window.moveChoice = function(index, dir) {
  if (index + dir < 0 || index + dir >= State.choices.length) return;
  const temp = State.choices[index];
  State.choices[index] = State.choices[index + dir];
  State.choices[index + dir] = temp;
  saveChoices();
  updateChoiceUI();
};

window.removeChoice = function(index) {
  State.choices.splice(index, 1);
  saveChoices();
  updateChoiceUI();
};

// Start the application
initApp();