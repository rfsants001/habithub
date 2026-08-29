/**
 * testes.mjs — menu de testes e cobertura.
 *
 * A saída do vitest é mostrada nativa (stdio herdado); o que esta camada
 * acrescenta é a leitura do coverage-summary.json numa tabela legível,
 * e o foco por arquivo (incluindo as linhas descobertas).
 */
import { existsSync, readFileSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { aguardarTecla, barra, C, cabecalho, menu, perguntar, pintar, preencher, tela } from './ui.mjs'
import { executar } from './proc.mjs'

const lerJson = (caminho) => {
  try { return JSON.parse(readFileSync(caminho, 'utf8')) } catch { return null }
}

export async function menuTestes(ctx) {
  for (;;) {
    const escolha = await menu({
      titulo: 'testes',
      itens: [
        { separador: 'RODAR' },
        { id: 'todos', rotulo: 'Rodar todos os testes', dica: 'vitest run · api' },
        { id: 'arquivo', rotulo: 'Rodar um arquivo específico…', dica: 'você digita o nome' },
        { id: 'watch', rotulo: 'Modo watch', dica: 'reroda ao salvar — o modo de trabalho' },
        { separador: 'COBERTURA' },
        { id: 'cov-total', rotulo: 'Coverage total', dica: 'tabela completa + resumo' },
        { id: 'cov-arquivo', rotulo: 'Coverage de um arquivo…', dica: '% + linhas descobertas' },
        { id: 'cov-html', rotulo: 'Abrir relatório HTML', dica: 'coverage/index.html',
          desativado: !existsSync(join(ctx.api, 'coverage/index.html')),
          motivo: 'rode o coverage antes' },
        { separador: '' },
        { id: null, rotulo: '← Voltar' },
      ],
      rodape: ctx.temTestes
        ? `suíte: ${ctx.arquivosDeTeste.length} arquivo(s) em api/src`
        : 'nenhum *.test.ts ainda — o primeiro nasce na task PH-1-006 (domain/grafo.test.ts)',
    })

    if (!escolha) return

    switch (escolha) {
      case 'todos':
        await rodarVitest(ctx, ['run'])
        break

      case 'arquivo': {
        const alvo = await pedirArquivoDeTeste(ctx)
        if (alvo) await rodarVitest(ctx, ['run', alvo])
        break
      }

      case 'watch':
        tela.limpar()
        console.log(pintar('\n  modo watch — Ctrl+C (ou q) encerra e volta ao menu\n', C.cinza))
        await executar('npm', ['run', 'test:watch'], { cwd: ctx.api })
        break

      case 'cov-total':
        if ((await rodarVitest(ctx, ['run', '--coverage'], { pausar: false })) !== null) {
          await mostrarCoberturaTotal(ctx)
        }
        break

      case 'cov-arquivo':
        await coberturaDeArquivo(ctx)
        break

      case 'cov-html':
        await executar('xdg-open', [join(ctx.api, 'coverage/index.html')])
        break
    }
  }
}

async function rodarVitest(ctx, args, { pausar = true } = {}) {
  if (!ctx.temTestes) {
    tela.limpar()
    console.log(cabecalho('testes') + '\n')
    console.log(pintar('  Nenhum arquivo *.test.ts em api/src ainda.', C.amarelo))
    console.log(pintar('  O primeiro é o `domain/grafo.test.ts` da task PH-1-006 —', C.cinza))
    console.log(pintar('  os 11 testes já estão escritos no arquivo da task, prontos pra colar.\n', C.cinza))
    await aguardarTecla()
    return null
  }

  tela.limpar()
  console.log(cabecalho('testes') + '\n')
  const codigo = await executar('npx', ['vitest', ...args], { cwd: ctx.api })

  if (pausar) {
    console.log(codigo === 0
      ? pintar('\n  ✔ suíte verde', C.verde, C.negrito)
      : pintar(`\n  ✖ falhou (código ${codigo})`, C.vermelho, C.negrito))
    await aguardarTecla()
  }
  return codigo
}

async function pedirArquivoDeTeste(ctx) {
  const sugestoes = ctx.arquivosDeTeste.map(basename)
  const dica = sugestoes.length
    ? `existentes: ${sugestoes.join(', ')}`
    : 'ainda não há arquivos de teste — ex: grafo.test.ts'

  const resposta = await perguntar('Qual arquivo de teste? (nome com extensão)', { dica })
  if (!resposta) return null

  // o vitest filtra por substring do caminho, então o nome do arquivo basta
  const existe = ctx.arquivosDeTeste.some((f) => basename(f) === resposta || f.includes(resposta))
  if (!existe) {
    tela.limpar()
    console.log(pintar(`\n  Não achei "${resposta}" em api/src.`, C.amarelo))
    console.log(pintar('  Vou passar assim mesmo pro vitest — ele filtra por substring do caminho.\n', C.cinza))
    await aguardarTecla('enter pra rodar assim mesmo')
  }
  return resposta
}

// ── cobertura ──────────────────────────────────────────────────────────────

function lerResumo(ctx) {
  return lerJson(join(ctx.api, 'coverage/coverage-summary.json'))
}

function corPct(pct) {
  return pct >= 90 ? C.verde : pct >= 70 ? C.amarelo : C.vermelho
}

async function mostrarCoberturaTotal(ctx) {
  const resumo = lerResumo(ctx)
  tela.limpar()
  console.log(cabecalho('coverage') + '\n')

  if (!resumo) {
    console.log(pintar('  Não achei coverage/coverage-summary.json.', C.amarelo))
    console.log(pintar('  (O reporter json-summary está ligado em api/vitest.config.ts.)\n', C.cinza))
    await aguardarTecla()
    return
  }

  const arquivos = Object.entries(resumo)
    .filter(([k]) => k !== 'total')
    .map(([caminho, m]) => ({ caminho: relative(ctx.api, caminho), m }))
    .sort((a, b) => a.m.lines.pct - b.m.lines.pct) // pior primeiro: é o que você quer ver

  const largura = Math.max(24, ...arquivos.map((a) => a.caminho.length)) + 2

  // `preencher` já ignora os códigos ANSI ao medir — as larguras aqui são as visíveis
  const COL = { linhas: 10, funcoes: 10, branches: 11 }
  const regua = '─'.repeat(largura + COL.linhas + COL.funcoes + COL.branches + 16)

  console.log('  ' + pintar(preencher('ARQUIVO', largura) + preencher('LINHAS', COL.linhas) +
    preencher('FUNÇÕES', COL.funcoes) + preencher('BRANCHES', COL.branches) + 'COBERTURA', C.cinza, C.negrito))
  console.log('  ' + pintar(regua, C.cinza))

  for (const { caminho, m } of arquivos) {
    console.log('  ' +
      preencher(caminho, largura) +
      preencher(pintar(`${m.lines.pct.toFixed(0)}%`, corPct(m.lines.pct)), COL.linhas) +
      preencher(pintar(`${m.functions.pct.toFixed(0)}%`, corPct(m.functions.pct)), COL.funcoes) +
      preencher(pintar(`${m.branches.pct.toFixed(0)}%`, corPct(m.branches.pct)), COL.branches) +
      barra(m.lines.pct))
  }

  const t = resumo.total
  console.log('  ' + pintar(regua, C.cinza))
  console.log('  ' +
    preencher(pintar('TOTAL', C.branco, C.negrito), largura) +
    preencher(pintar(`${t.lines.pct.toFixed(1)}%`, corPct(t.lines.pct), C.negrito), COL.linhas) +
    preencher(pintar(`${t.functions.pct.toFixed(1)}%`, corPct(t.functions.pct), C.negrito), COL.funcoes) +
    preencher(pintar(`${t.branches.pct.toFixed(1)}%`, corPct(t.branches.pct), C.negrito), COL.branches) +
    barra(t.lines.pct))

  console.log('\n  ' + pintar('threshold: src/domain/** exige 90% linhas / 100% funções (ADR-009)', C.cinza, C.fraco))
  await aguardarTecla()
}

async function coberturaDeArquivo(ctx) {
  const resumo = lerResumo(ctx)
  const conhecidos = resumo
    ? Object.keys(resumo).filter((k) => k !== 'total').map((k) => relative(ctx.api, k))
    : ctx.arquivosFonte

  const alvo = await perguntar('Qual arquivo? (caminho ou nome com extensão)', {
    dica: conhecidos.length ? `ex: ${conhecidos.slice(0, 4).join(', ')}` : 'ex: src/domain/grafo.ts',
  })
  if (!alvo) return

  // sempre reroda: cobertura velha mente, e a suíte é rápida
  const codigo = await rodarVitest(ctx, ['run', '--coverage'], { pausar: false })
  if (codigo === null) return

  const novo = lerResumo(ctx)
  tela.limpar()
  console.log(cabecalho(`coverage · ${alvo}`) + '\n')

  const achado = novo && Object.entries(novo).find(([k]) => k !== 'total' && k.includes(alvo))
  if (!achado) {
    console.log(pintar(`  "${alvo}" não aparece no relatório.`, C.amarelo))
    console.log(pintar('  Ou o caminho está errado, ou o arquivo não é importado por nenhum teste.\n', C.cinza))
    if (novo) {
      console.log(pintar('  Arquivos no relatório:', C.cinza))
      for (const k of Object.keys(novo).filter((k) => k !== 'total')) {
        console.log(pintar('    ' + relative(ctx.api, k), C.cinza))
      }
    }
    await aguardarTecla()
    return
  }

  const [caminhoAbs, m] = achado
  const linhas = [
    ['Linhas', m.lines], ['Statements', m.statements],
    ['Funções', m.functions], ['Branches', m.branches],
  ]

  console.log('  ' + pintar(relative(ctx.api, caminhoAbs), C.branco, C.negrito) + '\n')
  for (const [rotulo, met] of linhas) {
    console.log('  ' + preencher(rotulo, 14) +
      preencher(pintar(`${met.pct.toFixed(1)}%`, corPct(met.pct)), 9) +
      preencher(pintar(`${met.covered}/${met.total}`, C.cinza), 12) +
      barra(met.pct, 24))
  }

  const descobertas = linhasDescobertas(ctx, caminhoAbs)
  if (descobertas.length) {
    console.log('\n  ' + pintar('Linhas sem cobertura:', C.amarelo, C.negrito))
    console.log('  ' + pintar(descobertas.join(', '), C.vermelho))
    console.log('  ' + pintar('↑ é aqui que falta teste', C.cinza, C.fraco))
  } else if (m.lines.pct === 100) {
    console.log('\n  ' + pintar('✔ toda linha deste arquivo é exercitada por algum teste', C.verde))
  }

  await aguardarTecla()
}

/** Lê o coverage-final.json e agrupa as linhas com contador 0 em intervalos legíveis. */
function linhasDescobertas(ctx, caminhoAbs) {
  const final = lerJson(join(ctx.api, 'coverage/coverage-final.json'))
  const dados = final?.[caminhoAbs]
  if (!dados?.statementMap) return []

  const linhas = new Set()
  for (const [id, contagem] of Object.entries(dados.s ?? {})) {
    if (contagem === 0 && dados.statementMap[id]) linhas.add(dados.statementMap[id].start.line)
  }

  const ordenadas = [...linhas].sort((a, b) => a - b)
  const grupos = []
  let inicio = null
  let anterior = null

  for (const n of ordenadas) {
    if (inicio === null) { inicio = anterior = n; continue }
    if (n === anterior + 1) { anterior = n; continue }
    grupos.push(inicio === anterior ? `${inicio}` : `${inicio}–${anterior}`)
    inicio = anterior = n
  }
  if (inicio !== null) grupos.push(inicio === anterior ? `${inicio}` : `${inicio}–${anterior}`)

  return grupos
}
