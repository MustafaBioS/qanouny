document.addEventListener('DOMContentLoaded', function () {
  var revealTargets = document.querySelectorAll('[data-reveal]');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && revealTargets.length) {
    revealTargets.forEach(function (el) { el.setAttribute('data-reveal', 'pending'); });
    var scan = function () {
      revealTargets.forEach(function (el) {
        if (el.dataset.revealDone) return;
        if (el.getBoundingClientRect().top < innerHeight * 0.94) {
          el.dataset.revealDone = '1';
          el.setAttribute('data-reveal', 'true');
        }
      });
    };
    var raf = 0;
    var onScroll = function () {
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; scan(); });
    };
    scan();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    addEventListener('load', scan);
    setTimeout(scan, 300);
  }

  document.querySelectorAll('.faq-toggle').forEach(function (button) {
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', function () {
      var item = button.closest('.faq-item');
      var panel = item.querySelector('.faq-panel');
      var isOpen = item.classList.toggle('open');
      button.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      panel.style.maxHeight = isOpen ? panel.scrollHeight + 'px' : '0px';
    });
  });
});
