import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { light, dark, typeScale } from './tokens';
import { iosLight, iosDark } from './iosTokens';
import { mix, readableOn, luminance } from './colorUtils';
import { wallpaperCss, getCustomWallpaper, setCustomWallpaper as persistCustomWallpaper } from './wallpapers';
import { isNative, setSystemBarsStyle } from '../native';

const STORAGE_KEY = 'findly-appearance';
const IOS_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif';

const DEFAULTS = {
  mode: 'system',            // 'light' | 'dark' | 'system'
  accent: null,              // '#RRGGBB' или null (= цвет по умолчанию для выбранного стиля)
  uiStyle: isNative ? 'ios' : 'material',
  bubbleRadius: 18,          // скругление сообщений, px
  textSize: 15,              // размер текста в чате, px
  wallpaper: 'none',         // id обоев чата
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    // Миграция со старых ключей (до появления настроек оформления)
    const legacy = { ...DEFAULTS };
    const oldMode = localStorage.getItem('findly-theme-mode');
    if (oldMode) legacy.mode = oldMode;
    const oldAccent = localStorage.getItem('findly-accent');
    if (oldAccent) legacy.accent = JSON.parse(oldAccent)?.primary || null;
    return legacy;
  } catch {
    return { ...DEFAULTS };
  }
}

const AppearanceContext = createContext(null);
export const useAppearance = () => useContext(AppearanceContext);
export const useColorMode = useAppearance; // старое имя оставлено для совместимости

function buildTheme({ mode, uiStyle, accent, bubbleRadius, textSize, wallpaper, customWallpaper }) {
  const ios = uiStyle === 'ios';
  const base = ios ? (mode === 'dark' ? iosDark : iosLight) : (mode === 'dark' ? dark : light);
  const t = { ...base };

  if (accent) {
    // В тёмной теме слишком тёмный акцент подсветляем, чтобы текст оставался читаемым
    const visible = mode === 'dark' && luminance(accent) < 0.12 ? mix(accent, '#FFFFFF', 0.4) : accent;
    t.primary = visible;
    t.onPrimary = readableOn(visible);
    t.primaryContainer = mix(base.surface, visible, mode === 'dark' ? 0.34 : 0.16);
    t.onPrimaryContainer = mode === 'dark' ? mix(visible, '#FFFFFF', 0.75) : mix(visible, '#000000', 0.6);
  }

  const radius = ios
    ? { small: 8, medium: 10, large: 12, extraLarge: 14 }
    : { small: 8, medium: 12, large: 16, extraLarge: 28 };
  const fontBody = ios ? IOS_FONT : typeScale.fontBody;
  const fontDisplay = ios ? IOS_FONT : typeScale.fontDisplay;

  const bubbleIn = t.bubbleIn || t.surface3;
  const bubbleOut = t.primary;

  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary, contrastText: t.onPrimary, container: t.primaryContainer, onContainer: t.onPrimaryContainer },
      secondary: { main: t.secondary, contrastText: t.onSecondary, container: t.secondaryContainer, onContainer: t.onSecondaryContainer },
      error: { main: t.error, contrastText: t.onError, container: t.errorContainer, onContainer: t.onErrorContainer },
      success: { main: t.success },
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
      groupedBg: t.groupedBg || t.background,
      groupedItem: t.groupedItem || t.surface1,
      bubbleIn,
      bubbleInText: t.onSurface,
      bubbleOut,
      bubbleOutText: t.onPrimary,
    },
    appearance: {
      uiStyle, ios, bubbleRadius, textSize, wallpaper,
      wallpaperCss: wallpaperCss(wallpaper, mode, customWallpaper),
    },
    shape: { borderRadius: radius.medium },
    m3shape: radius,
    typography: {
      fontFamily: fontBody,
      ...Object.fromEntries(
        Object.entries(typeScale)
          .filter(([k]) => /^(display|headline|title|body|label)/.test(k))
          .map(([k, v]) => [k, { ...v, fontFamily: v.fontFamily === 'display' ? fontDisplay : fontBody, ...(ios ? { letterSpacing: undefined } : {}) }])
      ),
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: ios ? 12 : 999, textTransform: 'none', fontWeight: 600, paddingInline: 20,
            transition: 'transform .15s cubic-bezier(0.34,1.56,0.64,1), box-shadow .2s ease, background-color .2s ease',
            '&:active': { transform: 'scale(0.96)' },
          },
        },
      },
      MuiTextField: { defaultProps: { variant: 'filled' } },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            borderRadius: radius.large, backgroundColor: t.surfaceVariant, transition: 'background-color .2s ease',
            '&:before, &:after': { display: 'none' },
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none', transition: 'box-shadow .2s ease, transform .2s ease' } } },
      MuiCard: { styleOverrides: { root: { borderRadius: radius.extraLarge } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 999 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: radius.extraLarge } } },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: radius.large, transition: 'background-color .2s ease, transform .15s ease', '&:active': { transform: 'scale(0.985)' } },
        },
      },
      MuiMenu: { styleOverrides: { paper: { borderRadius: ios ? 14 : 16, overflow: 'hidden' } } },
      MuiAppBar: { styleOverrides: { root: { backgroundColor: t.surface1, color: t.onSurface, boxShadow: 'none' } } },
    },
  });
}

export function AppThemeProvider({ children }) {
  const [state, setState] = useState(loadSaved);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [customWallpaper, setCustomWallpaperState] = useState(getCustomWallpaper);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const resolvedMode = state.mode === 'system' ? (systemDark ? 'dark' : 'light') : state.mode;

  useEffect(() => { setSystemBarsStyle(resolvedMode); }, [resolvedMode]);

  const theme = useMemo(
    () => buildTheme({ ...state, mode: resolvedMode, customWallpaper }),
    [state, resolvedMode, customWallpaper]
  );

  const patch = useCallback((p) => setState((s) => ({ ...s, ...p })), []);

  const value = useMemo(() => ({
    ...state,
    resolvedMode,
    defaultAccent: (state.uiStyle === 'ios' ? iosLight : light).primary,
    setMode: (mode) => patch({ mode }),
    setAccent: (accent) => patch({ accent: typeof accent === 'string' ? accent : accent?.primary || null }),
    setUiStyle: (uiStyle) => patch({ uiStyle }),
    setBubbleRadius: (bubbleRadius) => patch({ bubbleRadius }),
    setTextSize: (textSize) => patch({ textSize }),
    setWallpaper: (wallpaper) => patch({ wallpaper }),
    customWallpaper,
    setCustomWallpaper: (dataUrl) => { persistCustomWallpaper(dataUrl); setCustomWallpaperState(dataUrl); },
    reset: () => setState({ ...DEFAULTS }),
  }), [state, resolvedMode, patch, customWallpaper]);

  return (
    <AppearanceContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppearanceContext.Provider>
  );
}
