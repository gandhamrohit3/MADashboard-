import '@material/web/button/elevated-button.js';
import '@material/web/button/text-button.js';
import '@material/web/icon/icon.js';
import '@material/web/iconbutton/icon-button.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/elevation/elevation.js';
import '@material/web/progress/circular-progress.js';
import '@material/web/switch/switch.js';
import { fetchGoogleNewsRSS, buildSearchQuery, categorizeDeal } from './api.js';

// Global chart instance
let dealChart = null;

// Initialize and update pie chart
window.updateChart = function(confirmedCount, rumorsCount) {
  const ctx = document.getElementById('dealChart')?.getContext('2d');
  if (!ctx) return;

  // Get theme colors from CSS variables
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const primaryColor = isDark ? '#84f7e0' : '#006b5b';
  const secondaryColor = isDark ? '#b0ccc7' : '#4a635f';

  const chartData = {
    labels: [`Confirmed Deals (${confirmedCount})`, `Rumors & Signals (${rumorsCount})`],
    datasets: [{
      data: [confirmedCount, rumorsCount],
      backgroundColor: [primaryColor, secondaryColor],
      borderColor: isDark 
        ? ['#104a43', '#2d3c39']
        : ['#005048', '#3a4d4a'],
      borderWidth: 2,
      borderRadius: 4,
    }]
  };

  if (dealChart) {
    dealChart.data = chartData;
    dealChart.update();
  } else {
    dealChart = new Chart(ctx, {
      type: 'doughnut',
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#e3e3e3' : '#333333',
              font: {
                family: '"Roboto", sans-serif',
                size: 13,
                weight: '500'
              },
              padding: 16,
              usePointStyle: true,
            }
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(32, 32, 32, 0.95)' : 'rgba(245, 245, 245, 0.95)',
            titleColor: isDark ? '#ffffff' : '#000000',
            bodyColor: isDark ? '#e3e3e3' : '#333333',
            borderColor: isDark ? '#454545' : '#e0e0e0',
            borderWidth: 1,
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed;
              }
            }
          }
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');

  if (dateFrom) dateFrom.value = thirtyDaysAgo.toISOString().split('T')[0];
  if (dateTo) dateTo.value = today.toISOString().split('T')[0];

  // Theme Management
  const themeToggle = document.getElementById('themeToggle');
  const storedTheme = localStorage.getItem('pharma-theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const isDark = storedTheme === 'dark' || (!storedTheme && systemDark);

  if (isDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeToggle) themeToggle.selected = true;
  } else {
    document.documentElement.removeAttribute('data-theme');
    if (themeToggle) themeToggle.selected = false;
  }

  if (themeToggle) {
    themeToggle.addEventListener('change', (e) => {
      if (e.target.selected) {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('pharma-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('pharma-theme', 'light');
      }
    });
  }

  // Initialize pie chart with default values
  window.updateChart(0, 0);
});

window.setLoading = function (on) {
  document.getElementById('fetchBtn').disabled = on;
  document.getElementById('liveDot').classList.toggle('active', !on);
  document.getElementById('liveStatus').textContent = on ? 'FETCHING' : 'LIVE';
}

window.showLoading = function (id) {
  document.getElementById(id).innerHTML = `
    <div class="loading-state">
      <md-circular-progress indeterminate></md-circular-progress>
      <div class="loading-text" style="margin-top: 24px;">Scanning global sources...</div>
    </div>`;
}

window.renderDeal = function (deal, type) {
  const rel = type === 'rumor'
    ? `<div class="reliability">
        <span class="reliability-label">Source Strength</span>
        <div class="reliability-bar">
          ${[1, 2, 3, 4, 5].map(i => `<div class="reliability-pip ${i <= (deal.reliability || 3) ? 'filled' : ''}"></div>`).join('')}
        </div>
       </div>`
    : '';

  return `<div class="deal-card ${type}" style="animation-delay:${Math.random() * 0.3}s">
    <div class="deal-top">
      <div class="deal-companies">${deal.acquirer || '?'} &rarr; ${deal.target || '?'}</div>
      ${deal.value ? `<div class="deal-value">${deal.value}</div>` : ''}
    </div>
    <div class="deal-meta">
      ${deal.geography ? `<span class="tag geo">${deal.geography}</span>` : ''}
      ${deal.dealType ? `<span class="tag type">${deal.dealType}</span>` : ''}
      ${deal.date ? `<span class="tag date">${deal.date}</span>` : ''}
    </div>
    <div class="deal-summary">${deal.summary || ''}</div>
    ${rel}
    ${deal.source ? `<div class="deal-source"><span class="material-symbols-outlined source-icon">link</span> Source: <a href="${deal.sourceUrl || '#'}" target="_blank">${deal.source}</a></div>` : ''}
  </div>`;
}

// Store deals for sorting
window.dealsCache = { confirmed: [], rumors: [] };

window.sortDeals = function(type, sortBy, descending = true) {
  const deals = window.dealsCache[type] || [];
  const listId = type === 'confirmed' ? 'confirmedList' : 'rumorsList';
  const tagId = type === 'confirmed' ? 'confirmedSortTag' : 'rumorsSortTag';
  const labelId = type === 'confirmed' ? 'confirmedSortLabel' : 'rumorsSortLabel';
  const clearBtnId = type === 'confirmed' ? 'clearConfirmedBtn' : 'clearRumorsBtn';
  
  let sortedDeals = [...deals];
  
  // Map sort field to label
  const sortLabels = {
    date: 'Date',
    value: 'Value',
    reliability: 'Reliability',
    company: 'Company'
  };

  // Sort based on selected field
  sortedDeals.sort((a, b) => {
    let aVal, bVal;

    switch(sortBy) {
      case 'date':
        aVal = new Date(a.date || 0);
        bVal = new Date(b.date || 0);
        break;
      case 'value':
        // Extract numeric value from string like "$43.0B"
        aVal = parseFloat(a.value?.replace(/[^\d.]/g, '') || 0);
        bVal = parseFloat(b.value?.replace(/[^\d.]/g, '') || 0);
        break;
      case 'reliability':
        aVal = a.reliability || 0;
        bVal = b.reliability || 0;
        break;
      case 'company':
        aVal = (a.acquirer || '').toLowerCase();
        bVal = (b.acquirer || '').toLowerCase();
        return descending ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      default:
        return 0;
    }

    if (descending) {
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    } else {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    }
  });

  // Re-render sorted deals
  const listElement = document.getElementById(listId);
  listElement.innerHTML = sortedDeals.map(d => window.renderDeal(d, type === 'confirmed' ? 'confirmed' : 'rumor')).join('');
  
  // Show sort tag and clear button
  const tagElement = document.getElementById(tagId);
  const labelElement = document.getElementById(labelId);
  const clearBtn = document.getElementById(clearBtnId);
  if (labelElement) labelElement.textContent = sortLabels[sortBy] || sortBy;
  if (tagElement) tagElement.style.display = 'inline-flex';
  if (clearBtn) clearBtn.style.display = 'inline-flex';
}

window.clearSort = function(type) {
  const listId = type === 'confirmed' ? 'confirmedList' : 'rumorsList';
  const tagId = type === 'confirmed' ? 'confirmedSortTag' : 'rumorsSortTag';
  const clearBtnId = type === 'confirmed' ? 'clearConfirmedBtn' : 'clearRumorsBtn';
  const deals = window.dealsCache[type] || [];
  
  // Re-render deals in original order (no sorting)
  const listElement = document.getElementById(listId);
  listElement.innerHTML = deals.map(d => window.renderDeal(d, type === 'confirmed' ? 'confirmed' : 'rumor')).join('');
  
  // Hide sort tag and clear button
  const tagElement = document.getElementById(tagId);
  const clearBtn = document.getElementById(clearBtnId);
  if (tagElement) tagElement.style.display = 'none';
  if (clearBtn) clearBtn.style.display = 'none';
}

window.fetchDeals = async function () {
  window.setLoading(true);
  window.showLoading('confirmedList');
  window.showLoading('rumorsList');

  try {
    const searchKeywordsField = document.getElementById('searchKeywords');
    const searchKeywordsValue = searchKeywordsField ? (searchKeywordsField.value || '') : '';
    
    const filters = {
      geo: document.getElementById('geoFilter').value,
      dateFrom: document.getElementById('dateFrom').value,
      dateTo: document.getElementById('dateTo').value,
      dealType: document.getElementById('dealTypeFilter').value,
      searchKeywords: searchKeywordsValue
    };

    // Build search query using API module
    const searchQuery = buildSearchQuery(filters);
    console.log('Search query:', searchQuery);
    console.log('Filters:', filters);

    // Fetch from Google News RSS using API module
    const deals = await fetchGoogleNewsRSS(searchQuery);

    if (!deals || deals.length === 0) {
      throw new Error('No results found. Please try different search terms.');
    }

    // Categorize deals using API module
    const { confirmed, rumors } = categorizeDeal(deals);
    
    // Cache deals for sorting
    window.dealsCache = { confirmed, rumors };

    document.getElementById('confirmedList').innerHTML = confirmed.length
      ? confirmed.map(d => window.renderDeal(d, 'confirmed')).join('')
      : `<div class="empty-state">
           <span class="material-symbols-outlined empty-icon">search_off</span>
           <div class="empty-text">No confirmed deals found.<br>Try adjusting your criteria.</div>
         </div>`;

    document.getElementById('rumorsList').innerHTML = rumors.length
      ? rumors.map(d => window.renderDeal(d, 'rumor')).join('')
      : `<div class="empty-state">
           <span class="material-symbols-outlined empty-icon">sensors_off</span>
           <div class="empty-text">No rumors found for selected filters.</div>
         </div>`;

    document.getElementById('statConfirmed').textContent = confirmed.length;
    document.getElementById('statRumors').textContent = rumors.length;
    document.getElementById('statValue').textContent = `${deals.length} items`;

    document.getElementById('confirmedCount').textContent = `${confirmed.length} deal${confirmed.length !== 1 ? 's' : ''}`;
    document.getElementById('rumorsCount').textContent = `${rumors.length} signal${rumors.length !== 1 ? 's' : ''}`;
    document.getElementById('lastUpdated').textContent = `Last updated: ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`;

    // Update pie chart with new data
    window.updateChart(confirmed.length, rumors.length);
  } catch (err) {
    console.error(err);
    ['confirmedList', 'rumorsList'].forEach(id => {
      document.getElementById(id).innerHTML =
        `<div class="empty-state">
           <span class="material-symbols-outlined empty-icon">error</span>
           <div class="empty-text">${err.message || 'Failed to load data. Please try again.'}</div>
         </div>`;
    });
  } finally {
    window.setLoading(false);
  }
}
