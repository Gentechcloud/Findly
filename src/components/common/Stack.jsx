import { forwardRef } from 'react';
import MuiStack from '@mui/material/Stack';

// В MUI 9 у Stack больше нет «коротких» пропсов (alignItems, justifyContent, flexWrap, ...) —
// они молча превращались в атрибуты DOM и не работали. Эта обёртка переносит их в sx,
// чтобы привычная запись <Stack direction="row" alignItems="center"> снова работала.
const STYLE_PROPS = ['alignItems', 'justifyContent', 'flexWrap', 'gap', 'rowGap', 'columnGap', 'flex', 'textAlign', 'width', 'height'];

const Stack = forwardRef(function Stack({ sx, ...props }, ref) {
  const own = {};
  const rest = {};
  Object.keys(props).forEach((k) => {
    if (STYLE_PROPS.includes(k)) own[k] = props[k]; else rest[k] = props[k];
  });
  const merged = Object.keys(own).length ? [own, ...(Array.isArray(sx) ? sx : [sx])] : sx;
  return <MuiStack ref={ref} sx={merged} {...rest} />;
});

export default Stack;
