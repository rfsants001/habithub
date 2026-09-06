# habithub-web

SPA do HabitHub — Vite + React 19 + TypeScript. A API fica em [`../api`](../api).

```bash
npm run dev        # http://localhost:5173 (e no IP da LAN, pelo --host)
npm run typecheck
npm run lint
npm run build
```

> Prefira a TUI da raiz — `./scripts/habithub` sobe API e web lado a lado.

## Estrutura

```
src/
├── api/client.ts     # ÚNICA fronteira de rede — nenhum fetch( fora daqui
├── components/       # componentes de tela
├── styles/global.css # tokens (cores, escala do grafo) e primitivos
├── App.tsx           # shell
└── main.tsx          # entrada
```

## Como as chamadas chegam na API

O front sempre usa caminho relativo (`/api/categories`). O proxy do
[`vite.config.ts`](vite.config.ts) encaminha pra `http://localhost:3000` e tira o prefixo `/api`.

Por isso abrir pelo IP da LAN no celular funciona sem trocar nada — se a URL fosse
`localhost:3000` hardcoded, o celular tentaria conectar em si mesmo.

## Convenções

- Código em inglês, texto de tela em português (ADR-010 / NF-005).
- `console.log` solto não passa no review: ou é `log.debug` (some no build), ou não existe.
- Erro de API vira **duas** coisas: log no console e estado visível no form (FN-014).
