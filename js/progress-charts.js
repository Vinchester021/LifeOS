// LifeOS — charts of the Progress page. The ONLY file that uses Chart.js.
// It gets ready numbers (series from the pure functions in progress.js) and only draws them.
// Every chart also has a table with the same numbers:
//   - with Chart.js the table is hidden visually but read by screen readers;
//   - without Chart.js (no internet) the table is shown instead of the chart.
'use strict';

const ProgressCharts = {
  charts: [], // Chart instances, destroyed before every redraw

  isAvailable() {
    return typeof window.Chart === 'function';
  },

  // Chart colors come from the CSS variables, so they follow the theme and the accent.
  colors() {
    const style = getComputedStyle(document.documentElement);
    const read = (name) => style.getPropertyValue(name).trim();
    return {
      primary: read('--lifeos-primary'),
      clay: read('--palette-clay'),
      text: read('--lifeos-text-muted'),
      grid: read('--lifeos-border')
    };
  },

  destroy() {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
  },

  // "#0f5f57" + 0.15 -> "rgba(15, 95, 87, 0.15)" (the soft fill under a line).
  withAlpha(color, alpha) {
    const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color);
    if (!match) return 'transparent';
    const [red, green, blue] = match.slice(1).map((hex) => parseInt(hex, 16));
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  },

  // series: { weight, savings, tasks } — each { labels, values, format, tick, tableHeads, emptyKey }
  render(series) {
    this.destroy();
    byId('charts-offline').hidden = this.isAvailable();
    this.draw('chart-weight', series.weight);
    this.draw('chart-savings', series.savings);
    this.draw('chart-tasks', series.tasks);
  },

  // The year summary: one bar chart "Tasks by month".
  renderSummary(series) {
    this.destroy();
    byId('summary-chart-offline').hidden = this.isAvailable();
    this.draw('summary-months', series);
  },

  tableHtml(data, isVisible) {
    const rows = data.labels.map((label, index) =>
      `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(data.format(data.values[index]))}</td></tr>`).join('');
    const table = `
      <table class="data-table">
        <thead><tr>${data.tableHeads.map((head) => `<th scope="col">${escapeHtml(head)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    return isVisible ? `<div class="table-wrap chart-table">${table}</div>` : `<div class="visually-hidden">${table}</div>`;
  },

  // A line with a soft area under it (the last point is bigger), or bars when data.type is 'bar'.
  draw(containerId, data) {
    const container = byId(containerId);
    if (data.labels.length === 0) {
      container.innerHTML = `<p class="task-empty">${escapeHtml(t(data.emptyKey))}</p>`;
      return;
    }
    if (!this.isAvailable()) {
      container.innerHTML = this.tableHtml(data, true);
      return;
    }
    // The canvas is a picture for sighted users; the hidden table has the numbers for screen readers.
    container.innerHTML = `<div class="chart-box"><canvas aria-hidden="true"></canvas></div>${this.tableHtml(data, false)}`;
    const colors = this.colors();
    const color = colors.primary;
    const lastIndex = data.values.length - 1;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chart = new window.Chart(container.querySelector('canvas'), {
      type: data.type ?? 'line',
      data: {
        labels: data.labels,
        datasets: [{
          data: data.values,
          borderColor: color,
          backgroundColor: data.type === 'bar' ? color : this.withAlpha(color, 0.14),
          borderRadius: data.type === 'bar' ? 4 : 0,
          fill: data.type !== 'bar',
          borderWidth: 2,
          pointBackgroundColor: color,
          pointRadius: data.values.map((_, index) => (index === lastIndex ? 5 : 2.5)),
          tension: 0.3
        }]
      },
      options: {
        animation: reduceMotion ? false : { duration: 400 },
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (item) => data.format(item.parsed.y) } }
        },
        scales: {
          x: { ticks: { color: colors.text, maxRotation: 0, autoSkip: true }, grid: { display: false } },
          y: {
            beginAtZero: Boolean(data.fromZero), // counts start at 0; weight and money zoom in
            ...(data.fromZero ? { suggestedMax: 1 } : {}),
            ticks: { color: colors.text, maxTicksLimit: 4, precision: data.fromZero ? 0 : undefined, callback: (value) => (data.tick ?? data.format)(value) },
            grid: { color: colors.grid }
          }
        }
      }
    });
    this.charts.push(chart);
  }
};
