export function initTimeline({
  videoElement,
  timelineTrack,
  videoTrack,
  audioTrack,
  videoClipsData = [],
  audioClipsData = [],
  onTimesChanged
}) {
  const clips = [];

  function getBaseWidth() {
    const w = timelineTrack.clientWidth;
    if (!w || w < 10) console.warn('timelineTrack width too small:', w);
    return w || 1;
  }

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function timeToPixels(t) {
    const dur = videoElement.duration || 1;
    return (t / dur) * getBaseWidth();
  }
  function pixelsToTime(px) {
    const dur = videoElement.duration || 1;
    return (px / getBaseWidth()) * dur;
  }

  function build() {
    videoTrack.innerHTML = '';
    audioTrack.innerHTML = '';
    clips.length = 0;

    // Helper to create clip elements
    function createClipElement(data, trackType, index) {
      const container = trackType === 'video' ? videoTrack : audioTrack;
      const clip = document.createElement('div');
      clip.className = 'clip';
      clip.dataset.start = data.startTime;
      clip.dataset.end = data.endTime;

    clip.style.position = 'absolute';
    clip.style.left = `${timeToPixels(startTime)}px`;
    clip.style.width = `${timeToPixels(endTime) - timeToPixels(startTime)}px`;
    clip.style.top = '8px';
    clip.style.height = '44px';

      const hl = document.createElement('div'); hl.className = 'handle-left';
      const hr = document.createElement('div'); hr.className = 'handle-right';

      const vc = document.createElement('div'); vc.className = 'volume-control';
      const knob = document.createElement('div'); knob.className = 'volume-knob';
      vc.appendChild(knob);

      clip.append(hl, hr, vc);
      container.appendChild(clip);

      const clipObj = {
        clip, hl, hr, knob, data,
        dragging: false,
        resizingLeft: false,
        resizingRight: false,
        adjustVol: false,
        startX: 0,
        startLeft: 0,
        startWidth: 0,
        startY: 0,
        startTop: 0,
        trackType,
        index
      };

      clips.push(clipObj);

      // Attach mouse down handlers for this clip
      attachClipHandlers(clipObj);
    }

    // Create video clips
    videoClipsData.forEach((data, i) => createClipElement(data, 'video', i));

    // Create audio clips
    audioClipsData.forEach((data, i) => createClipElement(data, 'audio', i));
  }

  // Update a single clip UI from data
  function updateClipUI(obj) {
    const left = timeToPixels(obj.data.startTime);
    const right = timeToPixels(obj.data.endTime);
    obj.clip.style.left = `${left}px`;
    obj.clip.style.width = `${right - left}px`;

    const h = obj.clip.clientHeight || 40;
    obj.knob.style.top = `${h * (1 - clamp(obj.data.volume, 0, 1))}px`;
    obj.clip.style.opacity = 0.5 + 0.5 * obj.data.volume;
  }

  // Update data from UI for a clip object and call callback
  function updateData(obj) {
    const left = parseFloat(obj.clip.style.left) || 0;
    const width = parseFloat(obj.clip.style.width) || 0;
    let s = clamp(pixelsToTime(left), 0, videoElement.duration);
    let e = clamp(pixelsToTime(left + width), 0, videoElement.duration);
    if (e <= s) e = s + 0.1;

    obj.data.startTime = s;
    obj.data.endTime = e;

    const h = obj.clip.clientHeight || 40;
    const knobY = obj.knob.offsetTop;
    obj.data.volume = clamp(1 - (knobY / h), 0, 1);

    if (onTimesChanged)
      onTimesChanged(obj.trackType, obj.index, s, e, obj.data.volume);
  }

  // Attach event listeners for dragging, resizing, volume control
  function attachClipHandlers(o) {
    o.clip.addEventListener('mousedown', e => {
      if ([o.hl, o.hr, o.knob].includes(e.target)) return;
      o.dragging = true;
      o.startX = e.clientX;
      o.startLeft = parseFloat(o.clip.style.left) || 0;
      document.body.style.userSelect = 'none';
    });
    o.hl.addEventListener('mousedown', e => {
      o.resizingLeft = true;
      o.startX = e.clientX;
      o.startLeft = parseFloat(o.clip.style.left) || 0;
      o.startWidth = parseFloat(o.clip.style.width) || 0;
      document.body.style.userSelect = 'none';
      e.stopPropagation();
    });
    o.hr.addEventListener('mousedown', e => {
      o.resizingRight = true;
      o.startX = e.clientX;
      o.startWidth = parseFloat(o.clip.style.width) || 0;
      document.body.style.userSelect = 'none';
      e.stopPropagation();
    });
    o.knob.addEventListener('mousedown', e => {
      o.adjustVol = true;
      o.startY = e.clientY;
      o.startTop = o.knob.offsetTop;
      document.body.style.userSelect = 'none';
      e.stopPropagation();
    });
  }

  // Attach document-level listeners for dragging/resizing/volume adjustment
  function attachEvents() {
    document.addEventListener('mousemove', e => {
      clips.forEach(o => {
        if (o.dragging) {
          const dx = e.clientX - o.startX;
          let nl = clamp(o.startLeft + dx, 0, getBaseWidth() - o.clip.clientWidth);
          o.clip.style.left = `${nl}px`;
          updateData(o);
        }
        if (o.resizingLeft) {
          const dx = e.clientX - o.startX;
          let nl = o.startLeft + dx;
          let nw = o.startWidth - dx;
          if (nl < 0) { nw += nl; nl = 0; }
          if (nw < 20) { nw = 20; nl = o.startLeft + (o.startWidth - 20); }
          o.clip.style.left = `${nl}px`;
          o.clip.style.width = `${nw}px`;
          updateData(o);
        }
        if (o.resizingRight) {
          const dx = e.clientX - o.startX;
          let nw = o.startWidth + dx;
          const maxW = getBaseWidth() - (parseFloat(o.clip.style.left) || 0);
          if (nw < 20) nw = 20;
          if (nw > maxW) nw = maxW;
          o.clip.style.width = `${nw}px`;
          updateData(o);
        }
        if (o.adjustVol) {
          const dy = e.clientY - o.startY;
          let nt = clamp(o.startTop + dy, 0, o.clip.clientHeight || 40);
          o.knob.style.top = `${nt}px`;
          updateData(o);
        }
      });
    });

    document.addEventListener('mouseup', () => {
      clips.forEach(o => {
        o.dragging = false;
        o.resizingLeft = false;
        o.resizingRight = false;
        o.adjustVol = false;
      });
      document.body.style.userSelect = '';
    });
  }

  function destroy() {
    timelineTrack.innerHTML = '';
    clips.length = 0;
    // Optionally detach document event listeners here if you want full cleanup
  }

  build();
  attachEvents();

  return {
    updateClipUI,
    updateData,
    destroy
  };
}