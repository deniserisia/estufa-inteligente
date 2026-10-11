import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Dados } from './dados';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="casca">
      <nav aria-label="Navegação principal">
        <div class="marca">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8FD3A8" stroke-width="1.6"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 20c0-8.5 5.5-14 15-15-0.8 9.5-6.5 15-15 15z"></path><path d="M5 20l8-8"></path>
          </svg>
          <div>
            <div class="marca-nome">Estufa Inteligente</div>
            <div class="marca-sub">Central da fazenda</div>
          </div>
        </div>

        <div class="links">
          <a routerLink="/painel" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1.5"></rect><rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1.5"></rect><rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
            </svg>
            Painel
          </a>
          <a routerLink="/fontes" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"></path>
            </svg>
            Fontes e controles
          </a>
          <a routerLink="/graficos" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 3v18h18"></path><path d="M7 15l4-5 3 3 5-7"></path>
            </svg>
            Gráficos
          </a>
          <a routerLink="/consultas" routerLinkActive="ativo" ariaCurrentWhenActive="page">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                 stroke-linecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path>
            </svg>
            Consultas
          </a>
        </div>

        <div class="conexao">
          <div class="conexao-titulo">
            <span class="ponto" [class.desligado]="!conectado()"></span>
            {{ conectado() ? 'Gateway conectado' : 'Sem conexão' }}
          </div>
          <div class="mono">{{ resumoConexao() }}</div>
        </div>
      </nav>

      <main>
        @if (dados.erro(); as erro) {
          <div class="erro-msg" role="alert">{{ erro }}</div>
        }
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .casca { min-height: 100vh; display: flex; flex-wrap: wrap; }
    nav {
      flex: 1 1 232px; max-width: 100%; padding: 28px 20px; background: var(--nav); color: #e8efea;
      display: flex; flex-direction: column; gap: 28px;
    }
    main { flex: 999 1 560px; min-width: 0; padding: 32px 40px 48px; display: flex; flex-direction: column; gap: 16px; }
    .marca { display: flex; align-items: center; gap: 12px; }
    .marca-nome { font-weight: 600; font-size: 16px; line-height: 20px; }
    .marca-sub { font-size: 12px; color: #a9bdb0; }
    .links { display: flex; flex-direction: column; gap: 4px; }
    .links a {
      display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 10px 12px; border-radius: 8px;
      color: var(--nav-texto); text-decoration: none; font-size: 14px;
    }
    .links a:hover { background: var(--nav-2); color: #fff; }
    .links a.ativo { background: var(--nav-ativo); color: #fff; font-weight: 500; }
    .conexao { margin-top: auto; padding: 14px; border-radius: 8px; background: var(--nav-2); font-size: 12px; line-height: 18px; color: var(--nav-texto); }
    .conexao-titulo { display: flex; align-items: center; gap: 8px; color: #fff; font-weight: 500; }
    .ponto { width: 8px; height: 8px; border-radius: 4px; background: #8fd3a8; }
    .ponto.desligado { background: #f0956a; }
    @media (max-width: 640px) { main { padding: 24px 16px 40px; } }
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
