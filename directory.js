(function () {
  // Elements
  const input = document.getElementById('globalSearch');
  const btnGrid = document.getElementById('btnGrid');
  const btnTable = document.getElementById('btnTable');
  const gridContainers = Array.from(document.querySelectorAll('.region-grid'));
  const tableContainers = Array.from(document.querySelectorAll('.region-table'));
  const mainEl = document.querySelector('main');
  const controlsSection = document.getElementById('controls');
  if (!input || !btnGrid || !btnTable || !mainEl) {
    return;
  }
  // Create (or reuse) a results container inside the controls section (directly under the search area)
  let resultsContainer = document.getElementById('searchResultsContainer');
  if (!resultsContainer) {
    resultsContainer = document.createElement('div');
    resultsContainer.id = 'searchResultsContainer';
    resultsContainer.className = 'search-results';
    resultsContainer.style.margin = '0.75rem 0 1rem 0';
    // If controlsSection exists, insert results container inside it after the .view element (so it sits under the search box)
    if (controlsSection) {
      const viewEl = controlsSection.querySelector('.view');
      if (viewEl) viewEl.insertAdjacentElement('afterend', resultsContainer);
      else controlsSection.appendChild(resultsContainer);
    } else {
      // fallback: insert at top of main
      mainEl.insertBefore(resultsContainer, mainEl.firstChild);
    }
  }
  // Save original order so we can restore it when search is cleared
  const originalGridOrder = new Map();
  gridContainers.forEach(grid => originalGridOrder.set(grid, Array.from(grid.children)));
  const originalTableOrder = new Map();
  tableContainers.forEach(tblWrap => {
    const tbody = tblWrap.querySelector('tbody');
    if (tbody) originalTableOrder.set(tbody, Array.from(tbody.children));
  });
  // Save original section order (top-level sections under <main>)
  const originalSectionsOrder = Array.from(mainEl.querySelectorAll(':scope > section'));
  // Utilities
  function normalize(s) { return (s || '').toString().toLowerCase().trim(); }
  function focusSearch() {
    requestAnimationFrame(() => {
      try { input.focus({ preventScroll: true }); }
      catch (e) { input.focus(); }
    });
  }
  // View toggles
  function showGridView() {
    document.querySelectorAll('.region-grid').forEach(el => el.style.display = '');
    document.querySelectorAll('.region-table').forEach(el => el.style.display = 'none');
    btnGrid.classList.add('active', 'grid');
    btnTable.classList.remove('active', 'table');
    btnGrid.setAttribute('aria-pressed', 'true');
    btnTable.setAttribute('aria-pressed', 'false');
  }
  function showTableView() {
    document.querySelectorAll('.region-grid').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.region-table').forEach(el => el.style.display = '');
    btnTable.classList.add('active', 'table');
    btnGrid.classList.remove('active', 'grid');
    btnTable.setAttribute('aria-pressed', 'true');
    btnGrid.setAttribute('aria-pressed', 'false');
  }
  btnGrid.addEventListener('click', showGridView);
  btnTable.addEventListener('click', showTableView);
  // Core filtering: highlight and move matches to top (preserve relative order)
  function applyGridFilter(query) {
    gridContainers.forEach(grid => {
      const cards = Array.from(grid.querySelectorAll('.card'));
      if (!query) {
        const orig = originalGridOrder.get(grid);
        if (orig) orig.forEach(node => grid.appendChild(node));
        cards.forEach(c => {
          c.classList.remove('search-match');
          c.style.display = '';
        });
        return;
      }
      const matches = [];
      const nonMatches = [];
      cards.forEach(card => {
        const hay = normalize(card.getAttribute('data-search') || card.textContent);
        if (hay.includes(query)) matches.push(card);
        else nonMatches.push(card);
      });
      cards.forEach(c => c.classList.remove('search-match'));
      matches.forEach(m => {
        m.classList.add('search-match');
        grid.appendChild(m);
      });
      nonMatches.forEach(n => grid.appendChild(n));
      if (matches.length) matches[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  function applyTableFilter(query) {
    tableContainers.forEach(tblWrap => {
      const tbody = tblWrap.querySelector('tbody');
      if (!tbody) return;
      if (!query) {
        const orig = originalTableOrder.get(tbody);
        if (orig) orig.forEach(row => tbody.appendChild(row));
        Array.from(tbody.children).forEach(r => {
          r.classList.remove('search-match');
          r.style.display = '';
        });
        return;
      }
      const rows = Array.from(tbody.children);
      const matches = [];
      const nonMatches = [];
      rows.forEach(row => {
        const hay = normalize(row.getAttribute('data-search') || row.textContent);
        if (hay.includes(query)) matches.push(row);
        else nonMatches.push(row);
      });
      rows.forEach(r => r.classList.remove('search-match'));
      matches.forEach(r => {
        r.classList.add('search-match');
        tbody.appendChild(r);
      });
      nonMatches.forEach(r => tbody.appendChild(r));
      if (matches.length) matches[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  // Build a compact card element from a table row (used for results container)
  function rowToCardElement(row) {
    const cells = Array.from(row.children);
    const name = (cells[0] && cells[0].textContent.trim()) || '';
    const position = (cells[1] && cells[1].textContent.trim()) || '';
    const emailAnchor = cells[2] ? cells[2].querySelector('a') : null;
    const email = emailAnchor ? emailAnchor.href.replace('mailto:', '') : (cells[2] ? cells[2].textContent.trim() : '');
    const location = (cells[3] && cells[3].textContent.trim()) || '';
    const corr = (cells[4] && cells[4].textContent.trim()) || '';
    const card = document.createElement('article');
    card.className = 'card search-match result-card';
    card.style.minHeight = 'auto';
    card.innerHTML = `
      <h4>${escapeHtml(name)} <span class="position">${escapeHtml(position)}</span></h4>
      ${email ? `<p><strong>Email:</strong><br><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>` : ''}
      ${location ? `<p><strong>Location:</strong> ${escapeHtml(location)}</p>` : ''}
      ${corr ? `<p><strong>Corr. Code:</strong> ${escapeHtml(corr)}</p>` : ''}
    `;
    return card;
  }
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  // Populate the results container with matched items (cloned compact cards)
  function showResultsUnderSearch(query) {
    resultsContainer.innerHTML = '';
    if (!query) {
      resultsContainer.style.display = 'none';
      return;
    }
    const matchedCards = [];
    gridContainers.forEach(grid => {
      Array.from(grid.querySelectorAll('.card')).forEach(card => {
        if (card.classList.contains('search-match')) matchedCards.push(card);
      });
    });
    const matchedRows = [];
    tableContainers.forEach(tblWrap => {
      const tbody = tblWrap.querySelector('tbody');
      if (!tbody) return;
      Array.from(tbody.children).forEach(row => {
        if (row.classList.contains('search-match')) matchedRows.push(row);
      });
    });
    if (matchedCards.length === 0 && matchedRows.length === 0) {
      resultsContainer.style.display = 'none';
      return;
    }
    const heading = document.createElement('div');
    heading.className = 'search-results-heading';
    heading.style.marginBottom = '.5rem';
    heading.innerHTML = `<strong>Search results</strong> — showing ${matchedCards.length + matchedRows.length} item(s)`;
    resultsContainer.appendChild(heading);
    matchedCards.forEach(card => {
      const clone = card.cloneNode(true);
      clone.classList.add('result-card');
      resultsContainer.appendChild(clone);
    });
    matchedRows.forEach(row => {
      const card = rowToCardElement(row);
      resultsContainer.appendChild(card);
    });
    resultsContainer.style.display = '';
    focusSearch();
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  // Reorder top-level sections: matched sections first (preserve original relative order)
  // Ensure controlsSection always remains at the very top (and resultsContainer stays inside it)
  function reorderSections(query) {
    function appendControlsFirst() {
      if (controlsSection && mainEl.contains(controlsSection)) {
        mainEl.appendChild(controlsSection);
      }
    }
    if (!query) {
      appendControlsFirst();
      originalSectionsOrder.forEach(sec => {
        if (sec === controlsSection) return;
        sec.classList.remove('section-match');
        mainEl.appendChild(sec);
      });
      return;
    }
    const matched = [];
    const notMatched = [];
    originalSectionsOrder.forEach(section => {
      if (section === controlsSection) return;
      const hasCardMatch = !!section.querySelector('.card.search-match');
      const hasRowMatch = !!section.querySelector('tbody .search-match');
      if (hasCardMatch || hasRowMatch) matched.push(section);
      else notMatched.push(section);
    });
    appendControlsFirst();
    matched.forEach(s => {
      s.classList.add('section-match');
      mainEl.appendChild(s);
    });
    notMatched.forEach(s => {
      s.classList.remove('section-match');
      mainEl.appendChild(s);
    });
  }
  // Debounced input handler with minimum length + Enter/Escape handling
  const DEBOUNCE_MS = 600;
  const MIN_CHARS = 3;
  let timer = null;
  function runFilterNow(rawValue) {
    const q = normalize(rawValue || '');
    if (q === '') {
      applyGridFilter('');
      applyTableFilter('');
      reorderSections('');
      showResultsUnderSearch('');
      focusSearch();
      return;
    }
    if (q.length < MIN_CHARS) {
      gridContainers.forEach(grid => {
        const orig = originalGridOrder.get(grid);
        if (orig) orig.forEach(node => grid.appendChild(node));
        Array.from(grid.querySelectorAll('.card')).forEach(c => {
          c.classList.remove('search-match');
          c.style.display = '';
        });
      });
      tableContainers.forEach(tblWrap => {
        const tbody = tblWrap.querySelector('tbody');
        if (!tbody) return;
        const orig = originalTableOrder.get(tbody);
        if (orig) orig.forEach(row => tbody.appendChild(row));
        Array.from(tbody.children).forEach(r => {
          r.classList.remove('search-match');
          r.style.display = '';
        });
      });
      reorderSections('');
      showResultsUnderSearch('');
      focusSearch();
      return;
    }
    applyGridFilter(q);
    applyTableFilter(q);
    reorderSections(q);
    showResultsUnderSearch(q);
    const firstMatchedSection = mainEl.querySelector('.section-match');
    if (firstMatchedSection) firstMatchedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  input.addEventListener('input', function (e) {
    clearTimeout(timer);
    const val = e.target.value;
    timer = setTimeout(() => runFilterNow(val), DEBOUNCE_MS);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      clearTimeout(timer);
      runFilterNow(e.target.value);
    } else if (e.key === 'Escape') {
      clearTimeout(timer);
      input.value = '';
      runFilterNow('');
    }
  });
  // Initialize default view and hide results container initially
  showGridView();
  resultsContainer.style.display = 'none';
})();