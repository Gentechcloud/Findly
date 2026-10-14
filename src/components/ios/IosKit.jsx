import { Children, Fragment } from 'react';
import { Box, Typography, ButtonBase, Divider } from '@mui/material';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

// Полупрозрачный фон панелей (как в iOS: размытие содержимого под шапкой / панелью вкладок)
const barBg = (t) => (t.palette.mode === 'dark' ? 'rgba(28,28,30,0.82)' : 'rgba(249,249,249,0.86)');

export function IosHeader({ title, subtitle, left, right, onTitleClick }) {
  return (
    <Box
      sx={{
        position: 'sticky', top: 0, zIndex: 10, flexShrink: 0,
        pt: 'env(safe-area-inset-top, 0px)',
        bgcolor: barBg, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '0.5px solid', borderColor: 'divider',
      }}
    >
      <Box sx={{ minHeight: 48, display: 'grid', gridTemplateColumns: '1fr minmax(0, 2fr) 1fr', alignItems: 'center', px: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', minWidth: 0 }}>{left}</Box>
        <Box
          onClick={onTitleClick}
          sx={{ textAlign: 'center', minWidth: 0, cursor: onTitleClick ? 'pointer' : 'default', py: 0.5 }}
        >
          <Typography noWrap sx={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>{title}</Typography>
          {subtitle && (
            <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.2 }}>{subtitle}</Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 0 }}>{right}</Box>
      </Box>
    </Box>
  );
}

// Кнопка «‹ Назад» в шапке
export function IosBackButton({ label = 'Назад', onClick }) {
  return (
    <ButtonBase onClick={onClick} sx={{ color: 'primary.main', fontSize: 17, py: 1, pr: 1, borderRadius: 2 }}>
      <ChevronLeftRoundedIcon sx={{ fontSize: 30, ml: -0.5 }} />
      {label}
    </ButtonBase>
  );
}

export function IosSearchField({ placeholder = 'Поиск', onClick }) {
  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <ButtonBase
        onClick={onClick}
        sx={{
          width: '100%', height: 36, borderRadius: '10px', px: 1.25, gap: 0.75,
          backgroundColor: (t) => t.m3.surfaceVariant, color: 'text.secondary', fontSize: 16,
        }}
      >
        <SearchRoundedIcon sx={{ fontSize: 20 }} />
        {placeholder}
      </ButtonBase>
    </Box>
  );
}

export function IosTabBar({ items, value, onChange }) {
  return (
    <Box
      component="nav"
      sx={{
        flexShrink: 0, pb: 'env(safe-area-inset-bottom, 0px)',
        bgcolor: barBg, backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '0.5px solid', borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', height: 50 }}>
        {items.map((item, i) => {
          const active = value === i;
          return (
            <ButtonBase
              key={item.label}
              onClick={() => onChange(i)}
              sx={{
                flex: 1, flexDirection: 'column', gap: 0.25, borderRadius: 0,
                color: active ? 'primary.main' : 'text.secondary',
                transition: 'color .15s ease, transform .15s ease',
                '&:active': { transform: 'scale(0.94)' },
              }}
            >
              <Box sx={{ position: 'relative', display: 'flex', '& svg': { fontSize: 26 } }}>
                {active ? item.activeIcon || item.icon : item.icon}
                {item.dot && <Box sx={{ position: 'absolute', top: 0, right: -2, width: 9, height: 9, borderRadius: '50%', bgcolor: 'error.main', border: '1.5px solid', borderColor: 'background.paper' }} />}
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 500, lineHeight: 1 }}>{item.label}</Typography>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}

// ---------- Сгруппированные списки (экран настроек) ----------
export function IosSection({ header, footer, children, inset = 16 }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <Box sx={{ mb: 2.5 }}>
      {header && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', textTransform: 'uppercase', px: 2.5, pb: 0.75, letterSpacing: 0.2 }}>
          {header}
        </Typography>
      )}
      <Box sx={{ mx: 1.5, borderRadius: '12px', overflow: 'hidden', bgcolor: (t) => t.m3.groupedItem }}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <Divider sx={{ ml: `${inset}px`, borderColor: 'divider', borderBottomWidth: '0.5px' }} />}
            {row}
          </Fragment>
        ))}
      </Box>
      {footer && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', px: 2.5, pt: 0.75 }}>{footer}</Typography>
      )}
    </Box>
  );
}

export function IosIconBox({ children, color = '#007AFF' }) {
  return (
    <Box
      sx={{
        width: 30, height: 30, borderRadius: '7px', bgcolor: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& svg': { fontSize: 19 },
      }}
    >
      {children}
    </Box>
  );
}

export function IosRow({ icon, iconColor, title, subtitle, value, onClick, chevron = true, danger, right }) {
  const content = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.1, minHeight: 46, width: '100%', textAlign: 'left' }}>
      {icon && <IosIconBox color={iconColor}>{icon}</IosIconBox>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography noWrap sx={{ fontSize: 17, color: danger ? 'error.main' : 'text.primary' }}>{title}</Typography>
        {subtitle && <Typography noWrap sx={{ fontSize: 13, color: 'text.secondary' }}>{subtitle}</Typography>}
      </Box>
      {value && <Typography noWrap sx={{ fontSize: 17, color: 'text.secondary', maxWidth: '45%' }}>{value}</Typography>}
      {right}
      {onClick && chevron && <ChevronRightRoundedIcon sx={{ color: 'text.secondary', opacity: 0.6, fontSize: 22, mr: -0.5 }} />}
    </Box>
  );
  if (!onClick) return content;
  return <ButtonBase onClick={onClick} sx={{ display: 'block', width: '100%', borderRadius: 0 }}>{content}</ButtonBase>;
}
