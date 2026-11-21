# Simulador MCX (AppyPay sandbox)

Ferramenta interna para testar pagamentos **Multicaixa Express** e **por referência** em qualquer
projeto que use a conta de **teste** da AppyPay. Funciona só no ambiente de testes (`gwy-api-tst`),
nunca mexe em dinheiro real.

## Começar

```bash
npm install
cp .env.example .env.local   # preenche com as credenciais de teste da AppyPay
npm run dev -- -p 3100       # http://localhost:3100
```

## O que faz

| Separador | Para quê |
| --- | --- |
| **Pagar ref.** | Paga uma referência gerada por um projeto (simula o cliente no ATM / app). A AppyPay avisa o webhook desse projeto. |
| **Express** | Cria uma cobrança Multicaixa Express com um número de teste, para ver a resposta da API. |
| **Gerar ref.** | Gera uma referência de teste e permite pagá-la logo a seguir. |
| **Consultar** | Mostra o estado de uma transação pelo ID (GUID). |
| **Histórico** | Últimas operações (guardadas só neste browser). |

O painel lateral mostra a resposta completa da API a cada operação.

## Números de teste (Multicaixa Express)

Confirmados no sandbox em 21/11/2026 — usa-os em qualquer projeto:

| Número | Resultado | Código |
| --- | --- | --- |
| 900000000 | Aprovado | 100 |
| 900000001 | Saldo insuficiente | 216 |
| 900000002 | Tempo esgotado (90 s) | 211 |
| 900000003 | Recusado pelo cliente | 231 |

## Notas da API AppyPay (aprendidas a testar)

- `merchantTransactionId`: alfanumérico, **máx. 15 caracteres**.
- Referência: o **número (9 dígitos) é enviado por nós** em `paymentInfo.referenceNumber`; a entidade de teste é `00348`.
- A referência gerada vem dentro de `responseStatus.reference` (não no topo da resposta).
- Cobranças com erro devolvem `id` = `00000000-0000-0000-0000-000000000000`.
- Sem cabeçalho `Accept-Language` as mensagens vêm em português; com `pt-PT` vêm em inglês.
- Pagamento de referência no sandbox: `POST /mocks/referenceProcessing` com `{ entity, referenceNumber }`.
