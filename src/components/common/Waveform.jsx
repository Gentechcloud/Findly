import { useMemo } from 'react';
import { Box, useTheme } from '@mui/material';

/**
 * Decorative / functional waveform bars.
 * - `variant="ambient"` → slow idle animation, used as a page motif (dividers, empty states, splash).
 * - `variant="active"`  → fast animation, used while actually recording/playing a voice message.
 * - `levels`            → pass real amplitude data (0..1 per bar) to render a static/live waveform.
 */
export default function Waveform({ bars = 28, variant = 'ambient', levels, color, height = 32 }) {
  const theme = useTheme();
  const barColor = color || theme.m3?.tertiary || theme.palette.primary.main;

  const heights = useMemo(() => {
    if (levels?.length) return levels;
    return Array.from({ length: bars }, () => 0.25 + Math.random() * 0.75);
  }, [bars, levels]);

  const animated = !levels;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        height,
      }}
      aria-hidden
    >
      {heights.map((h, i) => (
        <Box
          key={i}
          sx={{
            width: 3,
            borderRadius: 999,
            backgroundColor: barColor,
            height: `${Math.max(12, h * 100)}%`,
            opacity: 0.85,
            transformOrigin: 'center',
            ...(animated && {
              animation: `findly-wave ${variant === 'active' ? 0.7 : 1.8}s ease-in-out ${i * 0.045}s infinite alternate`,
              '@keyframes findly-wave': {
                from: { transform: 'scaleY(0.4)' },
                to: { transform: 'scaleY(1)' },
              },
            }),
          }}
        />
      ))}
    </Box>
  );
}
