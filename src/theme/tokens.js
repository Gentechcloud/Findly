// Findly — Material 3 design tokens
// Seed hue: electric indigo (~245°) for primary, paired with a warm amber
// tertiary that becomes the "waveform" signature accent used across voice
// messages, loading states and empty states.

export const light = {
  primary: '#4A46E0',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E2DFFF',
  onPrimaryContainer: '#14116B',

  secondary: '#5C5D72',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E1E0F9',
  onSecondaryContainer: '#191A2C',

  tertiary: '#8A5D00',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFDEA6',
  onTertiaryContainer: '#2B1B00',

  error: '#BA1A1A',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#410002',

  background: '#FCFAFF',
  onBackground: '#1B1B21',
  surface: '#FCFAFF',
  onSurface: '#1B1B21',
  surfaceVariant: '#E4E1EC',
  onSurfaceVariant: '#47464F',

  surface1: '#F3F1FB',
  surface2: '#EDEBF9',
  surface3: '#E7E4F7',
  surface4: '#E4E2F6',
  surface5: '#DFDDF4',

  outline: '#78767F',
  outlineVariant: '#C8C5D0',
  inverseSurface: '#303036',
  inverseOnSurface: '#F3EFF6',
  inversePrimary: '#C4C0FF',
  shadow: '#000000',
  scrim: '#000000',
  success: '#2E7D32',
  online: '#3DDC84',
};

export const dark = {
  primary: '#C4C0FF',
  onPrimary: '#1D1A6E',
  primaryContainer: '#322F86',
  onPrimaryContainer: '#E2DFFF',

  secondary: '#C5C4DD',
  onSecondary: '#2D2E42',
  secondaryContainer: '#444559',
  onSecondaryContainer: '#E1E0F9',

  tertiary: '#FFB951',
  onTertiary: '#452B00',
  tertiaryContainer: '#634100',
  onTertiaryContainer: '#FFDEA6',

  error: '#FFB4AB',
  onError: '#690005',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',

  background: '#131318',
  onBackground: '#E4E1E9',
  surface: '#131318',
  onSurface: '#E4E1E9',
  surfaceVariant: '#47464F',
  onSurfaceVariant: '#C8C5D0',

  surface1: '#1B1A24',
  surface2: '#201F2C',
  surface3: '#252433',
  surface4: '#272636',
  surface5: '#2B2A3D',

  outline: '#928F99',
  outlineVariant: '#47464F',
  inverseSurface: '#E4E1E9',
  inverseOnSurface: '#303036',
  inversePrimary: '#4A46E0',
  shadow: '#000000',
  scrim: '#000000',
  success: '#8BD48F',
  online: '#3DDC84',
};

// M3 shape scale
export const shape = {
  none: 0,
  extraSmall: 4,
  small: 8,
  medium: 12,
  large: 16,
  extraLarge: 28,
  full: 999,
};

// M3 type scale (role -> css-ish spec). Display/Headline/Title use "Sora"
// (geometric, a little unusual — avoids the generic Inter-everywhere look),
// Body/Label use "Inter" for maximum legibility in dense chat UI.
export const typeScale = {
  fontDisplay: '"Sora", "Inter", system-ui, sans-serif',
  fontBody: '"Inter", system-ui, sans-serif',
  displayLarge: { fontFamily: 'display', fontWeight: 600, fontSize: '3.5rem', lineHeight: 1.12, letterSpacing: '-0.02em' },
  displayMedium: { fontFamily: 'display', fontWeight: 600, fontSize: '2.8rem', lineHeight: 1.15, letterSpacing: '-0.015em' },
  displaySmall: { fontFamily: 'display', fontWeight: 600, fontSize: '2.25rem', lineHeight: 1.18 },
  headlineLarge: { fontFamily: 'display', fontWeight: 600, fontSize: '2rem', lineHeight: 1.2 },
  headlineMedium: { fontFamily: 'display', fontWeight: 600, fontSize: '1.75rem', lineHeight: 1.22 },
  headlineSmall: { fontFamily: 'display', fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.25 },
  titleLarge: { fontFamily: 'display', fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.3 },
  titleMedium: { fontFamily: 'body', fontWeight: 600, fontSize: '1rem', lineHeight: 1.4, letterSpacing: '0.01em' },
  titleSmall: { fontFamily: 'body', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.4, letterSpacing: '0.01em' },
  bodyLarge: { fontFamily: 'body', fontWeight: 400, fontSize: '1rem', lineHeight: 1.5 },
  bodyMedium: { fontFamily: 'body', fontWeight: 400, fontSize: '0.875rem', lineHeight: 1.45 },
  bodySmall: { fontFamily: 'body', fontWeight: 400, fontSize: '0.75rem', lineHeight: 1.4 },
  labelLarge: { fontFamily: 'body', fontWeight: 600, fontSize: '0.875rem', lineHeight: 1.3, letterSpacing: '0.02em' },
  labelMedium: { fontFamily: 'body', fontWeight: 600, fontSize: '0.75rem', lineHeight: 1.3, letterSpacing: '0.03em' },
  labelSmall: { fontFamily: 'body', fontWeight: 600, fontSize: '0.6875rem', lineHeight: 1.3, letterSpacing: '0.03em' },
};

// Palette used to derive a deterministic "random" avatar color from a
// user's id/username when no photo is set (feature #2).
export const avatarPalette = [
  '#4A46E0', '#8A5D00', '#2E7D32', '#B23A48', '#0B7285',
  '#7048E8', '#C2410C', '#0F766E', '#A21CAF', '#1D4ED8',
  '#B45309', '#15803D', '#BE185D', '#4338CA', '#B91C1C', '#0369A1',
];

export function colorFromString(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
