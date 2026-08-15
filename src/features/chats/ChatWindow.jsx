import { useEffect, useRef, useState } from 'react';
import {
  Box, Stack, Typography, IconButton, TextField, CircularProgress, Tooltip, Snackbar, Alert,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import MessageBubble from './MessageBubble';
import VoiceRecorder from './VoiceRecorder';

function attachmentTypeFor(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

export default function ChatWindow({ chatId, otherProfile, myId, onBack, isDesktop }) {
  const [messages, setMessages] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: msgs } = await supabase
        .from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      const { data: hidden } = await supabase
        .from('message_hidden').select('message_id').eq('user_id', myId);
      if (!cancelled) {
        setMessages(msgs || []);
        setHiddenIds(new Set((hidden || []).map((h) => h.message_id)));
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [chatId, myId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const visibleMessages = messages.filter((m) => !hiddenIds.has(m.id));
  const byId = Object.fromEntries(messages.map((m) => [m.id, m]));

  async function sendMessage(fields) {
    const { error: sendErr } = await supabase.from('messages').insert({
      chat_id: chatId,
      sender_id: myId,
      content: fields.content || '',
      message_type: fields.message_type || 'text',
      attachment_url: fields.attachment_url || null,
      attachment_name: fields.attachment_name || null,
      attachment_size: fields.attachment_size || null,
      duration_seconds: fields.duration_seconds || null,
      waveform_levels: fields.waveform_levels || null,
      reply_to_id: replyingTo?.id || null,
    });
    if (sendErr) setError(sendErr.message);
    setReplyingTo(null);
  }

  async function handleSendText(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendMessage({ content: text, message_type: 'text' });
  }

  async function handleVoiceRecorded(blob, durationSeconds, levels) {
    setUploading(true);
    const path = `${myId}/${chatId}/${crypto.randomUUID()}.webm`;
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, blob, { contentType: 'audio/webm' });
    setUploading(false);
    if (upErr) { setError('Не удалось отправить голосовое: ' + upErr.message); return; }
    const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
    await sendMessage({
      message_type: 'voice', content: '[голосовое сообщение]',
      attachment_url: pub.publicUrl, duration_seconds: durationSeconds, waveform_levels: levels,
    });
  }

  async function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { alert('Пока лимит — 50 МБ на бесплатном тарифе Supabase. После перехода на платный/свой сервер лимит можно увеличить до 1 ГБ.'); return; }

    setUploading(true);
    const path = `${myId}/${chatId}/${crypto.randomUUID()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (upErr) { setError('Не удалось загрузить файл: ' + upErr.message); return; }
    const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
    await sendMessage({
      message_type: attachmentTypeFor(file), content: `[файл] ${file.name}`,
      attachment_url: pub.publicUrl, attachment_name: file.name, attachment_size: file.size,
    });
  }

  async function handleEdit(messageId, newContent) {
    await supabase.from('messages').update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', messageId);
  }
  async function handleDeleteForEveryone(messageId) {
    await supabase.from('messages').update({ deleted_for_everyone: true }).eq('id', messageId);
  }
  async function handleDeleteForMe(messageId) {
    await supabase.from('message_hidden').insert({ message_id: messageId, user_id: myId });
    setHiddenIds((prev) => new Set(prev).add(messageId));
  }
  function handleDownloadTxt(message) {
    const text = `${new Date(message.created_at).toLocaleString()}\n\n${message.content}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `message-${message.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
        {!isDesktop && <IconButton onClick={onBack}><ArrowBackRoundedIcon /></IconButton>}
        <FindlyAvatar src={otherProfile?.avatar_url} name={`${otherProfile?.first_name || ''} ${otherProfile?.last_name || ''}`} seed={otherProfile?.username} size={40} />
        <Box>
          <Typography variant="titleMedium">{otherProfile ? `${otherProfile.first_name} ${otherProfile.last_name}` : '...'}</Typography>
          <Typography variant="labelSmall" color="text.secondary">@{otherProfile?.username}</Typography>
        </Box>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {loading ? (
          <Box sx={{ m: 'auto' }}><CircularProgress size={28} /></Box>
        ) : visibleMessages.length === 0 ? (
          <Typography variant="bodyMedium" color="text.secondary" sx={{ m: 'auto' }}>Сообщений пока нет — напишите первым!</Typography>
        ) : (
          visibleMessages.map((m) => (
            <MessageBubble
              key={m.id}
              message={m}
              mine={m.sender_id === myId}
              replyPreview={m.reply_to_id ? (byId[m.reply_to_id]?.content || 'сообщение') : null}
              onReply={setReplyingTo}
              onEdit={handleEdit}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForEveryone={handleDeleteForEveryone}
              onDownloadTxt={handleDownloadTxt}
            />
          ))
        )}
        <div ref={bottomRef} />
      </Box>

      {replyingTo && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderTop: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ width: 3, alignSelf: 'stretch', bgcolor: 'primary.main', borderRadius: 1 }} />
          <Typography variant="bodyMedium" noWrap sx={{ flex: 1 }}>Ответ на: {replyingTo.content}</Typography>
          <IconButton size="small" onClick={() => setReplyingTo(null)}><CloseRoundedIcon fontSize="small" /></IconButton>
        </Stack>
      )}

      <Stack component="form" onSubmit={handleSendText} direction="row" alignItems="center" spacing={1} sx={{ p: 1.5, borderTop: replyingTo ? 'none' : '1px solid', borderColor: 'divider' }}>
        <input ref={fileInputRef} type="file" hidden onChange={handleFilePicked} />
        <Tooltip title="Прикрепить фото, видео или файл">
          <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <AttachFileRoundedIcon />
          </IconButton>
        </Tooltip>

        {draft.trim() === '' ? <VoiceRecorder onRecorded={handleVoiceRecorded} /> : null}

        <TextField
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={uploading ? 'Загрузка вложения...' : 'Написать сообщение...'}
          fullWidth size="small" disabled={uploading}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSendText(e); }}
        />
        <Tooltip title="Отправить">
          <span>
            <IconButton type="submit" disabled={!draft.trim()} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' }, '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}>
              <SendRoundedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: 4 }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
