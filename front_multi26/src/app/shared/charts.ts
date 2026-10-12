import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatMoney, formatNumber } from './format';

/** Couleurs des séries, dans l'ordre ; la première suit la couleur de l'application. */
export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-10 » → « oct. 26 ». */
export function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTHS[month - 1] ?? key} ${String(year).slice(2)}`;
}

/** Plus petit palier « rond » au-dessus de la valeur, pour graduer un axe. */
function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((step) => step * magnitude).find((step) => step >= value) ?? 10 * magnitude;
}

export interface BarSeries {
  name: string;
  values: number[];
}

/** Barres groupées par période, qui montent à l'affichage. Montants en GNF. */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="legend">
      @for (item of series(); track item.name; let index = $index) {
        <span><i [style.background]="colors[index]"></i>{{ item.name }}</span>
      }
      <span class="unit">{{ unit().label }}</span>
    </div>
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="label()">
      @for (tick of ticks(); track tick.value) {
        <line class="grid" [attr.x1]="left" [attr.x2]="width" [attr.y1]="tick.y" [attr.y2]="tick.y" />
        <text class="axis" [attr.x]="left - 8" [attr.y]="tick.y + 4" text-anchor="end">{{ tick.text }}</text>
      }
      @for (group of groups(); track group.label; let g = $index) {
        @for (bar of group.bars; track bar.name) {
          <rect class="bar" [attr.x]="bar.x" [attr.y]="bar.y" [attr.width]="bar.width" [attr.height]="bar.height" rx="3" [attr.fill]="bar.color" [style.animation-delay.ms]="g * 45">
            <title>{{ group.label }} — {{ bar.name }} : {{ bar.amount }}</title>
          </rect>
        }
        <text class="axis" [attr.x]="group.center" [attr.y]="height - 6" text-anchor="middle">{{ group.label }}</text>
      }
    </svg>
  `,
  styles: `
    :host { display: block; }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .axis { fill: var(--text-muted); font-size: 11px; }
    .bar { transform-box: fill-box; transform-origin: 50% 100%; animation: grow .8s cubic-bezier(.2, .8, .2, 1) both; transition: opacity .15s ease; }
    .bar:hover { opacity: .8; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 18px; margin-bottom: 10px; font-size: 12.5px; color: var(--text-soft); }
    .legend span { display: inline-flex; align-items: center; gap: 7px; }
    .legend i { width: 10px; height: 10px; border-radius: 3px; }
    .legend .unit { margin-left: auto; color: var(--text-muted); }
    @keyframes grow { from { transform: scaleY(0); } }
    @media (prefers-reduced-motion: reduce) { .bar { animation: none; } }
  `,
})
export class BarChart {
  readonly labels = input.required<string[]>();
  readonly series = input.required<BarSeries[]>();
  readonly label = input('Graphique en barres');

  protected readonly colors = CHART_COLORS;
  protected readonly width = 720;
  protected readonly height = 260;
  protected readonly left = 46;
  readonly #top = 10;
  readonly #bottom = 28;

  readonly #max = computed(() => niceCeiling(Math.max(0, ...this.series().flatMap((item) => item.values))));
  /** L'axe est gradué dans une unité lisible ; les montants complets restent dans les infobulles. */
  protected readonly unit = computed(() => {
    const max = this.#max();
    if (max >= 1_000_000) {
      return { divisor: 1_000_000, label: 'en millions de GNF' };
    }
    return max >= 1000 ? { divisor: 1000, label: 'en milliers de GNF' } : { divisor: 1, label: 'en GNF' };
  });

  protected readonly ticks = computed(() => {
    const max = this.#max();
    const plot = this.height - this.#top - this.#bottom;
    return [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
      value: ratio,
      y: this.#top + plot * (1 - ratio),
      text: formatNumber((max * ratio) / this.unit().divisor),
    }));
  });

  protected readonly groups = computed(() => {
    const labels = this.labels();
    const series = this.series();
    const max = this.#max();
    const plot = this.height - this.#top - this.#bottom;
    const slot = (this.width - this.left) / Math.max(1, labels.length);
    const barWidth = Math.min(26, (slot * 0.7) / Math.max(1, series.length));
    const groupWidth = barWidth * series.length + 3 * (series.length - 1);

    return labels.map((label, index) => {
      const start = this.left + slot * index + (slot - groupWidth) / 2;
      return {
        label,
        center: this.left + slot * index + slot / 2,
        bars: series.map((item, position) => {
          const value = Math.max(0, item.values[index] ?? 0);
          const barHeight = (value / max) * plot;
          return {
            name: item.name,
            color: CHART_COLORS[position % CHART_COLORS.length],
            x: start + position * (barWidth + 3),
            y: this.#top + plot - barHeight,
            width: barWidth,
            height: Math.max(barHeight, value > 0 ? 2 : 0),
            amount: formatMoney(value),
          };
        }),
      };
    });
  });
}

export interface Slice {
  name: string;
  value: number;
}

/** Répartition en anneau, dont les parts se dessinent à l'affichage. */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 120 120" role="img" [attr.aria-label]="label()">
      <circle class="track" cx="60" cy="60" r="46" />
      @for (arc of arcs(); track arc.name; let index = $index) {
        <circle
          class="arc" cx="60" cy="60" r="46" [attr.stroke]="arc.color" pathLength="100"
          [attr.stroke-dasharray]="arc.share + ' ' + (100 - arc.share)" [attr.stroke-dashoffset]="-arc.offset" [style.animation-delay.ms]="index * 120"
        >
          <title>{{ arc.name }} : {{ arc.amount }} ({{ arc.percent }} %)</title>
        </circle>
      }
      <text class="total" x="60" y="57" text-anchor="middle">{{ arcs().length }}</text>
      <text class="caption" x="60" y="71" text-anchor="middle">{{ arcs().length > 1 ? 'activités' : 'activité' }}</text>
    </svg>
    <ul>
      @for (arc of arcs(); track arc.name) {
        <li>
          <i [style.background]="arc.color"></i>
          <span class="name">{{ arc.name }}</span>
          <span class="percent num">{{ arc.percent }} %</span>
          <span class="amount num">{{ arc.amount }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: grid; grid-template-columns: 150px 1fr; gap: 20px; align-items: center; }
    svg { width: 150px; height: 150px; transform: rotate(-90deg); }
    .track { fill: none; stroke: var(--surface-3); stroke-width: 14; }
    .arc { fill: none; stroke-width: 14; animation: draw .9s cubic-bezier(.2, .8, .2, 1) both; transition: stroke-width .15s ease; }
    .arc:hover { stroke-width: 17; }
    text { transform: rotate(90deg); transform-origin: 60px 60px; }
    .total { fill: var(--text); font-size: 20px; font-weight: 600; }
    .caption { fill: var(--text-muted); font-size: 8px; }
    ul { display: grid; gap: 10px; }
    li { display: grid; grid-template-columns: auto 1fr auto; gap: 2px 10px; align-items: center; font-size: 13px; }
    i { width: 10px; height: 10px; border-radius: 3px; }
    .name { font-weight: 500; }
    .percent { color: var(--text-soft); }
    .amount { grid-column: 2 / -1; color: var(--text-muted); font-size: 12.5px; }
    @keyframes draw { from { stroke-dasharray: 0 100; } }
    @media (prefers-reduced-motion: reduce) { .arc { animation: none; } }
    @media (max-width: 520px) { :host { grid-template-columns: 1fr; justify-items: center; } }
  `,
})
export class DonutChart {
  readonly slices = input.required<Slice[]>();
  readonly label = input('Répartition');

  protected readonly arcs = computed(() => {
    const slices = this.slices().filter((slice) => slice.value > 0);
    const total = slices.reduce((sum, slice) => sum + slice.value, 0) || 1;
    let offset = 0;
    return slices.map((slice, index) => {
      const share = (slice.value / total) * 100;
      const arc = {
        name: slice.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
        share,
        offset,
        percent: formatNumber(Math.round(share * 10) / 10),
        amount: formatMoney(slice.value),
      };
      offset += share;
      return arc;
    });
  });
}

export interface RankItem {
  name: string;
  value: number;
  /** Devise du montant ; GNF par défaut. */
  currency?: string;
  /** Précision sous le nom. */
  note?: string;
}

/** Classement : une barre horizontale par ligne, qui s'allonge à l'affichage. */
@Component({
  selector: 'app-rank-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (row of rows(); track row.name + row.currency; let index = $index) {
      <div class="row">
        <span class="position num">{{ index + 1 }}</span>
        <div class="body">
          <div class="head">
            <span class="name">{{ row.name }}</span>
            <span class="amount num">{{ row.amount }}</span>
          </div>
          <div class="track"><div class="fill" [style.width.%]="row.share" [style.animation-delay.ms]="index * 60" [style.background]="color()"></div></div>
          @if (row.note) {
            <span class="note">{{ row.note }}</span>
          }
        </div>
      </div>
    } @empty {
      <p class="none">Rien à classer sur la période.</p>
    }
  `,
  styles: `
    :host { display: grid; gap: 14px; }
    .row { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; }
    .position { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: var(--surface-3); color: var(--text-soft); font-size: 11.5px; font-weight: 600; }
    .head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 13px; }
    .name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amount { font-weight: 600; white-space: nowrap; }
    .track { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
    .fill { height: 100%; border-radius: 3px; transform-origin: left; animation: stretch .8s cubic-bezier(.2, .8, .2, 1) both; }
    .note { display: block; margin-top: 4px; font-size: 12px; color: var(--text-muted); }
    .none { color: var(--text-muted); }
    @keyframes stretch { from { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .fill { animation: none; } }
  `,
})
export class RankList {
  readonly items = input.required<RankItem[]>();
  readonly color = input('var(--chart-1)');

  protected readonly rows = computed(() => {
    const items = this.items();
    // Les longueurs se comparent au sein d'une même devise
    const maxByCurrency = new Map<string, number>();
    for (const item of items) {
      const currency = item.currency ?? 'GNF';
      maxByCurrency.set(currency, Math.max(maxByCurrency.get(currency) ?? 0, item.value));
    }
    return items.map((item) => {
      const currency = item.currency ?? 'GNF';
      return {
        name: item.name,
        currency,
        note: item.note,
        amount: formatMoney(item.value, currency),
        share: Math.max(2, (item.value / (maxByCurrency.get(currency) || 1)) * 100),
      };
    });
  });
}
