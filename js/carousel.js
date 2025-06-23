const carousel = document.querySelector('.carousel');
  const cards = Array.from(document.querySelectorAll('.card'));
  const leftBtn = document.querySelector('.nav-left');
  const rightBtn = document.querySelector('.nav-right');
  const dotsContainer = document.querySelector('.dots');

  let currentIndex = 0;

  function updateActiveCard(index) {
    currentIndex = index;
    cards.forEach((card, i) => {
      card.classList.toggle('active', i === index);
    });
    updateDots(index);
    updateButtons(index);
    centerCard(index);
  }

function centerCard(index) {
  const card = cards[index];
  const carouselRect = carousel.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const scrollLeft = carousel.scrollLeft;

  const offset = cardRect.left - carouselRect.left;
  const scrollTo = scrollLeft + offset - (carouselRect.width / 2 - cardRect.width / 2);

  carousel.scrollTo({
    left: scrollTo,
    behavior: 'smooth',
  });
}

  function createDots() {
    dotsContainer.innerHTML = '';
    cards.forEach((_, i) => {
      const dot = document.createElement('div');
      dot.classList.add('dot');
      if (i === currentIndex) dot.classList.add('active');
      dot.addEventListener('click', () => updateActiveCard(i));
      dotsContainer.appendChild(dot);
    });
  }

  function updateDots(activeIndex) {
    const dots = Array.from(dotsContainer.children);
    dots.forEach((dot, i) => dot.classList.toggle('active', i === activeIndex));
  }

  function updateButtons(index) {
    leftBtn.disabled = index === 0;
    rightBtn.disabled = index === cards.length - 1;
  }

  leftBtn.addEventListener('click', () => {
    if (currentIndex > 0) updateActiveCard(currentIndex - 1);
  });

  rightBtn.addEventListener('click', () => {
    if (currentIndex < cards.length - 1) updateActiveCard(currentIndex + 1);
  });

  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      if (i !== currentIndex) updateActiveCard(i);
    });
  });

  function setCarouselPadding() {
    const cardWidth = cards[0].offsetWidth;
    const containerWidth = carousel.offsetWidth;
    const sidePadding = containerWidth / 2 - cardWidth / 2;

    carousel.style.paddingLeft = `${sidePadding}px`;
    carousel.style.paddingRight = `${sidePadding}px`;
  }

  window.addEventListener('resize', () => {
    setCarouselPadding();
    updateActiveCard(currentIndex);
  });

  setCarouselPadding();
  createDots();
  updateActiveCard(currentIndex);