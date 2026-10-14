import { useRef, useState } from 'react';
import {
  Box,
  Typography,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  TextField,
  Divider,
  ButtonBase,
} from '@mui/material';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Waveform from '../../components/common/Waveform';
import VideoMessagePlayer from './VideoMessagePlayer';
import useBubbleSx from '../../theme/useBubble';
import { colorFromString } from '../../theme/tokens';
import { downloadUrl } from '../../native';

import Stack from '../../components/common/Stack';
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function VoicePlayer({ url, duration, levels, mine }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause(); else audio.play();
  }

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 190 }}>
      <IconButton
        size="small" onClick={toggle}
        sx={{ bgcolor: mine ? 'rgba(255,255,255,0.25)' : 'primary.main', color: mine ? 'inherit' : 'primary.contrastText', '&:hover': { bgcolor: mine ? 'rgba(255,255,255,0.35)' : 'primary.main' } }}
      >
        {playing ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
      </IconButton>
      <Box sx={{ flex: 1 }}>
        <Waveform levels={levels || []} height={26} progress={progress} color={mine ? 'currentColor' : undefined} />
      </Box>
      <Typography variant="labelSmall" sx={{ minWidth: 32 }}>
        {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
      </Typography>
      <audio
        ref={audioRef} src={url} preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => setProgress(e.target.duration ? e.target.currentTime / e.target.duration : 0)}
      />
    </Stack>
  );
}

// Содержимое сообщения по типу (используется и в пузыре, и в публикации канала)
export function MessageContent({ message, mine, textSize }) {
  if (message.message_type === 'voice') {
    return <VoicePlayer url={message.attachment_url} duration={message.duration_seconds || 0} levels={message.waveform_levels} mine={mine} />;
  }
  if (message.message_type === 'image') {
    return <Box component="img" src={message.attachment_url} alt="" sx={{ maxWidth: '100%', width: 260, maxHeight: 340, objectFit: 'cover', borderRadius: '12px', display: 'block' }} />;
  }
  if (message.message_type === 'video') return <VideoMessagePlayer src={message.attachment_url} />;
  if (message.message_type === 'file') {
    return (
      <ButtonBase onClick={() => downloadUrl(message.attachment_url, message.attachment_name)} sx={{ gap: 1, textAlign: 'left', color: 'inherit', borderRadius: 2 }}>
        <InsertDriveFileRoundedIcon />
        <Stack sx={{ minWidth: 0 }}>
          <Typography variant="bodyMedium" noWrap sx={{ fontSize: textSize }}>{message.attachment_name}</Typography>
          <Typography variant="labelSmall" sx={{ opacity: 0.8 }}>{formatSize(message.attachment_size)}</Typography>
        </Stack>
      </ButtonBase>
    );
  }
  return <Typography sx={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap', fontSize: textSize, lineHeight: 1.35 }}>{message.content}</Typography>;
}

export default function MessageBubble({
  message, mine, replyPreview, senderName, senderSeed, variant = 'bubble', footer,
  canReply = true, canModerate = false,
  onReply, onEdit, onDeleteForMe, onDeleteForEveryone, onModDelete, onDownloadTxt,
}) {
  const bubbleSx = useBubbleSx(mine);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const longPressTimer = useRef(null);
  const isPost = variant === 'post';

  const openMenuAt = (x, y) => setMenuAnchor({ top: y, left: x });
  const closeMenu = () => setMenuAnchor(null);

  function saveEdit() {
    if (editValue.trim() && editValue !== message.content) onEdit(message.id, editValue.trim());
    setEditing(false);
  }

  const wrapSx = isPost
    ? { alignSelf: 'flex-start', width: 'min(100%, 540px)' }
    : { alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%' };

  if (message.deleted_for_everyone) {
    return (
      <Box sx={wrapSx}>
        <Box sx={{ ...bubbleSx, bgcolor: 'action.hover', color: 'text.secondary', px: 1.75, py: 1, fontStyle: 'italic', fontSize: 14 }}>
          Сообщение удалено
        </Box>
      </Box>
    );
  }

  const containerSx = isPost
    ? { ...bubbleSx, borderRadius: `${Math.min(bubbleSx.borderTopLeftRadius, 22)}px`, p: 1.5 }
    : { ...bubbleSx, px: 1.75, py: 1 };

  return (
    <Box sx={wrapSx}>
      <Box
        onContextMenu={(e) => { e.preventDefault(); openMenuAt(e.clientX, e.clientY); }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          longPressTimer.current = setTimeout(() => openMenuAt(t.clientX, t.clientY), 480);
        }}
        onTouchEnd={() => clearTimeout(longPressTimer.current)}
        onTouchMove={() => clearTimeout(longPressTimer.current)}
        onDoubleClick={() => canReply && onReply?.(message)}
        sx={{
          ...containerSx, cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none',
          transition: 'transform .12s ease', '&:active': { transform: 'scale(0.992)' },
        }}
      >
        {senderName && (
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: isPost ? 'text.primary' : colorFromString(senderSeed || senderName), mb: 0.25 }}>
            {senderName}
          </Typography>
        )}

        {replyPreview && (
          <Box sx={{ borderLeft: '3px solid', borderColor: mine ? 'rgba(255,255,255,0.6)' : 'primary.main', pl: 1, mb: 0.75, opacity: 0.85 }}>
            <Typography variant="labelSmall" noWrap sx={{ display: 'block' }}>{replyPreview}</Typography>
          </Box>
        )}

        {editing ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <TextField
              value={editValue} onChange={(e) => setEditValue(e.target.value)}
              size="small" autoFocus multiline maxRows={4}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
              sx={{ minWidth: 180, '& .MuiInputBase-root': { color: 'inherit' } }}
            />
            <IconButton size="small" onClick={saveEdit} sx={{ color: 'inherit' }}><CheckRoundedIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setEditing(false)} sx={{ color: 'inherit' }}><CloseRoundedIcon fontSize="small" /></IconButton>
          </Stack>
        ) : (
          <MessageContent message={message} mine={mine} textSize={bubbleSx.fontSize} />
        )}

        <Typography sx={{ fontSize: 11, opacity: 0.65, textAlign: 'right', mt: 0.25 }}>
          {message.edited_at ? 'изменено · ' : ''}
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Typography>

        {footer && <Box onClick={(e) => e.stopPropagation()} sx={{ mt: 0.5, cursor: 'default' }}>{footer}</Box>}
      </Box>

      <Menu
        open={!!menuAnchor} onClose={closeMenu}
        anchorReference="anchorPosition" anchorPosition={menuAnchor || undefined}
        slotProps={{ backdrop: { sx: { backdropFilter: { xs: 'blur(4px)', md: 'none' } } } }}
      >
        {canReply && (
          <MenuItem onClick={() => { onReply?.(message); closeMenu(); }}>
            <ListItemIcon><ReplyRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Ответить</ListItemText>
          </MenuItem>
        )}
        {mine && message.message_type === 'text' && (
          <MenuItem onClick={() => { setEditValue(message.content); setEditing(true); closeMenu(); }}>
            <ListItemIcon><EditRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Редактировать</ListItemText>
          </MenuItem>
        )}
        {message.message_type === 'text' && (
          <MenuItem onClick={() => { onDownloadTxt?.(message); closeMenu(); }}>
            <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Скачать .txt</ListItemText>
          </MenuItem>
        )}
        {['image', 'video', 'file'].includes(message.message_type) && (
          <MenuItem onClick={() => { downloadUrl(message.attachment_url, message.attachment_name); closeMenu(); }}>
            <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Скачать</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { onDeleteForMe?.(message.id); closeMenu(); }}>
          <ListItemIcon><DeleteRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Удалить у себя</ListItemText>
        </MenuItem>
        {mine && (
          <MenuItem onClick={() => { onDeleteForEveryone?.(message.id); closeMenu(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteForeverRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Удалить у всех</ListItemText>
          </MenuItem>
        )}
        {!mine && canModerate && (
          <MenuItem onClick={() => { onModDelete?.(message.id); closeMenu(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><GavelRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Удалить (модерация)</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
