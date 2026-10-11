import { Component, computed, input } from '@angular/core';
import { Ponto } from '../api';
import { fmt, hora } from '../formatos';

export interface Serie {
  nome: string;
  cor: string;
  pontos: Ponto[];
}

const X0 = 48;
const X1 = 544;
const Y0 = 16;
const Y1 = 200;
const LACUNA_MS = 60_000; // sem leitura por mais de 1 min: a linha é interrompida

/** Gráfico de linha em SVG puro (sem biblioteca), com linha de limite opcional. */
@Component({
  selector: 'app-grafico-linha',
  template: `
    <section class="cartao" style="padding: 20px 20px 12px; gap: 8px">
      <div class="topo" style="align-items: baseline">
        <h2 style="font-size: 16px">{{ titulo() }}</h2>
        <div class="grupo mono" style="font-size: 13px; gap: 14px">
          @for (s of atuais(); track s.nome) {
            <span [style.color]="s.cor">{{ s.nome }} {{ s.texto }}</span>
          }
        </div>
      </div>
      <svg viewBox="0 0 560 236" role="img" [attr.aria-label]="titulo()" class="mono">
        @for (t of ticksY(); track t.y) {
          <line [attr.x1]="x0" [attr.x2]="x1" [attr.y1]="t.y" [attr.y2]="t.y"
                [attr.stroke]="t.base ? '#BFCAC3' : '#E6EBE7'"></line>
          <text x="40" [attr.y]="t.y + 4" text-anchor="end" font-size="11" fill="#55625A">{{ t.rotulo }}</text>
        }
        @for (t of ticksX(); track t.x) {
          <text [attr.x]="t.x" y="222" [attr.text-anchor]="t.ancora" font-size="11" fill="#55625A">{{ t.rotulo }}</text>
        }
        @if (limiteY(); as ly) {
          <line [attr.x1]="x0" [attr.x2]="x1" [attr.y1]="ly" [attr.y2]="ly" stroke="#C2410C" stroke-width="1.25"
                stroke-dasharray="5 4"></line>
          <text x="540" [attr.y]="ly - 6" text-anchor="end" font-size="11" fill="#B4430A">limite de alerta {{ limite() }} {{ unidade() }}</text>
        }
        @for (l of linhas(); track $index) {
          <polyline [attr.points]="l.pontos" fill="none" [attr.stroke]="l.cor" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round"></polyline>
        }
        @for (m of marcasAlerta(); track $index) {
          <circle [attr.cx]="m.x" [attr.cy]="m.y" r="4" fill="#C2410C"></circle>
        }
        @if (!temDados()) {
          <text x="296" y="112" text-anchor="middle" font-size="13" fill="#55625A">Sem leituras no período</text>
        }
      </svg>
    </section>
  `,
  styles: `svg { width: 100%; height: auto; display: block; }`,
})
export class GraficoLinha {
  readonly titulo = input.required<string>();
  readonly unidade = input('');
  readonly series = input<Serie[]>([]);
  readonly de = input.required<number>();
  readonly ate = input.required<number>();
  readonly limite = input<number | undefined>(undefined);
  readonly casas = input(1);

  protected readonly x0 = X0;
  protected readonly x1 = X1;

  protected readonly temDados = computed(() => this.series().some((s) => s.pontos.length > 0));

  private readonly faixaY = computed(() => {
    const valores = this.series().flatMap((s) => s.pontos.map((p) => p.valor));
    const lim = this.limite();
    if (lim !== undefined) valores.push(lim);
    if (!valores.length) return { min: 0, max: 1, passo: 0.25 };
    let min = Math.min(...valores);
    let max = Math.max(...valores);
    if (max - min < 1e-9) {
      min -= 1;
      max += 1;
    }
    const passo = passoBonito((max - min) / 4);
    min = Math.floor(min / passo) * passo;
    max = Math.ceil(max / passo) * passo;
    return { min, max, passo };
  });

  private y(v: number): number {
    const { min, max } = this.faixaY();
    return Y1 - ((v - min) / (max - min)) * (Y1 - Y0);
  }

  private x(t: number): number {
    const de = this.de();
    const ate = this.ate();
    return X0 + ((t - de) / Math.max(1, ate - de)) * (X1 - X0);
  }

  protected readonly ticksY = computed(() => {
    const { min, max, passo } = this.faixaY();
    const ticks = [];
    const casas = passo >= 1 ? 0 : passo >= 0.1 ? 1 : 2;
    for (let v = min; v <= max + passo / 2; v += passo) {
      const rotulo = Math.abs(v) >= 10000 ? `${fmt(v / 1000, 0)}k` : fmt(v, casas);
      ticks.push({ y: this.y(v), rotulo, base: Math.abs(v - min) < 1e-9 });
    }
    return ticks;
  });

  protected readonly ticksX = computed(() => {
    const de = this.de();
    const ate = this.ate();
    const comSeg = ate - de <= 20 * 60_000;
    return [0, 0.25, 0.5, 0.75, 1].map((f, i) => ({
      x: X0 + f * (X1 - X0),
      rotulo: hora(de + f * (ate - de), comSeg),
      ancora: i === 0 ? 'start' : i === 4 ? 'end' : 'middle',
    }));
  });

  protected readonly limiteY = computed(() => {
    const lim = this.limite();
    return lim === undefined || !this.temDados() ? null : this.y(lim);
  });

  protected readonly linhas = computed(() => {
    const linhas: { cor: string; pontos: string }[] = [];
    // em períodos longos os pontos vêm agrupados pelo Gateway, mais espaçados
    const lacuna = Math.max(LACUNA_MS, (this.ate() - this.de()) / 80);
    for (const s of this.series()) {
      let atual: string[] = [];
      let anterior = 0;
      for (const p of s.pontos) {
        if (atual.length && p.timestampMs - anterior > lacuna) {
          linhas.push({ cor: s.cor, pontos: atual.join(' ') });
          atual = [];
        }
        atual.push(`${this.x(p.timestampMs).toFixed(1)},${this.y(p.valor).toFixed(1)}`);
        anterior = p.timestampMs;
      }
      if (atual.length === 1) atual.push(atual[0]); // um ponto só ainda aparece
      if (atual.length) linhas.push({ cor: s.cor, pontos: atual.join(' ') });
    }
    return linhas;
  });

  protected readonly marcasAlerta = computed(() =>
    this.series().flatMap((s) =>
      s.pontos.filter((p) => p.alerta).map((p) => ({ x: this.x(p.timestampMs), y: this.y(p.valor) })),
    ),
  );

  protected readonly atuais = computed(() =>
    this.series()
      .filter((s) => s.pontos.length)
      .map((s) => ({
        nome: s.nome,
        cor: s.cor,
        texto: `${fmt(s.pontos[s.pontos.length - 1].valor, this.casas())} ${this.unidade()}`,
      })),
  );
}

function passoBonito(bruto: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / exp;
  const bonito = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return bonito * exp;
}
