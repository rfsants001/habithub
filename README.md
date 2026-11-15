<div align="center">

<img src="web/public/brand.svg" alt="" width="64" height="64">

# HabitHub

**Sua rotina, no seu ritmo.**

Marque o que você fez hoje e veja sua rotina ganhar cor, um quadradinho de cada vez.

</div>

O HabitHub é um app de hábitos para uso pessoal. Ele roda na sua própria máquina ou servidor, guarda os dados em SQLite e funciona no navegador de computador e celular. A interface é em português e a instalação padrão dispensa cadastro e serviços de terceiros.

- **Hoje:** crie um hábito, registre em um toque e desfaça se precisar. Escolha entre todo dia e uma frequência flexível de dias por semana.
- **Histórico:** consulte os dias marcados no calendário de cada hábito ou veja o mapa anual de uma categoria. É possível registrar em datas anteriores e incluir uma nota.
- **Organizar:** edite categorias, arquive e restaure hábitos sem perder o histórico e baixe uma cópia dos seus dados.

![Tela Hoje do HabitHub com hábitos fictícios](docs/preview.png)

## Rodar na sua máquina

Com Docker e Compose:

```sh
docker compose up -d --build
```

Abra `http://localhost:8080`. A interface e a API ficam no mesmo endereço; por padrão, o acesso é permitido apenas a partir da própria máquina. O volume `habits` guarda o SQLite entre reinicializações. As migrações são executadas na inicialização, inclusive para bancos do MVP.

Para usar por outro aparelho, configure o acesso com uma VPN privada ou um proxy com HTTPS e autenticação na frente de **toda a aplicação**, incluindo `/api`. O HabitHub é para uma pessoa por instância e não tem autenticação própria. **Código público e instância pública são escolhas diferentes**: não exponha seu histórico à internet. Veja [self-hosting e recuperação](docs/self-hosting.md).

## Desenvolvimento

Requer Node.js 24 e npm. A API usa `better-sqlite3`, que pode precisar de Python e ferramentas C/C++ se não houver binário para sua plataforma.

```sh
npm run setup
npm run dev:api  # terminal 1
npm run dev:web  # terminal 2
```

Abra `http://localhost:5173`. A API usa `api/habithub.db` por padrão, sem preencher dados de demonstração. Para uma demo separada:

```sh
DB_FILE=/tmp/habithub-demo.db npm run db:migrate
DB_FILE=/tmp/habithub-demo.db npm run seed:showcase
DB_FILE=/tmp/habithub-demo.db npm run dev:api
```

Antes de contribuir, rode `npm run verify` e `npm run build`. Para estrutura dos pacotes, acessibilidade e planos futuros, veja [notas de produto](docs/product.md) e [roteiro de acessibilidade](docs/accessibility.md). Os ícones são da biblioteca [Lucide](https://lucide.dev/).
