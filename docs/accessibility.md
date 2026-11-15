# Acessibilidade e usabilidade

Referência: [WCAG 2.2 nível AA](https://www.w3.org/TR/WCAG22/) e [heurísticas de Nielsen](https://www.nngroup.com/articles/ten-usability-heuristics/). Este é um roteiro de verificação, não uma declaração formal de conformidade.

| Área | O que verificar |
| --- | --- |
| Teclado e foco | O primeiro Tab revela o atalho para o conteúdo. Navegação, calendário, menu e formulários funcionam com teclado. O foco entra no diálogo e volta à origem no cancelamento. Escape fecha o diálogo. O foco permanece visível. |
| Leitor de tela | Verifique navegação, títulos, campos e nomes das ações em NVDA/Firefox ou VoiceOver/Safari; ao marcar, ouça a confirmação e use Desfazer. Selecione um dia no calendário com registro. |
| Contraste e informação | Os estados usam texto, ícones e, quando aplicável, cor. O grafo tem resumo numérico. Verifique 4,5:1 para texto normal e 3:1 para os controles e indicadores relevantes. |
| Reflow e zoom | Em desktop, teste zoom de 200% e largura de 320 CSS px; mantenha o conteúdo legível sem rolagem da página em duas dimensões. O mapa anual tem uma região de rolagem própria e alternativa textual. |
| Fluxo e erros | Crie um hábito e marque hoje; desfaça, tente registrar duas vezes, navegue em meses e arquive/restaure. Simule falha de rede no carregamento e confirme que o erro fornece recuperação. |
| Preferências | Ative movimento reduzido e alto contraste. Os elementos interativos preservam foco, nome e estado. |

Erros de comunicação aparecem com texto de recuperação, registros são reversíveis, ações que removem dados têm confirmação e o fluxo principal usa linguagem comum. Valide também com uma pessoa que ainda não conhece o HabitHub. Sugestão de tarefa: “crie um hábito, marque, corrija um toque errado e encontre os dias em que você o fez”.

Na revisão desta versão, o axe em Chromium não apontou violações nas verificações WCAG configuradas para Hoje, Histórico, Organizar e o formulário de criação. Também foram testados o fluxo principal por navegador, o atalho de teclado, o foco no diálogo e o retorno após Escape, e o layout a 320 CSS px. As verificações manuais de leitor de tela continuam no roteiro acima.
