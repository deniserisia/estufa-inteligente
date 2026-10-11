import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fonte } from '../api';
import { Dados } from '../dados';
import { LIMITE_ALERTA, TEMPERATURA_IDEAL, fmt, hora, medicao, nomeEstufa } from '../formatos';

interface VisaoEstufa {
  id: string;
  nome: string;
  online: number;
  total: number;
  temp?: number;
  umid?: number;
  lux?: number;
  co2?: number;
  exaustor?: Fonte;
  nebulizador?: Fonte;
  tela?: Fonte;
  emAlerta: boolean;
  problemas: string[];
}

@Component({
  selector: 'app-painel',
  imports: [RouterLink],
  template: `
    <div class="pagina">
      <div class="topo">
        <div>
          <h1>Painel</h1>
          <p class="sub">Atualização automática a cada 3 s · última às {{ hora(dados.ultimaAtualizacao()) }}</p>
        </div>
        <div class="grupo">
          <span class="chip" [class.ok]="online() === total()" [class.ruim]="online() !== total()">
            {{ online() }} de {{ total() }} fontes online
          </span>
          @if (emAlerta().length) {
            <span class="chip ruim">{{ emAlerta().length }} estufa(s) acima de {{ limite }} °C</span>
          }
        </div>
      </div>

      @for (e of emAlerta(); track e.id) {
        <div class="faixa-alerta" role="alert">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C2410C" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 3l10 18H2L12 3z"></path><path d="M12 10v5M12 18h.01"></path>
          </svg>
          <div style="flex: 1 1 320px; min-width: 0">
            <strong>{{ e.nome }} acima de {{ limite }} °C</strong>
            <div>Agora {{ fmt(e.temp) }} °C. {{ textoUltimoAlerta(e.id) }}</div>
          </div>
          <a class="botao laranja" routerLink="/fontes">Ajustar atuadores</a>
        </div>
      }

      @if (dados.carregou() && !visoes().length) {
        <div class="cartao vazio">
          Nenhuma fonte descoberta ainda. Suba as fontes com <span class="mono">py scripts/iniciar_fontes.py</span>.
        </div>
      }

      <div class="linha-flex">
        @for (e of visoes(); track e.id) {
          <section class="cartao" [class.alerta]="e.emAlerta" [attr.aria-label]="e.nome">
            <div class="topo" style="align-items: center">
              <div>
                <h2 style="font-size: 20px">{{ e.nome }}</h2>
                <div class="pequeno">{{ e.online }} de {{ e.total }} fontes online</div>
              </div>
              @if (e.emAlerta) {
                <span class="chip ruim">Alerta</span>
              } @else if (e.problemas.length) {
                <span class="chip neutro">Atenção</span>
              } @else {
                <span class="chip ok">Normal</span>
              }
            </div>

            <div class="metricas">
              <div class="metrica" [class.quente]="e.emAlerta">
                <div class="rotulo">Temperatura</div>
                <div class="valor">{{ fmt(e.temp) }}<span> °C</span></div>
                <div class="nota">{{ e.emAlerta ? 'Acima do limite de ' + limite + ' °C' : 'Ideal até ' + ideal + ' °C' }}</div>
              </div>
              <div class="metrica">
                <div class="rotulo">Umidade do ar</div>
                <div class="valor">{{ fmt(e.umid, 0) }}<span> %</span></div>
                <div class="nota">{{ e.nebulizador?.estado?.ligado ? 'Nebulizador ligado' : 'Nebulizador desligado' }}</div>
              </div>
              <div class="metrica">
                <div class="rotulo">Luminosidade</div>
                <div class="valor">{{ fmt(e.lux, 0) }}<span> lux</span></div>
                <div class="nota">Tela {{ fmt(e.tela?.estado?.nivel, 0) }}% aberta</div>
              </div>
              <div class="metrica">
                <div class="rotulo">CO₂</div>
                <div class="valor">{{ fmt(e.co2, 0) }}<span> ppm</span></div>
                <div class="nota">{{ textoVentilacao(e) }}</div>
              </div>
            </div>

            <div class="grupo">
              @for (a of atuadores(e); track a.rotulo) {
                <span class="etiqueta" [class.problema]="a.problema">{{ a.rotulo }} <strong>{{ a.valor }}</strong></span>
              }
            </div>
            @for (p of e.problemas; track p) {
              <div class="pequeno texto-alerta">{{ p }}</div>
            }
            <a routerLink="/graficos" style="font-weight: 500">Ver gráficos da {{ e.nome.toLowerCase() }}</a>
          </section>
        }
      </div>

      <section class="cartao">
        <h2>Alertas recentes</h2>
        @if (dados.alertas().length) {
          <div class="rolagem">
            <table style="min-width: 560px">
              <thead><tr><th>Hora</th><th>Estufa</th><th>Fonte</th><th>Ocorrência</th></tr></thead>
              <tbody>
                @for (a of dados.alertas().slice(0, 8); track $index) {
                  <tr>
                    <td class="mono">{{ hora(a.timestampMs) }}</td>
                    <td>{{ nomeEstufa(a.estufa) }}</td>
                    <td class="mono">{{ a.fonteId }}</td>
                    <td>{{ a.motivo }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="pequeno">Nenhum alerta até agora.</div>
        }
      </section>
    </div>
  `,
  styles: `
    .metricas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .metrica { padding: 16px; border-radius: 10px; background: var(--fundo); }
    .metrica.quente { background: var(--laranja-claro); color: var(--laranja-texto); }
    .rotulo { font-size: 13px; color: var(--texto-2); }
    .quente .rotulo, .quente .nota { color: #6e2a07; }
    .valor { font-family: var(--mono); font-size: 30px; font-weight: 500; line-height: 40px; }
    .valor span { font-size: 16px; color: var(--texto-2); }
    .quente .valor span { color: inherit; }
    .nota { font-size: 12px; color: var(--texto-2); }
    .etiqueta { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--borda); font-size: 13px; }
    .etiqueta strong { font-weight: 600; }
    .etiqueta.problema { border: 1px dashed var(--laranja); color: var(--laranja-texto); }
    @media (max-width: 420px) { .valor { font-size: 24px; } }
  `,
})
export class Painel {
  protected readonly dados = inject(Dados);
  protected readonly fmt = fmt;
  protected readonly hora = hora;
  protected readonly nomeEstufa = nomeEstufa;
  protected readonly limite = LIMITE_ALERTA;
  protected readonly ideal = TEMPERATURA_IDEAL;

  protected readonly online = computed(() => this.dados.fontes().filter((f) => f.online).length);
  protected readonly total = computed(() => this.dados.fontes().length);

  protected readonly visoes = computed<VisaoEstufa[]>(() =>
    this.dados.estufas().map((id) => {
      const fs = this.dados.fontes().filter((f) => f.estufa === id);
      const doTipo = (t: string) => fs.find((f) => f.tipo === t);
      const sensorTemp = doTipo('SENSOR_TEMP_UMIDADE');
      const temp = medicao(sensorTemp, 'temperatura');
      const problemas = fs
        .filter((f) => !f.online || f.estado.emFalha)
        .map((f) => `${f.id}: ${f.estado.emFalha ? 'em falha simulada' : 'offline'}`);
      return {
        id,
        nome: nomeEstufa(id),
        online: fs.filter((f) => f.online).length,
        total: fs.length,
        temp,
        umid: medicao(sensorTemp, 'umidade'),
        lux: medicao(doTipo('SENSOR_LUMINOSIDADE'), 'luminosidade'),
        co2: medicao(doTipo('SENSOR_CO2'), 'co2'),
        exaustor: doTipo('EXAUSTOR'),
        nebulizador: doTipo('NEBULIZADOR'),
        tela: doTipo('TELA_SOMBREAMENTO'),
        emAlerta: temp !== undefined && temp > LIMITE_ALERTA,
        problemas,
      };
    }),
  );

  protected readonly emAlerta = computed(() => this.visoes().filter((v) => v.emAlerta));

  protected atuadores(e: VisaoEstufa): { rotulo: string; valor: string; problema: boolean }[] {
    const lista: { rotulo: string; valor: string; problema: boolean }[] = [];
    const indisponivel = (f: Fonte) => !f.online || f.estado.emFalha;
    if (e.exaustor) {
      const f = e.exaustor;
      lista.push({
        rotulo: 'Exaustor',
        valor: indisponivel(f) ? 'offline' : f.estado.ligado ? `${fmt(f.estado.nivel, 0)}%` : 'desligado',
        problema: indisponivel(f),
      });
    }
    if (e.nebulizador) {
      const f = e.nebulizador;
      lista.push({
        rotulo: 'Nebulizador',
        valor: indisponivel(f) ? 'offline' : f.estado.ligado ? 'ligado' : 'desligado',
        problema: indisponivel(f),
      });
    }
    if (e.tela) {
      const f = e.tela;
      lista.push({
        rotulo: 'Tela',
        valor: indisponivel(f) ? 'offline' : `${fmt(f.estado.nivel, 0)}% aberta`,
        problema: indisponivel(f),
      });
    }
    return lista;
  }

  protected textoVentilacao(e: VisaoEstufa): string {
    const ex = e.exaustor;
    if (!ex || !ex.online || ex.estado.emFalha || !ex.estado.ligado) return 'Sem ventilação';
    return `Ventilação a ${fmt(ex.estado.nivel, 0)}%`;
  }

  protected textoUltimoAlerta(estufa: string): string {
    const a = this.dados.alertas().find((x) => x.estufa === estufa && x.tipo === 'SENSOR_TEMP_UMIDADE');
    return a ? `O sensor ${a.fonteId} enviou o alerta na hora às ${hora(a.timestampMs)}.` : '';
  }
}
