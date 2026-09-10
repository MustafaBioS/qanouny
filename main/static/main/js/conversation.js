document.addEventListener('DOMContentLoaded', function () {
  var STORAGE_KEY = 'qanouny.case';
  var urls = window.QANOUNY_URLS;

  function getCookie(name) {
    var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? decodeURIComponent(match.pop()) : '';
  }

  function fileExt(name) {
    var parts = String(name || '').split('.');
    return parts.length > 1 ? parts.pop().toUpperCase().slice(0, 4) : 'FILE';
  }

  function fileSize(bytes) {
    if (typeof bytes !== 'number') return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  var el = {
    caseLine: document.querySelector('.conv-case-line'),
    progressBar: document.querySelector('.conv-progress-bar'),
    blobLayers: document.querySelectorAll('.conv-blob-layer'),

    busy: document.querySelector('.conv-busy'),
    askText: document.querySelector('.conv-ask-text'),
    askFile: document.querySelector('.conv-ask-file'),
    reviewing: document.querySelector('.conv-reviewing'),
    done: document.querySelector('.conv-done'),
    navRow: document.querySelector('.conv-nav-row'),

    textarea: document.querySelector('.conv-textarea'),

    fileCard: document.querySelector('.conv-file-card'),
    fileExt: document.querySelector('.conv-file-ext'),
    fileName: document.querySelector('.conv-file-name'),
    fileSize: document.querySelector('.conv-file-size'),
    fileRemove: document.querySelector('.conv-file-remove'),
    dropzone: document.querySelector('.conv-dropzone'),
    dropzoneHint: document.querySelector('.conv-dropzone-hint'),
    fileInput: document.querySelector('.conv-file-input'),
    fileError: document.querySelector('.conv-file-error'),

    reviewList: document.querySelector('.conv-review-list'),
    change: document.querySelector('.conv-change'),
    startOver: document.querySelector('.conv-start-over'),
    submitCase: document.querySelector('.conv-submit-case'),

    closing: document.querySelector('.conv-closing'),
    matchLine: document.querySelector('.conv-match-line'),
    recap: document.querySelector('.conv-recap'),
    newCase: document.querySelector('.conv-new-case'),

    back: document.querySelector('.conv-back'),
    skip: document.querySelector('.conv-skip'),
    continueBtn: document.querySelector('.conv-continue'),
  };
  var questionEls = document.querySelectorAll('.conv-question');

  var state = {
    caseId: '', email: '', survey: {}, description: '',
    turns: [], idx: 0, busy: true, done: false, submitted: false, match: null, closing: '',
  };

  function transcriptFor(turns) {
    var out = [];
    if (state.description) out.push({ role: 'user', text: state.description });
    turns.forEach(function (t) {
      out.push({ role: 'agent', text: t.question });
      if (!t.answer) return;
      if (t.answer.kind === 'text') out.push({ role: 'user', text: t.answer.value });
      else if (t.answer.kind === 'file') out.push({ role: 'user', text: 'Uploaded: ' + t.answer.name });
      else out.push({ role: 'user', text: 'Skipped' });
    });
    return out;
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        caseId: state.caseId, email: state.email, survey: state.survey, description: state.description,
        turns: state.turns, idx: state.idx, done: state.done, submitted: state.submitted,
        match: state.match, closing: state.closing,
      }));
    } catch (e) {}
  }

  function render() {
    var turn = state.turns[state.idx] || null;
    var prompt = turn ? turn.prompt : {};
    var asking = !state.busy && !state.done && !!turn;
    var reviewing = state.done && !state.submitted;
    var finished = state.done && state.submitted;

    el.caseLine.textContent = state.caseId ? 'Case ' + state.caseId : 'New case';
    var total = Math.max(state.turns.length, 1);
    el.progressBar.style.width = state.done
      ? '100%'
      : Math.round(((state.idx + (state.busy ? 0.5 : 0)) / (total + 1)) * 100) + '%';

    var step = state.done ? 4 : state.idx;
    el.blobLayers.forEach(function (layer, i) { layer.style.opacity = step % 4 === i ? '1' : '0'; });

    el.busy.style.display = state.busy ? '' : 'none';
    el.askText.style.display = asking && prompt.type !== 'file' ? '' : 'none';
    el.askFile.style.display = asking && prompt.type === 'file' ? '' : 'none';
    el.reviewing.style.display = reviewing ? '' : 'none';
    el.done.style.display = finished ? '' : 'none';
    el.navRow.style.display = asking ? '' : 'none';

    if (asking) {
      questionEls.forEach(function (n) { n.textContent = turn.question; });
    }

    if (asking && prompt.type !== 'file') {
      el.textarea.rows = prompt.rows || 5;
      el.textarea.placeholder = prompt.placeholder || 'Type your answer';
      el.textarea.value = turn.answer && turn.answer.kind === 'text' ? turn.answer.value : '';
    }

    if (asking && prompt.type === 'file') {
      var file = turn.answer && turn.answer.kind === 'file' ? turn.answer : null;
      el.fileCard.style.display = file ? '' : 'none';
      el.dropzone.style.display = file ? 'none' : '';
      el.dropzoneHint.textContent = prompt.hint || '';
      el.fileInput.accept = prompt.accept || '';
      if (file) {
        el.fileExt.textContent = fileExt(file.name);
        el.fileName.textContent = file.name;
        el.fileSize.textContent = fileSize(file.size);
      }
      el.fileError.style.display = 'none';
    }

    if (asking) {
      el.back.style.display = state.idx > 0 ? '' : 'none';
      el.skip.style.display = prompt.skippable !== false ? '' : 'none';
      el.skip.textContent = prompt.type === 'file' ? 'I do not have this' : 'Skip this question';
      var hasAnswer = prompt.type === 'file'
        ? !!(turn.answer && turn.answer.kind === 'file')
        : !!(el.textarea.value || '').trim() || !!turn.answer;
      el.continueBtn.disabled = !hasAnswer;
    }

    if (reviewing) {
      renderReview();
    }

    if (finished) {
      el.closing.textContent = state.closing;
      var m = state.match;
      el.matchLine.textContent = m
        ? (m.area
            ? 'A specialist in ' + String(m.area).toLowerCase() + ' matters, covering ' + m.governorate + ', will reach out ' + m.eta + '.'
            : 'A specialist covering ' + m.governorate + ' will reach out ' + m.eta + '.')
        : '';
      el.recap.textContent = recapBits().join(' · ') || 'Your survey answers.';
    }
  }

  function recapBits() {
    var bits = [];
    if (state.survey.area) bits.push(state.survey.area);
    if (state.survey.governorate) bits.push(state.survey.governorate);
    state.turns.forEach(function (t) {
      if (!t.answer) return;
      if (t.answer.kind === 'file') bits.push(t.answer.name);
      else if (t.answer.kind === 'text') bits.push(t.answer.value.length > 46 ? t.answer.value.slice(0, 46) + '…' : t.answer.value);
    });
    return bits;
  }

  function renderReview() {
    var items = [{
      q: 'What it is about',
      a: [state.survey.area, state.survey.governorate].filter(Boolean).join(' · ') || 'Not given',
    }];
    if (state.description) items.push({ q: 'In your words', a: state.description });
    state.turns.forEach(function (t) {
      if (!t.answer) return;
      var a = t.answer.kind === 'text' ? t.answer.value
        : t.answer.kind === 'file' ? t.answer.name + ' (' + fileSize(t.answer.size) + ')'
        : 'Skipped';
      items.push({ q: t.question, a: a });
    });
    el.reviewList.innerHTML = '';
    items.forEach(function (item) {
      var row = document.createElement('div');
      row.className = 'conv-review-row';
      var q = document.createElement('span');
      q.className = 'conv-review-q';
      q.textContent = item.q;
      var a = document.createElement('span');
      a.className = 'conv-review-a';
      a.textContent = item.a;
      row.appendChild(q);
      row.appendChild(a);
      el.reviewList.appendChild(row);
    });
  }

  function askNext(turns) {
    state.busy = true;
    render();
    fetch(urls.turn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({ survey: state.survey, description: state.description, transcript: transcriptFor(turns) }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res.done) {
          state.turns = turns;
          state.idx = Math.max(0, turns.length - 1);
          state.busy = false;
          state.done = true;
          state.match = res.match || null;
          state.closing = res.message;
        } else {
          var next = turns.concat([{ question: res.message, prompt: res.prompt || { type: 'text', skippable: true }, answer: null }]);
          state.turns = next;
          state.idx = next.length - 1;
          state.busy = false;
        }
        persist();
        render();
      })
      .catch(function () {
        var next = turns.concat([{
          question: 'I lost the connection for a moment. Could you say that again?',
          prompt: { type: 'text', skippable: true, placeholder: 'Type your answer', rows: 4 },
          answer: null,
        }]);
        state.turns = next;
        state.idx = next.length - 1;
        state.busy = false;
        persist();
        render();
      });
  }

  function commit(answer) {
    var idx = state.idx;
    var turns = state.turns.slice();
    if (!turns[idx]) return;
    var prev = turns[idx].answer;
    var unchanged = JSON.stringify(prev) === JSON.stringify(answer);
    turns[idx] = Object.assign({}, turns[idx], { answer: answer });

    if (unchanged && idx < turns.length - 1) {
      state.turns = turns;
      state.idx = idx + 1;
      persist();
      render();
      return;
    }
    if (unchanged && state.match) {
      state.turns = turns;
      state.done = true;
      persist();
      render();
      return;
    }
    var kept = turns.slice(0, idx + 1);
    state.turns = kept;
    state.done = false;
    state.match = null;
    state.closing = '';
    persist();
    askNext(kept);
  }

  function goNext() {
    if (state.busy) return;
    var turn = state.turns[state.idx];
    if (!turn) return;
    if (turn.prompt.type === 'file') {
      if (turn.answer) commit(turn.answer);
      return;
    }
    var value = (el.textarea.value || '').trim();
    if (!value) {
      if (turn.answer) commit(turn.answer);
      return;
    }
    commit({ kind: 'text', value: value });
  }

  function goBack() {
    if (state.busy) return;
    var idx = Math.max(0, state.idx - (state.done ? 0 : 1));
    state.idx = idx;
    state.done = false;
    state.submitted = false;
    persist();
    render();
  }

  function goSkip() {
    if (state.busy) return;
    commit({ kind: 'skip' });
  }

  function setFile(answer) {
    var turns = state.turns.slice();
    var idx = state.idx;
    if (!turns[idx]) return;
    turns[idx] = Object.assign({}, turns[idx], { answer: answer });
    state.turns = turns;
    persist();
    render();
  }

  el.textarea.addEventListener('input', function () {
    el.continueBtn.disabled = !(el.textarea.value || '').trim() && !(state.turns[state.idx] && state.turns[state.idx].answer);
  });
  el.textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      goNext();
    }
  });

  el.fileInput.addEventListener('change', function () {
    var file = el.fileInput.files && el.fileInput.files[0];
    if (!file) return;
    el.fileError.style.display = 'none';
    var formData = new FormData();
    formData.append('file', file);
    el.dropzone.querySelector('.conv-dropzone-label').textContent = 'Uploading…';
    fetch(urls.upload, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCookie('csrftoken') },
      body: formData,
    })
      .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
      .then(function (result) {
        el.dropzone.querySelector('.conv-dropzone-label').textContent = 'Drop your file here, or choose one';
        if (!result.ok) throw new Error(result.data.error || 'upload failed');
        setFile({ kind: 'file', name: result.data.name, size: result.data.size, mime: result.data.mime, url: result.data.url });
      })
      .catch(function () {
        el.dropzone.querySelector('.conv-dropzone-label').textContent = 'Drop your file here, or choose one';
        el.fileError.textContent = 'That upload did not go through. Please try again.';
        el.fileError.style.display = '';
      });
    el.fileInput.value = '';
  });
  el.fileRemove.addEventListener('click', function () { setFile(null); });

  el.back.addEventListener('click', goBack);
  el.skip.addEventListener('click', goSkip);
  el.continueBtn.addEventListener('click', goNext);
  el.change.addEventListener('click', goBack);

  el.startOver.addEventListener('click', resetCase);
  el.newCase.addEventListener('click', resetCase);

  el.submitCase.addEventListener('click', function () {
    el.submitCase.disabled = true;
    fetch(urls.submit, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify({
        caseId: state.caseId, email: state.email, survey: state.survey, description: state.description,
        transcript: transcriptFor(state.turns), match: state.match,
      }),
    })
      .catch(function () {})
      .then(function () {
        state.submitted = true;
        persist();
        render();
      });
  });

  function resetCase() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('qanouny.survey');
      localStorage.removeItem('qanouny.description');
    } catch (e) {}
    location.href = urls.intake;
  }

  function init() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) {}
    if (saved && saved.turns && saved.turns.length) {
      Object.assign(state, saved, { idx: Math.min(saved.idx || 0, saved.turns.length - 1), busy: false });
      render();
      return;
    }

    var survey = {}, email = '', description = '';
    try {
      survey = JSON.parse(localStorage.getItem('qanouny.survey') || '{}');
      email = localStorage.getItem('qanouny.email') || '';
      description = localStorage.getItem('qanouny.description') || '';
    } catch (e) {}
    state.caseId = 'QN-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    state.survey = survey;
    state.email = email;
    state.description = description;
    render();
    askNext([]);
  }

  init();
});
