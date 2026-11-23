-- ============================================================================
-- 3오늘 — 전도자의 삶 (다중 사용자 · 프라이버시 보장 · 관리자 점검용 SQL)
-- Supabase 대시보드 → SQL Editor 에 그대로 붙여넣고 Run 을 누르세요. (여러 번 실행해도 안전합니다)
-- ============================================================================

create extension if not exists pgcrypto;

-- 1. 멤버 프로필 (권한: member / admin)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null default '전도자',
  group_name text not null default '',
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

-- 2. 공동체 설정 (초대 코드, 40일 캠프 시작일)
create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  site_title text not null default '3오늘 — 전도자의 삶',
  invite_code text not null default '',
  campaign_name text not null default '40일 집중',
  campaign_start date
);

insert into public.app_settings (id) values (1)
on conflict (id) do nothing;

-- 3. 날짜별 3오늘 기록 (사용자당 하루 1건, 개인 비공개 옵션 포함)
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  entry_date date not null,
  covenant text not null default '',
  ref text not null default '',
  word jsonb not null default '{}'::jsonb,
  prayer jsonb not null default '[]'::jsonb,
  evangelism jsonb not null default '[]'::jsonb,
  witness jsonb not null default '{}'::jsonb,
  forum jsonb,
  share_with_admin boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists journal_entries_user_date_idx
  on public.journal_entries (user_id, entry_date desc);

create index if not exists journal_entries_date_idx
  on public.journal_entries (entry_date desc);

-- 4. 관리자 확인 함수 (RLS 무한 재귀 방지용 security definer)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 5. 로그인 전 회원가입 화면 안내용 공개 정보 (초대 코드 자체는 노출하지 않음)
create or replace function public.auth_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'has_admin', exists(select 1 from public.profiles where role = 'admin'),
    'requires_invite', coalesce((select invite_code <> '' from public.app_settings where id = 1), false),
    'site_title', coalesce((select site_title from public.app_settings where id = 1), '3오늘 — 전도자의 삶')
  );
$$;

grant execute on function public.auth_info() to anon, authenticated;

-- 6. 일반 사용자가 자신의 role 을 admin 으로 바꾸지 못하도록 보호
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not public.is_admin() then
      raise exception '권한(role)을 직접 변경할 수 없습니다.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on public.profiles;
create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- 7. 수정 시간 자동 갱신
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_journal_entries on public.journal_entries;
create trigger trg_touch_journal_entries
  before update on public.journal_entries
  for each row execute function public.touch_updated_at();

-- 8. 회원가입 처리 트리거 (첫 가입자 = 자동 관리자 / 이후 초대 코드 확인)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_admin boolean;
  expected_code text;
  given_code text;
  u_name text;
  u_group text;
begin
  select exists(select 1 from public.profiles where role = 'admin') into has_admin;
  select invite_code into expected_code from public.app_settings where id = 1;
  given_code := trim(coalesce(new.raw_user_meta_data->>'invite_code', ''));

  if has_admin and coalesce(trim(expected_code), '') <> '' and given_code <> trim(expected_code) then
    raise exception '초대 코드가 올바르지 않습니다.';
  end if;

  u_name := nullif(trim(coalesce(new.raw_user_meta_data->>'display_name', '')), '');
  if u_name is null then
    u_name := split_part(coalesce(new.email, '전도자'), '@', 1);
  end if;
  u_group := trim(coalesce(new.raw_user_meta_data->>'group_name', ''));

  insert into public.profiles (id, email, display_name, group_name, role)
  values (
    new.id,
    new.email,
    u_name,
    u_group,
    case when not has_admin then 'admin' else 'member' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 9. Row Level Security (데이터베이스 단계에서 타인 열람 원천 차단)
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.journal_entries enable row level security;
revoke all on public.profiles, public.app_settings, public.journal_entries from anon;

-- profiles: 본인 정보 또는 관리자만 조회/수정
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- app_settings: 관리자만 조회 및 수정
drop policy if exists "app_settings_admin_all" on public.app_settings;
create policy "app_settings_admin_all" on public.app_settings
  for all using (public.is_admin())
  with check (public.is_admin());

-- journal_entries:
--   조회: 본인 기록이거나, (관리자이고 작성자가 관리자 점검 공유를 허용한 경우)
--   작성/수정/삭제: 오직 본인 기록만 가능
drop policy if exists "entries_select" on public.journal_entries;
create policy "entries_select" on public.journal_entries
  for select using (
    auth.uid() = user_id
    or (public.is_admin() and share_with_admin = true)
  );

drop policy if exists "entries_insert" on public.journal_entries;
create policy "entries_insert" on public.journal_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "entries_update" on public.journal_entries;
create policy "entries_update" on public.journal_entries
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "entries_delete" on public.journal_entries;
create policy "entries_delete" on public.journal_entries
  for delete using (auth.uid() = user_id);
