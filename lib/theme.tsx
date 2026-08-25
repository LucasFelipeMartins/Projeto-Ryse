'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Theme = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  /** Preferencia salva pelo usuario. */
  theme: Theme;
  /** Tema efetivamente aplicado depois de resolver `system`. */
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const STORAGE_KEY = 'ryse-theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Script inline injetado no <head> para aplicar o tema ANTES da primeira
 * pintura — evita o flash de tela branca em quem usa dark mode.
 */
export const themeScript = `(function(){try{var k='${STORAGE_KEY}';var s=localStorage.getItem(k);var m=window.matchMedia('(prefers-color-scheme: dark)').matches;var d=s==='dark'||((!s||s==='system')&&m);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function systemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function apply(resolved: 'light' | 'dark') {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  // Mantem a barra de status do iOS/Android em sintonia com o tema.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolved === 'dark' ? '#000000' : '#ffffff');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // Hidrata a partir do localStorage (o script inline ja pintou a tela).
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system';
    setThemeState(stored);
    setResolved(stored === 'system' ? systemTheme() : stored);
  }, []);

  // Segue o SO enquanto a preferencia for `system`.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = mq.matches ? 'dark' : 'light';
      setResolved(next);
      apply(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    const effective = next === 'system' ? systemTheme() : next;
    setThemeState(next);
    setResolved(effective);
    apply(effective);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* modo privado / storage bloqueado */
    }
  }, []);

  const toggle = useCallback(
    () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
    [resolved, setTheme],
  );

  const value = useMemo(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme precisa estar dentro de <ThemeProvider>');
  return ctx;
}
