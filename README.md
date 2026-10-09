# TheYep

> A volta da internet divertida, colorida e social, feita para estudantes e escolas.

**Status:** v1 em desenvolvimento 🚧

TheYep é uma rede social leve para a comunidade escolar: você cria sua conta com e-mail, monta seu perfil e acompanha o que a galera da sua escola publica. A interface é em português, funciona bem no celular e pode ser instalada como app (PWA).

## Funcionalidades

### Já funcionando

- Criar conta e entrar com e-mail e senha (Supabase Auth)
- Página de perfil com nome, bio, foto (ou a inicial do nome) e data de entrada. O perfil é criado automaticamente no cadastro
- Sair da conta
- Tema claro e escuro, seguindo o sistema ou escolhido pelo usuário
- Navegação mobile-first: barra de abas no celular e menu no topo no desktop
- PWA: manifesto e ícones para instalar na tela inicial
- Banco com Row Level Security: cada usuário só cria e edita o próprio perfil e só envia arquivos para a própria pasta

### Em construção (escopo da v1)

- Feed geral e feed do campus (a tela inicial ainda é um placeholder)
- Posts com texto e foto, escolhendo quem pode ver
- Curtir e comentar
- Apagar os próprios posts e a própria conta

A base de dados já tem a tabela de escolas e os buckets de fotos (`avatars` e `post-photos`) prontos para essas funções.

## Stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19 + TypeScript
- [Supabase](https://supabase.com/): autenticação, Postgres e Storage (`@supabase/ssr` e `@supabase/supabase-js`)
- [Tailwind CSS 4](https://tailwindcss.com/)
- Ícones [Lucide](https://lucide.dev/) e fonte Nunito (`next/font`)
- ESLint + Prettier

Cores da marca: rosa `#F06292`, azul `#42A5F5` e amarelo `#FFD54F`.

## Estrutura de pastas

```
.
├── public/                  # ícones, favicon, imagem OG e manifest.webmanifest (PWA)
├── src/
│   ├── app/                 # rotas (App Router)
│   │   ├── layout.tsx       # layout raiz, fonte, tema e metadados
│   │   ├── page.tsx         # /        Início (feed)
│   │   ├── postar/          # /postar  Publicar
│   │   ├── perfil/          # /perfil  Login, cadastro e perfil
│   │   ├── error.tsx
│   │   ├── not-found.tsx
│   │   └── globals.css      # tema e cores
│   ├── components/          # Shell (cabeçalho e abas) e painel de perfil
│   ├── lib/
│   │   ├── supabase/        # clientes do Supabase (navegador, servidor e middleware)
│   │   └── relative-time.ts
│   └── middleware.ts        # renova a sessão do Supabase a cada requisição
├── supabase/migrations/     # SQL do banco (tabelas, RLS, trigger e buckets)
├── .env.example             # variáveis de ambiente necessárias
└── next.config.ts
```

## Como rodar localmente

**Pré-requisitos:** Node.js 20 ou superior (testado com Node 22), npm e um projeto gratuito no [Supabase](https://supabase.com/).

1. Clone o repositório e instale as dependências:

   ```bash
   git clone https://github.com/EstiveJobson/theyep.git
   cd theyep
   npm install
   ```

2. Copie o arquivo de exemplo de variáveis de ambiente:

   ```bash
   cp .env.example .env.local
   ```

3. No `.env.local`, preencha com os dados do seu projeto Supabase (em **Project Settings → API**):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
   ```

   Use só a chave `anon`. Nunca coloque a `service_role` no projeto nem commite o `.env.local`.

4. Prepare o banco: abra o **SQL Editor** do Supabase e rode o conteúdo de [`supabase/migrations/0001_foundation.sql`](supabase/migrations/0001_foundation.sql) uma vez. Antes, troque os nomes de exemplo `[ESCOLA_1]`, `[ESCOLA_2]` e `[ESCOLA_3]` pelas escolas reais.

5. Rode o servidor de desenvolvimento:

   ```bash
   npm run dev
   ```

   Abra [http://localhost:8080](http://localhost:8080).

Sem as variáveis do Supabase o app ainda abre, mas o login fica desligado e mostra um aviso.

## Scripts

| Comando             | O que faz                                      |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento na porta 8080      |
| `npm run build`     | Build de produção (gera a pasta `.next-build`) |
| `npm run preview`   | Serve o build de produção em `127.0.0.1:8081`  |
| `npm run typecheck` | Checagem de tipos com o TypeScript             |
| `npm run lint`      | ESLint                                         |
| `npm run format`    | Formata o código com o Prettier                |

> **Windows:** `build` e `preview` definem a variável `NEXT_DIST_DIR` no estilo Linux/macOS, que não funciona no PowerShell nem no CMD. No Windows, rode esses dois pelo Git Bash ou pelo WSL. O `npm run dev` funciona normalmente.

## Deploy na Vercel

1. Importe o repositório na [Vercel](https://vercel.com/new). O framework Next.js é detectado sozinho.
2. Em **Settings → Environment Variables**, cadastre `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Faça o deploy.
4. No Supabase, em **Authentication → URL Configuration**, coloque o domínio da Vercel como _Site URL_ para que os links de confirmação de e-mail funcionem.

## Roadmap

Fica para depois da v1:

- Mensagens diretas e grupos
- The Clips
- Selo de estudante verificado
- Busca

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).

## Autor

Feito por **Sérgio Vieira** · GitHub [@EstiveJobson](https://github.com/EstiveJobson)
