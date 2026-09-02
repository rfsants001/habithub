/**
 * painel.mjs — o dashboard split: API e WEB rodando lado a lado, cada um com seu log.
 *
 * Sem tmux e sem dependência: o split é desenhado aqui, linha a linha.
 * (`t` abre a mesma coisa em tmux de verdade, pra quem quer scroll e copy-mode.)
 */
import { C, caixa, cabecalho, ouvirTeclas, pintar, tela, truncar } from './ui.mjs'

const LARGURA_MINIMA_LADO_A_LADO = 100

const ICONE = {
  rodando: pintar('●', C.verde),
  parado: pintar('○', C.cinza),
  saiu: pintar('◌', C.amarelo),
  falhou: pintar('✖', C.vermelho),
}

export function abrirPainel(servicos, { ip, aoSairParaTmux }) {
  return new Promise((resolve) => {
    let foco = null          // null = split; senão, o nome do serviço em tela cheia
    let sujo = true
    let seguirFim = true

    const marcarSujo = () => { sujo = true }
    const descartes = servicos.map((s) => s.aoMudar(marcarSujo))

    const timer = setInterval(() => { if (sujo) { sujo = false; desenhar() } }, 100)
    const relogio = setInterval(marcarSujo, 1000) // atualiza o "tempo ativo"
    process.stdout.on('resize', marcarSujo)

    function tituloServico(s, largura) {
      const estado = `${ICONE[s.estado]} ${s.estado}${s.tempoAtivo ? ' ' + s.tempoAtivo : ''}`
      const nome = pintar(s.nome, s.cor, C.negrito)
      const porta = s.porta ? pintar(`:${s.porta}`, C.cinza) : ''
      return truncar(`${nome}${porta} ${estado}`, Math.max(10, largura - 4))
    }

    function corpoLog(s, largura, altura) {
      const visiveis = s.linhas.slice(seguirFim ? -altura : 0, seguirFim ? undefined : altura)
      const linhas = visiveis.map((l) => {
        const texto = l.origem === 'erro' ? pintar(l.texto, C.vermelho)
          : l.origem === 'meta' ? pintar(l.texto, C.cinza, C.fraco)
            : l.texto
        return truncar(texto.replace(/\t/g, '  '), largura - 2)
      })
      while (linhas.length < altura) linhas.push('')
      return linhas
    }

    function desenhar() {
      const L = tela.largura
      const A = tela.altura
      tela.limpar()

      const rotuloTopo = foco ? `dev · foco: ${foco}` : 'dev'
      tela.escrever(cabecalho(`${rotuloTopo}${ip ? ` · ${ip}` : ''}`) + '\n')

      const alturaCorpo = A - 5 // cabeçalho + rodapé + bordas
      const ladoALado = !foco && L >= LARGURA_MINIMA_LADO_A_LADO && servicos.length > 1

      if (foco) {
        const s = servicos.find((x) => x.nome === foco) ?? servicos[0]
        const linhas = caixa(tituloServico(s, L), corpoLog(s, L, alturaCorpo), L, { corBorda: s.cor })
        tela.escrever(linhas.join('\n') + '\n')
      } else if (ladoALado) {
        const largura = Math.floor(L / servicos.length)
        const caixas = servicos.map((s, i) => {
          const w = i === servicos.length - 1 ? L - largura * (servicos.length - 1) : largura
          return caixa(tituloServico(s, w), corpoLog(s, w, alturaCorpo), w, { corBorda: s.cor })
        })
        // costura as colunas linha a linha
        for (let i = 0; i < caixas[0].length; i++) {
          tela.escrever(caixas.map((c) => c[i]).join('') + '\n')
        }
      } else {
        // terminal estreito: empilhado
        const cada = Math.floor((alturaCorpo - servicos.length * 2) / servicos.length)
        for (const s of servicos) {
          tela.escrever(caixa(tituloServico(s, L), corpoLog(s, L, Math.max(3, cada)), L, { corBorda: s.cor }).join('\n') + '\n')
        }
      }

      const atalhos = [
        ['r', 'reiniciar tudo'],
        ['1/2', 'reiniciar api/web'],
        ['f', foco ? 'voltar ao split' : 'focar'],
        ['c', 'limpar log'],
        ['t', 'abrir em tmux'],
        ['q', 'parar e voltar'],
      ]
      tela.escrever(pintar('  ' + atalhos.map(([k, d]) => `${k} ${d}`).join(' · '), C.cinza))
    }

    let encerrando = false

    /** Só resolve depois que todo serviço morreu — quem vem depois (menu, tmux,
     *  ou outro start) precisa das portas 3000/5173 livres. */
    async function encerrar(destino = 'menu', aoFinalizar) {
      if (encerrando) return // 'q' repetido não deve disparar duas rodadas de kill
      encerrando = true

      clearInterval(timer)
      clearInterval(relogio)
      process.stdout.off('resize', marcarSujo)
      descartes.forEach((d) => d())
      pararTeclas()

      tela.limpar()
      tela.escrever(pintar('\n  parando os serviços…\n', C.cinza))
      await Promise.all(servicos.map((s) => s.parar()))

      tela.limpar()
      if (aoFinalizar) await aoFinalizar()
      resolve(destino)
    }

    const pararTeclas = ouvirTeclas((tecla) => {
      switch (tecla) {
        case 'q': case 'esc': case 'ctrl-c': return encerrar('menu')
        case 'r': servicos.forEach((s) => s.reiniciar()); return marcarSujo()
        case '1': servicos[0]?.reiniciar(); return marcarSujo()
        case '2': servicos[1]?.reiniciar(); return marcarSujo()
        case 'c': servicos.forEach((s) => s.limparLog()); return marcarSujo()
        case 'f': {
          const i = foco ? servicos.findIndex((s) => s.nome === foco) : -1
          foco = i + 1 < servicos.length ? servicos[i + 1].nome : null
          return marcarSujo()
        }
        // o tmux sobe os mesmos servidores: só depois que estes soltarem as portas
        case 't': return encerrar('menu', aoSairParaTmux)
        default: return undefined
      }
    })

    for (const s of servicos) s.iniciar()
    desenhar()
  })
}
