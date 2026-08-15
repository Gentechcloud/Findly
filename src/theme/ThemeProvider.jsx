import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { light, dark, shape, typeScale } from './tokens';

const ColorModeContext = createContext({ mode: 'system', setMode: () => {} });
export const useColorMode = () => useContext(ColorModeContext);

function buildTheme(mode, tokens, accent) {
  const t = accent ? { ...tokens, primary: accent.primary, primaryContainer: accent.primaryContainer, onPrimaryContainer: accent.onPrimaryContainer } : tokens;

  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary, contrastText: t.onPrimary, container: t.primaryContainer, onContainer: t.onPrimaryContainer },
      secondary: { main: t.secondary, contrastText: t.onSecondary, container: t.secondaryContainer, onContainer: t.onSecondaryContainer },
      // MUI doesn't have a native "tertiary" slot; we attach it as a custom key below.
      error: { main: t.error, contrastText: t.onError, container: t.errorContainer, onContainer: t.onErrorContainer },
      background: { default: t.background, paper: t.surface1 },
      text: { primary: t.onBackground, secondary: t.onSurfaceVariant },
      divider: t.outlineVariant,
    },
    m3: {
      tertiary: t.tertiary, onTertiary: t.onTertiary, tertiaryContainer: t.tertiaryContainer, onTertiaryContainer: t.onTertiaryContainer,
      surface: t.surface, onSurface: t.onSurface, surfaceVariant: t.surfaceVariant, onSurfaceVariant: t.onSurfaceVariant,
      surface1: t.surface1, surface2: t.surface2, surface3: t.surface3, surface4: t.surface4, surface5: t.surface5,
      outline: t.outline, outlineVariant: t.outlineVariant, inverseSurface: t.inverseSurface, inverseOnSurface: t.inverseOnSurface,
      inversePrimary: t.inversePrimary, success: t.success, online: t.online,
    },
    shape: { borderRadius: shape.medium },
    m3shape: shape,
    typography: {
      fontFamily: typeScale.fontBody,
      ...Object.fromEntries(
        Object.entries(typeScale).filter(([k]) => k.match(/^(display|headline|title|body|label)/)).map(([k, v]) => [
          k,
          { ...v, fontFamily: v.fontFamily === 'display' ? typeScale.fontDisplay : typeScale.fontBody },
        ])
      ),
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: shape.full, textTransform: 'none', fontWeight: 600, paddingInline: 20,
            transition: 'transform .15s cubic-bezier(0.34,1.56,0.64,1), box-shadow .2s ease, background-color .2s ease',
            '&:active': { transform: 'scale(0.96)' },
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'filled' },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            borderRadius: shape.large,
            backgroundColor: t.surfaceVariant,
            transition: 'background-color .2s ease',
            '&:before, &:after': { display: 'none' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', transition: 'box-shadow .2s ease, transform .2s ease' },
        },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: shape.extraLarge } },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: shape.full } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: shape.large,
            transition: 'background-color .2s ease, transform .15s ease',
            '&:active': { transform: 'scale(0.985)' },
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: { borderRadius: shape.large, overflow: 'hidden' },
        },
      },
      MuiAppBar: {
        styleOverrides: { root: { backgroundColor: t.surface1, color: t.onSurface, boxShadow: 'none' } },
      },
    },
  });
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('findly-theme-mode') || 'system');
  const [accent, setAccent] = useState(() => {
    const saved = localStorage.getItem('findly-accent');
    return saved ? JSON.parse(saved) : null;
  });

  const systemPrefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolvedMode = mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode;

  useEffect(() => { localStorage.setItem('findly-theme-mode', mode); }, [mode]);
  useEffect(() => {
    if (accent) localStorage.setItem('findly-accent', JSON.stringify(accent));
    else localStorage.removeItem('findly-accent');
  }, [accent]);

  const theme = useMemo(
    () => buildTheme(resolvedMode, resolvedMode === 'dark' ? dark : light, accent),
    [resolvedMode, accent]
  );

  const ctx = useMemo(() => ({ mode, setMode, accent, setAccent, resolvedMode }), [mode, accent, resolvedMode]);

  return (
    <ColorModeContext.Provider value={ctx}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ColorModeContext.Provider>
  );
}
