/**
 * ui.mjs — primitivas de terminal (ANSI puro, zero dependências).
 *
 * Responsabilidade: desenhar e ler teclas. Nada aqui sabe o que é HabitHub.
 */
import process from 'node:process'

const temCor = process.stdout.isTTY && !process.env.NO_COLOR
const cod = (n) => (temCor ? `\x1b[${n}m` : '')

export const C = {
  reset: cod(0),
  negrito: cod(1),
  fraco: cod(2),
  inverso: cod(7),
  vermelho: cod(31),
  verde: cod(32),
  amarelo: cod(33),
  azul: cod(34),
  magenta: cod(35),
  ciano: cod(36),
  cinza: cod(90),
  branco: cod(97),
  bgEscuro: cod(48) + (temCor ? ';5;236m' : ''),
}

export const pintar = (texto, ...cores) => (temCor ? cores.join('') + texto + C.reset : String(texto))

// ── medição ────────────────────────────────────────────────────────────────
// Largura em COLUNAS do terminal, não em caracteres: sequências ANSI ocupam 0
// e emoji ocupam 2. Errar isso desalinha toda borda de caixa.
const RE_ANSI = /\x1b\[[0-9;]*[a-zA-Z]/g

// Só o que o terminal realmente desenha em 2 colunas. Símbolos como ✔ ✖ ● ⚠ ❯
// vivem em U+2500–U+27BF e ocupam 1 — incluí-los aqui desalinharia toda borda.
const RE_EMOJI = /[\u{1F000}-\u{1FAFF}]/u
const RE_CJK = /[\u{1100}-\u{115F}\u{2E80}-\u{A4CF}\u{AC00}-\u{D7A3}\u{F900}-\u{FAFF}\u{FE30}-\u{FE6F}\u{FF00}-\u{FF60}\u{FFE0}-\u{FFE6}]/u
const VS16 = '️' // força apresentação emoji → o char anterior passa a ocupar 2

function larguraDe(ch, proximo) {
  if (ch === VS16) return 0
  if (proximo === VS16) return 2
  return RE_EMOJI.test(ch) || RE_CJK.test(ch) ? 2 : 1
}

export function larguraVisivel(str) {
  const chars = [...String(str).replace(RE_ANSI, '')]
  let largura = 0
  for (let i = 0; i < chars.length; i++) largura += larguraDe(chars[i], chars[i + 1])
  return largura
}

/** Corta preservando as cores (e fecha com reset se cortou no meio de uma). */
export function truncar(str, max) {
  if (larguraVisivel(str) <= max) return str
  let saida = ''
  let largura = 0
  let i = 0
  const s = String(str)

  while (i < s.length) {
    if (s[i] === '\x1b') {
      const m = s.slice(i).match(/^\x1b\[[0-9;]*[a-zA-Z]/)
      if (m) { saida += m[0]; i += m[0].length; continue }
    }
    const resto = [...s.slice(i)]
    const ch = resto[0]
    const w = larguraDe(ch, resto[1])
    if (largura + w > max - 1) break
    saida += ch
    largura += w
    i += ch.length
  }
  return saida + C.reset + pintar('…', C.cinza)
}

export const preencher = (str, largura) => str + ' '.repeat(Math.max(0, largura - larguraVisivel(str)))

// ── tela ───────────────────────────────────────────────────────────────────
export const tela = {
  get largura() { return process.stdout.columns || 100 },
  get altura() { return process.stdout.rows || 30 },
  limpar: () => process.stdout.write('\x1b[2J\x1b[H'),
  irPara: (l, c = 1) => process.stdout.write(`\x1b[${l};${c}H`),
  esconderCursor: () => process.stdout.write('\x1b[?25l'),
  mostrarCursor: () => process.stdout.write('\x1b[?25h'),
  entrarAlt: () => process.stdout.write('\x1b[?1049h'),
  sairAlt: () => process.stdout.write('\x1b[?1049l'),
  escrever: (s) => process.stdout.write(s),
}

// ── caixas ─────────────────────────────────────────────────────────────────
export function caixa(titulo, linhas, largura, { corBorda = C.cinza } = {}) {
  const interna = largura - 2
  const tituloFmt = titulo ? ` ${titulo} ` : ''
  const preenchimento = Math.max(0, interna - larguraVisivel(tituloFmt))

  const saida = [
    pintar('╭', corBorda) + tituloFmt + pintar('─'.repeat(preenchimento) + '╮', corBorda),
  ]
  for (const l of linhas) {
    saida.push(pintar('│', corBorda) + preencher(truncar(l, interna), interna) + pintar('│', corBorda))
  }
  saida.push(pintar('╰' + '─'.repeat(interna) + '╯', corBorda))
  return saida
}

export function cabecalho(subtitulo = '') {
  const l = tela.largura
  const marca = pintar(' ▪▪▪ HabitHub ', C.verde, C.negrito) + pintar('control ', C.cinza)
  const dir = subtitulo ? pintar(subtitulo + ' ', C.cinza) : ''
  const meio = Math.max(0, l - larguraVisivel(marca) - larguraVisivel(dir))
  return marca + ' '.repeat(meio) + dir
}

// ── teclado ────────────────────────────────────────────────────────────────
let ouvinte = null

function garantirRaw() {
  if (process.stdin.isTTY) process.stdin.setRawMode(true)
  process.stdin.resume()
  process.stdin.setEncoding('utf8')
}

export function pararTeclado() {
  if (ouvinte) { process.stdin.off('data', ouvinte); ouvinte = null }
  if (process.stdin.isTTY) process.stdin.setRawMode(false)
  process.stdin.pause()
}

/** Chama `aoTeclar(nome)` a cada tecla. Nomes: 'cima','baixo','enter','esc','ctrl-c' ou o char. */
export function ouvirTeclas(aoTeclar) {
  pararTeclado()
  garantirRaw()
  ouvinte = (dados) => {
    for (const seq of separarSequencias(dados)) aoTeclar(nomearTecla(seq))
  }
  process.stdin.on('data', ouvinte)
  return pararTeclado
}

function separarSequencias(dados) {
  // teclas coladas no mesmo chunk (paste, repeat rápido) precisam ser separadas
  const partes = []
  let i = 0
  while (i < dados.length) {
    if (dados[i] === '\x1b' && dados[i + 1] === '[') {
      const m = dados.slice(i).match(/^\x1b\[[0-9;]*[A-Za-z~]/)
      if (m) { partes.push(m[0]); i += m[0].length; continue }
    }
    partes.push(dados[i])
    i++
  }
  return partes
}

function nomearTecla(seq) {
  switch (seq) {
    case '\x1b[A': return 'cima'
    case '\x1b[B': return 'baixo'
    case '\x1b[C': return 'direita'
    case '\x1b[D': return 'esquerda'
    case '\r': case '\n': return 'enter'
    case '\x1b': return 'esc'
    case '\x03': return 'ctrl-c'
    case '\x7f': case '\b': return 'backspace'
    case ' ': return 'espaco'
    default: return seq
  }
}

// ── menu ───────────────────────────────────────────────────────────────────
/**
 * Menu vertical navegável. Resolve com o `id` do item, ou null se o usuário saiu.
 * Itens: { id, rotulo, dica?, desativado?, motivo? }
 */
export function menu({ titulo, itens, rodape = '', aoDesenharTopo }) {
  return new Promise((resolve) => {
    // `separador: ''` (linha em branco) também é separador — testar por presença, não por verdade
    const ehSeparador = (i) => i.separador !== undefined
    const selecionaveis = itens.filter((i) => !ehSeparador(i))
    let sel = itens.findIndex((i) => !ehSeparador(i) && !i.desativado)
    if (sel < 0) sel = 0

    const desenhar = () => {
      tela.limpar()
      tela.escrever(cabecalho(titulo) + '\n\n')
      if (aoDesenharTopo) tela.escrever(aoDesenharTopo() + '\n')

      itens.forEach((item, idx) => {
        if (ehSeparador(item)) {
          tela.escrever(item.separador ? '  ' + pintar(item.separador, C.cinza, C.negrito) + '\n' : '\n')
          return
        }
        const ativo = idx === sel
        const marca = ativo ? pintar(' ❯ ', C.verde, C.negrito) : '   '
        const numero = selecionaveis.indexOf(item) + 1
        const tecla = numero <= 9 ? pintar(`${numero} `, ativo ? C.branco : C.cinza) : '  '

        let rotulo = item.desativado
          ? pintar(item.rotulo, C.cinza)
          : ativo ? pintar(item.rotulo, C.branco, C.negrito) : item.rotulo

        const dica = item.desativado && item.motivo
          ? pintar(`  ← ${item.motivo}`, C.amarelo, C.fraco)
          : item.dica ? pintar(`  ${item.dica}`, C.cinza) : ''

        tela.escrever(marca + tecla + rotulo + dica + '\n')
      })

      tela.escrever('\n' + pintar('  ↑↓/jk mover · enter escolher · 1-9 atalho · q sair', C.cinza) + '\n')
      if (rodape) tela.escrever(pintar('  ' + rodape, C.cinza, C.fraco) + '\n')
    }

    const mover = (passo) => {
      let i = sel
      for (let n = 0; n < itens.length; n++) {
        i = (i + passo + itens.length) % itens.length
        if (!ehSeparador(itens[i])) { sel = i; break }
      }
      desenhar()
    }

    const parar = ouvirTeclas((tecla) => {
      if (tecla === 'cima' || tecla === 'k') return mover(-1)
      if (tecla === 'baixo' || tecla === 'j') return mover(1)

      if (tecla === 'enter') {
        const item = itens[sel]
        if (item.desativado || ehSeparador(item)) return
        parar(); tela.limpar(); return resolve(item.id)
      }
      if (/^[1-9]$/.test(tecla)) {
        const item = selecionaveis[Number(tecla) - 1]
        if (item && !item.desativado) { parar(); tela.limpar(); return resolve(item.id) }
        return
      }
      if (tecla === 'q' || tecla === 'esc' || tecla === 'ctrl-c') {
        parar(); tela.limpar(); return resolve(null)
      }
    })

    desenhar()
  })
}

/** Prompt de texto de uma linha. Resolve com a string (ou null se cancelou). */
export function perguntar(rotulo, { padrao = '', dica = '' } = {}) {
  return new Promise((resolve) => {
    let buffer = padrao

    const desenhar = () => {
      tela.limpar()
      tela.escrever(cabecalho() + '\n\n')
      tela.escrever('  ' + pintar(rotulo, C.branco, C.negrito) + '\n')
      if (dica) tela.escrever('  ' + pintar(dica, C.cinza) + '\n')
      tela.escrever('\n  ' + pintar('›', C.verde) + ' ' + buffer + pintar('█', C.verde) + '\n')
      tela.escrever('\n' + pintar('  enter confirma · esc cancela', C.cinza) + '\n')
    }

    const parar = ouvirTeclas((tecla) => {
      if (tecla === 'enter') { parar(); tela.limpar(); return resolve(buffer.trim()) }
      if (tecla === 'esc' || tecla === 'ctrl-c') { parar(); tela.limpar(); return resolve(null) }
      if (tecla === 'backspace') { buffer = buffer.slice(0, -1); return desenhar() }
      if (tecla === 'espaco') { buffer += ' '; return desenhar() }
      if (tecla.length === 1 && tecla >= ' ') { buffer += tecla; return desenhar() }
    })

    desenhar()
  })
}

/** Pausa até uma tecla. Usado depois de rodar um comando, pra dar tempo de ler a saída. */
export function aguardarTecla(mensagem = 'qualquer tecla pra voltar') {
  return new Promise((resolve) => {
    process.stdout.write('\n' + pintar(`  ── ${mensagem} ──`, C.cinza) + '\n')
    const parar = ouvirTeclas(() => { parar(); resolve() })
  })
}

/** Barra de progresso horizontal, usada na tabela de coverage. */
export function barra(pct, largura = 16) {
  const cheio = Math.round((Math.max(0, Math.min(100, pct)) / 100) * largura)
  const c = pct >= 90 ? C.verde : pct >= 70 ? C.amarelo : C.vermelho
  return pintar('█'.repeat(cheio), c) + pintar('░'.repeat(largura - cheio), C.cinza)
}
