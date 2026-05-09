/**
 * AppContext — single source of truth for app state, language and i18n.
 *
 * Wrap the root once with <AppProvider state={...} persist={...}> and any
 * component can access the live state via useApp(). This kills three classes
 * of boilerplate that were spreading through the codebase:
 *   1) Passing `state` and `persist` down every component tree.
 *   2) Repeating `T(state.language, 'key')` everywhere — `t('key')` is shorter
 *      and always resolves with the current language automatically.
 *   3) Recomputing `currentProfile(state)` at every callsite.
 */
import React, { createContext, useContext, useMemo } from 'react';
import { PersistedState, LanguageCode, LanguageProfile, currentProfile } from './state';
import { T, Tn, STRINGS } from './i18n';

type StringKey = keyof typeof STRINGS.pl;

type AppContextValue = {
  state: PersistedState;
  persist: (next: PersistedState) => Promise<void>;
  lang: LanguageCode;
  profile: LanguageProfile;
  t: (key: StringKey) => string;
  tn: (key: StringKey, vars: Record<string, string | number>) => string;
};

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({
  state,
  persist,
  children,
}: {
  state: PersistedState;
  persist: (next: PersistedState) => Promise<void>;
  children: React.ReactNode;
}) {
  const value = useMemo<AppContextValue>(() => {
    const lang = state.language;
    return {
      state,
      persist,
      lang,
      profile: currentProfile(state),
      t: (key) => T(lang, key as any),
      tn: (key, vars) => Tn(lang, key as any, vars),
    };
  }, [state, persist]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
