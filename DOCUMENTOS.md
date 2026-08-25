# Envio de documentos de saúde

O paciente envia exames em `/documentos`. O arquivo vai para o Storage privado
do Supabase; os metadados e o resultado da análise ficam em `health_documents`.

## As quatro camadas de verificação

A ordem é deliberada: o que é barato e determinístico roda primeiro. Um arquivo
reprovado na assinatura binária nunca chega a consumir cota de API de IA.

### 1. Cliente — retorno imediato

`lib/validation/document.ts` → `validateBeforeUpload()`

Tipo declarado e tamanho. Serve para dar erro antes de gastar banda; **não é
barreira de segurança**, porque roda no navegador.

### 2. Servidor — assinatura binária

`lib/validation/document.ts` → `validateBytes()`

Autoritativa. Lê os primeiros bytes em vez de confiar no `Content-Type`:

| Verificação | Rejeita |
|---|---|
| Assinatura do arquivo | `%PDF-`, `FFD8FF`, `89504E47`, `RIFF…WEBP` — qualquer outra coisa cai fora |
| Coerência | Extensão trocada (um JPEG renomeado para `.pdf`) |
| Tamanho | Acima de 10 MB |
| PDF protegido | `/Encrypt` no trailer — a API não conseguiria ler mesmo |
| Páginas | Acima de 30 |
| Limite diário | 10 envios por paciente, via `documents_today()` |

Renomear `foto.jpg` para `exame.pdf` engana a extensão, não a assinatura.

### 3. Servidor — conteúdo

`lib/validation/health-content.ts`

Assinatura e tamanho não distinguem um hemograma de um recibo: os dois são PDFs
válidos de 200 KB. Aqui o texto é extraído (`unpdf`) e pontuado contra o
vocabulário de laudos — analitos, unidades (`mg/dL`, `ng/mL`) e termos
estruturais (`valor de referência`, `método`, `responsável técnico`).

Uma blocklist recusa de saída o que é claramente de outro domínio (nota fiscal,
boleto, contrato). Mas a aprovação **não** depende dela: um documento neutro,
sem termo bloqueado e sem sinal clínico, também é recusado.

PDF escaneado não tem camada de texto — nesse caso a heurística se abstém e a
decisão passa para a camada 4.

### 4. IA — classificação e extração

`lib/ai/analyzer.ts`

Dois passos: **triagem** (isto é um exame?) e só então **extração** (quais
marcadores?). A triagem é o que barra o que passou pelas camadas anteriores mas
não é documento de saúde. Documento recusado aqui é apagado do Storage.

## Trocando o provedor de IA

O app depende só da interface `DocumentAnalyzer`. As instruções clínicas moram
em `lib/ai/analyzer.ts`, fora de qualquer implementação — trocar de fornecedor
não significa reescrever as regras.

**Estado atual:** `lib/ai/openai.ts` é um esqueleto com TODO. Sem
`OPENAI_API_KEY`, `getAnalyzer()` devolve `null` e o documento fica em
`aguardando_analise` — as camadas 1 a 3 seguem funcionando normalmente.

Para ligar:

```bash
npm install openai
echo "OPENAI_API_KEY=sk-..." >> .env.local   # sem NEXT_PUBLIC_
```

E preencher `triage()` e `analyze()`. Os parsers defensivos (`parseTriage`,
`parseAnalysis`) já estão prontos: validam a resposta antes de gravar, e o
default de `accepted` é `false` — resposta quebrada recusa o documento em vez
de deixá-lo passar sem checagem.

## Privacidade

- **Consentimento explícito** antes de cada envio, gravado em
  `health_documents.consent_at`.
- **Bucket privado.** O acesso é por signed URL de 60 segundos, emitida só
  depois da checagem de RLS.
- **Isolamento por pasta.** O caminho é `{patient_id}/{uuid}.{ext}` e as
  políticas do Storage comparam a primeira pasta com `auth.uid()` — ninguém lê
  nem escreve na pasta de outro paciente, mesmo forjando o caminho.
- **Documento recusado não fica guardado**: é apagado do bucket.

## Testes

As camadas 2 e 3 são funções puras, testadas com bytes reais durante o
desenvolvimento: JPEG renomeado para `.pdf`, executável disfarçado, ZIP, PDF
com senha, PDF de 60 páginas, nota fiscal, contrato, ata de condomínio e
receita culinária — todos recusados; laudo laboratorial aceito.
