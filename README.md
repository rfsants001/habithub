# HabitHub 🟩

> App de hábitos com a **estética do contribution graph do GitHub**: cada categoria de hábito tem uma cor, cada hábito cumprido é um **"commit"**, e o grafo do ano vai pintando. Feedback visual acumulado (o vício dos quadradinhos) **sem sistema de punição** — a única consequência de falhar é o quadradinho vazio e a streak zerada.

Roda como **PWA mobile-first** servido na rede local: o hábito se marca no celular, o grafo pinta na hora.

![status](https://img.shields.io/badge/status-F1%20arrancando-yellow) ![stack](https://img.shields.io/badge/stack-React%20%2B%20Fastify%20%2B%20SQLite-blue) ![lang](https://img.shields.io/badge/TypeScript-3178C6) ![licença](https://img.shields.io/badge/uso-pessoal-lightgrey)

---

## 🎯 Por que existe

Cumprir hábitos depende de motivação — e motivação acaba. O que funciona é **feedback visual acumulado** (não deixar buraco no desenho), não cobrança. Os apps prontos ou são genéricos demais, ou **gamificam/punem demais** (Habitica) — e o app acaba abandonado em duas semanas. O HabitHub é o meio-termo:

- **Minimalista e honesto:** quem fala é o grafo.
- **Sem punição** (é arquitetural, não só de UX): falhar é só o quadradinho vazio. Não existe "vida", dano ou estado negativo no modelo de dados.
- **Cada canto da vida com sua cor:** academia verde, leitura azul — um contribution graph por categoria, empilhados.
- **"Commit" de verdade:** na Fase 3, cada hábito marcado vira um **commit git real** — o `git log` vira um diário auditável (e dá pra espelhar no GitHub e pintar o grafo de lá).

> Uso pessoal + portfólio + série de conteúdo *build-in-public*. Não é produto (por ora). É também um projeto de **prática de Python**.

---

## ✨ Features (por fase)

| # | Feature | O que entrega |
|---|---------|---------------|
| 1 | **Grafo vivo** ⭐ | CRUD de hábitos/categorias (cada categoria com cor) + "commit" na UI + um contribution graph por categoria; marcar o hábito **pinta o quadradinho na hora** (HTMX, sem reload) |
| 2 | **Streaks & stats** | Sequência atual + recorde (por hábito e geral) + taxa de conclusão por categoria — sem punição, o grafo fala |
| 3 | **Git de verdade** | Cada "commit" da UI gera um **commit git real** num repo local de hábitos; `git log` = diário auditável (espelhável no GitHub) |
| 4 | **Metas com prazo** | Metas ligadas aos commits + barra de progresso ("30 treinos até setembro: 12/30") |
| 5 | **PWA + lembretes** | Instalável no celular, janelas de horário por hábito + **Web Push** quando a janela abre/fecha |
| 6 | **Relatório semanal** | Resumo automático da semana (cumpriu / falhou / onde falha mais) — insumo do ritual de domingo |

### O que o HabitHub **não** é (Non-Goals)

- ❌ **Não é gamificado nem punitivo** — sem vidas, gacha, HARDCORE, badges, níveis ou pontos. A única mecânica é a streak e o grafo.
- ❌ **Sem loja** (Play/App Store) — é **PWA na rede local** ("sem loja, sem taxa" é parte da promessa).
- ❌ **Sem multiusuário / conta / nuvem** — uso pessoal, roda local.
- ❌ **Sem social / feed / comparação** — o grafo é seu, ponto.

---

## 🧱 Stack

**JS/TS** — SPA React + API REST Node separadas (re-arquitetado 2026-08-15, era Python-first).

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Frontend | **Vite** + **React 19** + **TypeScript** | SPA; espelha o setup do Grimório |
| Backend | **Fastify** + **TypeScript** (`tsx`) | API REST Node, rotas + hooks |
| ORM / DB | **Drizzle ORM** + **better-sqlite3** + **SQLite** | TS-first, SQL-próximo, um arquivo |
| Validação | **Zod** | schemas de body/params → DTO tipado |
| Grafo | **CSS Grid puro** | 53×7 quadradinhos, sem lib de chart |
| Testes | **Vitest** | domínio puro (streak, agregação do grafo) |
| Git real (F3) | **`node:child_process`** (git CLI) | commit real com data retroativa |
| Lembretes (F5) | **node-cron** + **web-push** | jobs de janela de horário + Web Push |
| PWA (F5) | **vite-plugin-pwa** + **mkcert/caddy** | HTTPS na rede local (pré-req de SW e Push) |

> **Dois `package.json`** (`api/`, `web/`), sem tooling de monorepo (ADR-008). Domínio puro isolado em `api/src/domain/` (ADR-009) — testável e campo de treino de DS&A.

---

## 🏗️ Arquitetura

### Modelo de dados

```mermaid
erDiagram
    CATEGORIA ||--o{ HABITO : "tem"
    HABITO ||--o{ REGISTRO : "recebe commits"
    HABITO ||--o{ META : "pode ter (F4)"

    CATEGORIA {
        int id PK
        string nome
        int cor_hue "0-360 (HSL)"
        datetime criada_em
    }
    HABITO {
        int id PK
        string nome
        int categoria_id FK
        time janela_inicio "null (F5)"
        time janela_fim "null (F5)"
        bool ativo
        datetime criado_em
    }
    REGISTRO {
        int id PK
        int habito_id FK
        date data "o dia do quadradinho"
        datetime criado_em "hora real do commit"
        string mensagem "null (opcional)"
    }
    META {
        int id PK
        int habito_id FK
        int alvo_qtd "ex: 30"
        date prazo
        datetime criada_em
    }
```

- **`REGISTRO` é o "commit".** Chama-se "commit" na UI e no conteúdo, mas o model é `Registro` — evita colisão com git e com `session.commit()` do SQLAlchemy (ADR-004).
- **O grafo é um `GROUP BY (categoria, data) → COUNT`.** Não existe tabela de "dia": dia vazio = sem `Registro` = quadradinho vazio (a "falha" sem punição).
- **Streak é derivado, nunca persistido** (ADR-003) — calculado a partir da lista de datas dos `Registro`. Fonte única de verdade, zero risco de dessincronizar.

### Fluxo do "commit" (F1 — o coração)

```mermaid
sequenceDiagram
    participant C as 📱 React (web)
    participant S as API Fastify
    participant DB as SQLite (Drizzle)
    participant G as domain/grafo.ts

    C->>S: fetch POST /habitos/:id/commit  (JSON)
    S->>S: Zod valida o body
    S->>DB: grava Registro(habito, data=hoje, criadoEm=agora)
    Note right of S: (F3) gitHabitos.commitar() → commit git real
    S->>G: montar(categoria) → matriz 53×7
    G-->>S: MatrizCategoria
    S-->>C: JSON { grafo }
    Note over C: React repinta o grafo da categoria<br/>quadradinho de hoje escurece, sem reload ← o AHÁ do EP01
```

### Módulos

```mermaid
graph TD
    subgraph api[api/ — Fastify + TS]
        routes[routes/<br/>categorias · habitos · commits]
        domain[domain/ ⭐<br/>streak.ts · grafo.ts — puro, DS&A]
        repos[repositories/<br/>Drizzle]
        services[services/<br/>gitHabitos F3 · lembretes F5 · relatorio F6]
        schemas[schemas/<br/>Zod]
        dbmod[db/<br/>schema.ts · client · migrations]
    end
    subgraph web[web/ — Vite + React + TS]
        grafoC[components/Grafo.tsx<br/>CSS Grid 53×7]
        commitC[components/BotaoCommit.tsx]
        apiC[api/client.ts<br/>fetch tipado]
    end

    routes --> schemas & domain & repos & services
    repos --> dbmod
    web -->|JSON REST| routes
```

> ⚠️ A estrutura acima é o **alvo**, não código pronto. Ver [ADRs](#-decisões-de-arquitetura-adrs).

---

## 🗺️ Roadmap

```mermaid
flowchart LR
    F1[F1 · Grafo vivo ⭐] --> F2[F2 · Streaks & stats]
    F2 --> F3[F3 · Git de verdade]
    F3 --> F4[F4 · Metas com prazo]
    F4 --> F5[F5 · PWA + lembretes]
    F5 --> F6[F6 · Relatório semanal]

    F2 -.->|streak alimenta| F6
    F5 -.->|HTTPS local<br/>é pré-req| F5

    style F1 fill:#39d353,stroke:#26a641,color:#000
```

**Marcos:**
- **Fim da F1** → marcar um hábito **pinta o quadradinho na hora** (demo já no primeiro EP).
- **Fim da F3** → o `git log` da vida real pinta o grafo do GitHub ("enganei o site dos programadores: meu perfil é de flexão e livro").
- **Fim da F6** → o relatório de domingo se gera sozinho.

Cada fase = 1 arco fechado = 1 episódio da série *build-in-public*.

---

## 🚀 Setup (F1)

> Requer Node.js LTS (≥ 20). Dois pacotes: `api/` (Fastify) e `web/` (Vite+React). O código do app é do Rafael (modo tutor-review).

```bash
git clone <este-repo> ~/dev/habithub
cd ~/dev/habithub
npm run setup      # instala api/ e web/
```

### 📦 Comandos (todos da raiz — não precisa entrar nas pastas)

O `package.json` da raiz é um **orquestrador**: não tem dependência nenhuma e delega pros dois pacotes com `npm --prefix`. **Não usa workspaces** — `api/` e `web/` continuam independentes (ADR-008).

| Comando | O que faz |
|---|---|
| `npm start` / `npm run tui` | abre a **TUI** (tudo em um lugar) |
| `npm run dev` | sobe API + Web no **painel split** |
| `npm run dev:api` · `npm run dev:web` | sobe um só, saída crua |
| `npm test` · `test:watch` · `test:coverage` | Vitest na `api/` |
| `npm run typecheck` | `tsc` nos **dois** pacotes |
| `npm run lint` | oxlint no `web/` |
| **`npm run verify`** | typecheck + lint + testes — **o gate do PR** |
| `npm run db:generate` · `db:migrate` · `db:studio` | Drizzle |
| `npm run seed` · `seed:demo` | popula o banco |
| `npm run build` | build de produção do `web/` |
| `npm run check` | diagnóstico do projeto, sem abrir a TUI |

<details>
<summary>Como os pacotes foram criados (histórico)</summary>

```bash
# --- API (Fastify + TS + Drizzle) ---
mkdir api && cd api && npm init -y
npm i fastify @fastify/cors drizzle-orm better-sqlite3 zod
npm i -D typescript tsx drizzle-kit @types/better-sqlite3 @types/node vitest
npm i -D pino-pretty @vitest/coverage-v8
cd ..

# --- WEB (Vite + React + TS) — igual ao Grimório ---
npm create vite@latest web -- --template react-ts
cd web && npm i && cd ..
```
</details>

### 🎛️ A TUI — todo comando mora aqui

```bash
./scripts/habithub
```

CLI gráfica que centraliza o projeto: sobe **API e Web em painéis lado a lado** com os logs separados, roda testes (todos, um arquivo específico, watch), mostra **coverage total ou por arquivo com as linhas descobertas**, e cuida de migrations, seed e typecheck/lint. Zero dependências — só Node. Detalhes em [`scripts/README.md`](scripts/README.md).

`./scripts/habithub --check` mostra o estado do projeto sem abrir a interface.

### Servir na rede local (marcar no celular)

```bash
# F1–F4 (HTTP): API em host 0.0.0.0 (:3000) + Vite --host (:5173, proxy /api → :3000)
#   descobrir o IP com `ip addr` → acessar http://192.168.x.x:5173 no celular

# F5 (HTTPS — obrigatório pro PWA/Web Push):
mkcert -install
mkcert 192.168.x.x localhost      # gera cert local confiável
# caddy faz reverse proxy TLS → https://192.168.x.x
```

---

## 🧭 Decisões de arquitetura (ADRs)

| ADR | Decisão | Resumo |
|-----|---------|--------|
| **001** ⭐ | **SPA React (Vite) + API REST Node (Fastify)** *(revertido 15/08)* | era server-rendered; agora front/back separados por JSON — ensaia o padrão da Nyx |
| **002** ⭐ | Grafo = **um por categoria**, empilhados (CSS Grid) | "cada canto da vida com sua cor"; leitura imediata; `GROUP BY` simples |
| **003** | Streak é **derivado**, não persistido | `calcularStreak(datas)`; fonte única = histórico de `registros` |
| **004** | "Commit" (domínio) = tabela/tipo `Registro` (código) | evita colisão com git |
| **005** | Git real via **`child_process`** (git CLI) | `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` fixam a data retroativa |
| **006** ⭐ | **Sem punição é arquitetural** | nenhuma penalidade no modelo; falha = ausência de `registro` |
| **007** | PWA na rede local exige **HTTPS** (F5) | SW e Web Push só em contexto seguro → mkcert/caddy |
| **008** | Repo **`web/` + `api/` separados**, sem monorepo | dois `package.json`; evita overhead que pioraria o Problema B |
| **009** | **Domínio puro isolado** (`api/src/domain/`) | streak/grafo sem framework → testável (Vitest) + campo de DS&A |

---

## 🔀 Fluxo de trabalho

Projeto de prática de **JS/TS/Node** em **modo tutor-review** (SDD + GitHub Flow):

```mermaid
flowchart LR
    A[/sdd-phase N/] --> B[Rafael coda<br/>na branch]
    B --> C[Pull Request]
    C --> D[Review contra<br/>rubrica]
    D -->|correções| B
    D -->|aprovado| E[merge → develop]
    E --> F[🎬 grava o EP da fase]
```

- Branch de trabalho: **`develop`**.
- Cada fase fechada → DoD completa + vídeo da fase.
- Commits **sem** trailer de co-autoria.

---

## 📁 Estrutura do repositório

```
habithub/
├── api/                     # Backend — Fastify + TypeScript
│   ├── src/
│   │   ├── server.ts        # bootstrap Fastify (CORS, rotas, errors)
│   │   ├── routes/          # categorias · habitos · commits
│   │   ├── domain/ ⭐        # streak.ts · grafo.ts — puro, testável, DS&A
│   │   ├── repositories/    # acesso a dados (Drizzle)
│   │   ├── services/        # gitHabitos (F3) · lembretes (F5) · relatorio (F6)
│   │   ├── schemas/         # Zod
│   │   └── db/              # schema.ts · client · migrations
│   ├── package.json
│   └── tsconfig.json
├── web/                     # Frontend — Vite + React + TS
│   ├── src/
│   │   ├── components/      # Grafo.tsx (CSS Grid) · BotaoCommit.tsx · Form*.tsx
│   │   ├── api/client.ts    # fetch tipado
│   │   └── styles/
│   └── package.json
├── bruno/                   # Collection Bruno — exploração da API (.bru versionado)
│   ├── environments/        # Local · LAN (celular)
│   └── Health/ Categories/ Habits/ Commits/ Erros/ Limpeza/
├── .gitignore
└── README.md
```

> O repo de **histórico de hábitos** (F3) é **separado** — nunca aninhado neste repo.

---

## 📄 Licença

Uso pessoal. Sem licença aberta por ora.
