import { useRef, useState } from 'react';
import { Box, IconButton, Typography, Stack, Tooltip } from '@mui/material';
import MicRoundedIcon from '@mui/icons-material/MicRounded';
import Waveform from '../../components/common/Waveform';

const MAX_SECONDS = 300; // 5 минут

export default function VoiceRecorder({ onRecorded }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [liveLevels, setLiveLevels] = useState([]);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const meterRef = useRef(null);
  const cancelledRef = useRef(false);
  const startTimeRef = useRef(0);

  async function startRecording() {
    cancelledRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      setLiveLevels([]);
      setSeconds(0);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start();
      setRecording(true);
      startTimeRef.current = Date.now();

      // Визуализация уровня звука в реальном времени
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);

      meterRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length);
        setLiveLevels((prev) => [...prev.slice(-59), Math.min(1, rms * 4)]);
      }, 120);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { stopRecording(false); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch {
      alert('Не удалось получить доступ к микрофону. Разрешите доступ в настройках браузера.');
    }
  }

  function cleanup() {
    clearInterval(timerRef.current);
    clearInterval(meterRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    setRecording(false);
  }

  function stopRecording(cancelled) {
    cancelledRef.current = cancelled;
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') { cleanup(); return; }

    recorder.onstop = () => {
      cleanup();
      if (cancelledRef.current) return;
      const actualSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000));
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      if (blob.size > 0) {
        onRecorded(blob, actualSeconds, downsample(liveLevels, 32));
      }
    };
    recorder.stop();
  }

  function downsample(levels, targetBars) {
    if (levels.length === 0) return Array(targetBars).fill(0.3);
    const chunkSize = Math.max(1, Math.floor(levels.length / targetBars));
    const out = [];
    for (let i = 0; i < targetBars; i++) {
      const chunk = levels.slice(i * chunkSize, (i + 1) * chunkSize);
      const avg = chunk.length ? chunk.reduce((a, b) => a + b, 0) / chunk.length : 0.2;
      out.push(Math.max(0.15, avg));
    }
    return out;
  }

  if (recording) {
    return (
      <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1, px: 1 }}>
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'error.main', animation: 'pulse 1s infinite' }} />
        <Typography variant="labelMedium" sx={{ minWidth: 40 }}>
          {String(Math.floor(seconds / 60)).padStart(1, '0')}:{String(seconds % 60).padStart(2, '0')}
        </Typography>
        <Box sx={{ flex: 1 }}>
          <Waveform levels={liveLevels.slice(-32)} height={28} color="error.main" />
        </Box>
        <Tooltip title="Отменить">
          <IconButton size="small" onClick={() => stopRecording(true)}>✕</IconButton>
        </Tooltip>
      </Stack>
    );
  }

  return (
    <Tooltip title="Удерживайте, чтобы записать голосовое">
      <IconButton
        onMouseDown={startRecording}
        onMouseUp={() => stopRecording(false)}
        onMouseLeave={() => recording && stopRecording(false)}
        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
        onTouchEnd={(e) => { e.preventDefault(); stopRecording(false); }}
      >
        <MicRoundedIcon />
      </IconButton>
    </Tooltip>
  );
}
