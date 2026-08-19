import { type ReactNode, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useGetCurrentUser, useListConversations, useCreateConversation } from '@workspace/api-client-react';
import { getListConversationsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowUpRight, BookOpen, ChevronDown, Compass, Home, LogOut, Menu, MessageSquare, Plus, Search, Settings, X } from 'lucide-react';

function initials(name?: string, email?: string) {
  const value = name || email || 'A';
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export function AskFlowMark({ small = false }: { small?: boolean }) {
  return <span className={`inline-flex items-center justify-center rounded-[10px] bg-primary text-primary-foreground ${small ? 'size-8' : 'size-9'}`} aria-label="AskFlow mark"><Compass className={small ? 'size-4' : 'size-[18px]'} strokeWidth={1.8} /></span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userQuery = useGetCurrentUser();
  const conversationsQuery = useListConversations();
  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();
  const conversations = conversationsQuery.data || [];
  const currentId = location.startsWith('/chat/') ? location.split('/')[2] : '';
  const recent = useMemo(() => conversations.slice(0, 6), [conversations]);

  function newChat() {
    createConversation.mutate({ data: { title: 'Untitled thought' } }, {
      onSuccess: (conversation) => {
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setMobileOpen(false);
        setLocation(`/chat/${conversation.id}`);
      },
    });
  }

  async function signOut() {
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } finally { setLocation('/login'); }
  }

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: Home },
    { href: '/chat', label: 'New conversation', icon: MessageSquare },
  ];

  return (
    <div className="askflow-noise min-h-[100dvh] bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur md:hidden">
        <Link href="/dashboard" data-testid="link-mobile-brand" className="flex items-center gap-2.5">
          <AskFlowMark small /><span className="text-[15px] font-extrabold tracking-[-.03em]">askflow</span>
        </Link>
        <button type="button" data-testid="button-toggle-menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Open navigation"><Menu className="size-5" /></button>
      </header>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-border/80 bg-card px-4 py-5 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:fixed`}>
        <div className="flex items-center justify-between px-2">
          <Link href="/dashboard" data-testid="link-brand" onClick={() => setMobileOpen(false)} className="flex items-center gap-2.5">
            <AskFlowMark /><span className="text-[17px] font-extrabold tracking-[-.04em]">askflow</span>
          </Link>
          <button type="button" data-testid="button-close-menu" onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted md:hidden" aria-label="Close navigation"><X className="size-4" /></button>
        </div>
        <button type="button" data-testid="button-new-conversation" onClick={newChat} disabled={createConversation.isPending} className="mt-9 flex h-11 items-center justify-between rounded-lg bg-primary px-3.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-60">
          <span className="flex items-center gap-2"><Plus className="size-4" />New conversation</span><span className="font-mono-ui text-[10px] opacity-60">⌘ N</span>
        </button>
        <nav className="mt-6 space-y-1" aria-label="Primary navigation">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`} onClick={() => setMobileOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${location === href ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}><Icon className="size-[17px]" strokeWidth={1.8} />{label}</Link>)}
        </nav>
        <div className="mt-8 flex items-center justify-between px-3 pb-2">
          <p className="font-mono-ui text-[10px] font-medium uppercase tracking-[.12em] text-muted-foreground">Recent thinking</p>
          <Link href="/chat" data-testid="link-see-all-conversations" className="text-muted-foreground hover:text-foreground"><ArrowUpRight className="size-3.5" /></Link>
        </div>
        <div className="scrollbar-subtle flex-1 space-y-0.5 overflow-y-auto">
          {conversationsQuery.isLoading ? [1, 2, 3].map((item) => <div key={item} className="mx-2 my-2 h-9 animate-pulse rounded-md bg-muted" />) : recent.length ? recent.map((conversation) => <Link key={conversation.id} href={`/chat/${conversation.id}`} data-testid={`link-conversation-${conversation.id}`} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[12px] transition ${currentId === conversation.id ? 'bg-accent/10 font-semibold text-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'}`}><MessageSquare className="size-3.5 shrink-0 opacity-60" /><span className="truncate">{conversation.title || 'Untitled thought'}</span></Link>) : <div className="px-3 py-3 text-xs leading-relaxed text-muted-foreground">Your saved conversations will appear here.</div>}
          {conversationsQuery.isError && <div className="px-3 py-3 text-xs leading-relaxed text-destructive">Could not load recent conversations.</div>}
        </div>
        <div className="mt-5 border-t border-border/70 pt-4">
          <Link href="/dashboard" data-testid="link-library" className="mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground"><BookOpen className="size-[17px]" strokeWidth={1.8} />Library</Link>
          <button type="button" data-testid="button-settings" onClick={() => setLocation('/dashboard')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-muted-foreground hover:bg-muted/70 hover:text-foreground"><Settings className="size-[17px]" strokeWidth={1.8} />Settings</button>
          <div className="mt-4 flex items-center gap-2.5 rounded-lg bg-muted/60 px-3 py-2.5">
            <div data-testid="avatar-user" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-extrabold text-accent-foreground">{initials(userQuery.data?.name, userQuery.data?.email)}</div>
            <div className="min-w-0 flex-1"><p data-testid="text-user-name" className="truncate text-xs font-bold">{userQuery.data?.name || 'Your workspace'}</p><p data-testid="text-user-email" className="truncate font-mono-ui text-[9px] text-muted-foreground">{userQuery.data?.email || 'Account'}</p></div>
            <button type="button" data-testid="button-sign-out" onClick={signOut} className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground" aria-label="Sign out"><LogOut className="size-3.5" /></button>
          </div>
        </div>
      </aside>
      <main className="min-h-[calc(100dvh-4rem)] md:pl-[272px]">{children}</main>
    </div>
  );
}

export function PageEyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono-ui text-[10px] font-medium uppercase tracking-[.16em] text-primary">{children}</p>;
}