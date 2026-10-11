-- 004_assistant_history.sql (PROPOSAL from Lane C, for Aayush to review and move into db/migrations/)
--
-- Saved conversations for the 'Ask Elevra' assistants (students, faculty and admins), so a user can reopen past chats
-- on any device. Each message keeps its rendered extras (chart, hackathon cards, query result) in `payload`, so an old
-- conversation looks exactly as it did.
--
-- Access: every user reads only their own conversations (owner = auth.uid()). Nobody writes through the API directly;
-- the FastAPI backend writes with the service role after checking ownership. Deleting a conversation deletes its
-- messages. Deleting a login deletes its conversations. Safe to run more than once.
-- Revert: drop table if exists public.assistant_messages, public.assistant_conversations;

create table if not exists public.assistant_conversations (
  id          bigserial primary key,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('student','faculty')),   -- which assistant
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists assistant_conversations_owner_idx on public.assistant_conversations (owner_id, kind, updated_at desc);

create table if not exists public.assistant_messages (
  id               bigserial primary key,
  conversation_id  bigint not null references public.assistant_conversations(id) on delete cascade,
  role             text not null check (role in ('user','assistant')),
  content          text not null,
  payload          jsonb not null default '{}'::jsonb,   -- chart, cards, rows, sql, follow-ups ... as returned to the UI
  created_at       timestamptz not null default now()
);
create index if not exists assistant_messages_conversation_idx on public.assistant_messages (conversation_id, id);

-- ---------- row-level security ----------
alter table public.assistant_conversations enable row level security;
alter table public.assistant_messages      enable row level security;

drop policy if exists rls_read on public.assistant_conversations;
create policy rls_read on public.assistant_conversations for select to authenticated
  using (owner_id = auth.uid());

drop policy if exists rls_read on public.assistant_messages;
create policy rls_read on public.assistant_messages for select to authenticated
  using (exists (select 1 from public.assistant_conversations c where c.id = conversation_id and c.owner_id = auth.uid()));

revoke all privileges on table public.assistant_conversations, public.assistant_messages from anon, authenticated;
grant select on table public.assistant_conversations, public.assistant_messages to authenticated;
