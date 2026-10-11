import { Routes } from '@angular/router';
import { Consultas } from './paginas/consultas';
import { Fontes } from './paginas/fontes';
import { Graficos } from './paginas/graficos';
import { Painel } from './paginas/painel';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'painel' },
  { path: 'painel', component: Painel, title: 'Painel · Estufa Inteligente' },
  { path: 'fontes', component: Fontes, title: 'Fontes · Estufa Inteligente' },
  { path: 'graficos', component: Graficos, title: 'Gráficos · Estufa Inteligente' },
  { path: 'consultas', component: Consultas, title: 'Consultas · Estufa Inteligente' },
  { path: '**', redirectTo: 'painel' },
];
