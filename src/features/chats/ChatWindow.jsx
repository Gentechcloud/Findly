import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  InputBase,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  ButtonBase,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import { supabase } from '../../lib/supabaseClient';
import FindlyAvatar from '../../components/common/FindlyAvatar';
import ProfileViewDialog from '../../components/common/ProfileViewDialog';
import { IosHeader, IosBackButton } from '../../components/ios/IosKit';
import MessageBubble from './MessageBubble';
import VoiceRecorder from './VoiceRecorder';
import CommentsDialog from './CommentsDialog';
import GroupInfoPanel from '../groups/GroupInfoPanel';
import { saveText } from '../../native';

import Stack from '../../components/common/Stack';
const RANK = { owner: 4, admin: 3, moderator: 2, member: 1 };
const barBg = (t) => (t.palette.mode === 'dark' ? 'rgba(28,28,30,0.82)' : 'rgba(249,249,249,0.86)');

function attachmentTypeFor(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

function dayKey(iso) { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return 'Сегодня';
  if (dayKey(iso) === dayKey(yest.toISOString())) return 'Вчера';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
}
function slowLabel(sec) {
  if (sec >= 3600) return `${Math.round(sec / 3600)} ч`;
  if (sec >= 60) return `${Math.round(sec / 60)} мин`;
  return `${sec} сек`;
}

function DayChip({ iso }) {
  return (
    <Box sx={{ alignSelf: 'center', my: 0.75, px: 1.25, py: 0.25, borderRadius: 999, bgcolor: 'rgba(0,0,0,0.32)', color: '#fff', fontSize: 12, fontWeight: 500 }}>
      {dayLabel(iso)}
    </Box>
  );
}

function Banner({ children }) {
  return (
    <Box sx={{ p: 1.75, pb: 'calc(env(safe-area-inset-bottom, 0px) + 14px)', textAlign: 'center', borderTop: '0.5px solid', borderColor: 'divider', bgcolor: barBg }}>
      <Typography variant="bodyMedium" color="text.secondary">{children}</Typography>
    </Box>
  );
}

// Реакции и комментарии под публикацией канала
function PostFooter({ up, down, mine, onReact, commentsEnabled, commentCount, onOpenComments }) {
  const pill = (active) => ({
    display: 'flex', alignItems: 'center', gap: 0.5, px: 1.1, py: 0.35, borderRadius: 999,
    border: '1px solid', borderColor: active ? 'transparent' : 'divider', bgcolor: active ? 'action.selected' : 'transparent',
  });
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
      <ButtonBase onClick={() => onReact(1)} sx={pill(mine === 1)} aria-label="Нравится">
        <ArrowUpwardRoundedIcon sx={{ fontSize: 19, color: 'success.main' }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{up}</Typography>
      </ButtonBase>
      <ButtonBase onClick={() => onReact(-1)} sx={pill(mine === -1)} aria-label="Не нравится">
        <ArrowDownwardRoundedIcon sx={{ fontSize: 19, color: 'error.main' }} />
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{down}</Typography>
      </ButtonBase>
      <Box sx={{ flex: 1 }} />
      {commentsEnabled && (
        <ButtonBase onClick={onOpenComments} sx={{ ...pill(false), color: 'primary.main' }}>
          <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 17 }} />
          <Typography sx={{ fontSize: 13 }}>{commentCount > 0 ? `Комментарии · ${commentCount}` : 'Комментировать'}</Typography>
        </ButtonBase>
      )}
    </Stack>
  );
}

export default function ChatWindow({ chat, myId, onBack, isDesktop, onChatsChanged, onLeft }) {
  const theme = useTheme();
  const ios = theme.appearance.ios && !isDesktop;
  const wallpaper = theme.appearance.wallpaperCss;
  const chatId = chat.id;
  const isDirect = chat.type === 'direct';
  const isChannel = chat.type === 'channel';
  const otherProfile = chat.profile;

  const [meta, setMeta] = useState(chat);
  const [messages, setMessages] = useState([]);
  const [hiddenIds, setHiddenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const [removed, setRemoved] = useState(false);
  const [extraProfiles, setExtraProfiles] = useState({});
  const [reactions, setReactions] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [commentsPost, setCommentsPost] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { setMeta(chat); }, [chat]);

  // ---------- участники (группы и каналы) ----------
  const loadMembers = useCallback(async () => {
    if (isDirect) return;
    const { data, error: err } = await supabase.rpc('get_chat_members', { p_chat: chatId });
    if (err) { setRemoved(true); return; }
    setRemoved(false);
    setMembers(data || []);
  }, [chatId, isDirect]);

  const reloadMeta = useCallback(async () => {
    if (isDirect) return;
    const { data } = await supabase
      .from('chats').select('id, type, title, avatar_url, description, slow_mode_seconds, comments_enabled')
      .eq('id', chatId).maybeSingle();
    if (data) setMeta((prev) => ({ ...prev, ...data }));
  }, [chatId, isDirect]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  const membersById = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);
  const myMember = membersById[myId];
  const myRole = myMember?.role;
  const isStaff = !!myRole && RANK[myRole] >= 2;
  const mutedUntil = myMember?.muted_until && new Date(myMember.muted_until) > new Date() ? new Date(myMember.muted_until) : null;

  // ---------- сообщения ----------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: msgs } = await supabase.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
      const { data: hidden } = await supabase.from('message_hidden').select('message_id').eq('user_id', myId);
      if (!cancelled) {
        setMessages(msgs || []);
        setHiddenIds(new Set((hidden || []).map((h) => h.message_id)));
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => {
        setMessages((prev) => prev.map((m) => (m.id === payload.new.id ? payload.new : m)));
      })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [chatId, myId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Профили отправителей, которых нет среди участников (вышли из группы)
  useEffect(() => {
    if (isDirect) return;
    const unknown = [...new Set(messages.map((m) => m.sender_id))].filter((id) => id && !membersById[id] && !extraProfiles[id]);
    if (!unknown.length) return;
    supabase.from('profiles').select('id, username, first_name, last_name, avatar_url').in('id', unknown)
      .then(({ data }) => setExtraProfiles((prev) => ({ ...prev, ...Object.fromEntries((data || []).map((p) => [p.id, p])) })));
  }, [messages, membersById]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- реакции и комментарии (каналы) ----------
  const loadChannelData = useCallback(async () => {
    if (!isChannel) return;
    const { data: r } = await supabase.from('post_reactions').select('message_id, user_id, value').eq('chat_id', chatId);
    setReactions(r || []);
    const { data: c } = await supabase.from('post_comments').select('post_id').eq('chat_id', chatId);
    const counts = {};
    (c || []).forEach((x) => { counts[x.post_id] = (counts[x.post_id] || 0) + 1; });
    setCommentCounts(counts);
  }, [chatId, isChannel]);

  useEffect(() => {
    if (!isChannel) return undefined;
    loadChannelData();
    const channel = supabase
      .channel(`channel-data:${chatId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_reactions', filter: `chat_id=eq.${chatId}` }, () => loadChannelData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments', filter: `chat_id=eq.${chatId}` }, () => loadChannelData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, isChannel, loadChannelData]);

  function reactionInfo(messageId) {
    let up = 0; let down = 0; let mine = 0;
    reactions.forEach((r) => {
      if (r.message_id !== messageId) return;
      if (r.value === 1) up += 1; else down += 1;
      if (r.user_id === myId) mine = r.value;
    });
    return { up, down, mine };
  }

  async function react(messageId, value) {
    const { error: err } = await supabase.rpc('react_to_post', { p_message: messageId, p_value: value });
    if (err) setError(err.message); else loadChannelData();
  }

  // ---------- блокировка (личные чаты) ----------
  useEffect(() => {
    if (!isDirect || !otherProfile?.id) { setIsBlocked(false); return undefined; }
    let cancelled = false;
    supabase.from('blocked_users').select('blocker_id')
      .or(`and(blocker_id.eq.${myId},blocked_id.eq.${otherProfile.id}),and(blocker_id.eq.${otherProfile.id},blocked_id.eq.${myId})`)
      .then(({ data }) => { if (!cancelled) setIsBlocked((data || []).length > 0); });
    return () => { cancelled = true; };
  }, [otherProfile?.id, myId, isDirect]);

  async function handleBlock() {
    if (!otherProfile?.id) return;
    await supabase.from('blocked_users').insert({ blocker_id: myId, blocked_id: otherProfile.id });
    setIsBlocked(true);
    setMenuAnchor(null);
    setProfileOpen(false);
    onChatsChanged?.();
  }

  // ---------- отправка ----------
  const visibleMessages = messages.filter((m) => !hiddenIds.has(m.id));
  const byId = Object.fromEntries(messages.map((m) => [m.id, m]));

  async function sendMessage(fields) {
    const { error: sendErr } = await supabase.from('messages').insert({
      chat_id: chatId, sender_id: myId,
      content: fields.content || '',
      message_type: fields.message_type || 'text',
      attachment_url: fields.attachment_url || null,
      attachment_name: fields.attachment_name || null,
      attachment_size: fields.attachment_size || null,
      duration_seconds: fields.duration_seconds || null,
      waveform_levels: fields.waveform_levels || null,
      reply_to_id: replyingTo?.id || null,
    });
    if (sendErr) { setError(sendErr.message); if (!isDirect) loadMembers(); }
    setReplyingTo(null);
  }

  async function handleSendText(e) {
    e?.preventDefault?.();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendMessage({ content: text, message_type: 'text' });
  }

  async function uploadAndSend(path, fileOrBlob, contentType, fields) {
    setUploading(true);
    const { error: upErr } = await supabase.storage.from('attachments').upload(path, fileOrBlob, { contentType });
    setUploading(false);
    if (upErr) { setError('Не удалось загрузить: ' + upErr.message); return; }
    const { data: pub } = supabase.storage.from('attachments').getPublicUrl(path);
    await sendMessage({ ...fields, attachment_url: pub.publicUrl });
  }

  function handleVoiceRecorded(blob, durationSeconds, levels) {
    return uploadAndSend(`${myId}/${chatId}/${crypto.randomUUID()}.webm`, blob, 'audio/webm', {
      message_type: 'voice', content: '[голосовое сообщение]', duration_seconds: durationSeconds, waveform_levels: levels,
    });
  }

  function handleFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('Пока лимит — 50 МБ на бесплатном тарифе Supabase. После перехода на платный/свой сервер лимит можно увеличить до 1 ГБ.');
      return;
    }
    return uploadAndSend(`${myId}/${chatId}/${crypto.randomUUID()}-${file.name}`, file, file.type, {
      message_type: attachmentTypeFor(file), content: `[файл] ${file.name}`, attachment_name: file.name, attachment_size: file.size,
    });
  }

  async function handleEdit(messageId, newContent) {
    const { error: err } = await supabase.from('messages').update({ content: newContent, edited_at: new Date().toISOString() }).eq('id', messageId);
    if (err) setError(err.message);
  }
  async function handleDeleteForEveryone(messageId) {
    const { error: err } = await supabase.from('messages').update({ deleted_for_everyone: true }).eq('id', messageId);
    if (err) setError(err.message);
  }
  async function handleModDelete(messageId) {
    const { error: err } = await supabase.rpc('moderator_delete_message', { p_message: messageId });
    if (err) setError(err.message);
  }
  async function handleDeleteForMe(messageId) {
    await supabase.from('message_hidden').insert({ message_id: messageId, user_id: myId });
    setHiddenIds((prev) => new Set(prev).add(messageId));
  }
  function handleDownloadTxt(message) {
    saveText(`message-${message.id.slice(0, 8)}.txt`, `${new Date(message.created_at).toLocaleString()}\n\n${message.content}`);
  }

  async function panelChanged() {
    await Promise.all([loadMembers(), reloadMeta()]);
    onChatsChanged?.();
  }

  // ---------- шапка ----------
  const title = isDirect ? (otherProfile ? `${otherProfile.first_name || ''} ${otherProfile.last_name || ''}`.trim() : '...') : meta.title;
  const subtitle = isDirect
    ? `@${otherProfile?.username || ''}`
    : `${isChannel ? 'Канал' : 'Группа'}${members.length ? ` · ${members.length} ${isChannel ? 'подписчиков' : 'участников'}` : ''}`;
  const headerAvatar = (size) => (isDirect
    ? <FindlyAvatar src={otherProfile?.avatar_url} name={title} seed={otherProfile?.username} size={size} />
    : <FindlyAvatar src={meta.avatar_url} name={meta.title || 'Чат'} seed={chatId} size={size} />);
  const openHeaderTarget = () => (isDirect ? setProfileOpen(true) : setInfoOpen(true));

  // ---------- права на отправку ----------
  let composerState = 'ok';
  if (isDirect && isBlocked) composerState = 'blocked';
  else if (!isDirect && removed) composerState = 'removed';
  else if (isChannel && members.length && myRole !== 'owner' && myRole !== 'admin') composerState = 'readonly';
  else if (!isDirect && mutedUntil) composerState = 'muted';

  const showAttach = !(isDirect && otherProfile?.restrict_media);
  const showMic = !(isDirect && otherProfile?.restrict_voice);
  const slowHint = !isDirect && !isChannel && meta.slow_mode_seconds > 0 && myRole === 'member'
    ? `Медленный режим: одно сообщение в ${slowLabel(meta.slow_mode_seconds)}` : null;

  const personLabel = (id) => {
    const p = membersById[id] || extraProfiles[id];
    return p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username : 'Пользователь';
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', minHeight: 0, bgcolor: 'background.default' }}>
      {/* ---- Шапка ---- */}
      {ios ? (
        <IosHeader
          title={title} subtitle={subtitle}
          left={<IosBackButton label="Чаты" onClick={onBack} />}
          right={<ButtonBase onClick={openHeaderTarget} sx={{ borderRadius: '50%', mr: 0.5 }}>{headerAvatar(36)}</ButtonBase>}
          onTitleClick={openHeaderTarget}
        />
      ) : (
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ p: 1.5, pt: isDesktop ? 1.5 : 'calc(env(safe-area-inset-top, 0px) + 12px)', borderBottom: '1px solid', borderColor: 'divider' }}>
          {!isDesktop && <IconButton onClick={onBack}><ArrowBackRoundedIcon /></IconButton>}
          <ButtonBase onClick={openHeaderTarget} sx={{ gap: 1.5, borderRadius: 2, textAlign: 'left', minWidth: 0 }}>
            {headerAvatar(40)}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="titleMedium" noWrap>{title}</Typography>
              <Typography variant="labelSmall" color="text.secondary" noWrap sx={{ display: 'block' }}>{subtitle}</Typography>
            </Box>
          </ButtonBase>
          <Box sx={{ flex: 1 }} />
          {isDirect && otherProfile?.id && (
            <>
              <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}><MoreVertRoundedIcon /></IconButton>
              <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
                <MenuItem onClick={() => { setMenuAnchor(null); setProfileOpen(true); }}>
                  <ListItemIcon><PersonRoundedIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>Профиль</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleBlock} sx={{ color: 'error.main' }} disabled={isBlocked}>
                  <ListItemIcon><BlockRoundedIcon fontSize="small" color="error" /></ListItemIcon>
                  <ListItemText>{isBlocked ? 'Уже заблокирован' : 'Заблокировать'}</ListItemText>
                </MenuItem>
              </Menu>
            </>
          )}
          {!isDirect && <IconButton onClick={() => setInfoOpen(true)}><InfoOutlinedIcon /></IconButton>}
        </Stack>
      )}

      {/* ---- Сообщения ---- */}
      <Box
        sx={{
          flex: 1, overflowY: 'auto', minHeight: 0, p: ios ? 1 : 2, display: 'flex', flexDirection: 'column', gap: ios ? 0.5 : 1,
          ...(wallpaper ? { background: wallpaper } : {}),
        }}
      >
        {loading ? (
          <Box sx={{ m: 'auto' }}><CircularProgress size={28} /></Box>
        ) : visibleMessages.length === 0 ? (
          <Typography variant="bodyMedium" color="text.secondary" sx={{ m: 'auto', textAlign: 'center', px: 3 }}>
            {isChannel ? 'В канале пока нет публикаций.' : 'Сообщений пока нет — напишите первым!'}
          </Typography>
        ) : (
          visibleMessages.map((m, idx) => {
            const prev = visibleMessages[idx - 1];
            const showDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const mine = m.sender_id === myId;
            const showName = !isDirect && !isChannel && !mine && (showDay || prev?.sender_id !== m.sender_id);
            const senderRole = membersById[m.sender_id]?.role || 'member';
            const canModerate = !isDirect && isStaff && !mine && RANK[myRole] > RANK[senderRole];
            const common = {
              message: m, mine,
              replyPreview: m.reply_to_id ? (byId[m.reply_to_id]?.content || 'сообщение') : null,
              senderName: showName ? personLabel(m.sender_id) : null,
              senderSeed: m.sender_id,
              canModerate,
              onReply: setReplyingTo, onEdit: handleEdit,
              onDeleteForMe: handleDeleteForMe, onDeleteForEveryone: handleDeleteForEveryone,
              onModDelete: handleModDelete, onDownloadTxt: handleDownloadTxt,
            };
            const info = isChannel ? reactionInfo(m.id) : null;
            return (
              <Fragment key={m.id}>
                {showDay && <DayChip iso={m.created_at} />}
                {isChannel ? (
                  <MessageBubble
                    {...common} variant="post" canReply={false} senderName={null}
                    footer={!m.deleted_for_everyone && (
                      <PostFooter
                        up={info.up} down={info.down} mine={info.mine}
                        onReact={(v) => react(m.id, v)}
                        commentsEnabled={meta.comments_enabled !== false}
                        commentCount={commentCounts[m.id] || 0}
                        onOpenComments={() => setCommentsPost(m)}
                      />
                    )}
                  />
                ) : (
                  <MessageBubble {...common} />
                )}
              </Fragment>
            );
          })
        )}
        <div ref={bottomRef} />
      </Box>

      {/* ---- Ввод ---- */}
      {composerState === 'blocked' && <Banner>Переписка недоступна — пользователь заблокирован.</Banner>}
      {composerState === 'removed' && <Banner>Вы больше не участник этого чата.</Banner>}
      {composerState === 'readonly' && <Banner>Публиковать в канале могут только администраторы.</Banner>}
      {composerState === 'muted' && (
        <Banner>Вы заглушены до {mutedUntil.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Banner>
      )}

      {composerState === 'ok' && (
        <Box sx={{ borderTop: '0.5px solid', borderColor: 'divider', bgcolor: ios ? barBg : 'transparent', backdropFilter: ios ? 'blur(20px)' : undefined }}>
          {replyingTo && (
            <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 0.75, bgcolor: 'action.hover' }}>
              <Box sx={{ width: 3, alignSelf: 'stretch', bgcolor: 'primary.main', borderRadius: 1 }} />
              <Typography variant="bodyMedium" noWrap sx={{ flex: 1 }}>Ответ на: {replyingTo.content}</Typography>
              <IconButton size="small" onClick={() => setReplyingTo(null)}><CloseRoundedIcon fontSize="small" /></IconButton>
            </Stack>
          )}
          {slowHint && (
            <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, pt: 0.75 }}>{slowHint}</Typography>
          )}

          <Stack
            component="form" onSubmit={handleSendText} direction="row" alignItems="flex-end" spacing={0.5}
            sx={{ px: 1, pt: 0.75, pb: !isDesktop ? 'calc(env(safe-area-inset-bottom, 0px) + 8px)' : 1 }}
          >
            <input ref={fileInputRef} type="file" hidden onChange={handleFilePicked} />
            {!recording && showAttach && (
              <Tooltip title="Прикрепить фото, видео или файл">
                <span>
                  <IconButton onClick={() => fileInputRef.current?.click()} disabled={uploading} sx={{ color: 'text.secondary' }}>
                    <AttachFileRoundedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )}

            {!recording && (ios ? (
              <InputBase
                value={draft} onChange={(e) => setDraft(e.target.value)} multiline maxRows={5} fullWidth
                placeholder={uploading ? 'Загрузка вложения...' : 'Сообщение'} disabled={uploading}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && isDesktop) { e.preventDefault(); handleSendText(); } }}
                sx={{
                  border: '1px solid', borderColor: 'divider', borderRadius: '20px', px: 1.75, py: 0.7, fontSize: 17,
                  bgcolor: (t) => (t.palette.mode === 'dark' ? '#1C1C1E' : '#FFFFFF'),
                }}
              />
            ) : (
              <TextField
                value={draft} onChange={(e) => setDraft(e.target.value)} fullWidth size="small" multiline maxRows={5}
                placeholder={uploading ? 'Загрузка вложения...' : 'Написать сообщение...'} disabled={uploading}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && isDesktop) { e.preventDefault(); handleSendText(); } }}
              />
            ))}

            {draft.trim() ? (
              <IconButton
                type="submit" aria-label="Отправить"
                sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }}
              >
                <SendRoundedIcon />
              </IconButton>
            ) : showMic ? (
              <VoiceRecorder onRecorded={handleVoiceRecorded} onRecordingChange={setRecording} />
            ) : (
              <IconButton disabled aria-label="Отправить"><SendRoundedIcon /></IconButton>
            )}
          </Stack>
        </Box>
      )}

      {isDirect && (
        <ProfileViewDialog
          open={profileOpen} onClose={() => setProfileOpen(false)} profile={otherProfile}
          onBlock={handleBlock} blocked={isBlocked}
        />
      )}
      {!isDirect && (
        <GroupInfoPanel
          open={infoOpen} onClose={() => setInfoOpen(false)} chat={meta} members={members} myId={myId}
          onChanged={panelChanged} onLeft={() => { setInfoOpen(false); onChatsChanged?.(); onLeft?.(); }}
        />
      )}
      {isChannel && commentsPost && (
        <CommentsDialog
          open onClose={() => setCommentsPost(null)} post={commentsPost} myId={myId} membersById={membersById}
          canModerate={isStaff} commentsEnabled={meta.comments_enabled !== false}
        />
      )}

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError('')} sx={{ borderRadius: 4 }}>{error}</Alert>
      </Snackbar>
    </Box>
  );
}
