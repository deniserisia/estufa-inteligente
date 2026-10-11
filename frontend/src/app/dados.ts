import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { Alerta, Api, Fonte, Status, mensagemDeErro } from './api';

const INTERVALO_MS = 3000;

/**
 * Estado compartilhado pelas telas: fontes, alertas e status do Gateway,
 * atualizados por polling a cada 3 s.
 */
@Injectable({ providedIn: 'root' })
export class Dados {
  private readonly api = inject(Api);

  readonly fontes = signal<Fonte[]>([]);
  readonly alertas = signal<Alerta[]>([]);
  readonly status = signal<Status | null>(null);
  readonly erro = signal<string | null>(null);
  readonly ultimaAtualizacao = signal<number>(0);
  readonly carregou = signal(false);

  readonly estufas = computed(() => [...new Set(this.fontes().map((f) => f.estufa))].sort());

  private timer: ReturnType<typeof setInterval> | undefined;

  iniciar(): void {
    if (this.timer) return;
    this.atualizar();
    this.timer = setInterval(() => this.atualizar(), INTERVALO_MS);
  }

  atualizar(): void {
    this.api.status().subscribe({
      next: (s) => {
        this.status.set(s);
        if (!s.gatewayConectado) {
          this.erro.set(`Gateway fora do ar (${s.gateway}). Inicie: python gateway/main.py`);
          this.carregou.set(true);
          return;
        }
        forkJoin({ fontes: this.api.fontes(), alertas: this.api.alertas() }).subscribe({
          next: ({ fontes, alertas }) => {
            this.fontes.set(fontes);
            this.alertas.set(alertas);
            this.erro.set(null);
            this.ultimaAtualizacao.set(Date.now());
            this.carregou.set(true);
          },
          error: (e) => this.falhou(e),
        });
      },
      error: (e) => this.falhou(e),
    });
  }

  private falhou(e: unknown): void {
    this.status.set(null);
    this.erro.set(mensagemDeErro(e));
    this.carregou.set(true);
  }
}
