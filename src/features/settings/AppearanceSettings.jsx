import { useRef } from 'react';
import {
  Box,
  Typography,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  ButtonBase,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import { useAppearance } from '../../theme/ThemeProvider';
import { accentPresets } from '../../theme/accentPresets';
import { WALLPAPERS, wallpaperCss, fileToWallpaper } from '../../theme/wallpapers';
import useBubbleSx from '../../theme/useBubble';

import Stack from '../../components/common/Stack';
function Block({ title, children }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography sx={{ fontSize: 13, color: 'text.secondary', textTransform: 'uppercase', px: 1, pb: 0.75, letterSpacing: 0.2 }}>
        {title}
      </Typography>
      <Box sx={{ borderRadius: '12px', bgcolor: (t) => t.m3.groupedItem, p: 2, border: '1px solid', borderColor: 'divider' }}>
        {children}
      </Box>
    </Box>
  );
}

function PreviewBubble({ mine, children }) {
  const sx = useBubbleSx(mine);
  return (
    <Box sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%', px: 1.75, py: 0.9, ...sx }}>
      {children}
    </Box>
  );
}

// Живой предпросмотр: обои + два сообщения с текущими настройками
function ChatPreview() {
  const theme = useTheme();
  const bg = theme.appearance.wallpaperCss;
  return (
    <Box
      sx={{
        borderRadius: '14px', overflow: 'hidden', mb: 2.5, p: 2, display: 'flex', flexDirection: 'column', gap: 1,
        background: bg || theme.palette.background.default, border: '1px solid', borderColor: 'divider', minHeight: 150,
      }}
    >
      <PreviewBubble>Привет! Как тебе новый дизайн?</PreviewBubble>
      <PreviewBubble mine>Выглядит отлично, оставляю так 👍</PreviewBubble>
      <PreviewBubble>Ты можешь менять цвета, обои и размер текста</PreviewBubble>
    </Box>
  );
}

function ModeTile({ label, selected, onClick, bg, bubble, fg }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flex: 1, flexDirection: 'column', gap: 0.75, p: 1, borderRadius: '12px',
        border: '2px solid', borderColor: selected ? 'primary.main' : 'divider',
      }}
    >
      <Box sx={{ width: '100%', height: 56, borderRadius: '8px', background: bg, p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5, overflow: 'hidden' }}>
        <Box sx={{ width: '60%', height: 14, borderRadius: '7px', bgcolor: fg, opacity: 0.9 }} />
        <Box sx={{ width: '55%', height: 14, borderRadius: '7px', bgcolor: bubble, alignSelf: 'flex-end' }} />
      </Box>
      <Typography sx={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{label}</Typography>
    </ButtonBase>
  );
}

export default function AppearanceSettings() {
  const a = useAppearance();
  const theme = useTheme();
  const fileRef = useRef(null);
  const currentAccent = (a.accent || a.defaultAccent).toLowerCase();

  async function pickWallpaper(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await fileToWallpaper(file);
      a.setCustomWallpaper(dataUrl);
      a.setWallpaper('custom');
    } catch { /* не удалось прочитать картинку */ }
  }

  const tile = (id, content, label) => (
    <ButtonBase
      key={id}
      onClick={() => a.setWallpaper(id)}
      sx={{ flexDirection: 'column', gap: 0.5, flexShrink: 0 }}
    >
      <Box
        sx={{
          width: 64, height: 96, borderRadius: '10px', overflow: 'hidden', position: 'relative',
          border: '2px solid', borderColor: a.wallpaper === id ? 'primary.main' : 'divider',
          background: content, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {id === 'none' && <BlockRoundedIcon sx={{ color: 'text.secondary', opacity: 0.6 }} />}
        {a.wallpaper === id && (
          <Box sx={{ position: 'absolute', bottom: 4, right: 4, width: 20, height: 20, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckRoundedIcon sx={{ fontSize: 14 }} />
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>{label}</Typography>
    </ButtonBase>
  );

  return (
    <Box>
      <ChatPreview />

      <Block title="Размер текста">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography sx={{ fontSize: 12 }}>Аа</Typography>
          <Slider value={a.textSize} min={12} max={22} step={1} onChange={(_, v) => a.setTextSize(v)} />
          <Typography sx={{ fontSize: 22 }}>Аа</Typography>
          <Typography sx={{ minWidth: 28, textAlign: 'right', color: 'text.secondary' }}>{a.textSize}</Typography>
        </Stack>
      </Block>

      <Block title="Обои чата">
        <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5 }}>
          {tile('none', theme.palette.background.default, 'Нет')}
          {WALLPAPERS.filter((w) => w.id !== 'none').map((w) => tile(w.id, wallpaperCss(w.id, theme.palette.mode), w.name))}
          {a.customWallpaper && tile('custom', wallpaperCss('custom', theme.palette.mode, a.customWallpaper), 'Своё')}
          <ButtonBase onClick={() => fileRef.current?.click()} sx={{ flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
            <Box sx={{ width: 64, height: 96, borderRadius: '10px', border: '2px dashed', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main' }}>
              <AddPhotoAlternateRoundedIcon />
            </Box>
            <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>Из галереи</Typography>
          </ButtonBase>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickWallpaper} />
        </Box>
      </Block>

      <Block title="Цветовая тема">
        <Box sx={{ display: 'flex', gap: 1.25 }}>
          <ModeTile label="Светлая" selected={a.mode === 'light'} onClick={() => a.setMode('light')} bg="#F2F2F7" fg="#FFFFFF" bubble={theme.palette.primary.main} />
          <ModeTile label="Тёмная" selected={a.mode === 'dark'} onClick={() => a.setMode('dark')} bg="#111114" fg="#2C2C2E" bubble={theme.palette.primary.main} />
          <ModeTile label="Как в системе" selected={a.mode === 'system'} onClick={() => a.setMode('system')} bg="linear-gradient(90deg,#F2F2F7 50%,#111114 50%)" fg="#8E8E93" bubble={theme.palette.primary.main} />
        </Box>
      </Block>

      <Block title="Акцентный цвет">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 1.25, justifyItems: 'center' }}>
          {accentPresets.map((p) => {
            const selected = currentAccent === p.primary.toLowerCase();
            return (
              <ButtonBase
                key={p.primary}
                title={p.name}
                onClick={() => a.setAccent(p.primary)}
                sx={{
                  width: 30, height: 30, borderRadius: '50%', bgcolor: p.primary, color: '#fff',
                  outline: selected ? '2px solid' : 'none', outlineColor: 'text.primary', outlineOffset: 2,
                }}
              >
                {selected && <CheckRoundedIcon sx={{ fontSize: 18 }} />}
              </ButtonBase>
            );
          })}
        </Box>
      </Block>

      <Block title="Скругление сообщений">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ width: 22, height: 14, border: '2px solid', borderColor: 'text.secondary', borderRadius: '2px' }} />
          <Slider value={a.bubbleRadius} min={0} max={26} step={1} onChange={(_, v) => a.setBubbleRadius(v)} />
          <Box sx={{ width: 22, height: 14, border: '2px solid', borderColor: 'text.secondary', borderRadius: '8px' }} />
          <Typography sx={{ minWidth: 28, textAlign: 'right', color: 'text.secondary' }}>{a.bubbleRadius}</Typography>
        </Stack>
      </Block>

      <Block title="Стиль интерфейса">
        <ToggleButtonGroup
          exclusive fullWidth size="small" value={a.uiStyle}
          onChange={(_, v) => v && a.setUiStyle(v)}
        >
          <ToggleButton value="ios">iOS</ToggleButton>
          <ToggleButton value="material">Material 3</ToggleButton>
        </ToggleButtonGroup>
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1 }}>
          iOS-раскладка (нижняя панель вкладок, сгруппированные списки) включается на телефоне.
          Цвета и шрифты меняются везде, на компьютере раскладка остаётся прежней.
        </Typography>
      </Block>

      <Button color="error" onClick={a.reset} sx={{ display: 'block', mx: 'auto' }}>Сбросить оформление</Button>
    </Box>
  );
}
