window.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.getElementById('start-btn');
  const modeToggleBtn = document.getElementById('mode-toggle');
  const keysContainer = document.getElementById('keys-container');
  const clipKeysContainer = document.getElementById('clip-keys-container');
  const recordingsDiv = document.getElementById('recordings');
  const effectButtons = document.querySelectorAll('.effect-btn');
  const waveformCanvas = document.getElementById('waveform');
  const ctx = waveformCanvas.getContext('2d');

  const synthKeys = ['a','s','d','f','g','h','j','k','l'];
  const gMajorNotes = ['G4','A4','B4','C5','D5','E5','F#5','G5','A5'];
  const clipKeys = ['z','x','c','v','b','n','m'];
  const recordKeys = ['1','2','3','4','5','6','7','8','9','0'];

  let synth, delay, reverb, analyser, mediaRecorder;
  let mic = new Tone.UserMedia();
  let micOn = false;
  let currentEffect = 'crisp';
  let recordedBlobs = [];
  let recordings = new Array(10).fill(null);
  let clips = new Array(7).fill(null);
  let currentRecordIndex = null;
  let isRecording = false;

  // Create buttons for synth keys (with keyboard labels)
  synthKeys.forEach((key, i) => {
    const btn = document.createElement('button');
    btn.textContent = key.toUpperCase();
    btn.dataset.note = gMajorNotes[i];
    btn.dataset.key = key;
    btn.title = `Key: ${key.toUpperCase()} - Note: ${gMajorNotes[i]}`;
    keysContainer.appendChild(btn);

    btn.addEventListener('mousedown', () => {
      playNote(gMajorNotes[i]);
      btn.classList.add('key-active');
    });
    btn.addEventListener('mouseup', () => {
      btn.classList.remove('key-active');
    });
    btn.addEventListener('mouseleave', () => {
      btn.classList.remove('key-active');
    });
  });

  // Create buttons for playback clips (Z-M)
  clipKeys.forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = key.toUpperCase();
    btn.title = `Playback clip key: ${key.toUpperCase()}`;
    clipKeysContainer.appendChild(btn);
  });

  // Create record controls for 10 slots
  for (let i = 0; i < 10; i++) {
    const slotNum = i + 1 === 10 ? '0' : (i + 1).toString();

    const recDiv = document.createElement('div');
    recDiv.style.marginBottom = '10px';

    const label = document.createElement('div');
    label.textContent = slotNum;
    recDiv.appendChild(label);

    const recordBtn = document.createElement('button');
    recordBtn.textContent = 'Record';
    recordBtn.dataset.index = i;
    recDiv.appendChild(recordBtn);

    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop';
    stopBtn.dataset.index = i;
    stopBtn.disabled = true;
    recDiv.appendChild(stopBtn);

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.dataset.index = i;
    playBtn.disabled = true;
    recDiv.appendChild(playBtn);

    recordingsDiv.appendChild(recDiv);

    recordBtn.addEventListener('click', () => startRecording(i, recordBtn, stopBtn, playBtn));
    stopBtn.addEventListener('click', () => stopRecording(i, recordBtn, stopBtn, playBtn));
    playBtn.addEventListener('click', () => playRecording(i));
  }

  // Effects buttons event
  effectButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentEffect = btn.dataset.effect;
      effectButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyEffect();
    });
  });

  // Start audio context
  startBtn.addEventListener('click', async () => {
    await Tone.start();
    console.log('Audio started');

    setupSynth();
    setupAnalyser();
    setupMediaRecorderSource();
    drawWaveform();

    startBtn.disabled = true;
    modeToggleBtn.disabled = false;
  });

  // Mode toggle synth/mic
  modeToggleBtn.addEventListener('click', async () => {
    if (micOn) {
      // Switch to synth
      micOn = false;
      modeToggleBtn.textContent = 'Mode: Synth';
      await mic.close();
      setupSynth();
      setupAnalyser();
      setupMediaRecorderSource();
    } else {
      // Switch to mic
      try {
        await mic.open();
        micOn = true;
        modeToggleBtn.textContent = 'Mode: Mic';
        disconnectSynth();
        applyEffect();
        setupAnalyser();
        setupMediaRecorderSource();
      } catch(e) {
        alert('Mic error or denied: ' + e);
        console.error(e);
      }
    }
  });

  // Play note in synth mode
  function playNote(note) {
    if (!micOn && synth) {
      synth.triggerAttackRelease(note, '8n');
    }
  }

  // Play clip by index
  function playClip(i) {
    if (clips[i]) {
      const audio = new Audio(clips[i]);
      audio.play();
    }
  }

  // Start recording
  function startRecording(index, recordBtn, stopBtn, playBtn) {
    if (isRecording) {
      alert('Stop current recording first.');
      return;
    }
    currentRecordIndex = index;
    recordedBlobs = [];
    mediaRecorder.start();
    isRecording = true;
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    playBtn.disabled = true;
    console.log('Recording started on slot', index + 1);
  }

  // Stop recording
  function stopRecording(index, recordBtn, stopBtn, playBtn) {
    if (!isRecording || currentRecordIndex !== index) return;
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    playBtn.disabled = false;
    console.log('Recording stopped on slot', index + 1);
  }

  // Play recording
  function playRecording(index) {
    if (!recordings[index]) {
      alert('No recording in slot ' + (index + 1));
      return;
    }
    const blob = recordings[index];
    const url = URL.createObjectURL(blob);
    clips[index % clips.length] = url; // optionally assign to clip playback
    const audio = new Audio(url);
    audio.play();
  }

  // Setup synth and effects chain
  function setupSynth() {
    disconnectSynth();

    synth = new Tone.Synth();
    delay = new Tone.FeedbackDelay('8n', 0.5);
    reverb = new Tone.Reverb({ decay: 2, wet: 0.5 });

    applyEffect();
  }

  function disconnectSynth() {
    if (synth) synth.disconnect();
    if (delay) delay.disconnect();
    if (reverb) reverb.disconnect();
  }

  // Apply effect chain based on mode and selected effect
  function applyEffect() {
    if (micOn) {
      synth && synth.disconnect();
      delay && delay.disconnect();
      reverb && reverb.disconnect();

      delay = new Tone.FeedbackDelay('8n', 0.5);
      reverb = new Tone.Reverb({ decay: 2, wet: 0.5 });

      mic.disconnect();

      switch(currentEffect) {
        case 'crisp':
          mic.connect(Tone.Destination);
          break;
        case 'echo':
          mic.connect(delay);
          delay.toDestination();
          break;
        case 'reverb':
          mic.connect(reverb);
          reverb.toDestination();
          break;
      }
    } else {
      delay && delay.disconnect();
      reverb && reverb.disconnect();
      synth.disconnect();

      delay = new Tone.FeedbackDelay('8n', 0.5);
      reverb = new Tone.Reverb({ decay: 2, wet: 0.5 });

      switch(currentEffect) {
        case 'crisp':
          synth.connect(Tone.Destination);
          break;
        case 'echo':
          synth.connect(delay);
          delay.toDestination();
          break;
        case 'reverb':
          synth.connect(reverb);
          reverb.toDestination();
          break;
      }
    }
  }

  // Setup analyser to visualize waveform
  function setupAnalyser() {
    analyser = new Tone.Analyser('waveform', 256);
    if (micOn) {
      mic.connect(analyser);
    } else {
      synth.connect(analyser);
    }
  }

  // Setup media recorder source
  function setupMediaRecorderSource() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    const dest = Tone.context.createMediaStreamDestination();
    if (micOn) {
      mic.connect(dest);
    } else {
      synth.connect(dest);
    }

    mediaRecorder = new MediaRecorder(dest.stream);

    mediaRecorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) {
        recordedBlobs.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      if (currentRecordIndex !== null) {
        const blob = new Blob(recordedBlobs, { type: 'audio/wav' });
        recordings[currentRecordIndex] = blob;
        recordedBlobs = [];
        currentRecordIndex = null;
      }
    };
  }

  // Waveform draw loop
  function drawWaveform() {
    requestAnimationFrame(drawWaveform);
    if (!analyser) return;

    const data = analyser.getValue();
    const width = waveformCanvas.width = waveformCanvas.clientWidth;
    const height = waveformCanvas.height = waveformCanvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#4caf50';
    ctx.beginPath();

    const sliceWidth = width / data.length;
    let x = 0;

    for(let i = 0; i < data.length; i++) {
      const y = (1 - (data[i] + 1) / 2) * height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    ctx.stroke();
  }

  // Handle key press events
  window.addEventListener('keydown', (e) => {
    if (!synth) return;
    const key = e.key.toLowerCase();

    // Synth keys play notes (only in synth mode)
    if (!micOn && synthKeys.includes(key)) {
      const idx = synthKeys.indexOf(key);
      const btn = keysContainer.querySelector(`button[data-key="${key}"]`);
      if (btn) {
        btn.classList.add('key-active');
        setTimeout(() => btn.classList.remove('key-active'), 100);
      }
      playNote(gMajorNotes[idx]);
    }

    // Clip keys playback
    if (clipKeys.includes(key)) {
      const idx = clipKeys.indexOf(key);
      const btn = clipKeysContainer.children[idx];
      btn.classList.add('key-active');
      setTimeout(() => btn.classList.remove('key-active'), 100);
      playClip(idx);
    }

    // Record keys (1-9,0)
    if (recordKeys.includes(key)) {
      const idx = recordKeys.indexOf(key);
      const recDiv = recordingsDiv.children[idx];
      if (!recDiv) return;
      const recordBtn = recDiv.querySelector('button:nth-child(2)');
      const stopBtn = recDiv.querySelector('button:nth-child(3)');
      const playBtn = recDiv.querySelector('button:nth-child(4)');

      if (!isRecording) {
        startRecording(idx, recordBtn, stopBtn, playBtn);
      } else if (isRecording && currentRecordIndex === idx) {
        stopRecording(idx, recordBtn, stopBtn, playBtn);
      }
    }
  });
});
