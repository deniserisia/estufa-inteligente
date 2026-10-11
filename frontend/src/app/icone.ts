import { Component, input } from '@angular/core';

export type NomeIcone =
  | 'estufa'
  | 'celeiro'
  | 'painel'
  | 'controles'
  | 'graficos'
  | 'consultas'
  | 'termometro'
  | 'gota'
  | 'sol'
  | 'co2'
  | 'ventilador'
  | 'nevoa'
  | 'sombra'
  | 'tomate'
  | 'pimenta'
  | 'folha'
  | 'alerta'
  | 'broto';

/** Ícones em SVG desenhados à mão (traço), sem dependências externas. */
@Component({
  selector: 'app-icone',
  template: `
    <svg [attr.width]="tamanho()" [attr.height]="tamanho()" viewBox="0 0 24 24" fill="none" [attr.stroke]="cor()"
         stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      @switch (nome()) {
        @case ('estufa') {
          <path d="M3 20v-8a9 7 0 0 1 18 0v8"></path>
          <path d="M2 20h20"></path>
          <path d="M12 5v15"></path>
          <path d="M7.5 6.6V20M16.5 6.6V20"></path>
          <path d="M3.2 11.5h17.6"></path>
        }
        @case ('celeiro') {
          <path d="M3 21V10l9-6 9 6v11"></path>
          <path d="M2 21h20"></path>
          <path d="M9 21v-6h6v6"></path>
          <path d="M9 15l6 6M15 15l-6 6"></path>
          <path d="M10 10h4"></path>
        }
        @case ('painel') {
          <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
        }
        @case ('controles') {
          <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"></path>
          <circle cx="16" cy="6" r="2"></circle>
          <circle cx="10" cy="12" r="2"></circle>
          <circle cx="18" cy="18" r="2"></circle>
        }
        @case ('graficos') {
          <path d="M3 3v18h18"></path>
          <path d="M7 15l4-5 3 3 5-7"></path>
        }
        @case ('consultas') {
          <circle cx="11" cy="11" r="7"></circle>
          <path d="M20 20l-4-4"></path>
        }
        @case ('termometro') {
          <path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"></path>
          <path d="M12 9v8"></path>
        }
        @case ('gota') {
          <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"></path>
          <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5"></path>
        }
        @case ('sol') {
          <circle cx="12" cy="12" r="4"></circle>
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>
        }
        @case ('co2') {
          <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"></path>
          <path d="M10 14.5h4"></path>
        }
        @case ('ventilador') {
          <circle cx="12" cy="12" r="1.6"></circle>
          <path d="M12 10.4c0-3.6 1.2-6.4 3.6-6.4 2 0 2.2 2.8-3.6 6.4z"></path>
          <path d="M12 10.4c0-3.6 1.2-6.4 3.6-6.4 2 0 2.2 2.8-3.6 6.4z" transform="rotate(120 12 12)"></path>
          <path d="M12 10.4c0-3.6 1.2-6.4 3.6-6.4 2 0 2.2 2.8-3.6 6.4z" transform="rotate(240 12 12)"></path>
        }
        @case ('nevoa') {
          <path d="M8 4v2M12 3v3M16 4v2"></path>
          <path d="M6 9h12"></path>
          <path d="M7 13c1 1 2 1 3 0s2-1 3 0 2 1 3 0"></path>
          <path d="M6 17c1 1 2 1 3 0s2-1 3 0 2 1 3 0 2-1 3 0"></path>
        }
        @case ('sombra') {
          <path d="M3 5h18v5H3z"></path>
          <path d="M7 5l-4 4M12 5l-5 5M17 5l-5 5M21 6l-4 4"></path>
          <path d="M7 14l-1 4M12 14v5M17 14l1 4"></path>
        }
        @case ('tomate') {
          <path d="M12 7.5c4.4 0 7.5 2.9 7.5 6.7S16.4 21 12 21s-7.5-3-7.5-6.8 3.1-6.7 7.5-6.7z"></path>
          <path d="M12 7.5L9.5 5M12 7.5l2.5-2.5M12 7.5L8 7M12 7.5l4-.5M12 7.5V3.5"></path>
        }
        @case ('pimenta') {
          <path d="M9 8.5c-3 2-3.8 7-1 10.5 2 2.5 5.4 2.4 7.3 0 2.8-3.5 2-8.5-1.1-10.5-1.6-1-3.6-1-5.2 0z"></path>
          <path d="M11.8 8V5.5c0-1.4 1-2.5 2.4-2.5"></path>
        }
        @case ('folha') {
          <path d="M5 19c0-8.5 5.5-14 15-15-.8 9.5-6.5 15-15 15z"></path>
          <path d="M5 19l8-8"></path>
        }
        @case ('broto') {
          <path d="M12 21v-9"></path>
          <path d="M12 12c0-4 2.5-6.5 7-7 0 4.5-2.5 7-7 7z"></path>
          <path d="M12 14c0-3-2-5-6-5.5 0 3.5 2 5.5 6 5.5z"></path>
          <path d="M7 21h10"></path>
        }
        @case ('alerta') {
          <path d="M12 3l10 18H2L12 3z"></path>
          <path d="M12 10v5M12 18h.01"></path>
        }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; }`,
})
export class Icone {
  readonly nome = input.required<NomeIcone>();
  readonly tamanho = input(20);
  readonly cor = input('currentColor');
}
