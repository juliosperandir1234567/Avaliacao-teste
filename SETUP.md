# Configuração do ambiente

## 1. Banco de dados (Supabase)

Projeto: `heqspsizpzjwlgjuguyo` (https://heqspsizpzjwlgjuguyo.supabase.co)

Rode as migrations, **em ordem**, no SQL Editor do painel do Supabase
(https://supabase.com/dashboard/project/heqspsizpzjwlgjuguyo/sql/new):

1. `supabase/migrations/0001_profiles.sql`
2. `supabase/migrations/0002_colaboradores.sql`
3. `supabase/migrations/0003_avaliacoes_schema.sql`
4. `supabase/migrations/0004_aplicacoes_schema.sql`
5. `supabase/migrations/0005_rls_policies.sql`
6. `supabase/migrations/0006_storage.sql`

Se o MCP do Supabase escopado a este projeto estiver conectado nesta sessão, posso rodar essas
migrations diretamente — é só avisar.

## 2. Primeiro usuário (Admin)

O app não tem uma tela pública de cadastro de usuários ainda (fica para uma próxima fase — exige a
Secret Key do Supabase para usar a API administrativa). Para o primeiro acesso:

1. No painel do Supabase → **Authentication → Users → Add user**, crie um usuário com e-mail/senha.
   Isso dispara o trigger `handle_new_user` e cria automaticamente um registro em `profiles` com
   `role = 'avaliador'`.
2. No **SQL Editor**, promova esse usuário a administrador:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
   ```
3. Faça login em `/login` com esse e-mail/senha.

Usuários adicionais (avaliadores/gestores) seguem o mesmo processo por enquanto: criar em
Authentication → Users, e opcionalmente ajustar o `role` via SQL (o padrão é `avaliador`).

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:3000 — o app é mobile-first, vale abrir o DevTools em modo responsivo
(celular/tablet) para conferir a experiência real de uso em campo.

## 4. O que já funciona (Fase 1)

- Login com perfis (Admin / Avaliador / Gestor) e RLS por perfil.
- Colaboradores internos: cadastro manual, edição, inativação, busca/filtro e importação em massa
  (.xlsx/.csv) com pré-visualização.
- Candidatos externos: cadastro manual.
- Banco de Avaliações: construtor visual (seções, competências, perguntas dos tipos principais,
  checklist, itens críticos, pesos, famílias de equipamento), publicação e duplicação/versionamento.
- Nova Avaliação: fluxo guiado completo (tipo de pessoa → localizar/cadastrar → motivo →
  identificação → seleção da avaliação).
- Aplicação da avaliação: runner mobile-first com autosave, evidências (foto), interrupção por
  segurança, resumo e finalização.
- Raio-X do avaliado: nota geral, notas por competência, resumo do checklist, parecer sugerido e
  parecer final editável pelo avaliador.

Fora do escopo desta fase (ver plano): dashboards executivos, relatório em PDF, assinatura digital,
importação de provas do Word, análise por IA, sincronização offline (PWA) e gestão self-service de
usuários.
