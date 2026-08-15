import Avatar from '@mui/material/Avatar';
import { colorFromString } from '../../theme/tokens';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export default function FindlyAvatar({ src, name, seed, size = 40, sx, ...props }) {
  const bg = colorFromString(seed || name || '');
  return (
    <Avatar
      src={src || undefined}
      sx={{
        width: size,
        height: size,
        bgcolor: src ? undefined : bg,
        fontWeight: 700,
        fontSize: size * 0.4,
        ...sx,
      }}
      {...props}
    >
      {!src && initials(name)}
    </Avatar>
  );
}
