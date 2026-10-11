import { Chart } from 'chart.js';

let bound = false;

function applyChartTheme(): void {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;

  // Textes (axes, legendes), quadrillage et separateurs de secteurs suivent le theme
  Chart.defaults.color = token('--app-text-muted', '#64748b');
  Chart.defaults.borderColor = 'rgba(148, 163, 184, .18)';
  Chart.defaults.elements.arc.borderColor = token('--app-surface', '#fff');

  Object.values(Chart.instances).forEach(chart => chart.update('none'));
}

/**
 * Aligne Chart.js sur le theme clair/sombre courant, puis a chaque bascule.
 * A appeler depuis tout ecran qui affiche un graphique : chart.js reste ainsi
 * hors du bundle initial.
 */
export function syncChartsWithTheme(): void {
  if (!bound) {
    bound = true;
    document.documentElement.addEventListener('ColorSchemeChange', applyChartTheme);
  }
  applyChartTheme();
}
