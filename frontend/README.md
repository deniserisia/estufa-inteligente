# Frontend Angular da Estufa Inteligente

Interface web com 4 telas: Painel, Fontes e controles, Gráficos e Consultas.
Conversa só com o backend Java (API REST em `http://localhost:8080/api`).

```bash
npm install
npm start          # http://localhost:4200
```

O `npm start` usa o `proxy.conf.json`, que encaminha `/api` para o backend
na porta 8080. Por isso o backend Java precisa estar rodando.

Estrutura:

- `src/app/api.ts`: tipos do JSON e todas as chamadas HTTP
- `src/app/dados.ts`: polling de fontes, alertas e status a cada 3 s
- `src/app/paginas/`: as 4 telas e o componente de gráfico em SVG
- `src/app/formatos.ts`: nomes, cores e formatação de números e horários
