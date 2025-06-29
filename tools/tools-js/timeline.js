export function initTimeline({
  videoElement,
  timelineTrack,  // the scrolling multi-track container
  videoTrack,     // the track element for video clips
  audioTrack,     // the track element for audio clips
  clipsData,      // Array of { startTime, endTime, volume }
  onTimesChanged  // (clipIndex, start, end, volume) => void
}) {
  const clips = [];
  const BASE_WIDTH = timelineTrack.clientWidth;
  if (!BASE_WIDTH || BASE_WIDTH < 10) {
    console.warn('timelineTrack width too small:', BASE_WIDTH);
  }

  // Helpers
  function clamp(v,min,max){ return Math.min(max,Math.max(min,v)); }
  function timeToPixels(t){
    const dur = videoElement.duration||1;
    return (t/dur)*BASE_WIDTH;
  }
  function pixelsToTime(px){
    const dur = videoElement.duration||1;
    return (px/BASE_WIDTH)*dur;
  }

  // Build all clip elements
  function build() {
    videoTrack.innerHTML = '';
    audioTrack.innerHTML = '';
    clips.length = 0;

    clipsData.forEach((data,index)=>{
      const container = index===0 ? videoTrack : audioTrack;
      const clip = document.createElement('div');
      clip.className = 'clip';
      clip.dataset.start = data.startTime;
      clip.dataset.end   = data.endTime;
      clip.style.left   = `${timeToPixels(data.startTime)}px`;
      clip.style.width  = `${timeToPixels(data.endTime) - timeToPixels(data.startTime)}px`;
      clip.style.opacity = 0.5 + 0.5*data.volume;

      // handles
      const hl = document.createElement('div'); hl.className='handle-left';
      const hr = document.createElement('div'); hr.className='handle-right';

      // volume knob
      const vc = document.createElement('div'); vc.className='volume-control';
      const knob = document.createElement('div'); knob.className='volume-knob';
      vc.appendChild(knob);

      clip.append(hl, hr, vc);
      container.appendChild(clip);

      clips.push({ clip, hl, hr, knob, data,
        dragging:false, resizingLeft:false, resizingRight:false, adjustVol:false,
        startX:0, startLeft:0, startWidth:0, startY:0, startTop:0 });
    });
  }

  // Update a single clip UI from its data
  function updateClipUI(obj) {
    const left = timeToPixels(obj.data.startTime);
    const right= timeToPixels(obj.data.endTime);
    obj.clip.style.left  = `${left}px`;
    obj.clip.style.width = `${right-left}px`;
    const h = obj.clip.clientHeight;
    obj.knob.style.top = `${h*(1- clamp(obj.data.volume,0,1))}px`;
    obj.clip.style.opacity = 0.5 + 0.5*obj.data.volume;
  }

  // Commit UI back to data & fire callback
  function updateData(obj) {
    const left = parseFloat(obj.clip.style.left)||0;
    const w    = parseFloat(obj.clip.style.width)||0;
    let s = clamp(pixelsToTime(left), 0, videoElement.duration);
    let e = clamp(pixelsToTime(left+w), 0, videoElement.duration);
    if(e<=s) e=s+0.1;
    obj.data.startTime = s;
    obj.data.endTime   = e;

    const h     = obj.clip.clientHeight;
    const knobY = obj.knob.offsetTop;
    obj.data.volume = clamp(1 - (knobY/h), 0,1);

    if(onTimesChanged)
      onTimesChanged(clips.indexOf(obj), s, e, obj.data.volume);
  }

  // Attach global listeners
  function attachEvents() {
    document.addEventListener('mousemove', e => {
      clips.forEach(o => {
        if(o.dragging) {
          const dx = e.clientX - o.startX;
          let nl = clamp(o.startLeft + dx, 0, BASE_WIDTH - o.clip.clientWidth);
          o.clip.style.left = `${nl}px`;
          updateData(o);
        }
        if(o.resizingLeft) {
          const dx = e.clientX - o.startX;
          let nl = o.startLeft + dx, nw = o.startWidth - dx;
          if(nl<0){ nw+=nl; nl=0; }
          if(nw<20){ nw=20; nl=o.startLeft+(o.startWidth-20); }
          o.clip.style.left = `${nl}px`;
          o.clip.style.width = `${nw}px`;
          updateData(o);
        }
        if(o.resizingRight) {
          const dx = e.clientX - o.startX;
          let nw = o.startWidth + dx;
          const maxW = BASE_WIDTH - (parseFloat(o.clip.style.left)||0);
          if(nw<20) nw=20;
          if(nw>maxW) nw=maxW;
          o.clip.style.width = `${nw}px`;
          updateData(o);
        }
        if(o.adjustVol) {
          const dy = e.clientY - o.startY;
          let nt = clamp(o.startTop + dy, 0, o.clip.clientHeight);
          o.knob.style.top = `${nt}px`;
          updateData(o);
        }
      });
    });

    document.addEventListener('mouseup', ()=>{
      clips.forEach(o=>{
        o.dragging = o.resizingLeft = o.resizingRight = o.adjustVol = false;
      });
      document.body.style.userSelect = '';
    });

    clips.forEach(o=>{
      o.clip.addEventListener('mousedown', e=>{
        if([o.hl,o.hr,o.knob].includes(e.target)) return;
        o.dragging = true;
        o.startX    = e.clientX; o.startLeft = parseFloat(o.clip.style.left)||0;
        document.body.style.userSelect = 'none';
      });
      o.hl.addEventListener('mousedown', e=>{
        o.resizingLeft = true;
        o.startX    = e.clientX; o.startLeft = parseFloat(o.clip.style.left)||0;
        o.startWidth= parseFloat(o.clip.style.width)||0;
        document.body.style.userSelect = 'none';
        e.stopPropagation();
      });
      o.hr.addEventListener('mousedown', e=>{
        o.resizingRight = true;
        o.startX    = e.clientX; o.startWidth= parseFloat(o.clip.style.width)||0;
        document.body.style.userSelect = 'none';
        e.stopPropagation();
      });
      o.knob.addEventListener('mousedown', e=>{
        o.adjustVol = true;
        o.startY    = e.clientY; o.startTop = o.knob.offsetTop;
        document.body.style.userSelect = 'none';
        e.stopPropagation();
      });
    });
  }

  //
  // Public destroy if needed
  //
  function destroy() {
    timelineTrack.innerHTML = '';
    clips.length = 0;
  }

  //
  // Initialize
  //
  build();
  attachEvents();

  return {
    updateClipUI,
    updateData,
    destroy
  };
}