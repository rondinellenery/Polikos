# 🏛️ POLIKOS — Gestão inteligente de condomínios

Projeto full stack desenvolvido em **React + Vite, Node.js + Express e SQLite (sql.js)**, a partir dos requisitos do projeto *Condomínio Resolva*. O POLIKOS é o novo nome da plataforma. Foi preparado para ser estudado e apresentado no **Geração Tech 4.0**.

## 1. Requisitos

- **Node.js 22 LTS** recomendado (mínimo 20.19.0)
- **npm**, instalado junto com o Node.js
- VS Code e terminal Git Bash/PowerShell
- Internet na primeira execução para instalar as dependências npm

## 2. Como executar (um terminal, Windows / Git Bash)

Extraia o ZIP. No terminal do VS Code, entre na pasta que contém `package.json` da **raiz**:

```bash
cd polikos
cp .env.example .env
npm install
npm run dev
```

**No PowerShell**, copie o ambiente com `Copy-Item .env.example .env`.

Abra **http://localhost:5173** no navegador.

> **Atenção:** execute `npm install` e `npm run dev` na pasta **polikos** (raiz), e não dentro de `client/src`, porque o projeto usa **npm workspaces**. O npm instala o frontend e o backend simultaneamente.

### Contas de demonstração

| Perfil | E-mail | Senha |
|---|---|---|
| Síndico / administrador | `admin@polikos.local` | `Admin@12345` |
| Morador | `morador@polikos.local` | `Morador@12345` |

Código de cadastro de novo morador: **`POLIKOS2026`**.

Essas informações funcionam no modo local e são intencionalmente públicas para fins de aula. **Não as utilize em produção.**

Os dados iniciais incluem um condomínio, um síndico, um morador e cinco chamados de exemplo. Após o primeiro uso, novos chamados, contas e atualizações são persistidos em `server/data/polikos.sqlite`.

## 3. Comandos npm

| Comando (na raiz) | Ação |
|---|---|
| `npm install` | Instala todas as dependências dos workspaces |
| `npm run dev` | Inicia o backend e frontend em **um terminal** |
| `npm run test` | Executa testes de validação e integração da API |
| `npm run build` | Gera o frontend final em `client/dist` |
| `npm run check` | Testes e build |
| `npm start` | Executa o servidor Express (serve o build, se existir) |

A API fica em **http://localhost:3001**; o Vite usa a porta **5173** e redireciona `/api` para o backend.

## 4. Funcionalidades implementadas

**EP01 — Autenticação e acesso:** login, logout com confirmação, cadastro do morador, recuperação de senha por token temporário, perfis separados e proteção no backend.

**EP02 — Abertura de chamados:** título, categoria, localização, bloco, prioridade, descrição e foto opcional de até 3 MB. Identificador e data/hora automáticos.

**EP03 — Acompanhamento:** listagem individual, pesquisa, filtros, detalhes e linha do tempo do chamado com histórico permanente.

**EP04 — Administração:** painel com indicadores, listagem do condomínio, moradores, pesquisa e filtros, respostas e movimentação de status (`Aberto → Em análise → Em manutenção → Resolvido`). Exige resumo ao resolver.

**EP05 — Notificações:** avisos internos quando a administração responde ou altera o status; marcação de lidas.

**EP06 — Avaliações:** avaliação de 1 a 5 estrelas, com comentário opcional, somente após resolução e uma por chamado.

**Adicional:** relatórios de categorias, prioridade, evolução mensal e nota média do atendimento.

## 5. Estrutura

```text
polikos/
├── package.json                 # npm workspaces e comando único de execução
├── .env.example                 # variáveis de ambiente
├── client/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── App.jsx              # rotas
│       ├── main.jsx
│       ├── api.js                # requisições HTTP
│       ├── context/AuthContext.jsx
│       ├── components/          # layout e componentes comuns
│       ├── pages/               # telas de cada fluxo
│       └── styles.css
└── server/
    ├── package.json
    ├── src/
    │   ├── index.js             # inicia servidor
    │   ├── app.js               # rotas da API REST
    │   ├── auth.js              # sessão e permissões
    │   ├── db.js                # banco SQLite e dados de demonstração
    │   └── validation.js        # validações e regras de negócio
    └── tests/                   # testes unitários e de integração
```

## 6. Tecnologias e o que estudar

1. **Componentes React**: `Layout.jsx`, `Shared.jsx` e componentes de páginas.
2. **Props e estado (useState)**: formulários e filtros nas páginas.
3. **useEffect**: busca de dados na API ao abrir telas.
4. **React Router**: navegação por rotas em `App.jsx`.
5. **Context API**: login e sessão do usuário.
6. **Fetch e JSON**: serviço `api.js`, comunicando React e Express.
7. **Node / Express**: endpoints REST, middleware e regras de acesso.
8. **SQL**: tabelas para moradores, chamados, movimentações, anexos, notificações e avaliações.
9. **Git**: commits e versionamento no GitHub.

## 7. Autenticação e segurança

- Senhas guardadas como hash bcrypt (nunca senha em texto no banco).
- JWT de sessão em cookie HttpOnly, SameSite=Lax (JavaScript do navegador não lê o cookie).
- Restrição real por perfil e proprietário em todas as operações no backend.
- SQL parametrizado, limitação de tamanho de requisições, limite de tentativas de login.
- Validação de tamanho, tipo de arquivo e assinatura para anexos.
- O banco e os anexos ficam fora da pasta pública do site.

**Importante:** o aplicativo é uma demonstração funcional / MVP educacional, **não um produto auditado para condomínios reais**. Para produção, configure HTTPS, variáveis seguras, SMTP, backups, observabilidade, política de privacidade e consentimento de dados (LGPD), e revise os controles de segurança e a capacidade de armazenamento do servidor. A persistência com `sql.js` salva o SQLite a cada gravação e foi feita para uso pequeno/local; para produção com múltiplos acessos concorrentes, recomendo migrar para PostgreSQL ou SQLite com transações nativas.

### Recuperação de senha

Em ambiente **local** sem SMTP, o link de redefinição pode aparecer na tela **apenas no modo de demonstração** quando o e-mail informado está cadastrado. Esse comportamento não está habilitado em produção. Para envio real, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` e `APP_URL` no `.env`.

### Produção

A API rejeita o modo `NODE_ENV=production` sem `JWT_SECRET` de 32+ caracteres, `ADMIN_PASSWORD` personalizada e `COOKIE_SECURE=true`. HTTPS é obrigatório para cookies seguros. Configure o servidor de acordo com seu provedor de hospedagem. Não publique a pasta de dados, o arquivo `.env` ou contas de demonstração.

### Dados de teste

Para **reiniciar** o ambiente de demonstração, pare o servidor e apague somente `server/data/polikos.sqlite`; a inicialização irá recriar o banco. **Isso apaga contas e chamados existentes.** Faça backup antes de qualquer exclusão.

## 8. Erros comuns

**`npm ERR! enoent package.json`** — você está na pasta errada. Rode `pwd` (ou `cd`) e verifique se existe `package.json` na pasta atual.

**`npm: command not found`** — instale o Node.js LTS (inclui o npm), depois reabra o terminal.

**`EADDRINUSE 3001` ou `5173`** — outro programa já está usando essa porta; encerre a instância anterior.

**API indisponível** — confira o terminal: ambos os processos devem estar em execução. O Vite depende da API na porta 3001.

**Não aparece a conta de demonstração** — talvez já exista `server/data/polikos.sqlite`, criado por uma execução anterior com credenciais diferentes. Não exclua o banco sem backup.

## 9. Como enviar ao GitHub

```bash
git init
git add .
git commit -m "feat: projeto Polikos full stack"
git branch -M main
git remote add origin URL_DO_SEU_REPOSITORIO
git push -u origin main
```

Se o repositório já existir, **não execute `git init` ou `git remote add` de novo**. Copie as pastas do projeto para seu repositório e faça `git add .`, `git commit` e `git push` na branch correta. Se o repositório tiver arquivos existentes, revise antes de substituir.
