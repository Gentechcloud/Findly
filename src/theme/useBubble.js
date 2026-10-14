import { useTheme } from '@mui/material/styles';

// Стиль «пузыря» сообщения по настройкам оформления (скругление, размер текста, цвета).
export default function useBubbleSx(mine) {
  const theme = useTheme();
  const { bubbleRadius: r, textSize } = theme.appearance;
  const tail = Math.max(2, Math.round(r / 4));
  return {
    bgcolor: mine ? theme.m3.bubbleOut : theme.m3.bubbleIn,
    color: mine ? theme.m3.bubbleOutText : theme.m3.bubbleInText,
    borderTopLeftRadius: r,
    borderTopRightRadius: r,
    borderBottomRightRadius: mine ? tail : r,
    borderBottomLeftRadius: mine ? r : tail,
    fontSize: textSize,
    lineHeight: 1.35,
  };
}
