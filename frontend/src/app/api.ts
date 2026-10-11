import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

/* Tipos do JSON da API REST (backend Java). Espelham os DTOs em Dtos.java. */

export interface Medicao {
  grandeza: string;
  valor: number;
  unidade: string;
}

export interface Estado {
  ligado: boolean;
  nivel: number;
  intervaloEnvioS: number;
  emFalha: boolean;
}

export interface Fonte {
  id: string;
  tipo: string; // EXAUSTOR, NEBULIZADOR, TELA_SOMBREAMENTO, SENSOR_TEMP_UMIDADE, SENSOR_LUMINOSIDADE, SENSOR_CO2
  estufa: string;
  ip: string;
  portaGrpc: number;
  controlavel: boolean;
  online: boolean;
  ultimoContatoMs: number;
  estado: Estado;
  medicoes: Medicao[];
}

export interface Alerta {
  fonteId: string;
  estufa: string;
  tipo: string;
  timestampMs: number;
  motivo: string;
  medicoes: Medicao[];
}

export interface Resultado {
  estufa: string;
  valor: number;
  unidade: string;
  timestampMs: number;
  amostras: number;
}

export interface Consulta {
  tipo: string;
  janelaS: number;
  limite: number;
  mensagemEnviada: string;
  resultados: Resultado[];
}

export interface Ponto {
  timestampMs: number;
  valor: number;
  fonteId: string;
  alerta: boolean;
}

export interface Status {
  gatewayConectado: boolean;
  gateway: string;
  fontesOnline: number;
  fontesTotal: number;
  erro: string | null;
}

export interface ComandoResposta {
  fonteId: string;
  comando: string;
  estado: Estado;
}

export type TipoComando =
  | 'LIGAR'
  | 'DESLIGAR'
  | 'AJUSTAR_NIVEL'
  | 'AJUSTAR_INTERVALO'
  | 'SIMULAR_FALHA'
  | 'ENCERRAR_FALHA';

/** Todas as chamadas HTTP do frontend. O proxy do Angular leva /api ao backend Java (8080). */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  status(): Observable<Status> {
    return this.http.get<Status>('/api/status');
  }

  fontes(): Observable<Fonte[]> {
    return this.http.get<Fonte[]>('/api/fontes');
  }

  alertas(): Observable<Alerta[]> {
    return this.http.get<Alerta[]>('/api/alertas');
  }

  comando(fonteId: string, tipo: TipoComando, valor = 0): Observable<ComandoResposta> {
    return this.http.post<ComandoResposta>(`/api/fontes/${encodeURIComponent(fonteId)}/comandos`, {
      tipo,
      valor,
    });
  }

  tempoAcimaIdeal(janela: number, limite: number): Observable<Consulta> {
    const params = new HttpParams().set('janela', janela).set('limite', limite);
    return this.http.get<Consulta>('/api/consultas/tempo-acima-ideal', { params });
  }

  mediaUmidade(janela: number): Observable<Consulta> {
    return this.http.get<Consulta>('/api/consultas/media-umidade', {
      params: new HttpParams().set('janela', janela),
    });
  }

  picoLuminosidade(janela: number): Observable<Consulta> {
    return this.http.get<Consulta>('/api/consultas/pico-luminosidade', {
      params: new HttpParams().set('janela', janela),
    });
  }

  historico(grandeza: string, estufa: string, de: number, ate: number, maxPontos = 300): Observable<Ponto[]> {
    const params = new HttpParams()
      .set('grandeza', grandeza)
      .set('estufa', estufa)
      .set('de', de)
      .set('ate', ate)
      .set('maxPontos', maxPontos);
    return this.http.get<Ponto[]>('/api/historico', { params });
  }
}

/** Mensagem de erro legível a partir da resposta HTTP. */
export function mensagemDeErro(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.error && typeof e.error === 'object' && 'erro' in e.error) {
      return String(e.error.erro);
    }
    if (e.status === 0 || e.status === 504) {
      return 'Backend Java fora do ar (porta 8080).';
    }
    return `Erro HTTP ${e.status}`;
  }
  return String(e);
}
