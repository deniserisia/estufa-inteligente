import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Dados } from './dados';
import { Icone } from './icone';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icone],
  template: `
    <div class="casca">
      <nav aria-label="Navegação principal">
        <div class="marca">
          <span class="logo"><app-icone nome="estufa" [tamanho]="26" cor="#15241B" /></span>
          <div>
            <div class="marca-nome titulo-serif">Estufa Inteligente</div>
            <div class="marca-sub">Central da fazenda</div>
          </div>
        </div>

        <div class="links">
          <a routerLink="/painel" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <app-icone nome="painel" [tamanho]="18" /> Painel
          </a>
          <a routerLink="/fontes" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <app-icone nome="controles" [tamanho]="18" /> Fontes e controles
          </a>
          <a routerLink="/graficos" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <app-icone nome="graficos" [tamanho]="18" /> Gráficos
          </a>
          <a routerLink="/consultas" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <app-icone nome="consultas" [tamanho]="18" /> Consultas
          </a>
        </div>

        <!-- pequena paisagem: canteiros e brotos -->
        <svg class="paisagem" viewBox="0 0 200 92" aria-hidden="true">
          <path d="M0 70 C40 52 80 60 110 54 C140 48 170 56 200 50 L200 92 L0 92Z" fill="#24402F"></path>
          <path d="M0 80 C50 70 110 76 200 68 L200 92 L0 92Z" fill="#2D4E39"></path>
          <g fill="none" stroke="#8FD3A8" stroke-width="1.6" stroke-linecap="round">
            <path d="M30 74v-12M30 66c0-6 4-9 9-10 0 6-4 9-9 10zM30 69c0-4-3-7-8-7 0 4 3 7 8 7z"></path>
            <path d="M70 70v-16M70 60c0-7 5-11 11-12 0 7-5 11-11 12zM70 64c0-5-4-8-9-9 0 6 4 9 9 9z"></path>
            <path d="M112 66v-10M112 60c0-5 3-7 7-8 0 5-3 7-7 8z"></path>
            <path d="M150 64v-18M150 52c0-8 5-12 12-13 0 8-5 12-12 13zM150 57c0-6-4-9-10-10 0 6 4 10 10 10z"></path>
            <path d="M184 60v-9M184 55c0-4 3-6 6-7 0 4-3 6-6 7z"></path>
          </g>
          <circle cx="168" cy="18" r="9" fill="#E2B84F" opacity="0.85"></circle>
        </svg>

        <div class="conexao">
          <div class="conexao-titulo">
            <span class="ponto" [class.desligado]="!conectado()"></span>
            {{ conectado() ? 'Gateway conectado' : 'Sem conexão' }}
          </div>
          <div class="mono">{{ resumoConexao() }}</div>
        </div>
      </nav>

      <main>
        <!-- folhagem decorativa ao fundo -->
        <svg class="folhagem" viewBox="0 0 400 420" aria-hidden="true">
          <g fill="#1F6B4A">
            <path d="M400 420 C330 330 260 300 170 300 C210 360 300 410 400 420Z" opacity="0.07"></path>
            <path d="M400 420 C380 300 330 220 250 170 C250 260 310 360 400 420Z" opacity="0.06"></path>
            <path d="M400 420 C410 300 400 190 360 110 C320 200 340 330 400 420Z" opacity="0.08"></path>
            <path d="M400 420 C300 400 200 410 120 440 C220 470 330 460 400 420Z" opacity="0.05"></path>
          </g>
          <g fill="none" stroke="#1F6B4A" stroke-opacity="0.12" stroke-width="2" stroke-linecap="round">
            <path d="M400 420 C320 360 250 320 190 305"></path>
            <path d="M400 420 C350 330 310 250 262 190"></path>
            <path d="M400 420 C385 320 380 220 362 130"></path>
          </g>
        </svg>

        <div class="conteudo">
          @if (dados.erro(); as erro) {
            <div class="erro-msg" role="alert">{{ erro }}</div>
          }
          <router-outlet />
        </div>
      </main>
    </div>
  `,
  styles: `
    .casca { min-height: 100vh; display: flex; flex-wrap: wrap; }
    nav {
      position: relative; flex: 1 1 240px; max-width: 100%; padding: 28px 20px; color: #e8efea;
      display: flex; flex-direction: column; gap: 28px; overflow: hidden;
      background-color: var(--nav);
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%238fd3a8' stroke-opacity='0.07' stroke-width='1.3' stroke-linecap='round'%3E%3Cpath d='M14 44c6-16 22-23 38-20-4 16-20 26-38 20z'/%3E%3Cpath d='M14 44l29-15'/%3E%3Cpath d='M74 104c3-13 15-20 28-18-3 13-15 21-28 18z'/%3E%3Cpath d='M74 104l24-12'/%3E%3C/g%3E%3C/svg%3E");
    }
    main { position: relative; flex: 999 1 560px; min-width: 0; }
    .conteudo { position: relative; z-index: 1; padding: 32px 40px 48px; display: flex; flex-direction: column; gap: 16px; }
    .folhagem { position: fixed; right: 0; bottom: 0; width: min(46vw, 520px); height: auto; z-index: 0; pointer-events: none; }
    .marca { display: flex; align-items: center; gap: 12px; }
    .logo {
      width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center;
      background: #8fd3a8; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, 0.12);
    }
    .marca-nome { font-weight: 600; font-size: 18px; line-height: 22px; }
    .marca-sub { font-size: 12px; color: #a9bdb0; }
    .links { display: flex; flex-direction: column; gap: 4px; }
    .links a {
      display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 10px 12px; border-radius: 10px;
      color: var(--nav-texto); text-decoration: none; font-size: 14px;
    }
    .links a:hover { background: var(--nav-2); color: #fff; }
    .links a.ativo { background: var(--nav-ativo); color: #fff; font-weight: 500; box-shadow: inset 3px 0 0 #8fd3a8; }
    .paisagem { margin-top: auto; width: calc(100% + 40px); margin-left: -20px; margin-bottom: -28px; display: block; }
    .conexao { position: relative; padding: 14px; border-radius: 10px; background: var(--nav-2); font-size: 12px; line-height: 18px; color: var(--nav-texto); }
    .conexao-titulo { display: flex; align-items: center; gap: 8px; color: #fff; font-weight: 500; }
    .ponto { width: 8px; height: 8px; border-radius: 4px; background: #8fd3a8; }
    .ponto.desligado { background: #f0956a; }
    @media (max-width: 820px) {
      .paisagem { display: none; }
      .folhagem { width: 60vw; }
    }
    @media (max-width: 640px) { .conteudo { padding: 24px 16px 40px; } }
  `,
})
export class App implements OnInit {
  protected readonly dados = inject(Dados);

  protected readonly conectado = computed(() => this.dados.status()?.gatewayConectado ?? false);
  protected readonly resumoConexao = computed(() => {
    const s = this.dados.status();
    if (!s) return 'backend :8080 sem resposta';
    if (!s.gatewayConectado) return `TCP ${s.gateway}`;
    return `TCP ${s.gateway.split(':').pop()} · ${s.fontesOnline}/${s.fontesTotal} fontes`;
  });

  ngOnInit(): void {
    this.dados.iniciar();
  }
}
