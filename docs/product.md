# Decisões de produto

A versão web é a referência para **Hoje**, **Histórico** e **Organizar**. A biblioteca de ícones é Lucide; a marca usa um SVG próprio que combina quadradinhos e uma marca de conclusão. A UI usa fontes do sistema, sem fontes externas ou telemetria. O visual retrô aparece na marca, no âmbar e no mapa anual.

- Um hábito diário fica em dia quando foi marcado hoje. Um hábito semanal fica em dia ao atingir sua meta de dias distintos entre segunda e domingo. É possível registrar em mais dias ainda naquela semana.
- “Desfazer” remove o registro recém-criado. Uma marcação antiga pode ser removida no calendário com confirmação. Arquivar retira o hábito da rotina sem apagar o histórico.
- O mapa anual é uma leitura de atividade por categoria. A visão mensal responde em que datas um hábito foi feito. Os dados do mapa também estão disponíveis em texto.

## Desktop primeiro, mobile depois

Faz sentido como etapa, desde que o desktop tenha propósito próprio: **rodar offline, sem servidor instalado pelo usuário, com SQLite e backup local**. A próxima entrega seria um teste empacotado de Linux com um banco novo e um backup restaurado. Só depois valeria expandir os instaladores.

- **Electron** é a primeira opção a testar para reaproveitar React, Node e SQLite. O trabalho específico é empacotar e recompilar `better-sqlite3` para o Electron, guardar os dados no diretório do usuário e isolar o renderer. [Módulos nativos no Electron](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).
- **Tauri** é uma alternativa se houver disposição para manter Rust ou empacotar a API Node como processo auxiliar por plataforma. [Sidecars do Tauri](https://v2.tauri.app/develop/sidecar/).
- **Mobile:** reaproveitar a interface React com Capacitor é possível, mas o SQLite do Node atual não roda no celular. Antes de empacotar, separar as regras de hábito da API e introduzir um adaptador de armazenamento no dispositivo. O objetivo é abrir, registrar e recuperar backup sem rede. [Capacitor](https://capacitorjs.com/docs).

Metas com prazo, lembretes e Git real são candidatos posteriores. O web self-hosted atual requer um servidor alcançável mesmo quando acessado pelo celular.
