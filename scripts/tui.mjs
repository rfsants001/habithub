#!/usr/bin/env node
/**
 * HabitHub Control — TUI que centraliza todo comando do projeto.
 *
 * Rode com `./scripts/habithub`.
 * Zero dependências: só Node ≥ 20 (respeita o ADR-008 — nada de terceiro package.json).
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

import { aguardarTecla, C, cabecalho, menu, pintar, preencher, tela } from './lib/ui.mjs'
import { capturar, executar, pararTodosJa, Servico } from './lib/proc.mjs'
import { abrirPainel } from './lib/painel.mjs'
import { menuTestes } from './lib/testes.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..')
const API = join(RAIZ, 'api')
const WEB = join(RAIZ, 'web')

// ── contexto do projeto ────────────────────────────────────────────────────

function varrer(dir, aceitar, encontrados = []) {
  if (!existsSync(dir)) return encontrados
  for (const entrada of readdirSync(dir)) {
    if (entrada === 'node_modules' || entrada === 'coverage' || entrada.startsWith('.')) continue
    const caminho = join(dir, entrada)
    if (statSync(caminho).isDirectory()) varrer(caminho, aceitar, encontrados)
    else if (aceitar(caminho)) encontrados.push(caminho)
  }
  return encontrados
}

function ipLan() {
  for (const enderecos of Object.values(networkInterfaces())) {
    for (const e of enderecos ?? []) {
      if (e.family === 'IPv4' && !e.internal && e.address.startsWith('192.168.')) return e.address
    }
  }
  for (const enderecos of Object.values(networkInterfaces())) {
    for (const e of enderecos ?? []) if (e.family === 'IPv4' && !e.internal) return e.address
  }
  return null
}

function lerContexto() {
  const testes = varrer(join(API, 'src'), (f) => /\.(test|spec)\.ts$/.test(f))
  const fontes = varrer(join(API, 'src'), (f) => f.endsWith('.ts') && !/\.(test|spec)\.ts$/.test(f))

  return {
    raiz: RAIZ, api: API, web: WEB,
    temServidor: existsSync(join(API, 'src/server.ts')),
    temWeb: existsSync(join(WEB, 'package.json')),
    temNodeModulesApi: existsSync(join(API, 'node_modules')),
    temNodeModulesWeb: existsSync(join(WEB, 'node_modules')),
    temBanco: existsSync(join(API, 'habithub.db')),
    temMigrations: existsSync(join(API, 'src/db/migrations')),
    temSeed: existsSync(join(API, 'src/seed.ts')),
    arquivosDeTeste: testes.map((f) => relative(API, f)),
    arquivosFonte: fontes.map((f) => relative(API, f)),
    temTestes: testes.length > 0,
    ip: ipLan(),
  }
}

// ── serviços de desenvolvimento ────────────────────────────────────────────

// Chamamos os binários locais direto, sem passar por `npm run`: uma camada a menos
// na árvore de processos (o npm intermediário é quem deixava o vite órfão no Ctrl+C),
// e o log fica sem o cabeçalho do npm. Os scripts do package.json seguem valendo
// pra quem rodar na mão — a TUI só não depende deles.
const criarServicoApi = () => new Servico({
  nome: 'API', cor: C.magenta, porta: 3000,
  comando: join(API, 'node_modules/.bin/tsx'), args: ['watch', 'src/server.ts'], cwd: API,
})

const criarServicoWeb = () => new Servico({
  nome: 'WEB', cor: C.ciano, porta: 5173,
  comando: join(WEB, 'node_modules/.bin/vite'), args: ['--host'], cwd: WEB,
})

async function abrirTmux(quais) {
  const temTmux = (await capturar('which', ['tmux'])).codigo === 0
  if (!temTmux) {
    console.log(pintar('\n  tmux não encontrado no PATH.\n', C.amarelo))
    return aguardarTecla()
  }

  const args = ['new-session', '-A', '-s', 'habithub']
  if (quais.includes('api')) args.push(`cd ${API} && npm run dev`)
  if (quais.includes('api') && quais.includes('web')) {
    args.push(';', 'split-window', '-h', `cd ${WEB} && npm run dev`, ';', 'select-layout', 'even-horizontal')
  } else if (quais.includes('web')) {
    args.push(`cd ${WEB} && npm run dev`)
  }
  await executar('tmux', args)
}

// ── menus ──────────────────────────────────────────────────────────────────

async function menuBanco(ctx) {
  for (;;) {
    const escolha = await menu({
      titulo: 'banco',
      itens: [
        { id: 'generate', rotulo: 'Gerar migration', dica: 'drizzle-kit generate — lê o schema.ts',
          desativado: !existsSync(join(API, 'src/db/schema.ts')), motivo: 'falta src/db/schema.ts (PH-1-002)' },
        { id: 'migrate', rotulo: 'Aplicar migrations', dica: 'drizzle-kit migrate',
          desativado: !ctx.temMigrations, motivo: 'gere a migration antes' },
        { id: 'studio', rotulo: 'Abrir Drizzle Studio', dica: 'navegador de tabelas',
          desativado: !ctx.temBanco, motivo: 'sem habithub.db ainda' },
        { separador: 'DADOS' },
        { id: 'seed', rotulo: 'Seed (categorias reais)', dica: 'idempotente — pode rodar 2x',
          desativado: !ctx.temSeed, motivo: 'falta src/seed.ts (PH-1-010)' },
        { id: 'seed-demo', rotulo: 'Seed demo (histórico fictício)', dica: '⚠ faça backup do .db antes',
          desativado: !existsSync(join(API, 'src/seed-demo.ts')), motivo: 'falta src/seed-demo.ts (PH-1-010)' },
        { id: 'backup', rotulo: 'Backup do banco', dica: 'cp habithub.db habithub.db.bak',
          desativado: !ctx.temBanco, motivo: 'sem banco ainda' },
        { separador: '' },
        { id: null, rotulo: '← Voltar' },
      ],
      rodape: ctx.temBanco ? 'banco: api/habithub.db' : 'banco ainda não existe',
    })
    if (!escolha) return

    tela.limpar()
    console.log(cabecalho('banco') + '\n')

    const mapa = {
      generate: ['npm', ['run', 'db:generate']],
      migrate: ['npm', ['run', 'db:migrate']],
      studio: ['npm', ['run', 'db:studio']],
      seed: ['npm', ['run', 'seed']],
      'seed-demo': ['npm', ['run', 'seed:demo']],
      backup: ['cp', ['habithub.db', `habithub.db.bak`]],
    }
    const [cmd, args] = mapa[escolha]
    const codigo = await executar(cmd, args, { cwd: API })
    console.log(codigo === 0 ? pintar('\n  ✔ ok', C.verde) : pintar(`\n  ✖ código ${codigo}`, C.vermelho))
    await aguardarTecla()
  }
}

async function menuQualidade() {
  for (;;) {
    const escolha = await menu({
      titulo: 'qualidade',
      itens: [
        { id: 'tudo', rotulo: 'Rodar tudo', dica: 'typecheck api + web, lint web — o gate do PR' },
        { separador: 'INDIVIDUAL' },
        { id: 'tc-api', rotulo: 'Typecheck da API', dica: 'tsc --noEmit' },
        { id: 'tc-web', rotulo: 'Typecheck do Web', dica: 'tsc -b' },
        { id: 'lint-web', rotulo: 'Lint do Web', dica: 'oxlint' },
        { separador: '' },
        { id: null, rotulo: '← Voltar' },
      ],
      rodape: 'typecheck limpo é pré-requisito de PR (tasks.md)',
    })
    if (!escolha) return

    tela.limpar()
    console.log(cabecalho('qualidade') + '\n')

    const passos = {
      'tc-api': [['API  typecheck', 'npm', ['run', 'typecheck'], API]],
      'tc-web': [['WEB  typecheck', 'npm', ['run', 'typecheck'], WEB]],
      // chamado pelo binário local: o hook do RTK reescreve `npm run lint` pra ESLint
      'lint-web': [['WEB  lint', join(WEB, 'node_modules/.bin/oxlint'), [], WEB]],
      tudo: [
        ['API  typecheck', 'npm', ['run', 'typecheck'], API],
        ['WEB  typecheck', 'npm', ['run', 'typecheck'], WEB],
        ['WEB  lint', join(WEB, 'node_modules/.bin/oxlint'), [], WEB],
      ],
    }[escolha]

    const resultados = []
    for (const [rotulo, cmd, args, cwd] of passos) {
      console.log(pintar(`\n  ▸ ${rotulo}`, C.branco, C.negrito))
      const codigo = await executar(cmd, args, { cwd })
      resultados.push([rotulo, codigo])
    }

    console.log('')
    for (const [rotulo, codigo] of resultados) {
      console.log('  ' + (codigo === 0 ? pintar('✔', C.verde) : pintar('✖', C.vermelho)) + '  ' + rotulo)
    }
    const tudoOk = resultados.every(([, c]) => c === 0)
    console.log(tudoOk
      ? pintar('\n  pronto pra abrir o PR', C.verde, C.negrito)
      : pintar('\n  corrija antes de abrir o PR', C.amarelo, C.negrito))
    await aguardarTecla()
  }
}

async function mostrarStatus(ctx) {
  const [branch, gitStatus, nodeV] = await Promise.all([
    capturar('git', ['branch', '--show-current'], { cwd: RAIZ }),
    capturar('git', ['status', '--porcelain'], { cwd: RAIZ }),
    capturar('node', ['-v']),
  ])

  tela.limpar()
  console.log(cabecalho('status') + '\n')

  const linha = (rotulo, valor, cor = C.branco) =>
    console.log('  ' + preencher(pintar(rotulo, C.cinza), 28) + pintar(valor, cor))

  const sim = (rotulo, b) => linha(rotulo, b ? 'sim' : 'não', b ? C.verde : C.amarelo)

  console.log(pintar('  REPO', C.cinza, C.negrito))
  linha('branch', branch.saida || '?', branch.saida === 'develop' ? C.amarelo : C.verde)
  linha('alterações pendentes', String(gitStatus.saida.split('\n').filter(Boolean).length))
  console.log('')

  console.log(pintar('  AMBIENTE', C.cinza, C.negrito))
  linha('node', nodeV.saida)
  linha('IP na LAN', ctx.ip ? `http://${ctx.ip}:5173` : 'não detectado', C.ciano)
  console.log('')

  console.log(pintar('  PROJETO', C.cinza, C.negrito))
  sim('api/src/server.ts', ctx.temServidor)
  linha('deps instaladas (api/web)', `${ctx.temNodeModulesApi ? '✔' : '✖'} / ${ctx.temNodeModulesWeb ? '✔' : '✖'}`)
  sim('banco (habithub.db)', ctx.temBanco)
  sim('migrations', ctx.temMigrations)
  linha('arquivos de teste', String(ctx.arquivosDeTeste.length))
  linha('arquivos fonte (api)', String(ctx.arquivosFonte.length))

  if (!ctx.temServidor) {
    console.log('\n  ' + pintar('▸ próximo passo:', C.amarelo, C.negrito) +
      ' escrever ' + pintar('api/src/server.ts', C.branco) + ' (task PH-1-001)')
    console.log('  ' + pintar('  .specs/features/grafo-vivo/tasks/PH-1-001-esqueletos.md', C.cinza))
  }

  await aguardarTecla()
}

// ── principal ──────────────────────────────────────────────────────────────

async function principal() {
  for (;;) {
    const ctx = lerContexto() // recalcula: arquivos podem ter nascido desde a última volta

    const semServidor = !ctx.temServidor
    const motivoApi = 'falta api/src/server.ts (task PH-1-001)'

    const escolha = await menu({
      titulo: ctx.ip ? `http://${ctx.ip}:5173` : '',
      itens: [
        { separador: 'DESENVOLVIMENTO' },
        { id: 'dev', rotulo: 'Rodar o projeto (API + Web)', dica: 'split, log separado',
          desativado: semServidor, motivo: motivoApi },
        { id: 'dev-api', rotulo: 'Só a API', dica: ':3000', desativado: semServidor, motivo: motivoApi },
        { id: 'dev-web', rotulo: 'Só o Web', dica: ':5173' },
        { separador: 'QUALIDADE' },
        { id: 'testes', rotulo: 'Testes e cobertura…', dica: 'rodar, filtrar por arquivo, coverage' },
        { id: 'qualidade', rotulo: 'Typecheck e lint…', dica: 'o gate do PR' },
        { separador: 'DADOS' },
        { id: 'banco', rotulo: 'Banco…', dica: 'migrations, studio, seed' },
        { separador: 'PROJETO' },
        { id: 'status', rotulo: 'Status', dica: 'branch, IP, o que já existe' },
        { id: 'sair', rotulo: 'Sair' },
      ],
      rodape: semServidor
        ? 'PH-1-001 em andamento — falta o server.ts pra API subir'
        : 'tudo que este projeto roda passa por aqui',
    })

    switch (escolha) {
      case null: case 'sair':
        return

      case 'dev':
        await abrirPainel([criarServicoApi(), criarServicoWeb()], {
          ip: ctx.ip ? `http://${ctx.ip}:5173` : '',
          aoSairParaTmux: () => abrirTmux(['api', 'web']),
        })
        break

      case 'dev-api':
        await abrirPainel([criarServicoApi()], { ip: '', aoSairParaTmux: () => abrirTmux(['api']) })
        break

      case 'dev-web':
        await abrirPainel([criarServicoWeb()], {
          ip: ctx.ip ? `http://${ctx.ip}:5173` : '',
          aoSairParaTmux: () => abrirTmux(['web']),
        })
        break

      case 'testes': await menuTestes(ctx); break
      case 'qualidade': await menuQualidade(); break
      case 'banco': await menuBanco(ctx); break
      case 'status': await mostrarStatus(ctx); break
    }
  }
}

// ── ciclo de vida ──────────────────────────────────────────────────────────

let modoGrafico = false

function restaurar() {
  // Antes do terminal: os serviços são detached, então nenhum sinal que derruba
  // a TUI chega neles. Sem isto, um Ctrl+C fora do painel (ou um crash) deixa
  // tsx e vite vivos segurando :3000 e :5173, e o próximo start falha.
  pararTodosJa()
  if (!modoGrafico) return // --check não entrou em alt screen: nada a desfazer
  tela.mostrarCursor()
  tela.sairAlt()
  if (process.stdin.isTTY) { try { process.stdin.setRawMode(false) } catch { /* já fechou */ } }
}

process.on('exit', restaurar)
process.on('SIGINT', () => { restaurar(); process.exit(0) })
process.on('SIGTERM', () => { restaurar(); process.exit(0) })
process.on('uncaughtException', (err) => {
  restaurar()
  console.error('\n  A TUI quebrou:\n', err)
  process.exit(1)
})

// Modo não-interativo: mostra o que a TUI enxerga do projeto. Serve pra
// diagnosticar ("por que a opção X está desativada?") e roda em CI/pipe.
if (process.argv.includes('--check') || process.argv.includes('--status')) {
  const ctx = lerContexto()
  const marca = (b) => (b ? '✔' : '✖')
  console.log('HabitHub Control — diagnóstico\n')
  console.log(`  raiz                 ${ctx.raiz}`)
  console.log(`  node                 ${process.version}`)
  console.log(`  IP na LAN            ${ctx.ip ?? '(não detectado)'}`)
  console.log(`  ${marca(ctx.temNodeModulesApi)} api/node_modules`)
  console.log(`  ${marca(ctx.temNodeModulesWeb)} web/node_modules`)
  console.log(`  ${marca(ctx.temServidor)} api/src/server.ts`)
  console.log(`  ${marca(ctx.temMigrations)} migrations`)
  console.log(`  ${marca(ctx.temBanco)} habithub.db`)
  console.log(`  ${marca(ctx.temSeed)} src/seed.ts`)
  console.log(`  arquivos de teste    ${ctx.arquivosDeTeste.length} ${ctx.arquivosDeTeste.join(', ')}`)
  console.log(`  arquivos fonte (api) ${ctx.arquivosFonte.length}`)
  if (!ctx.temServidor) {
    console.log('\n  ▸ "Rodar o projeto" e "Só a API" ficam desativados até existir api/src/server.ts (PH-1-001).')
  }
  process.exit(0)
}

if (!process.stdin.isTTY) {
  console.error('Esta TUI precisa de um terminal interativo (TTY).')
  console.error('Para inspecionar o estado do projeto sem TTY: ./scripts/habithub --check')
  process.exit(1)
}

// Atalhos que pulam o menu e abrem o painel direto — é o que `npm run dev`,
// `npm run dev:api` e `npm run dev:web` da raiz usam.
const ATALHOS = {
  '--dev': () => [criarServicoApi(), criarServicoWeb()],
  '--dev-api': () => [criarServicoApi()],
  '--dev-web': () => [criarServicoWeb()],
}

const atalho = process.argv.find((a) => a in ATALHOS)
if (atalho) {
  const ctx = lerContexto()
  if (atalho !== '--dev-web' && !ctx.temServidor) {
    console.error('\n  api/src/server.ts ainda não existe — a API não tem o que subir.')
    console.error('  Ver .specs/features/grafo-vivo/tasks/PH-1-001-esqueletos.md')
    console.error('  (`npm run dev:web` sobe só o front.)\n')
    process.exit(1)
  }
  modoGrafico = true
  tela.entrarAlt()
  tela.esconderCursor()
  await abrirPainel(ATALHOS[atalho](), {
    ip: ctx.ip ? `http://${ctx.ip}:5173` : '',
    aoSairParaTmux: () => abrirTmux(atalho === '--dev' ? ['api', 'web'] : [atalho.slice(6)]),
  })
  restaurar()
  process.exit(0)
}

modoGrafico = true
tela.entrarAlt()
tela.esconderCursor()
await principal()
restaurar()
console.log(pintar('  até a próxima ▪▪▪\n', C.verde))
