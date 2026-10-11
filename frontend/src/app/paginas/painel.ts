import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Fonte } from '../api';
import { Dados } from '../dados';
import { LIMITE_ALERTA, TEMPERATURA_IDEAL, cultura, fmt, hora, medicao, nomeEstufa } from '../formatos';
import { Icone, NomeIcone } from '../icone';

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

interface Atuador {
  rotulo: string;
  valor: string;
  icone: NomeIcone;
  ativo: boolean;
  problema: boolean;
}

@Component({
  selector: 'app-painel',
  imports: [RouterLink, Icone],
  template: `
    <div class="pagina">
      <!-- topo ilustrado -->
      <section class="hero" aria-labelledby="titulo-painel">
        <div class="hero-texto">
          <div class="saudacao">{{ saudacao() }} · {{ hoje }}</div>
          <h1 id="titulo-painel">Sua fazenda agora</h1>
          <p class="sub">Atualiza a cada 3 s · última leitura às {{ hora(dados.ultimaAtualizacao()) }}</p>
          <div class="resumo">
            <div class="resumo-item">
              <span class="resumo-icone verde"><app-icone nome="broto" [tamanho]="18" /></span>
              <div><strong>{{ online() }}/{{ total() }}</strong><span>fontes online</span></div>
            </div>
            <div class="resumo-item">
              <span class="resumo-icone" [class.laranja]="emAlerta().length" [class.verde]="!emAlerta().length">
                <app-icone nome="alerta" [tamanho]="18" />
              </span>
              <div><strong>{{ emAlerta().length }}</strong><span>{{ emAlerta().length === 1 ? 'estufa em alerta' : 'estufas em alerta' }}</span></div>
            </div>
            <div class="resumo-item">
              <span class="resumo-icone trigo"><app-icone nome="termometro" [tamanho]="18" /></span>
              <div><strong>{{ fmt(tempMedia()) }} °C</strong><span>média das estufas</span></div>
            </div>
          </div>
        </div>

        <svg class="hero-arte" viewBox="0 0 640 230" preserveAspectRatio="xMaxYMax meet" aria-hidden="true">
          <defs>
            <linearGradient id="hero-fade-g" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stop-color="#fff" stop-opacity="0"></stop>
              <stop offset="0.22" stop-color="#fff" stop-opacity="1"></stop>
            </linearGradient>
            <mask id="hero-fade"><rect width="640" height="230" fill="url(#hero-fade-g)"></rect></mask>
          </defs>
          <g mask="url(#hero-fade)">
          <circle cx="560" cy="58" r="30" fill="#F2CC62"></circle>
          <circle cx="560" cy="58" r="44" fill="#F2CC62" opacity="0.18"></circle>
          <path d="M60 92 q14 -10 28 0 q12 -8 24 2" fill="none" stroke="#9BB8A4" stroke-width="2" stroke-linecap="round"></path>
          <path d="M150 60 q10 -8 20 0 q9 -6 18 1" fill="none" stroke="#9BB8A4" stroke-width="2" stroke-linecap="round"></path>
          <!-- colinas -->
          <path d="M0 176 C110 130 210 150 320 132 C430 114 520 138 640 120 L640 230 L0 230Z" fill="#CFE3C4"></path>
          <circle cx="132" cy="150" r="13" fill="#8DBA7E"></circle>
          <circle cx="150" cy="146" r="10" fill="#7FAE70"></circle>
          <rect x="130" y="156" width="3" height="10" fill="#7A5A3A"></rect>
          <path d="M0 200 C150 168 270 186 400 176 C510 168 570 180 640 172 L640 230 L0 230Z" fill="#A9CF96"></path>
          <!-- estufas em túnel -->
          <g>
            <path d="M210 188 V150 A70 46 0 0 1 350 150 V188 Z" fill="#F4FAF2" fill-opacity="0.9" stroke="#6E9E7E" stroke-width="2"></path>
            <path d="M233 188 V152 A47 34 0 0 1 327 152 V188" fill="none" stroke="#6E9E7E" stroke-width="1.2" opacity="0.6"></path>
            <path d="M280 104 V188" stroke="#6E9E7E" stroke-width="1.2" opacity="0.6"></path>
            <g fill="#4E9A5B">
              <circle cx="228" cy="182" r="5"></circle><circle cx="246" cy="180" r="6"></circle><circle cx="264" cy="182" r="5"></circle>
              <circle cx="296" cy="181" r="6"></circle><circle cx="314" cy="182" r="5"></circle><circle cx="332" cy="180" r="6"></circle>
            </g>
            <g fill="#D9534F"><circle cx="246" cy="178" r="1.8"></circle><circle cx="314" cy="179" r="1.8"></circle><circle cx="296" cy="183" r="1.6"></circle></g>
          </g>
          <g>
            <path d="M362 190 V160 A54 36 0 0 1 470 160 V190 Z" fill="#F4FAF2" fill-opacity="0.9" stroke="#6E9E7E" stroke-width="2"></path>
            <path d="M416 124 V190" stroke="#6E9E7E" stroke-width="1.2" opacity="0.6"></path>
            <g fill="#5DA866">
              <circle cx="378" cy="185" r="5"></circle><circle cx="396" cy="184" r="5"></circle>
              <circle cx="436" cy="185" r="5"></circle><circle cx="454" cy="184" r="5"></circle>
            </g>
            <g fill="#3F7D3A"><circle cx="396" cy="182" r="1.6"></circle><circle cx="436" cy="183" r="1.6"></circle></g>
          </g>
          <!-- celeiro -->
          <g>
            <path d="M500 192 V150 L540 124 L580 150 V192 Z" fill="#B5523B"></path>
            <path d="M494 152 L540 120 L586 152" fill="none" stroke="#7A3424" stroke-width="6" stroke-linejoin="round"></path>
            <rect x="527" y="164" width="26" height="28" fill="#F4E9D8"></rect>
            <path d="M527 164 L553 192 M553 164 L527 192" stroke="#B5523B" stroke-width="2.5"></path>
            <rect x="532" y="140" width="16" height="12" fill="#F4E9D8"></rect>
          </g>
          <!-- cerca -->
          <g stroke="#9A6B3C" stroke-width="2.5" stroke-linecap="round">
            <path d="M592 196 v-16 M608 194 v-16 M624 192 v-16"></path>
            <path d="M586 184 L636 178 M586 192 L636 186"></path>
          </g>
          <!-- canteiros em primeiro plano -->
          <path d="M0 214 C160 196 330 210 640 198 L640 230 L0 230Z" fill="#7FB46C"></path>
          <g fill="none" stroke="#5E9550" stroke-width="2" stroke-linecap="round" opacity="0.8">
            <path d="M20 222 C200 206 380 218 620 208"></path>
          </g>
          <g fill="none" stroke="#2F6B3B" stroke-width="2" stroke-linecap="round">
            <path d="M60 216v-10M60 209c0-5 3-7 7-8 0 5-3 7-7 8zM60 211c0-4-3-6-7-6 0 4 3 6 7 6z"></path>
            <path d="M120 212v-12M120 204c0-6 4-9 9-10 0 6-4 9-9 10zM120 207c0-4-3-7-8-7 0 4 3 7 8 7z"></path>
            <path d="M180 210v-9M180 205c0-4 3-6 6-7 0 4-3 6-6 7z"></path>
          </g>
          </g>
        </svg>
      </section>

      @for (e of emAlerta(); track e.id) {
        <div class="faixa-alerta" role="alert">
          <app-icone nome="alerta" [tamanho]="24" cor="#C2410C" />
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
          <section class="cartao estufa" [class.alerta]="e.emAlerta" [attr.aria-label]="e.nome">
            <div class="estufa-topo">
              <span class="cultura" [style.background]="cultura(e.id).fundo">
                <app-icone [nome]="cultura(e.id).icone" [tamanho]="26" [cor]="cultura(e.id).cor" />
              </span>
              <div style="flex: 1; min-width: 0">
                <h2 class="titulo-serif" style="font-size: 22px">{{ e.nome }}</h2>
                <div class="pequeno">{{ cultura(e.id).nome }} · {{ e.online }} de {{ e.total }} fontes online</div>
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
                <div class="metrica-topo">
                  <span class="rotulo">Temperatura</span>
                  <span class="metrica-icone temp"><app-icone nome="termometro" [tamanho]="18" /></span>
                </div>
                <div class="valor">{{ fmt(e.temp) }}<span> °C</span></div>
                <div class="barra-faixa" aria-hidden="true">
                  <div class="barra-cheia temp" [style.width.%]="pct(e.temp, 15, 45)"></div>
                  <div class="marca-limite" [style.left.%]="pct(limite, 15, 45)"></div>
                </div>
                <div class="nota">{{ e.emAlerta ? 'Acima do limite de ' + limite + ' °C' : 'Ideal até ' + ideal + ' °C' }}</div>
              </div>
              <div class="metrica">
                <div class="metrica-topo">
                  <span class="rotulo">Umidade do ar</span>
                  <span class="metrica-icone agua"><app-icone nome="gota" [tamanho]="18" /></span>
                </div>
                <div class="valor">{{ fmt(e.umid, 0) }}<span> %</span></div>
                <div class="barra-faixa" aria-hidden="true"><div class="barra-cheia agua" [style.width.%]="pct(e.umid, 0, 100)"></div></div>
                <div class="nota">{{ e.nebulizador?.estado?.ligado ? 'Nebulizador ligado' : 'Nebulizador desligado' }}</div>
              </div>
              <div class="metrica">
                <div class="metrica-topo">
                  <span class="rotulo">Luminosidade</span>
                  <span class="metrica-icone sol"><app-icone nome="sol" [tamanho]="18" /></span>
                </div>
                <div class="valor">{{ fmt(e.lux, 0) }}<span> lux</span></div>
                <div class="barra-faixa" aria-hidden="true"><div class="barra-cheia sol" [style.width.%]="pct(e.lux, 0, 80000)"></div></div>
                <div class="nota">Tela {{ fmt(e.tela?.estado?.nivel, 0) }}% aberta</div>
              </div>
              <div class="metrica">
                <div class="metrica-topo">
                  <span class="rotulo">CO₂</span>
                  <span class="metrica-icone ar"><app-icone nome="co2" [tamanho]="18" /></span>
                </div>
                <div class="valor">{{ fmt(e.co2, 0) }}<span> ppm</span></div>
                <div class="barra-faixa" aria-hidden="true"><div class="barra-cheia ar" [style.width.%]="pct(e.co2, 300, 1500)"></div></div>
                <div class="nota">{{ textoVentilacao(e) }}</div>
              </div>
            </div>

            <div class="atuadores">
              @for (a of atuadores(e); track a.rotulo) {
                <span class="etiqueta" [class.problema]="a.problema" [class.ativo]="a.ativo">
                  <app-icone [nome]="a.icone" [tamanho]="16" />
                  {{ a.rotulo }} <strong>{{ a.valor }}</strong>
                </span>
              }
            </div>
            @for (p of e.problemas; track p) {
              <div class="pequeno texto-alerta">{{ p }}</div>
            }
            <a routerLink="/graficos" class="link-graficos">
              <app-icone nome="graficos" [tamanho]="16" /> Ver gráficos da {{ e.nome.toLowerCase() }}
            </a>
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
    /* topo ilustrado */
    .hero {
      position: relative; overflow: hidden; border-radius: 20px; min-height: 230px;
      border: 1px solid #d5e3cf;
      background: linear-gradient(180deg, #e9f3f6 0%, #eef6e8 55%, #f5f1e2 100%);
      display: flex; align-items: stretch;
    }
    .hero-texto { position: relative; z-index: 1; padding: 28px 32px; display: flex; flex-direction: column; gap: 4px; max-width: 600px; }
    .saudacao { font-size: 13px; font-weight: 500; color: var(--verde-texto); }
    .hero h1 { font-size: 36px; line-height: 44px; }
    .resumo { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
    .resumo-item {
      display: flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 12px;
      background: rgba(255, 255, 255, 0.88); border: 1px solid rgba(31, 107, 74, 0.12);
    }
    .resumo-item strong { display: block; font-family: var(--mono); font-size: 16px; font-weight: 500; line-height: 20px; }
    .resumo-item span:not(.resumo-icone) { font-size: 12px; color: var(--texto-2); }
    .resumo-icone { width: 30px; height: 30px; border-radius: 10px; display: inline-flex; align-items: center; justify-content: center; }
    .resumo-icone.verde { background: var(--verde-claro); color: var(--verde); }
    .resumo-icone.laranja { background: var(--laranja-claro); color: var(--laranja); }
    .resumo-icone.trigo { background: #f8ecc8; color: #9a6b0c; }
    .hero-arte { position: absolute; right: 0; bottom: 0; height: 100%; width: 62%; }

    /* cartões das estufas */
    .estufa-topo { display: flex; align-items: center; gap: 14px; }
    .cultura { width: 52px; height: 52px; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; flex: none; }
    .metricas { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .metrica { padding: 14px 16px 16px; border-radius: 12px; background: #f6f8f3; border: 1px solid #e8eee5; }
    .metrica.quente { background: var(--laranja-claro); border-color: var(--laranja-borda); color: var(--laranja-texto); }
    .metrica-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .rotulo { font-size: 13px; color: var(--texto-2); }
    .metrica-icone { width: 32px; height: 32px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; }
    .metrica-icone.temp { background: #fde3d3; color: #c2410c; }
    .metrica-icone.agua { background: #dcebf7; color: #2f6ba8; }
    .metrica-icone.sol { background: #f8ecc8; color: #9a6b0c; }
    .metrica-icone.ar { background: #e3eee7; color: #1f6b4a; }
    .quente .rotulo, .quente .nota { color: #6e2a07; }
    .valor { font-family: var(--mono); font-size: 30px; font-weight: 500; line-height: 40px; margin-top: 4px; }
    .valor span { font-size: 16px; color: var(--texto-2); }
    .quente .valor span { color: inherit; }
    .nota { font-size: 12px; color: var(--texto-2); }
    .barra-faixa { position: relative; height: 6px; border-radius: 3px; background: rgba(21, 36, 27, 0.08); margin: 6px 0 8px; }
    .barra-cheia { height: 6px; border-radius: 3px; transition: width 0.6s ease; }
    .barra-cheia.temp { background: #e07a3f; }
    .barra-cheia.agua { background: #4a86c8; }
    .barra-cheia.sol { background: #e2b84f; }
    .barra-cheia.ar { background: #4e9a5b; }
    .marca-limite { position: absolute; top: -3px; width: 2px; height: 12px; background: #8a3306; border-radius: 1px; }
    .atuadores { display: flex; flex-wrap: wrap; gap: 8px; }
    .etiqueta {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px;
      border: 1px solid var(--borda); background: #fff; font-size: 13px; color: var(--texto-3);
    }
    .etiqueta strong { font-weight: 600; color: var(--texto); }
    .etiqueta.ativo { border-color: #b9d8c4; background: #f0f7f2; color: var(--verde); }
    .etiqueta.problema { border: 1px dashed var(--laranja); background: #fff8f3; color: var(--laranja-texto); }
    .etiqueta.problema strong { color: var(--laranja-texto); }
    .link-graficos { display: inline-flex; align-items: center; gap: 6px; font-weight: 500; align-self: flex-start; }

    @media (max-width: 900px) {
      .hero { flex-direction: column; }
      .hero-arte { position: static; width: 100%; height: auto; margin-top: -12px; }
    }
    @media (max-width: 420px) { .valor { font-size: 24px; } .hero h1 { font-size: 28px; line-height: 34px; } }
  `,
})
export class Painel {
  protected readonly dados = inject(Dados);
  protected readonly fmt = fmt;
  protected readonly hora = hora;
  protected readonly nomeEstufa = nomeEstufa;
  protected readonly cultura = cultura;
  protected readonly limite = LIMITE_ALERTA;
  protected readonly ideal = TEMPERATURA_IDEAL;
  protected readonly hoje = (() => {
    const t = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  })();

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

  protected readonly tempMedia = computed(() => {
    const temps = this.visoes().map((v) => v.temp).filter((t): t is number => t !== undefined);
    return temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : undefined;
  });

  protected saudacao(): string {
    const h = new Date().getHours();
    return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  }

  /** Posição de um valor entre min e max, em %, para as barrinhas. */
  protected pct(v: number | undefined, min: number, max: number): number {
    if (v === undefined) return 0;
    return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
  }

  protected atuadores(e: VisaoEstufa): Atuador[] {
    const lista: Atuador[] = [];
    const indisponivel = (f: Fonte) => !f.online || f.estado.emFalha;
    if (e.exaustor) {
      const f = e.exaustor;
      lista.push({
        rotulo: 'Exaustor',
        icone: 'ventilador',
        valor: indisponivel(f) ? 'offline' : f.estado.ligado ? `${fmt(f.estado.nivel, 0)}%` : 'desligado',
        ativo: !indisponivel(f) && f.estado.ligado,
        problema: indisponivel(f),
      });
    }
    if (e.nebulizador) {
      const f = e.nebulizador;
      lista.push({
        rotulo: 'Nebulizador',
        icone: 'nevoa',
        valor: indisponivel(f) ? 'offline' : f.estado.ligado ? 'ligado' : 'desligado',
        ativo: !indisponivel(f) && f.estado.ligado,
        problema: indisponivel(f),
      });
    }
    if (e.tela) {
      const f = e.tela;
      lista.push({
        rotulo: 'Tela',
        icone: 'sombra',
        valor: indisponivel(f) ? 'offline' : `${fmt(f.estado.nivel, 0)}% aberta`,
        ativo: false,
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
