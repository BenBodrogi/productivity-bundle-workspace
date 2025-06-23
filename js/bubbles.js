// Floating Dots Animation — toned down

const numDots = 20; // half the dots
const body = document.body;

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function createDot() {
  const dot = document.createElement('div');
  dot.classList.add('floating-dot');

  const size = randomRange(6, 14);
  dot.style.width = size + 'px';
  dot.style.height = size + 'px';

  dot.style.top = randomRange(0, window.innerHeight) + 'px';
  dot.style.left = randomRange(0, window.innerWidth) + 'px';

  dot.dataset.startX = parseFloat(dot.style.left);
  dot.dataset.startY = parseFloat(dot.style.top);
  dot.dataset.amplitudeX = randomRange(10, 40);
  dot.dataset.amplitudeY = randomRange(10, 40);
  dot.dataset.speed = randomRange(0.002, 0.006) / 4;  // slower speed
  dot.dataset.phase = Math.random() * Math.PI * 2;

  body.appendChild(dot);
  return dot;
}

const dots = [];
for(let i = 0; i < numDots; i++) {
  dots.push(createDot());
}

function animateDots(time = 0) {
  dots.forEach(dot => {
    const speed = parseFloat(dot.dataset.speed);
    const amplitudeX = parseFloat(dot.dataset.amplitudeX);
    const amplitudeY = parseFloat(dot.dataset.amplitudeY);
    const phase = parseFloat(dot.dataset.phase);
    const startX = parseFloat(dot.dataset.startX);
    const startY = parseFloat(dot.dataset.startY);

    const x = startX + Math.sin(time * speed + phase) * amplitudeX;
    const y = startY + Math.cos(time * speed + phase) * amplitudeY;

    dot.style.transform = `translate(${x - startX}px, ${y - startY}px)`;
    dot.style.opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * speed * 1.5 + phase));
  });

  requestAnimationFrame(animateDots);
}

requestAnimationFrame(animateDots);