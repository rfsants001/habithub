/**
 * proc.mjs — processos filhos: os de longa duração (dev servers) e os de um tiro (testes, migrations).
 */
import { spawn } from 'node:child_process'
import process from 'node:process'

const LIMITE_BUFFER = 800 // linhas guardadas por processo (ring buffer)
const PRAZO_SIGKILL = 2000 // quanto esperamos o SIGTERM antes de escalar

// Todo serviço vivo. Os filhos são `detached` (grupo próprio), então nenhum
// sinal que chega na TUI chega neles: quem sai tem que matar explicitamente,
// senão sobra órfão segurando :3000/:5173.
const vivos = new Set()

/**
 * Best-effort SÍNCRONO — para os handlers de saída da TUI (`exit`, SIGINT,
 * SIGTERM, crash), onde não dá pra aguardar promise.
 */
export function pararTodosJa() {
  for (const s of vivos) {
    const pid = s.filho?.pid
    if (!pid) continue
    try { process.kill(-pid, 'SIGTERM') }
    catch { try { process.kill(pid, 'SIGTERM') } catch { /* já morreu */ } }
  }
  vivos.clear()
}

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
    this.pedidoDeParada = false // distingue "eu mandei parar" de "caiu sozinho"
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
    this.pedidoDeParada = false

    const filho = spawn(this.comando, this.args, {
      cwd: this.cwd,
      // detached: o dev server gera netos (esbuild, workers). Sem grupo próprio,
      // matar o pai deixa órfão segurando a porta — e o próximo start falha.
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1' }, // mantém cor mesmo saindo por pipe
    })
    this.filho = filho
    vivos.add(this)

    filho.stdout.setEncoding('utf8')
    filho.stderr.setEncoding('utf8')
    filho.stdout.on('data', (d) => this.#anotar(d))
    filho.stderr.on('data', (d) => this.#anotar(d, 'erro'))

    // `filho` (local) e não `this.filho`: num restart o processo velho ainda
    // emite 'exit' depois do novo ter subido, e sem esta guarda ele apagaria
    // o estado do novo — a TUI mostraria "saiu" com o servidor no ar.
    filho.on('exit', (codigo, sinal) => {
      if (this.filho !== filho) return
      this.codigoSaida = codigo
      // 'saiu'/'falhou' = morreu sozinho (é o que você quer ver no painel).
      // tsx e vite tratam SIGTERM e saem com 0, daí a intenção valer mais que o código.
      this.estado = this.pedidoDeParada || sinal ? 'parado' : codigo === 0 ? 'saiu' : 'falhou'
      this.filho = null
      vivos.delete(this)
      this.#anotar(`\n[${this.nome}] processo encerrado (código ${codigo ?? sinal})\n`, 'meta')
    })

    filho.on('error', (err) => {
      if (this.filho !== filho) return
      this.estado = 'falhou'
      this.filho = null
      vivos.delete(this)
      this.#anotar(`[${this.nome}] falha ao executar: ${err.message}\n`, 'erro')
    })

    this.#notificar()
  }

  /** Resolve só quando o processo morreu de fato. Sempre aguarde antes de subir de novo. */
  parar() {
    const filho = this.filho
    if (!filho) return Promise.resolve()
    const pid = filho.pid
    this.pedidoDeParada = true

    const sinalizar = (sinal) => {
      try { process.kill(-pid, sinal) }              // '-pid' = o grupo inteiro (pai + netos)
      catch { try { process.kill(pid, sinal) } catch { /* já morreu */ } }
    }

    return new Promise((resolve) => {
      const pronto = () => { clearTimeout(kill); clearTimeout(desistir); resolve() }
      filho.once('exit', pronto)

      sinalizar('SIGTERM')

      // Escalonamento: dev server que ignora SIGTERM (ou trava fechando socket)
      // deixaria a porta ocupada e o próximo start falharia. 2s e vai SIGKILL.
      const kill = setTimeout(() => sinalizar('SIGKILL'), PRAZO_SIGKILL)
      // Nem o SIGKILL pode travar a TUI pra sempre — avisa e segue.
      const desistir = setTimeout(() => {
        this.#anotar(`\n[${this.nome}] não morreu nem com SIGKILL — confira a porta ${this.porta ?? '?'}\n`, 'erro')
        pronto()
      }, PRAZO_SIGKILL + 1000)
      kill.unref?.()
      desistir.unref?.()
    })
  }

  async reiniciar() {
    await this.parar()   // sem o await, o iniciar() abaixo cai no guard de 'rodando' e não sobe nada
    this.iniciar()
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
