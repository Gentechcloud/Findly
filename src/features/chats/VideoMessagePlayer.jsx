import { useRef, useState } from 'react';
import { Box, IconButton } from '@mui/material';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import VolumeOffRoundedIcon from '@mui/icons-material/VolumeOffRounded';

function fmt(t) {
  if (!Number.isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideoMessagePlayer({ src }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
  }

  function seek(e) {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
  }

  return (
    <Box
      sx={{ position: 'relative', width: 260, maxWidth: '100%', borderRadius: 3, overflow: 'hidden', bgcolor: '#000', lineHeight: 0 }}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      <Box
        component="video"
        ref={videoRef}
        src={src}
        playsInline
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => { setPlaying(false); setShowControls(true); }}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onTimeUpdate={(e) => { setTime(e.target.currentTime); setDuration(e.target.duration); setProgress(e.target.duration ? e.target.currentTime / e.target.duration : 0); }}
        sx={{ width: '100%', maxHeight: 340, display: 'block', cursor: 'pointer' }}
      />

      {!playing && (
        <IconButton
          onClick={toggle}
          sx={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            bgcolor: 'rgba(0,0,0,0.55)', color: '#fff', width: 48, height: 48,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <PlayArrowRoundedIcon fontSize="large" />
        </IconButton>
      )}

      <Box
        sx={{
          position: 'absolute', left: 0, right: 0, bottom: 0, px: 1, pb: 0.75, pt: 2.5,
          display: 'flex', alignItems: 'center', gap: 0.75,
          background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
          opacity: showControls ? 1 : 0, transition: 'opacity .2s ease',
        }}
      >
        <IconButton size="small" onClick={toggle} sx={{ color: '#fff', p: 0.5 }}>
          {playing ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
        </IconButton>

        <Box onClick={seek} sx={{ flex: 1, height: 14, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
          <Box sx={{ width: '100%', height: 3, borderRadius: 999, bgcolor: 'rgba(255,255,255,0.35)', position: 'relative' }}>
            <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progress * 100}%`, borderRadius: 999, bgcolor: '#fff' }} />
          </Box>
        </Box>

        <Box component="span" sx={{ color: '#fff', fontSize: 11, minWidth: 34, textAlign: 'right' }}>
          {fmt(time)}
        </Box>

        <IconButton size="small" onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted); } }} sx={{ color: '#fff', p: 0.5 }}>
          {muted ? <VolumeOffRoundedIcon fontSize="small" /> : <VolumeUpRoundedIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  );
}
