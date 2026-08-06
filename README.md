# opencode-samira-agent

Serviço de IA/API independente para o projeto **Samira Revela**, alimentado pela
API NVIDIA (modelo `deepseek-ai/deepseek-v4-flash`). Roda continuamente no Railway.

## Arquitetura

```
SITE SAMIRA REVELA
     │  POST /api/chat (Authorization: Bearer AGENT_API_KEY)
     ▼
Open Code Samira Agent  (Fastify, este serviço)
     │  Agent Loop + contexto + memória persistente (PostgreSQL)
     ▼
deepseek-v4-flash (NVIDIA)  →  resposta JSON  →  SITE SAMIRA REVELA
```

- **Evolution API / WhatsApp = responsabilidade do site.**
- **Este serviço = inteligência, contexto, memória e geração de respostas.**

```
Client -> HTTP API (Fastify) -> Samira Agent Service -> NVIDIA API -> deepseek-v4-flash
```

## Endpoints

| Método | Rota                 | Auth                     | Descrição                                              |
|--------|----------------------|--------------------------|--------------------------------------------------------|
| GET    | `/`                  | -                        | Página de chat de teste (abre no navegador)            |
| GET    | `/health`            | -                        | Healthcheck do Railway (`{ status: "ok" }`)            |
| GET    | `/api/status`        | -                        | Status sanitizado (sem segredos)                       |
| POST   | `/api/chat`          | `Bearer <AGENT_API_KEY>` | Chat público consumido pelo site                       |
| POST   | `/api/agent`         | -                        | Endpoint legado de agente (compatibilidade)            |
| POST   | `/webhook/evolution` | `x-webhook-secret`       | Webhook Evolution API (MVP)                            |
| GET    | `/api/evolution/health` | -                     | Healthcheck da Evolution API                           |

### POST /api/chat

**Request:**

```json
{
  "conversationId": "samira-cliente-123",
  "message": "Olá, meu nome é João.",
  "directives": "Seja educada. Responda sempre em português e nunca prometa prazos."
}
```

- `directives` é **opcional** e carrega as regras/diretrizes treinadas no painel do
  site. Quando enviado, o agente injeta esse texto no **system prompt** do modelo,
  de modo que a Samira passa a seguir as regras do site por cima da identidade base.

**Response (200):**

```json
{
  "conversationId": "samira-cliente-123",
  "response": "Olá, João! Como posso ajudar?",
  "model": "deepseek-ai/deepseek-v4-flash",
  "latencyMs": 7421
}
```

- O `conversationId` identifica a conversa. Mensagens com o **mesmo** id
  compartilham o mesmo histórico; ids **diferentes** nunca misturam contexto.
- O histórico é recuperado do PostgreSQL antes de chamar o deepseek-v4-flash e a resposta é
  persistida depois. Sem `DATABASE_URL`, o serviço cai para memória RAM
  (degradado; estado some no restart).
- **Auth:** o header `Authorization: Bearer <AGENT_API_KEY>` é obrigatório.
  Sem ele → `401`. Sem `AGENT_API_KEY` configurada no servidor → `503`.

### Página de chat de teste (GET /)

Abra a URL pública do Railway no navegador, cole a `AGENT_API_KEY` no campo
superior (ela fica só no navegador, via localStorage — nunca é embarcada na
página), e converse com o agente. A página mantém o `conversationId`, mostra
loading/erros e permite nova conversa / limpar a tela.

## Variáveis de ambiente

| Variável            | Obrigatória | Default         | Descrição                                            |
|---------------------|-------------|-----------------|------------------------------------------------------|
| `PORT`              | não         | `3000`          | Porta HTTP (Railway injeta)                          |
| `NVIDIA_API_KEY`    | **sim**     | -               | Chave da NVIDIA (somente no backend)                 |
| `AGENT_API_KEY`     | **sim**     | -               | Bearer token do `/api/chat` (somente no backend)     |
| `ALLOWED_ORIGINS`   | não         | (vazio = bloqueia cross-origin) | Origem(s) CORS permitidas |
| `DATABASE_URL`      | não         | -               | PostgreSQL (Neon/Railway) para memória persistente   |
| `SERVICE_NAME`      | não         | -               | Nome exibido em `/api/status`                        |
| `SERVICE_VERSION`   | não         | -               | Versão do serviço                                    |
| `LOG_LEVEL`         | não         | `info`          | Nível do pino                                        |
| `AGENT_MODEL`       | não         | `deepseek-ai/deepseek-v4-flash`  | Id do modelo NVIDIA                                  |
| `AGENT_MAX_TOKENS`  | não         | `1024`          | Máx. de tokens da resposta                           |

> Nunca envie `NVIDIA_API_KEY` nem `AGENT_API_KEY` para o frontend e nunca os
> coloque em logs ou respostas. Copie `.env.example` para `.env` localmente.

### Como configurar AGENT_API_KEY

Gere uma chave forte e defina-a **somente** no backend (Railway dashboard ou
`.env` local):

```bash
openssl rand -hex 32
```

```bash
AGENT_API_KEY=5f2a... (o valor gerado)
```

O site deve enviá-la em toda chamada:

```bash
curl -X POST https://SEU-DOMINIO.up.railway.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AGENT_API_KEY" \
  -d '{"conversationId":"samira-cliente-123","message":"Olá"}'
```

### Como configurar ALLOWED_ORIGINS

Lista de origens (separadas por vírgula) que podem chamar a API pelo navegador.
Sem esse valor, **nenhuma** origem externa é aceita (preflight → `403`). Use o
literal `*` apenas em dev. Suporta curinga de subdomínio: `*.lovable.app` libera
qualquer origem `*.lovable.app` (útil para previews do Lovable).

```bash
ALLOWED_ORIGINS=https://samirarevela.com.br,https://www.samirarevela.com.br,*.lovable.app
```

## Desenvolvimento local

```bash
npm install
cp .env.example .env   # preencha NVIDIA_API_KEY, AGENT_API_KEY, DATABASE_URL
npm run dev
```

## Testes

Os testes de integração chamam o deepseek-v4-flash real (sem mock) e exigem `NVIDIA_API_KEY`.

```bash
npm run typecheck
npm run test
npm run build
```

Cobrem: `/health`, `/api/status`, auth (401/503), chat novo, chat continuado
(memória), isolamento entre conversas, CORS e página `/`.

## Produção

```bash
npm install
npm run build
npm start
```

## Railway deploy

1. Envie este repo para o GitHub.
2. Crie um serviço no Railway apontando para o repo.
3. No dashboard adicione: `NVIDIA_API_KEY`, `AGENT_API_KEY`, `ALLOWED_ORIGINS`
   (domínio do site) e `DATABASE_URL` (plugin Postgres do Railway ou Neon).
4. O Railway detecta o Dockerfile automaticamente. `PORT` é injetado.
5. Deploy. A URL pública do serviço passa a expor `/api/chat` e a página `/`.

## Integration with Evolution API (MVP)

```
WhatsApp  ->  Evolution API  ->  POST /webhook/evolution  ->  runAgent() (deepseek-v4-flash)
                            ^                                v
                            +---- POST /message/sendText  <---+
```

> Mantido como compatibilidade/legado. **Nesta etapa o agente não chama a
> Evolution API**; a integração WhatsApp fica a cargo do site Samira Revela.

### Webhook validation

- Header `x-webhook-secret: <WEBHOOK_SECRET>` (ou `?secret=` query) é obrigatório.
- Retorna `401` quando ausente/inválido.
- Apenas eventos de `EVOLUTION_WEBHOOK_EVENTS` são processados (default `messages.upsert`).
- Mensagens `fromMe: true` são ignoradas (anti-loop).
- Mensagens sem texto (áudio/imagem/sticker) são ignoradas.
- `message.key.id` é deduplicado por ~10 min (LRU em memória, 1000 entradas).
- Chamadas a `runAgent()` são serializadas por semáforo (default concurrency 1).

### Mock mode

Defina `EVOLUTION_API_URL=mock://evolution` (ou deixe vazio) para testar o
webhook localmente sem uma Evolution API real. `sendText` vira no-op com
`synthetic 200 { mock: true }`.
