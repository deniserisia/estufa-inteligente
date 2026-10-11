import { Fonte } from './api';

export const LIMITE_ALERTA = 35;
export const TEMPERATURA_IDEAL = 30;

export const NOMES_TIPO: Record<string, string> = {
  EXAUSTOR: 'Exaustor',
  NEBULIZADOR: 'Nebulizador',
  TELA_SOMBREAMENTO: 'Tela de sombreamento',
  SENSOR_TEMP_UMIDADE: 'Temperatura e umidade',
  SENSOR_LUMINOSIDADE: 'Luminosidade',
  SENSOR_CO2: 'CO₂',
};

/** Cores por estufa, na ordem em que aparecem. */
export const CORES_ESTUFA = ['#1F6B4A', '#4A86C8', '#8A5CB8', '#B7791F'];

export function nomeEstufa(id: string): string {
  const m = /^estufa-(\d+)$/.exec(id);
  return m ? `Estufa ${m[1]}` : id;
}

export function corEstufa(id: string, todas: string[]): string {
  const i = Math.max(0, todas.indexOf(id));
  return CORES_ESTUFA[i % CORES_ESTUFA.length];
}

const numero = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export function fmt(valor: number | undefined, casas = 1): string {
  return valor === undefined || Number.isNaN(valor) ? '–' : numero(casas).format(valor);
}

export function hora(ms: number, comSegundos = true): string {
  if (!ms) return '–';
  return new Date(ms).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: comSegundos ? '2-digit' : undefined,
  });
}

export function duracao(segundos: number): string {
  const s = Math.round(segundos);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${m} min ${String(r).padStart(2, '0')} s`;
  return `${r} s`;
}

export function haQuanto(ms: number): string {
  if (!ms) return 'nunca';
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `há ${s} s`;
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  return `há ${Math.floor(s / 3600)} h`;
}

export function medicao(f: Fonte | undefined, grandeza: string): number | undefined {
  return f?.medicoes.find((m) => m.grandeza === grandeza)?.valor;
}

/** Texto curto com o estado (atuadores) ou a última leitura (sensores). */
export function resumoFonte(f: Fonte): string {
  if (f.controlavel) {
    const partes: string[] = [];
    if (f.estado.emFalha) partes.push('em falha simulada');
    if (f.tipo !== 'TELA_SOMBREAMENTO') partes.push(f.estado.ligado ? 'ligado' : 'desligado');
    if (f.tipo === 'EXAUSTOR') partes.push(`${fmt(f.estado.nivel, 0)}% velocidade`);
    if (f.tipo === 'TELA_SOMBREAMENTO') partes.push(`${fmt(f.estado.nivel, 0)}% aberta`);
    partes.push(`a cada ${fmt(f.estado.intervaloEnvioS, 0)} s`);
    return partes.join(' · ');
  }
  switch (f.tipo) {
    case 'SENSOR_TEMP_UMIDADE':
      return `${fmt(medicao(f, 'temperatura'))} °C · ${fmt(medicao(f, 'umidade'), 0)}%`;
    case 'SENSOR_LUMINOSIDADE':
      return `${fmt(medicao(f, 'luminosidade'), 0)} lux`;
    case 'SENSOR_CO2':
      return `${fmt(medicao(f, 'co2'), 0)} ppm`;
    default:
      return f.medicoes.map((m) => `${m.grandeza} ${fmt(m.valor)} ${m.unidade}`).join(' · ');
  }
}

/** Baixa um texto como arquivo (usado no Exportar CSV). */
export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob(['﻿' + conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/** Cultivo de cada estufa (só para exibição; troque à vontade). */
export const CULTURAS: Record<string, { nome: string; icone: 'tomate' | 'pimenta' | 'folha'; cor: string; fundo: string }> = {
  'estufa-1': { nome: 'Tomate', icone: 'tomate', cor: '#C2410C', fundo: '#FDEBDD' },
  'estufa-2': { nome: 'Pimentão', icone: 'pimenta', cor: '#3F7D3A', fundo: '#E5F1DF' },
};

export function cultura(estufa: string) {
  return CULTURAS[estufa] ?? { nome: 'Cultivo', icone: 'folha' as const, cor: '#1F6B4A', fundo: '#E3EEE7' };
}
