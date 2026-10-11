import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Api, Ponto, mensagemDeErro } from '../api';
import { Dados } from '../dados';
import { LIMITE_ALERTA, baixarArquivo, corEstufa, nomeEstufa } from '../formatos';
import { GraficoLinha, Serie } from './grafico-linha';

interface Grandeza {
  chave: string;
  titulo: string;
  unidade: string;
  casas: number;
  limite?: number;
}

const GRANDEZAS: Grandeza[] = [
  { chave: 'temperatura', titulo: 'Temperatura (°C)', unidade: '°C', casas: 1, limite: LIMITE_ALERTA },
  { chave: 'umidade', titulo: 'Umidade do ar (%)', unidade: '%', casas: 0 },
  { chave: 'luminosidade', titulo: 'Luminosidade (lux)', unidade: 'lux', casas: 0 },
  { chave: 'co2', titulo: 'CO₂ (ppm)', unidade: 'ppm', casas: 0 },
];

const PERIODOS = [
  { rotulo: '15 min', ms: 15 * 60_000 },
  { rotulo: '1 hora', ms: 3600_000 },
  { rotulo: '24 horas', ms: 24 * 3600_000 },
];

@Component({
  selector: 'app-graficos',
  imports: [GraficoLinha],
  template: `
    <div class="pagina">
      <div class="topo">
        <div>
          <h1>Gráficos</h1>
          <p class="sub">Séries temporais lidas do histórico no SQLite do Gateway · atualiza a cada 10 s</p>
        </div>
        <button type="button" (click)="exportar()" [disabled]="!dadosCarregados()">Exportar CSV</button>
      </div>

      <div class="cartao" style="flex-direction: row; flex-wrap: wrap; align-items: center; gap: 24px; padding: 16px 20px">
        <div class="grupo" role="group" aria-label="Estufa">
          <span class="pequeno" style="font-size: 13px">Estufa</span>
          <button type="button" [class.selecionado]="estufa() === ''" [attr.aria-pressed]="estufa() === ''"
                  (click)="mudarEstufa('')">Todas</button>
          @for (e of dados.estufas(); track e) {
            <button type="button" [class.selecionado]="estufa() === e" [attr.aria-pressed]="estufa() === e"
                    (click)="mudarEstufa(e)">{{ nomeEstufa(e) }}</button>
          }
        </div>
        <div class="grupo" role="group" aria-label="Período">
          <span class="pequeno" style="font-size: 13px">Período</span>
          @for (p of periodos; track p.ms) {
            <button type="button" [class.selecionado]="periodo() === p.ms" [attr.aria-pressed]="periodo() === p.ms"
                    (click)="mudarPeriodo(p.ms)">{{ p.rotulo }}</button>
          }
        </div>
        <div class="grupo" style="margin-left: auto; gap: 16px">
          @for (e of estufasVisiveis(); track e) {
            <span class="grupo pequeno" style="gap: 8px; color: var(--texto-3)">
              <span style="width: 18px; height: 3px; border-radius: 2px" [style.background]="cor(e)"></span>{{ nomeEstufa(e) }}
            </span>
          }
        </div>
      </div>

      @if (erro()) {
        <div class="erro-msg">{{ erro() }}</div>
      }

      <div class="grade">
        @for (g of grandezas; track g.chave) {
          <app-grafico-linha [titulo]="g.titulo" [unidade]="g.unidade" [casas]="g.casas" [limite]="g.limite"
                             [series]="series()[g.chave]" [de]="janela().de" [ate]="janela().ate" />
        }
      </div>
    </div>
  `,
  styles: `
    .grade { display: flex; flex-wrap: wrap; gap: 24px; }
    .grade > * { flex: 1 1 480px; min-width: 0; }
  `,
})
export class Graficos implements OnInit, OnDestroy {
  protected readonly dados = inject(Dados);
  private readonly api = inject(Api);

  protected readonly grandezas = GRANDEZAS;
  protected readonly periodos = PERIODOS;
  protected readonly nomeEstufa = nomeEstufa;

  protected readonly estufa = signal('');
  protected readonly periodo = signal(PERIODOS[1].ms);
  protected readonly janela = signal({ de: Date.now() - PERIODOS[1].ms, ate: Date.now() });
  protected readonly brutos = signal<Record<string, Record<string, Ponto[]>>>({}); // grandeza -> estufa -> pontos
  protected readonly erro = signal<string | null>(null);
  protected readonly dadosCarregados = computed(() => Object.keys(this.brutos()).length > 0);

  protected readonly estufasVisiveis = computed(() =>
    this.estufa() ? [this.estufa()] : this.dados.estufas(),
  );

  protected readonly series = computed<Record<string, Serie[]>>(() => {
    const saida: Record<string, Serie[]> = {};
    for (const g of GRANDEZAS) {
      saida[g.chave] = this.estufasVisiveis().map((e) => ({
        nome: nomeEstufa(e).replace('Estufa ', 'E'),
        cor: this.cor(e),
        pontos: this.brutos()[g.chave]?.[e] ?? [],
      }));
    }
    return saida;
  });

  private timer: ReturnType<typeof setInterval> | undefined;
  private esperandoEstufas: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.carregar();
    this.timer = setInterval(() => this.carregar(), 10_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
    clearTimeout(this.esperandoEstufas);
  }

  protected cor(e: string): string {
    return corEstufa(e, this.dados.estufas());
  }

  protected mudarEstufa(e: string): void {
    this.estufa.set(e);
    this.carregar();
  }

  protected mudarPeriodo(ms: number): void {
    this.periodo.set(ms);
    this.carregar();
  }

  private carregar(): void {
    const estufas = this.estufasVisiveis();
    if (!estufas.length) {
      // a lista de estufas chega pelo polling; tenta de novo logo em seguida
      clearTimeout(this.esperandoEstufas);
      this.esperandoEstufas = setTimeout(() => this.carregar(), 1000);
      return;
    }
    const ate = Date.now();
    const de = ate - this.periodo();
    const pedidos: Record<string, ReturnType<Api['historico']>> = {};
    for (const g of GRANDEZAS) {
      for (const e of estufas) {
        pedidos[`${g.chave}|${e}`] = this.api.historico(g.chave, e, de, ate, 240);
      }
    }
    forkJoin(pedidos).subscribe({
      next: (r) => {
        const novo: Record<string, Record<string, Ponto[]>> = {};
        for (const [chave, pontos] of Object.entries(r)) {
          const [g, e] = chave.split('|');
          (novo[g] ??= {})[e] = pontos;
        }
        this.brutos.set(novo);
        this.janela.set({ de, ate });
        this.erro.set(null);
      },
      error: (e) => this.erro.set(mensagemDeErro(e)),
    });
  }

  protected exportar(): void {
    const linhas = ['grandeza;estufa;fonte;data_hora;valor;alerta'];
    for (const [g, porEstufa] of Object.entries(this.brutos())) {
      for (const [e, pontos] of Object.entries(porEstufa)) {
        for (const p of pontos) {
          const quando = new Date(p.timestampMs).toLocaleString('pt-BR');
          linhas.push([g, e, p.fonteId, quando, String(p.valor).replace('.', ','), p.alerta ? 'sim' : ''].join(';'));
        }
      }
    }
    baixarArquivo(`estufa-historico-${new Date().toISOString().slice(0, 16).replace(':', 'h')}.csv`, linhas.join('\n'));
  }
}
