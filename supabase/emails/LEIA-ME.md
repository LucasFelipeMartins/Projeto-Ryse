# E-mails do Ryse

Templates prontos para colar no painel do Supabase, com a identidade do Ryse
em vez da aparência padrão.

---

## O ponto mais importante: o remetente

Trocar o HTML muda o **corpo** do e-mail. Não muda quem envia.

Com o SMTP padrão do Supabase, a mensagem sai de
`noreply@mail.app.supabase.io` e o nome exibido é o do projeto Supabase — por
mais que o conteúdo inteiro diga Ryse. A caixa de entrada mostra o remetente
antes do corpo, então esse é justamente o lugar onde a marca aparece primeiro.

**Para o e-mail sair como Ryse, é preciso SMTP próprio.** No painel:
`Authentication › Emails › SMTP Settings`.

O SMTP padrão também tem limite baixo (poucos e-mails por hora) e é explicitamente
destinado a desenvolvimento — em produção ele vai barrar cadastros.

### Serviços que funcionam bem

| Serviço | Grátis | Observação |
|---|---|---|
| [Resend](https://resend.com) | 3.000/mês | Configuração mais simples; SDK próprio não é necessário, basta o SMTP |
| [Brevo](https://brevo.com) | 300/dia | Não exige cartão |
| [Mailgun](https://mailgun.com) | 100/dia | Exige verificação de domínio |

Preencha no painel:

```
Host:        smtp.resend.com
Port:        465
Username:    resend
Password:    <sua API key>
Sender email: nao-responda@seudominio.com.br
Sender name:  Ryse
```

O `Sender name` é o que resolve o "Supabase" na caixa de entrada.

> Sem domínio próprio, a maioria dos serviços só entrega para o e-mail que
> você verificou. Para valer em produção, aponte os registros DNS (SPF/DKIM)
> do seu domínio — cada serviço mostra quais.

---

## Como aplicar os templates

`Authentication › Emails › Templates`. Uma aba por arquivo:

| Aba no painel | Arquivo | Assunto sugerido |
|---|---|---|
| Confirm signup | `confirmar-cadastro.html` | Confirme seu e-mail — Ryse |
| Reset password | `recuperar-senha.html` | Redefinir sua senha — Ryse |
| Magic Link | `magic-link.html` | Seu acesso ao Ryse |
| Change Email Address | `alterar-email.html` | Confirme seu novo e-mail — Ryse |

Cole o conteúdo inteiro do arquivo no campo de mensagem e ajuste o assunto no
campo acima. O `_base.html` **não** vai para o painel — ele documenta as
decisões de construção.

---

## Por que o HTML é assim

Cliente de e-mail não é navegador, e o que parece exagero tem motivo:

- **Layout em `<table>`.** O Outlook para Windows renderiza com o motor do
  Word, que ignora `display:flex`. Tabela é o que funciona em todos.
- **CSS inline em cada elemento.** O Gmail remove `<style>` em boa parte dos
  casos, e nenhum cliente baixa folha externa.
- **A marca é desenhada com células de tabela, não com imagem nem SVG.** O
  Gmail bloqueia imagens até o leitor autorizar — um logo em `<img>` apareceria
  como retângulo vazio na primeira leitura, que é a que mais importa. SVG não
  é suportado no Outlook. Barras coloridas montadas com `<td>` aparecem sempre.
- **A URL crua aparece embaixo do botão.** Filtros corporativos às vezes
  removem `<a>` estilizado, e cliente em texto puro não mostra botão.
- **600px de largura.** Padrão histórico que cabe no painel de leitura do
  Outlook sem barra horizontal.

---

## URLs de redirecionamento

Sem isso, os links do e-mail são recusados — independentemente do template.

`Authentication › URL Configuration`:

| Campo | Valor |
|---|---|
| Site URL | `https://seu-app.onrender.com` |
| Redirect URLs | `https://seu-app.onrender.com/**` |

Mantenha `http://localhost:3000/**` na lista se ainda desenvolve local; ela
aceita várias entradas.

---

## "Limite de envio atingido" — o que fazer

O SMTP embutido tem um teto baixo de mensagens por hora (hoje, 2 em projetos
novos) e não dá para levantá-lo: o campo `Authentication › Rate Limits ›
Emails per hour` fica travado enquanto o projeto usar o serviço padrão.
Configurar SMTP próprio é o que destrava aquele campo — não existe atalho.

Enquanto isso não acontece, há dois desvios para continuar testando.

### Desvio 1 — pelos comandos administrativos (preferível)

Não mexe em configuração nenhuma e não afeta quem já usa o app:

```bash
node scripts/admin.mjs confirmar voce@email.com
node scripts/admin.mjs senha voce@email.com NovaSenha123
```

O primeiro marca o e-mail como verificado, o segundo define a senha. Os dois
usam a chave secreta, então rodam só na sua máquina.

### Desvio 2 — desligar a confirmação por e-mail

`Authentication › Providers › Email` → desligue **Confirm email**.

Com isso, o cadastro para de enviar e-mail e a conta entra direto. Resolve o
limite porque nenhuma mensagem é gerada.

O custo é real e vale dizer com todas as letras: sem confirmação, ninguém
prova que o endereço é de quem se cadastrou. Dá para criar conta com o e-mail
de outra pessoa, e a recuperação de senha daquela conta passa a ser um
caminho para invadi-la. **Isso é aceitável em ambiente de teste e não é
aceitável em produção** — religue antes de abrir para clientes.

O app funciona nos dois modos: quando a confirmação está desligada, `signUp`
recebe sessão na hora e leva direto ao onboarding, sem passar pela tela de
verificação.

---

## Confirmação obrigatória de e-mail

`Authentication › Providers › Email` → **Confirm email** precisa estar
**ligado**.

Com ela ligada, `signUp` cria a conta mas não devolve sessão, e o app leva a
pessoa para `/verificar-email` — que explica o passo e oferece reenvio. Quem
tenta entrar antes de confirmar cai na mesma tela, com o endereço preenchido.

Com ela desligada, a conta entra direto e o endereço nunca é verificado.

---

## Testando

O caminho mais rápido para saber se está tudo de pé:

1. Cadastre-se com um e-mail real em `/cadastrar`
2. O app deve levar a `/verificar-email`
3. O e-mail chega com a marca Ryse e remetente Ryse
4. O link abre `/auth/confirmar` e a conta é ativada
5. Em `/recuperar-senha`, o link deve abrir `/nova-senha` já autenticado

Se o passo 5 falhar com "link inválido", quase sempre é a lista de
**Redirect URLs**.
