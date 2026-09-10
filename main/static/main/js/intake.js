document.addEventListener('DOMContentLoaded', function () {
  var steps = Array.prototype.slice.call(document.querySelectorAll('.intake-step:not(.intake-done)'));
  var doneStep = document.querySelector('.intake-done');
  var totalSteps = steps.length;

  var progressBar = document.querySelector('.intake-progress-bar');
  var counter = document.querySelector('.intake-counter');
  var backButton = document.querySelector('.intake-back');
  var skipButton = document.querySelector('.intake-skip');
  var summaryEl = document.querySelector('.intake-summary');
  var blobLayers = document.querySelectorAll('.intake-blob-layer');
  var textarea = document.querySelector('.intake-textarea');
  var submitLink = document.querySelector('.intake-submit');

  var current = 0;
  var answers = {};

  function render() {
    var isDone = current >= totalSteps;

    steps.forEach(function (stepEl, i) {
      stepEl.style.display = i === current ? '' : 'none';
      if (i === current) highlightSelected(stepEl);
    });
    doneStep.style.display = isDone ? '' : 'none';

    blobLayers.forEach(function (layer, i) {
      var isLast = i === blobLayers.length - 1;
      var active = isLast ? isDone : i === current;
      layer.style.opacity = active ? '1' : '0';
    });

    progressBar.style.width = Math.round(((isDone ? totalSteps : current) / totalSteps) * 100) + '%';
    counter.textContent = isDone ? 'Survey complete' : (current + 1) + ' of ' + totalSteps;
    backButton.style.display = current > 0 ? '' : 'none';
    skipButton.style.display = isDone ? 'none' : '';

    if (isDone) {
      var parts = steps
        .map(function (stepEl) { return answers[stepEl.dataset.key]; })
        .filter(Boolean);
      summaryEl.textContent = parts.length ? parts.join(' · ') : 'Nothing yet.';
    }
  }

  function highlightSelected(stepEl) {
    var value = answers[stepEl.dataset.key];
    stepEl.querySelectorAll('.intake-option').forEach(function (button) {
      button.classList.toggle('selected', button.dataset.value === value);
    });
  }

  function pick(stepEl, button) {
    answers[stepEl.dataset.key] = button.dataset.value;
    current += 1;
    render();
  }

  function goBack() {
    if (current > 0) {
      current -= 1;
      render();
    }
  }

  function skip() {
    if (current < totalSteps) {
      current += 1;
      render();
    }
  }

  steps.forEach(function (stepEl) {
    stepEl.querySelectorAll('.intake-option').forEach(function (button) {
      button.addEventListener('click', function () { pick(stepEl, button); });
    });
  });

  backButton.addEventListener('click', goBack);
  skipButton.addEventListener('click', skip);

  submitLink.addEventListener('click', function () {
    try {
      localStorage.setItem('qanouny.survey', JSON.stringify(answers));
      localStorage.setItem('qanouny.description', (textarea.value || '').trim());
      localStorage.removeItem('qanouny.case');
    } catch (e) {}
  });

  addEventListener('keydown', function (e) {
    if (current >= totalSteps || e.metaKey || e.ctrlKey || e.altKey) return;
    var target = e.target;
    if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;

    if (e.key === 'Backspace') {
      e.preventDefault();
      goBack();
      return;
    }

    var options = steps[current].querySelectorAll('.intake-option');
    var letterIndex = 'abcdefghi'.indexOf((e.key || '').toLowerCase());
    if (options.length <= 9 && letterIndex >= 0 && letterIndex < options.length) {
      e.preventDefault();
      pick(steps[current], options[letterIndex]);
    }
  });

  render();
});
