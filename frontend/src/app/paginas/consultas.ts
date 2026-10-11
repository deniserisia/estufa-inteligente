import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Api, Consulta, Ponto, Resultado, mensagemDeErro } from '../api';
import { Dados } from '../dados';
import { TEMPERATURA_IDEAL, baixarArquivo, corEstufa, duracao, fmt, hora, nomeEstufa } from '../formatos';

type Chave = 'tempo' | 'umidade' | 'luz';

interface EstadoConsulta {
  janela: number;
  resposta?: Consulta;
  erro?: string;
  carregando: boolean;
}

const JANELAS = [
  { rotulo: 'Última hora', s: 3600 },
  { rotulo: 'Últimas 24 h', s: 86400 },
];

@Component({
  selector: 'app-consultas',
  imports: [FormsModule],
  template: `
    <div class="pagina">
      <div>
        <h1>Consultas</h1>
        <p class="sub">Cada consulta vira uma ConsultaAgregada enviada ao Gateway por TCP</p>
      </div>

      <div class="linha-flex">
        @for (c of cartoes; track c.chave) {
          <section class="cartao" style="flex: 1 1 340px">
            <div>
              <h2>{{ c.titulo }}</h2>
              <p class="pequeno" style="margin: 4px 0 0; font-size: 13px; line-height: 19px">{{ c.descricao }}</p>
            </div>
            <div class="duas" role="group" aria-label="Janela">
              @for (j of janelas; track j.s) {
                <button type="button" [class.selecionado]="estado()[c.chave].janela === j.s"
                        [attr.aria-pressed]="estado()[c.chave].janela === j.s" (click)="mudarJanela(c.chave, j.s)">
                  {{ j.rotulo }}
                </button>
              }
            </div>
            @if (c.chave === 'tempo') {
              <div class="grupo" style="flex-wrap: nowrap">
                <label for="limite">Temperatura ideal até</label>
                <input id="limite" type="number" min="10" max="50" step="0.5" class="mono" style="width: 90px"
                       [ngModel]="limite()" (ngModelChange)="limite.set($event)" (change)="executar('tempo')">
                <span class="pequeno">°C</span>
              </div>
            }

            @if (estado()[c.chave]; as st) {
              @if (st.erro) {
                <div class="erro-msg">{{ st.erro }}</div>
              } @else if (st.resposta && !st.resposta.resultados.length) {
                <div class="pequeno">Sem leituras nesse período.</div>
              } @else if (st.resposta) {
                <div class="resultados">
                  @for (r of st.resposta.resultados; track r.estufa) {
                    <div>
                      <div class="topo" style="align-items: baseline; gap: 8px">
                        <span style="font-weight: 500">{{ nomeEstufa(r.estufa) }}</span>
                        <span class="mono" style="font-size: 18px; font-weight: 500">{{ valor(c.chave, r) }}</span>
                      </div>
                      <div class="trilho">
                        <div class="barra" [style.width.%]="largura(c.chave, r, st.resposta)" [style.background]="cor(r.estufa)"></div>
                      </div>
                      <div class="pequeno">{{ detalhe(c.chave, r, st.resposta) }}</div>
                    </div>
                  }
                </div>
              }
              <div class="caixa-mono" style="margin-top: auto">
                {{ st.resposta?.mensagemEnviada ?? (st.carregando ? 'consultando…' : '') }}
              </div>
            }
          </section>
        }
      </div>

      <section class="cartao">
        <div class="topo" style="align-items: baseline">
          <div>
            <h2>Histórico de leituras</h2>
            <p class="pequeno" style="margin: 4px 0 0; font-size: 13px">Persistido no SQLite do Gateway</p>
          </div>
          <button type="button" (click)="exportarHistorico()" [disabled]="!historico().length">Exportar CSV</button>
        </div>
        <form class="grupo" style="align-items: flex-end; gap: 16px" (ngSubmit)="buscarHistorico()">
          <div class="campo" style="flex: 1 1 160px">
            <label for="h-estufa">Estufa</label>
            <select id="h-estufa" name="estufa" [ngModel]="hEstufa()" (ngModelChange)="hEstufa.set($event)">
              @for (e of dados.estufas(); track e) {
                <option [value]="e">{{ nomeEstufa(e) }}</option>
              }
            </select>
          </div>
          <div class="campo" style="flex: 1 1 160px">
            <label for="h-grandeza">Grandeza</label>
            <select id="h-grandeza" name="grandeza" [ngModel]="hGrandeza()" (ngModelChange)="hGrandeza.set($event)">
              <option value="temperatura">Temperatura</option>
              <option value="umidade">Umidade</option>
              <option value="luminosidade">Luminosidade</option>
              <option value="co2">CO₂</option>
            </select>
          </div>
          <div class="campo" style="flex: 1 1 200px">
            <label for="h-de">De</label>
            <input id="h-de" name="de" type="datetime-local" [ngModel]="hDe()" (ngModelChange)="hDe.set($event)">
          </div>
          <div class="campo" style="flex: 1 1 200px">
            <label for="h-ate">Até</label>
            <input id="h-ate" name="ate" type="datetime-local" [ngModel]="hAte()" (ngModelChange)="hAte.set($event)">
          </div>
          <button type="submit" class="primario">Buscar</button>
        </form>
        @if (hErro()) {
          <div class="erro-msg">{{ hErro() }}</div>
        }
        @if (historico().length) {
          <div class="pequeno">{{ historico().length }} leituras (mais recentes primeiro)</div>
          <div class="rolagem" style="max-height: 360px; overflow-y: auto">
            <table style="min-width: 560px">
              <thead><tr><th>Horário</th><th>Fonte</th><th>Valor</th><th>Tipo de envio</th></tr></thead>
              <tbody>
                @for (p of historicoInvertido(); track $index) {
                  <tr [class.texto-alerta]="p.alerta">
                    <td class="mono">{{ hora(p.timestampMs) }}</td>
                    <td class="mono">{{ p.fonteId }}</td>
                    <td class="mono">{{ fmt(p.valor, 2) }}</td>
                    <td>{{ p.alerta ? 'Alerta imediato' : 'Periódico' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else if (buscou()) {
          <div class="pequeno">Nenhuma leitura nesse intervalo.</div>
        }
      </section>
    </div>
  `,
  styles: `
    .duas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .resultados { display: flex; flex-direction: column; gap: 14px; }
    .trilho { height: 10px; border-radius: 5px; background: var(--linha); overflow: hidden; margin: 6px 0; }
    .barra { height: 10px; border-radius: 5px; min-width: 2px; }
  `,
})
export class Consultas implements OnInit {
  protected readonly dados = inject(Dados);
  private readonly api = inject(Api);

  protected readonly janelas = JANELAS;
  protected readonly nomeEstufa = nomeEstufa;
  protected readonly hora = hora;
  protected readonly fmt = fmt;

  protected readonly cartoes: { chave: Chave; titulo: string; descricao: string }[] = [
    { chave: 'tempo', titulo: 'Tempo acima da temperatura ideal', descricao: 'Soma do tempo em que cada estufa ficou acima do limite escolhido.' },
    { chave: 'umidade', titulo: 'Média de umidade por estufa', descricao: 'Média das leituras de umidade do ar no período.' },
    { chave: 'luz', titulo: 'Pico de luminosidade', descricao: 'Maior leitura de luz de cada estufa e o horário em que ocorreu.' },
  ];

  protected readonly limite = signal(TEMPERATURA_IDEAL);
  protected readonly estado = signal<Record<Chave, EstadoConsulta>>({
    tempo: { janela: 3600, carregando: false },
    umidade: { janela: 3600, carregando: false },
    luz: { janela: 86400, carregando: false },
  });

  // histórico
  protected readonly hEstufa = signal('estufa-1');
  protected readonly hGrandeza = signal('temperatura');
  protected readonly hDe = signal(paraInput(Date.now() - 15 * 60_000));
  protected readonly hAte = signal(paraInput(Date.now() + 60_000));
  protected readonly historico = signal<Ponto[]>([]);
  protected readonly historicoInvertido = computed(() => [...this.historico()].reverse());
  protected readonly hErro = signal<string | null>(null);
  protected readonly buscou = signal(false);

  ngOnInit(): void {
    (['tempo', 'umidade', 'luz'] as Chave[]).forEach((c) => this.executar(c));
  }

  protected mudarJanela(c: Chave, s: number): void {
    this.estado.update((e) => ({ ...e, [c]: { ...e[c], janela: s } }));
    this.executar(c);
  }

  protected executar(c: Chave): void {
    const janela = this.estado()[c].janela;
    this.estado.update((e) => ({ ...e, [c]: { ...e[c], carregando: true } }));
    let req: Observable<Consulta>;
    if (c === 'tempo') req = this.api.tempoAcimaIdeal(janela, Number(this.limite()) || TEMPERATURA_IDEAL);
    else if (c === 'umidade') req = this.api.mediaUmidade(janela);
    else req = this.api.picoLuminosidade(janela);
    req.subscribe({
      next: (resposta) =>
        this.estado.update((e) => ({ ...e, [c]: { janela, resposta, carregando: false } })),
      error: (err) =>
        this.estado.update((e) => ({ ...e, [c]: { janela, erro: mensagemDeErro(err), carregando: false } })),
    });
  }

  protected cor(estufa: string): string {
    return corEstufa(estufa, this.dados.estufas());
  }

  protected valor(c: Chave, r: Resultado): string {
    if (c === 'tempo') return duracao(r.valor);
    if (c === 'umidade') return `${fmt(r.valor, 1)}%`;
    return `${fmt(r.valor, 0)} lux`;
  }

  protected largura(c: Chave, r: Resultado, resp: Consulta): number {
    if (c === 'tempo') return Math.min(100, (r.valor / resp.janelaS) * 100);
    if (c === 'umidade') return Math.min(100, r.valor);
    const maior = Math.max(...resp.resultados.map((x) => x.valor), 1);
    return (r.valor / maior) * 100;
  }

  protected detalhe(c: Chave, r: Resultado, resp: Consulta): string {
    if (c === 'tempo') {
      const pct = Math.round((r.valor / resp.janelaS) * 100);
      return `${pct}% da janela · ${r.amostras} leituras`;
    }
    if (c === 'umidade') return `média de ${r.amostras} leituras`;
    return `às ${hora(r.timestampMs)} · ${r.amostras} leituras`;
  }

  protected buscarHistorico(): void {
    const de = new Date(this.hDe()).getTime();
    const ate = new Date(this.hAte()).getTime();
    if (!de || !ate || de >= ate) {
      this.hErro.set('Informe um intervalo válido.');
      return;
    }
    this.api.historico(this.hGrandeza(), this.hEstufa(), de, ate, 500).subscribe({
      next: (pontos) => {
        this.historico.set(pontos);
        this.hErro.set(null);
        this.buscou.set(true);
      },
      error: (e) => this.hErro.set(mensagemDeErro(e)),
    });
  }

  protected exportarHistorico(): void {
    const linhas = ['data_hora;fonte;grandeza;valor;alerta'];
    for (const p of this.historico()) {
      linhas.push(
        [new Date(p.timestampMs).toLocaleString('pt-BR'), p.fonteId, this.hGrandeza(),
         String(p.valor).replace('.', ','), p.alerta ? 'sim' : ''].join(';'),
      );
    }
    baixarArquivo(`historico-${this.hEstufa()}-${this.hGrandeza()}.csv`, linhas.join('\n'));
  }
}

/** Data no formato do input datetime-local (hora local). */
function paraInput(ms: number): string {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}
