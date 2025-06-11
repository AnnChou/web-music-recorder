window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const recordBtn = document.getElementById('record-btn');
  const stopBtn = document.getElementById('stop-btn');
  const keysContainer = document.getElementById('keys');
  const waveform = document.getElementById('waveform');
  const ctx = waveform.getContext('2d');

  // Map keyboard letters to notes (G Major scale)
  const keyNoteMap = {
    'a': 'G4',
    's': 'A4',
    'd': 'B4',
    'f': 'C5',
    'g': 'D5',
    'h': 'E5',
    'j': 'F#5',
    'k': 'G5',
    'l': 'A5',
  };

  const MAX_RECORDINGS = 10;
  const recordings = new Array(MAX_RECORDINGS).fill(null);

  let synth, delay;
  let mediaRecorder;
  let recordedBlobs = [];
  let isRecording = false;
  let currentRecordIndex = null;

  let analyser;
  let animationId;

  // Start Audio context on user interaction
  startBtn.addEventListener('click', async () => {
    await Tone.start();
    console.log('Audio started');

    delay = new Tone.FeedbackDelay("8n", 0.5).toDestination();
    synth = new Tone.Synth().connect(delay);

    analyser = new Tone.Analyser("waveform", 256);
    synth.connect(analyser);

    const dest = Tone.context.createMediaStreamDestination();
    synth.connect(dest);

    mediaRecorder = new MediaRecorder(dest.stream);
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedBlobs, {type: 'audio/wav'});
      recordings[currentRecordIndex] = blob;
      recordedBlobs = [];
      currentRecordIndex = null;
      console.log('Recording saved');
      stopBtn.disabled = true;
      recordBtn.disabled = false;
    };

    drawWaveform();

    startBtn.style.display = 'none';
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  });

  function drawWaveform() {
    animationId = requestAnimationFrame(drawWaveform);
    const buffer = analyser.getValue();
    ctx.clearRect(0, 0, waveform.width, waveform.height);

    ctx.beginPath();
    ctx.strokeStyle = '#0a84ff';
    ctx.lineWidth = 2;

    const sliceWidth = waveform.width / buffer.length;
    let x = 0;
    for (let i = 0; i < buffer.length; i++) {
      const y = (buffer[i] * 0.5 + 0.5) * waveform.height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.stroke();
  }

  function playNote(note) {
    synth.triggerAttackRelease(note, "8n");
  }

  window.addEventListener('keydown', (e) => {
    if (!synth) return; // audio not started yet

    const key = e.key.toLowerCase();

    if (keyNoteMap[key]) {
      const keyDiv = [...keysContainer.children].find(k => k.textContent.toLowerCase() === key);
      if (keyDiv) {
        keyDiv.classList.add('active');
        setTimeout(() => keyDiv.classList.remove('active'), 150);
      }
      playNote(keyNoteMap[key]);
    } else if (!isRecording && /^[1-9]$/.test(key)) {
      const index = parseInt(key) - 1;
      if (recordings[index]) {
        playRecording(index);
      } else {
        console.log('No recording for slot', index + 1);
      }
    } else if (!isRecording && key === '0') {
      const index = 9;
      if (recordings[index]) {
        playRecording(index);
      } else {
        console.log('No recording for slot 10');
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    const keyDiv = [...keysContainer.children].find(k => k.textContent.toLowerCase() === key);
    if (keyDiv) {
      keyDiv.classList.remove('active');
    }
  });

  function playRecording(index) {
    const blob = recordings[index];
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => {
      URL.revokeObjectURL(url);
    };
  }

  recordBtn.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state === 'recording') return;

    let slot = prompt(`Enter recording slot number (1-${MAX_RECORDINGS}):`);
    slot = parseInt(slot);
    if (!slot || slot < 1 || slot > MAX_RECORDINGS) {
      alert('Invalid slot number');
      return;
    }
    currentRecordIndex = slot - 1;

    recordedBlobs = [];
    mediaRecorder.start();
    isRecording = true;
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    console.log('Recording started for slot', slot);
  });

  stopBtn.addEventListener('click', () => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
    mediaRecorder.stop();
    isRecording = false;
    console.log('Recording stopped');
  });

  function resizeCanvas() {
    waveform.width = waveform.clientWidth * devicePixelRatio;
    waveform.height = waveform.clientHeight * deviceP*
