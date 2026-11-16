# 📚🌿 Estante de Leitura

Portfólio e planner de leitura com estética aconchegante: estante virtual de madeira, leituras por ano, estatísticas, metas, citações e cadastro por código de barras.

- **Cada pessoa tem a sua estante.** O cadastro pede só nome, **@usuário** e um **PIN de 6 dígitos** (sem e-mail). Cada estante tem um link próprio (`…/#/u/seu_usuario`), começa pública e pode virar privada. Só a dona ou o dono edita.
- **Celular e computador.** Layout responsivo e instalável como app (PWA): no celular, use "Adicionar à tela inicial".
- **Código de barras.** A câmera lê o ISBN e busca título, autor, capa, páginas e gênero (BrasilAPI → Google Books → Open Library).
- **Leituras legado.** Marque um livro como "lido" sem data, nota nem formato. Ele conta na estante, mas fica fora das estatísticas por ano até você registrar os detalhes.
- **Importação.** Notion, Goodreads, StoryGraph ou qualquer CSV (Skoob, Skeelo, Sheets, Excel), com mapeamento de colunas. Também exporta um backup `.json` e uma planilha `.csv`.

Stack: **React 18 + TypeScript + Vite**, **Supabase** (Postgres, login e storage das capas), sem API própria.

---

## 1. Rodar no seu computador

```bash
npm install
npm run dev
```

Abra o endereço que aparecer. Sem configurar nada, o app roda em **modo local**: os dados ficam só naquele navegador, o que é ótimo pra testar e importar seus CSVs.

> A câmera só funciona em `https` ou `localhost`. Pra testar no celular, use o site publicado (passo 3).

## 2. Ligar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria:
   - as tabelas;
   - as regras de segurança (estante pública: todos veem; privada: só a dona ou o dono; editar: sempre só a dona ou o dono);
   - o bucket das capas.
3. Em **Authentication → Sign In / Providers → Email**, deixe **Allow new users to sign up** ligado e **desligue "Confirm email"**. O login usa @ + PIN, então nenhum e-mail é enviado.
4. Em **Authentication → Attack Protection** (ou *Policies/Password*), confira duas coisas:
   - a senha mínima é de **6 caracteres**, que é o padrão e é por isso que o PIN tem 6 dígitos;
   - **Leaked password protection** está desligada. Essa opção recusaria PINs numéricos.
5. Em **Project Settings → API Keys**, copie a *Project URL* e a **publishable key** (`sb_publishable_...`) para um arquivo `.env.local`, seguindo o [`.env.example`](.env.example):

   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

6. Rode `npm run dev` de novo e clique em **Criar minha estante**.

**Já testou em modo local?** Antes de ligar o Supabase, vá em **Perfil → Backup (.json)**. Depois de criar sua conta, use **Importar** e escolha esse arquivo: tudo é restaurado.

**Alguém esqueceu o PIN?** Rode no SQL Editor, trocando o @ e o PIN novo:

```sql
update auth.users
set encrypted_password = crypt('123456', gen_salt('bf'))
where email = 'usuario@estante-de-leitura.app';
```

> **Sobre segurança:** um PIN de 6 dígitos é prático, mas menos forte que uma senha. O Supabase limita as tentativas de login por IP, e o app recusa PINs óbvios (000000, 123456). Se o site ficar muito movimentado, o próximo passo seria adicionar CAPTCHA no cadastro e no login. Isso exige uma pequena mudança no app.
>
> A *publishable key* pode ficar no front-end: quem protege os dados são as regras RLS do `schema.sql`.

## 3. Publicar

### GitHub Pages (já configurado)

1. Suba o projeto para um repositório no GitHub.
2. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions**, crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.
4. Faça um push na `main`. O workflow [`deploy.yml`](.github/workflows/deploy.yml) compila e publica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

### Vercel (alternativa)

Importe o repositório, adicione as duas variáveis `VITE_...` e faça o deploy. O comando de build `npm run build` e a pasta `dist` já são detectados.

## 4. Importar do Notion e de outros lugares

Entre na sua estante e use **Perfil → Importar planilha**.

| Origem | Como exportar |
| --- | --- |
| Notion | Na base de leitura: `•••` → **Export** → *Markdown & CSV*. Selecione todos os `.csv` do zip de uma vez. |
| Goodreads | My Books → Import and export → **Export Library** |
| StoryGraph | Manage Account → **Export StoryGraph Library** |
| Skoob, Skeelo, outros | Não têm exportação oficial. Monte uma planilha, baixe como `.csv` e ajuste as colunas na tela de importação. |

O importador entende:
- notas em ⭐⭐⭐⭐, 🌕🌕🌕🌕🌑, `4,5`, `9/10`;
- datas `dd/mm/aaaa`, `aaaa-mm-dd` e "January 2, 2023";
- progresso em %.

Ele também ignora linhas decorativas (`▷▷▷`), junta arquivos repetidos (os `_all` do Notion) e transforma releituras em várias leituras do mesmo livro. Antes de confirmar, você revê tudo numa prévia e pode trocar o status de cada livro.

Pra testar a leitura de um CSV no terminal:

```bash
npm run test:import -- caminho/arquivo.csv
```

## Modelo de dados

```
profiles   @usuário (login e link), nome, nome do site, frase, meta anual, pública/privada
books      livro na estante: título, autor, ISBN, capa, gêneros, páginas,
           status (nao_lido | lendo | lido | abandonado | desejo), tenho?, página atual, anotações
readings   cada leitura de um livro: status, início, término, ano (se não lembrar a data),
           nota 0–5 (meia estrela), formato (físico | kindle | audiobook), resenha
quotes     citações com página
```

Um livro com status `lido` e nenhuma leitura registrada é uma **leitura legado**. As estatísticas por ano usam as leituras.

## Estrutura

```
src/
  lib/          tipos, backend (Supabase + modo local), estatísticas, busca por ISBN, importação/exportação
  store/        estado global da biblioteca (React context)
  components/   estante, capas, estrelas, formulários, leitor de código de barras, ilustrações
  pages/        Página inicial, Criar estante, Entrar, e por usuário (/u/:usuario):
                Início, Leituras, Estante, Adicionar, Livro, Importar, Perfil
supabase/schema.sql
```
