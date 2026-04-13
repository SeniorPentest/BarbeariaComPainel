function initCarousel(wrapperSelector, trackSelector, cardSelector) {
    const wrapper = document.querySelector(wrapperSelector);
    const track = document.querySelector(trackSelector);
    if (!wrapper || !track) return;

    const cards = track.querySelectorAll(cardSelector);
    const totalSlides = cards.length;
    let currentSlide = 0;
    let autoplayId = null;

    const getMetrics = () => {
        const cardWidth = cards[0].offsetWidth + 24; 
        const visibleCards = Math.round(wrapper.offsetWidth / cardWidth);
        const maxIndex = Math.max(0, totalSlides - visibleCards);
        return { cardWidth, maxIndex };
    };

    function updateCarousel() {
        const { cardWidth, maxIndex } = getMetrics();
        if (currentSlide > maxIndex) currentSlide = maxIndex;
        track.style.transform = `translateX(-${currentSlide * cardWidth}px)`;
    }

    function nextSlide() {
        const { maxIndex } = getMetrics();
        currentSlide = (currentSlide >= maxIndex) ? 0 : currentSlide + 1;
        updateCarousel();
    }

    const startAutoplay = () => { autoplayId = setInterval(nextSlide, 3500); };
    const stopAutoplay = () => { if (autoplayId) clearInterval(autoplayId); };

    wrapper.addEventListener('mouseenter', stopAutoplay);
    wrapper.addEventListener('mouseleave', startAutoplay);
    window.addEventListener('resize', updateCarousel);

    updateCarousel();
    startAutoplay();
}

document.addEventListener('DOMContentLoaded', () => {
    initCarousel('.snacks-carousel-wrapper', '.snacks-carousel', '.snack-card');
    initCarousel('.plans-carousel-wrapper', '.plans-grid', '.plan-card');
    initCarousel('.values-wrapper', '.values-grid', '.value-card');
});
