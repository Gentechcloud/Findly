import { useRef, useState } from 'react';
import {
  Box, Paper, Typography, Menu, MenuItem, ListItemIcon, ListItemText,
  IconButton, TextField, Stack, Divider,
} from '@mui/material';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import InsertDriveFileRoundedIcon from '@mui/icons-material/InsertDriveFileRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Waveform from '../../components/common/Waveform';

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
    if (playing) { audio.pause(); } else { audio.play(); }
  }

  const activeBars = Math.round((levels?.length || 0) * progress);
  const coloredLevels = (levels || []).map((v, i) => (i < activeBars ? v : v));

  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 200 }}>
      <IconButton
        size="small" onClick={toggle}
        sx={{ bgcolor: mine ? 'rgba(255,255,255,0.25)' : 'primary.main', color: mine ? 'inherit' : 'primary.contrastText' }}
      >
        {playing ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
      </IconButton>
      <Box sx={{ flex: 1, position: 'relative' }}>
        <Waveform levels={coloredLevels} height={26} color={mine ? 'rgba(255,255,255,0.9)' : undefined} />
      </Box>
      <Typography variant="labelSmall" sx={{ minWidth: 32 }}>
        {String(Math.floor(duration / 60)).padStart(1, '0')}:{String(duration % 60).padStart(2, '0')}
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

export default function MessageBubble({
  message, mine, replyPreview, onReply, onEdit, onDeleteForMe, onDeleteForEveryone, onDownloadTxt,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(message.content);
  const longPressTimer = useRef(null);

  function openMenuAt(x, y) {
    setMenuAnchor({ top: y, left: x });
  }
  function handleContextMenu(e) {
    e.preventDefault();
    openMenuAt(e.clientX, e.clientY);
  }
  function handleTouchStart(e) {
    const touch = e.touches[0];
    longPressTimer.current = setTimeout(() => openMenuAt(touch.clientX, touch.clientY), 480);
  }
  function handleTouchEnd() {
    clearTimeout(longPressTimer.current);
  }

  function closeMenu() { setMenuAnchor(null); }

  function saveEdit() {
    if (editValue.trim() && editValue !== message.content) onEdit(message.id, editValue.trim());
    setEditing(false);
  }

  if (message.deleted_for_everyone) {
    return (
      <Box sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
        <Paper sx={{ px: 1.75, py: 1, borderRadius: '20px', bgcolor: 'action.hover', fontStyle: 'italic' }}>
          <Typography variant="bodyMedium" color="text.secondary">Сообщение удалено</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '72%' }}>
      <Paper
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={() => onReply(message)}
        sx={{
          px: 2, py: 1.1, cursor: 'pointer', userSelect: 'none',
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          borderBottomRightRadius: mine ? 6 : 20,
          borderBottomLeftRadius: mine ? 20 : 6,
          transition: 'transform .12s ease',
          '&:active': { transform: 'scale(0.985)' },
          bgcolor: mine ? 'primary.main' : 'action.hover',
          color: mine ? 'primary.contrastText' : 'text.primary',
        }}
      >
        {replyPreview && (
          <Box sx={{
            borderLeft: '3px solid', borderColor: mine ? 'rgba(255,255,255,0.6)' : 'primary.main',
            pl: 1, mb: 0.75, opacity: 0.85,
          }}>
            <Typography variant="labelSmall" noWrap>{replyPreview}</Typography>
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
            <IconButton size="small" onClick={saveEdit}><CheckRoundedIcon fontSize="small" /></IconButton>
            <IconButton size="small" onClick={() => setEditing(false)}><CloseRoundedIcon fontSize="small" /></IconButton>
          </Stack>
        ) : message.message_type === 'voice' ? (
          <VoicePlayer url={message.attachment_url} duration={message.duration_seconds || 0} levels={message.waveform_levels} mine={mine} />
        ) : message.message_type === 'image' ? (
          <Box component="img" src={message.attachment_url} alt="" sx={{ maxWidth: 260, maxHeight: 320, borderRadius: 2, display: 'block' }} />
        ) : message.message_type === 'video' ? (
          <Box component="video" src={message.attachment_url} controls sx={{ maxWidth: 260, maxHeight: 320, borderRadius: 2, display: 'block' }} />
        ) : message.message_type === 'file' ? (
          <Stack direction="row" spacing={1} alignItems="center" component="a" href={message.attachment_url} download
            sx={{ textDecoration: 'none', color: 'inherit' }}>
            <InsertDriveFileRoundedIcon />
            <Stack sx={{ minWidth: 0 }}>
              <Typography variant="bodyMedium" noWrap>{message.attachment_name}</Typography>
              <Typography variant="labelSmall" sx={{ opacity: 0.8 }}>{formatSize(message.attachment_size)}</Typography>
            </Stack>
          </Stack>
        ) : (
          <Typography variant="bodyMedium" sx={{ wordBreak: 'break-word' }}>{message.content}</Typography>
        )}
      </Paper>
      <Typography variant="labelSmall" color="text.secondary" sx={{ display: 'block', textAlign: mine ? 'right' : 'left', mt: 0.25 }}>
        {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {message.edited_at ? ' · изменено' : ''}
      </Typography>

      <Menu
        open={!!menuAnchor}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menuAnchor || undefined}
        slotProps={{ backdrop: { sx: { backdropFilter: { xs: 'blur(4px)', md: 'none' } } } }}
      >
        <MenuItem onClick={() => { onReply(message); closeMenu(); }}>
          <ListItemIcon><ReplyRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Ответить</ListItemText>
        </MenuItem>
        {mine && message.message_type === 'text' && (
          <MenuItem onClick={() => { setEditing(true); closeMenu(); }}>
            <ListItemIcon><EditRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Редактировать</ListItemText>
          </MenuItem>
        )}
        {message.message_type === 'text' && (
          <MenuItem onClick={() => { onDownloadTxt(message); closeMenu(); }}>
            <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Скачать .txt</ListItemText>
          </MenuItem>
        )}
        {['image', 'video', 'file'].includes(message.message_type) && (
          <MenuItem component="a" href={message.attachment_url} download onClick={closeMenu}>
            <ListItemIcon><DownloadRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Скачать</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { onDeleteForMe(message.id); closeMenu(); }}>
          <ListItemIcon><DeleteRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Удалить у себя</ListItemText>
        </MenuItem>
        {mine && (
          <MenuItem onClick={() => { onDeleteForEveryone(message.id); closeMenu(); }} sx={{ color: 'error.main' }}>
            <ListItemIcon><DeleteForeverRoundedIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Удалить у всех</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
}
