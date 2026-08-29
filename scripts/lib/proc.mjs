/**
 * proc.mjs — processos filhos: os de longa duração (dev servers) e os de um tiro (testes, migrations).
 */
import { spawn } from 'node:child_process'
import process from 'node:process'

const LIMITE_BUFFER = 800 // linhas guardadas por processo (ring buffer)

/**
 * Processo de longa duração, com log capturado em memória.
 * Usado pelos dev servers no painel split.
 */
export class Servico {
  constructor({ nome, cor, comando, args, cwd, porta }) {
    Object.assign(this, { nome, cor, comando, args, cwd, porta })
    this.linhas = []
    this.estado = 'parado' // parado | rodando | saiu | falhou
    this.codigoSaida = null
    this.filho = null
    this.parcial = ''
    this.ouvintes = new Set()
    this.iniciadoEm = null
  }

  aoMudar(fn) { this.ouvintes.add(fn); return () => this.ouvintes.delete(fn) }
  #notificar() { for (const fn of this.ouvintes) fn(this) }

  #anotar(texto, origem = 'saida') {
    this.parcial += texto
    const partes = this.parcial.split('\n')
    this.parcial = partes.pop() ?? ''
    for (const linha of partes) {
      this.linhas.push({ texto: linha, origem, ts: Date.now() })
    }
    if (this.linhas.length > LIMITE_BUFFER) {
      this.linhas.splice(0, this.linhas.length - LIMITE_BUFFER)
    }
    this.#notificar()
  }

  iniciar() {
    if (this.estado === 'rodando') return
    this.estado = 'rodando'
    this.codigoSaida = null
    this.iniciadoEm = Date.now()

    this.filho = spawn(this.comando, this.args, {
      cwd: this.cwd,
      // detached: o dev server gera netos (esbuild, workers). Sem grupo próprio,
      // matar o pai deixa órfão segurando a porta — e o próximo start falha.
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }, // mantém cor mesmo saindo por pipe
    })

    this.filho.stdout.setEncoding('utf8')
    this.filho.stderr.setEncoding('utf8')
    this.filho.stdout.on('data', (d) => this.#anotar(d))
    this.filho.stderr.on('data', (d) => this.#anotar(d, 'erro'))

    this.filho.on('exit', (codigo, sinal) => {
      clearTimeout(this.timerKill)
      this.codigoSaida = codigo
      this.estado = codigo === 0 || sinal ? 'saiu' : 'falhou'
      this.#anotar(`\n[${this.nome}] processo encerrado (código ${codigo ?? sinal})\n`, 'meta')
      this.filho = null
    })

    this.filho.on('error', (err) => {
      this.estado = 'falhou'
      this.#anotar(`[${this.nome}] falha ao executar: ${err.message}\n`, 'erro')
      this.filho = null
    })

    this.#notificar()
  }

  parar() {
    if (!this.filho) return
    const pid = this.filho.pid

    const sinalizar = (sinal) => {
      try { process.kill(-pid, sinal) }              // '-pid' = o grupo inteiro (pai + netos)
      catch { try { process.kill(pid, sinal) } catch { /* já morreu */ } }
    }

    sinalizar('SIGTERM')

    // Escalonamento: dev server que ignora SIGTERM (ou trava fechando socket)
    // deixaria a porta ocupada e o próximo start falharia. 2s e vai SIGKILL.
    this.timerKill = setTimeout(() => {
      if (this.filho?.pid === pid) sinalizar('SIGKILL')
    }, 2000)
    this.timerKill.unref?.()
  }

  reiniciar() {
    this.parar()
    setTimeout(() => this.iniciar(), 350)
  }

  limparLog() { this.linhas = []; this.#notificar() }

  get tempoAtivo() {
    if (this.estado !== 'rodando' || !this.iniciadoEm) return ''
    const seg = Math.floor((Date.now() - this.iniciadoEm) / 1000)
    return seg < 60 ? `${seg}s` : `${Math.floor(seg / 60)}m${String(seg % 60).padStart(2, '0')}`
  }
}

/**
 * Comando de um tiro, herdando o terminal (o usuário vê a saída nativa,
 * com as cores e o formato originais do vitest/drizzle/tsc).
 * Resolve com o código de saída.
 */
export function executar(comando, args, { cwd, env } = {}) {
  return new Promise((resolve) => {
    const filho = spawn(comando, args, {
      cwd,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1', ...env },
    })
    filho.on('exit', (codigo) => resolve(codigo ?? 1))
    filho.on('error', (err) => {
      console.error(`\n  Falha ao executar ${comando}: ${err.message}\n`)
      resolve(1)
    })
  })
}

/** Executa capturando a saída (sem mostrar). Para comandos auxiliares curtos. */
export function capturar(comando, args, { cwd } = {}) {
  return new Promise((resolve) => {
    const filho = spawn(comando, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let saida = ''
    filho.stdout.on('data', (d) => { saida += d })
    filho.stderr.on('data', (d) => { saida += d })
    filho.on('exit', (codigo) => resolve({ codigo: codigo ?? 1, saida: saida.trim() }))
    filho.on('error', () => resolve({ codigo: 1, saida: '' }))
  })
}
