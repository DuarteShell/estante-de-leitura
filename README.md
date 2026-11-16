# 📚🌿 Estante de Leitura

Portfólio e planner de leitura com estética aconchegante: estante virtual de madeira, leituras por ano, estatísticas, metas, citações e cadastro por código de barras.

- **Público e só você edita.** Qualquer pessoa com o link vê sua estante; só você (logado) adiciona e altera.
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
2. Vá em **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas, as regras de segurança (leitura pública, escrita só da dona/dono) e o bucket das capas.
3. Em **Authentication → Users → Add user**, crie seu usuário com e-mail e senha (marque *Auto Confirm User*).
4. Em **Authentication → Sign In / Providers**, desative **Allow new users to sign up**, pra ninguém mais criar conta.
5. Em **Project Settings → API**, copie a *Project URL* e a *anon public key* para um arquivo `.env.local`, seguindo o [`.env.example`](.env.example):

   ```env
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```

6. Rode `npm run dev` de novo, abra **Perfil → Entrar** e faça login. Em **Perfil**, coloque seu nome, o nome do site e a meta do ano.

**Já testou em modo local?** Antes de ligar o Supabase, vá em **Perfil → Backup (.json)**. Depois de logar, use **Importar** e escolha esse arquivo: tudo é restaurado.

> A *anon key* pode ficar no front-end: quem protege os dados são as regras RLS do `schema.sql`.

## 3. Publicar

### GitHub Pages (já configurado)

1. Suba o projeto para um repositório no GitHub.
2. Em **Settings → Pages → Source**, escolha **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions**, crie os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Faça um push na `main`. O workflow [`deploy.yml`](.github/workflows/deploy.yml) compila e publica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

### Vercel (alternativa)

Importe o repositório, adicione as duas variáveis `VITE_...` e faça o deploy. O comando de build `npm run build` e a pasta `dist` já são detectados.

## 4. Importar do Notion e de outros lugares

Use **Perfil → Importar planilha**.

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
profiles   nome, nome do site, frase, meta anual
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
  pages/        Início, Leituras, Estante, Adicionar, Livro, Importar, Perfil, Entrar
supabase/schema.sql
```
