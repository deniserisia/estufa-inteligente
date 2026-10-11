import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, Fonte, TipoComando, mensagemDeErro } from '../api';
import { Dados } from '../dados';
import { NOMES_TIPO, fmt, haQuanto, hora, nomeEstufa, resumoFonte } from '../formatos';

@Component({
  selector: 'app-fontes',
  imports: [FormsModule],
  template: `
    <div class="pagina">
      <div class="topo">
        <div>
          <h1>Fontes e controles</h1>
          <p class="sub">
            {{ dados.fontes().length }} fontes descobertas por multicast · comandos vão ao Gateway, que repassa por gRPC
          </p>
        </div>
      </div>

      <div class="linha-flex" style="align-items: flex-start">
        <section class="cartao" style="flex: 999 1 640px; padding: 20px 24px">
          <h2>Fontes conectadas</h2>
          @if (!dados.fontes().length) {
            <div class="vazio">Nenhuma fonte descoberta ainda.</div>
          } @else {
            <div class="rolagem">
              <table style="min-width: 720px">
                <thead>
                  <tr><th>Fonte</th><th>Estufa</th><th>Endereço</th><th>Status</th><th>Estado ou leitura</th><th>Ação</th></tr>
                </thead>
                <tbody>
                  @for (f of dados.fontes(); track f.id) {
                    <tr [class.ativa]="f.id === selId()">
                      <td class="nowrap">
                        <div class="mono" style="font-weight: 500">{{ f.id }}</div>
                        <div class="pequeno">{{ nomeTipo(f.tipo) }}</div>
                      </td>
                      <td class="nowrap">{{ nomeEstufa(f.estufa) }}</td>
                      <td class="mono nowrap" style="font-size: 13px">{{ f.controlavel ? f.ip + ':' + f.portaGrpc : f.ip }}</td>
                      <td>
                        @if (f.online && !f.estado.emFalha) {
                          <span class="chip ok">online</span>
                        } @else if (f.estado.emFalha && f.online) {
                          <span class="chip ruim">em falha</span>
                        } @else {
                          <span class="chip ruim">offline</span>
                        }
                        <div class="pequeno" style="margin-top: 4px">{{ haQuanto(f.ultimoContatoMs) }}</div>
                      </td>
                      <td [class.texto-alerta]="!f.online || f.estado.emFalha">{{ resumo(f) }}</td>
                      <td>
                        @if (f.controlavel) {
                          <button type="button" class="pequeno-btn" (click)="selecionar(f.id)">Controlar</button>
                        } @else {
                          <span class="pequeno">Só UDP</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        @if (sel(); as f) {
          <section class="cartao" style="flex: 1 1 320px" aria-labelledby="titulo-controle">
            <div>
              <div class="pequeno" style="text-transform: uppercase; letter-spacing: 0.06em">Controle gRPC</div>
              <h2 id="titulo-controle" class="mono" style="font-size: 20px; font-weight: 500; margin-top: 4px">{{ f.id }}</h2>
              <div class="pequeno">{{ nomeTipo(f.tipo) }} · {{ nomeEstufa(f.estufa) }} · {{ f.ip }}:{{ f.portaGrpc }}</div>
            </div>

            @if (f.estado.emFalha) {
              <div class="erro-msg">Fonte em falha simulada: não envia dados nem atua. Encerre a falha para voltar a comandar.</div>
            } @else if (!f.online) {
              <div class="erro-msg">Fonte offline: o Gateway não recebe leituras dela. O comando pode falhar.</div>
            }

            @if (f.tipo !== 'TELA_SOMBREAMENTO') {
              <div class="campo">
                <span style="font-size: 13px; font-weight: 500">Energia</span>
                <div class="duas">
                  <button type="button" [class.selecionado]="f.estado.ligado" [disabled]="ocupado() || f.estado.emFalha"
                          (click)="enviar('LIGAR')">Ligar</button>
                  <button type="button" [class.selecionado]="!f.estado.ligado" [disabled]="ocupado() || f.estado.emFalha"
                          (click)="enviar('DESLIGAR')">Desligar</button>
                </div>
              </div>
            }

            @if (f.tipo === 'EXAUSTOR' || f.tipo === 'TELA_SOMBREAMENTO') {
              <div class="campo">
                <div class="topo" style="align-items: baseline">
                  <label for="nivel">{{ f.tipo === 'EXAUSTOR' ? 'Velocidade' : 'Abertura da tela' }}</label>
                  <span class="mono" style="font-size: 18px; font-weight: 500">{{ nivel() }}%</span>
                </div>
                <input id="nivel" type="range" min="0" max="100" step="5" [ngModel]="nivel()"
                       (ngModelChange)="nivel.set($event)" (change)="enviar('AJUSTAR_NIVEL', nivel())"
                       [disabled]="ocupado() || f.estado.emFalha">
                <div class="pequeno" style="display: flex; justify-content: space-between"><span>0%</span><span>100%</span></div>
              </div>
            }

            <div class="campo">
              <label for="intervalo">Intervalo de envio (s)</label>
              <div class="grupo" style="flex-wrap: nowrap">
                <input id="intervalo" type="number" min="1" max="3600" class="mono" style="flex: 1; min-width: 0"
                       [ngModel]="intervalo()" (ngModelChange)="intervalo.set($event)">
                <button type="button" [disabled]="ocupado() || f.estado.emFalha"
                        (click)="enviar('AJUSTAR_INTERVALO', intervalo())">Aplicar</button>
              </div>
            </div>

            <button type="button" class="perigo" [disabled]="ocupado()"
                    (click)="enviar(f.estado.emFalha ? 'ENCERRAR_FALHA' : 'SIMULAR_FALHA')">
              {{ f.estado.emFalha ? 'Encerrar falha simulada' : 'Simular falha' }}
            </button>

            <div class="caixa-mono" [class.texto-alerta]="mensagemErro()" aria-live="polite">
              <div style="font-family: 'IBM Plex Sans', sans-serif; font-weight: 500; font-size: 13px">Último comando</div>
              {{ mensagem() }}
            </div>
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .nowrap { white-space: nowrap; }
    .duas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  `,
})
export class Fontes {
  protected readonly dados = inject(Dados);
  private readonly api = inject(Api);

  protected readonly fmt = fmt;
  protected readonly haQuanto = haQuanto;
  protected readonly nomeEstufa = nomeEstufa;
  protected readonly resumo = resumoFonte;

  protected readonly selId = signal<string | null>(null);
  protected readonly nivel = signal(0);
  protected readonly intervalo = signal(10);
  protected readonly ocupado = signal(false);
  protected readonly mensagem = signal('Nenhum comando enviado nesta sessão.');
  protected readonly mensagemErro = signal(false);

  /** Fonte selecionada; por padrão a primeira controlável. */
  protected readonly sel = computed<Fonte | undefined>(() => {
    const controlaveis = this.dados.fontes().filter((f) => f.controlavel);
    return controlaveis.find((f) => f.id === this.selId()) ?? controlaveis[0];
  });

  constructor() {
    // ao trocar de fonte, os campos assumem o estado atual dela
    let ultimaId: string | undefined;
    effect(() => {
      const f = this.sel();
      if (f && f.id !== ultimaId) {
        ultimaId = f.id;
        this.nivel.set(Math.round(f.estado.nivel));
        this.intervalo.set(Math.round(f.estado.intervaloEnvioS));
      }
    });
  }

  protected nomeTipo(t: string): string {
    return NOMES_TIPO[t] ?? t;
  }

  protected selecionar(id: string): void {
    this.selId.set(id);
  }

  protected enviar(tipo: TipoComando, valor = 0): void {
    const f = this.sel();
    if (!f) return;
    this.ocupado.set(true);
    const descricao = tipo + (tipo === 'AJUSTAR_NIVEL' || tipo === 'AJUSTAR_INTERVALO' ? ' ' + valor : '');
    this.api.comando(f.id, tipo, Number(valor)).subscribe({
      next: (r) => {
        this.mensagem.set(`${descricao} → ${f.id} · OK às ${hora(Date.now())}`);
        this.mensagemErro.set(false);
        this.nivel.set(Math.round(r.estado.nivel));
        this.intervalo.set(Math.round(r.estado.intervaloEnvioS));
        this.ocupado.set(false);
        this.dados.atualizar();
      },
      error: (e) => {
        this.mensagem.set(`${descricao} → ${f.id} · recusado: ${mensagemDeErro(e)}`);
        this.mensagemErro.set(true);
        this.ocupado.set(false);
        this.dados.atualizar();
      },
    });
  }
}
