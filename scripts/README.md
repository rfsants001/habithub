# HabitHub Control — a TUI

```bash
./scripts/habithub     # ou, da raiz: npm start
```

Uma CLI gráfica que centraliza **todo comando do projeto**. Se você está digitando `cd api && npm run alguma-coisa`, provavelmente tem um item de menu pra isso — e um script equivalente no `package.json` da raiz.

### Atalhos de linha de comando

| Flag | Equivalente na raiz | Faz |
|---|---|---|
| `--dev` | `npm run tui -- --dev` | abre direto o painel split API+Web |
| `--dev-api` / `--dev-web` | `npm run tui -- --dev-api` / `npm run tui -- --dev-web` | painel de um serviço só |
| `--check` | `npm run check` | diagnóstico em texto, sem TTY |

```
 ▪▪▪ HabitHub control                              http://127.0.0.1:5173

  DESENVOLVIMENTO
   1 Rodar o projeto (API + Web)   split, log separado
   2 Só a API                      :3000
 ❯ 3 Só o Web                      :5173
  QUALIDADE
   4 Testes e cobertura…           rodar, filtrar por arquivo, coverage
   5 Typecheck e lint…             o gate do PR
  DADOS
   6 Banco…                        migrations, studio, seed
  PROJETO
   7 Status                        branch, endereço local e dependências
   8 Sair
```

## O painel de desenvolvimento

`1` sobe API e Web juntos, **cada um no seu painel**, com o log separado e colorido:

```
╭ API :3000 ● rodando 2m10 ─────────╮╭ WEB :5173 ● rodando 2m08 ─────────╮
│ {"level":30,"msg":"commit.criado"}││  VITE v8.2.2  ready in 242 ms     │
│ ...                               ││  ➜ Local: http://127.0.0.1...     │
╰───────────────────────────────────╯╰───────────────────────────────────╯
  r reiniciar tudo · 1/2 reiniciar api/web · f focar · c limpar · t tmux · q voltar
```

| Tecla | Faz |
|---|---|
| `r` | reinicia os dois |
| `1` / `2` | reinicia só a API / só o Web |
| `f` | alterna foco — um painel em tela cheia (pra ler stack trace) |
| `c` | limpa o log dos dois |
| `t` | reabre a mesma coisa em **tmux** de verdade (scroll, copy-mode) |
| `q` | mata os processos e volta ao menu |

Em terminal com menos de 100 colunas, os painéis empilham na vertical automaticamente.

## Testes e cobertura

| Opção | O que faz |
|---|---|
| Rodar todos | `vitest run` |
| Rodar um arquivo específico | você digita `grafo.test.ts` — o vitest filtra por substring do caminho |
| Modo watch | `vitest` — reroda ao salvar |
| **Coverage total** | roda com `--coverage` e mostra a tabela por arquivo **ordenada do pior pro melhor**, mais o total |
| **Coverage de um arquivo** | % detalhado + **quais linhas ficaram descobertas** (ex: `4–5, 11–13`) |
| Abrir relatório HTML | `coverage/index.html` |

A tabela sai do `coverage-summary.json`; as linhas descobertas saem do `coverage-final.json`. Os dois reporters estão ligados em [`api/vitest.config.ts`](../api/vitest.config.ts), junto com o threshold de 90%/100% para `src/domain/**` (ADR-009 — o domínio puro é o que precisa de cobertura de verdade).

## Sem TTY

```bash
npm run setup
npm run dev                  # sobe a API e o Web com logs no terminal
npm run check                # mostra as dependências e os caminhos detectados
```

`npm run dev:api` e `npm run dev:web` sobem os serviços separadamente. Use `PORT` e `WEB_PORT` para trocar as portas padrão 3000 e 5173.

## Decisões de implementação

- **Zero dependências npm.** Só Node ≥ 24 e ANSI escrito à mão. Um terceiro `package.json` aqui contrariaria o ADR-008 (dois pacotes, sem monorepo) e traria manutenção de dependência pra um script utilitário. O custo é `lib/ui.mjs` — ~250 linhas de primitivas de terminal.
- **O split é desenhado aqui, não delegado ao tmux.** Assim funciona em qualquer terminal, sem configuração. Quem quer tmux de verdade aperta `t`.
- **Os dev servers são chamados pelos binários locais** (`node_modules/.bin/tsx`, `node_modules/.bin/vite`), não por `npm run`. Uma camada a menos na árvore de processos — foi o `npm` intermediário que deixava o Vite órfão segurando a porta 5173 no `q`. Os scripts do `package.json` continuam valendo pra quem roda na mão.
- **Processos morrem pelo grupo** (`kill(-pid)`, com `detached: true`), e escalonam pra `SIGKILL` depois de 2s. Dev server que ignora `SIGTERM` deixaria a porta ocupada e o próximo start falharia.
- **Menu ciente do estado do projeto.** Opções que ainda não fazem sentido aparecem desativadas com o motivo e a task responsável (`← falta api/src/server.ts (task PH-1-001)`), em vez de quebrar com erro.
- **Comandos de um tiro herdam o terminal** (`stdio: 'inherit'`): você vê a saída nativa do vitest/drizzle/tsc, com o formato e as cores originais. A TUI não tenta reformatar o que já é bom.

## Adicionando um comando

Quase sempre é uma entrada no array de `itens` do menu certo em [`tui.mjs`](tui.mjs) e uma linha no mapa de comandos logo abaixo. Se for um processo de longa duração, envolva num `Servico` (de [`lib/proc.mjs`](lib/proc.mjs)) e passe pro `abrirPainel`.

```
scripts/
├── habithub          # wrapper bash (checa Node ≥ 24)
├── dev.mjs           # inicialização com logs comuns
├── tui.mjs           # menus, contexto do projeto, ações
└── lib/
    ├── ui.mjs        # ANSI: cores, medição de largura, caixas, menu, prompt
    ├── proc.mjs      # Servico (longa duração + ring buffer) · executar · capturar
    ├── painel.mjs    # o dashboard split
    └── testes.mjs    # menu de testes + leitura/render do coverage
```
