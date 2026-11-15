# Self-hosting

Por padrão, o Compose publica o HabitHub apenas em `127.0.0.1:8080`. A API e o volume SQLite ficam na rede interna do Compose. `HABITHUB_PORT` muda a porta externa; `TZ` controla a data e a semana usadas para registros (padrão `America/Sao_Paulo`). O navegador e o celular mostram o mesmo “hoje” definido pela instância.

Exemplo de `.env` para mudar a porta e o fuso:

```dotenv
HABITHUB_PORT=8765
TZ=America/Sao_Paulo
```

Para acesso remoto, mantenha a aplicação atrás de VPN privada ou de um proxy que controle acesso a todas as rotas. TLS sozinho não restringe acesso. Altere `HABITHUB_BIND_IP` somente se o proxy/VPN exigir e escolha um endereço privado. O Vite e o browser usam `/api`, sem CORS aberto. O aplicativo não implementa contas, segregação de usuários ou sincronização offline.

## Migrar da versão anterior

1. Pare a instância anterior e faça uma cópia do SQLite antes de subir a nova. Um arquivo SQLite não deve ser copiado enquanto outra instância estiver escrevendo nele.
2. Para continuar fora do Docker, informe o mesmo caminho absoluto em `DB_FILE` ao executar `npm run dev:api` ou `npm --prefix api start`.
3. Para levar esse banco ao Docker, coloque a cópia em um volume acessível ao usuário `node` do contêiner em `/data/habithub.db`. Garanta que `api` esteja parado e nunca sobrescreva um banco ativo.
4. A migração acrescenta uma frequência diária aos hábitos antigos e preserva registros existentes, inclusive múltiplos registros da mesma data. Novos registros da mesma data são tratados como a mesma marcação.

## Fazer backup e restaurar

Em **Organizar → Backup**, baixe o JSON. O arquivo inclui nomes, notas e datas. Guarde-o em um lugar privado. Para restaurar, aponte o comando a um arquivo SQLite novo. A restauração não apaga nem mescla um banco preenchido.

```sh
DB_FILE="$PWD/habithub-restaurado.db" npm run backup:restore -- "$PWD/habithub-backup.json"
DB_FILE="$PWD/habithub-restaurado.db" npm --prefix api start
```

Se estiver em Docker, passe o JSON como volume somente de leitura e crie um banco separado no volume de dados:

```sh
docker compose run --rm -e DB_FILE=/data/habithub-restaurado.db \
  -v "$PWD/habithub-backup.json:/backup.json:ro" api \
  npm run backup:restore -- /backup.json
```

Confira a cópia restaurada antes de adotá-la. Para manter esse arquivo como banco ativo no Compose, use um override que defina `services.api.environment.DB_FILE` como `/data/habithub-restaurado.db`. Não remova o volume com `docker compose down -v` se quiser preservar os dados.
