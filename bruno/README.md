# Collection Bruno — HabitHub API

Cliente de exploração da API. [Bruno](https://usebruno.com) guarda tudo como
arquivo de texto (`.bru`) dentro do repo — sem conta, sem nuvem, e o diff do PR
mostra o que mudou de verdade.

## Usar

Abra o Bruno → **Open Collection** → aponte para esta pasta (`bruno/`).
Depois escolha o environment no canto superior direito:

| Environment | Quando |
|---|---|
| **Local** | dia a dia, no PC |
| **Self-hosted** | validar o proxy do Compose em `127.0.0.1:8080` |

Suba a API antes (`./scripts/habithub`, ou `npm run dev:api`). As requests da
pasta Health que passam pelo `proxyUrl` também precisam do Vite no ar.

## Rodar tudo pelo terminal

```bash
npx @usebruno/cli run --env Local -r     # -r = recursivo, entra nas pastas
```

## Ordem de execução

As pastas rodam na sequência do `seq` de cada `folder.bru`, e uma alimenta a
seguinte:

```
Health → Categories → Habits → Commits → Erros → Limpeza
```

`Categories/create-category` guarda o id em `{{categoryId}}`;
`Habits/create-habit` usa ele e guarda `{{habitId}}`; `Commits` usa esse.
`Limpeza` apaga os dois no fim, então rodar a collection inteira devolve o
banco ao estado em que estava.

> Os DELETEs moram em `Limpeza/` e não nas pastas dos seus recursos por causa
> dessa ordem: um DELETE no fim de `Categories` rodaria **antes** de `Habits`,
> apagaria a categoria e o POST de hábito cairia com erro de foreign key.

## As requests marcadas com ⏳

Marcam o que ainda não existe: o **nome da request** quando falta a rota
inteira, o **nome do teste** quando falta só um campo da resposta. São o alvo,
escrito antes, e falham de propósito até a task chegar — depois o marcador sai.

As da F1 (PH-1-007 grafo, PH-1-008 commit, PH-1-009 error handler) já foram
cumpridas. A pendente agora é a PH-1.2-005, nos stats do `GET habits`.

## Isto não é a sua rede de segurança

Bruno é lanterna, não alarme: nada aqui roda no `npm run verify` nem quebra um
PR. Para isso existe o Vitest com `fastify.inject()`, que sobe o app em memória
sem porta e sem rede.
