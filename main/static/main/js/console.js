document.addEventListener('DOMContentLoaded', function () {
  var urls = window.QANOUNY_URLS;

  function getCookie(name) {
    var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
    return match ? decodeURIComponent(match.pop()) : '';
  }

  function detailUrl(id) { return urls.caseDetail.replace('__ID__', id); }
  function actionUrl(id) { return urls.caseAction.replace('__ID__', id); }

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

  function formatWhen(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', '
      + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
      body: JSON.stringify(body || {}),
    }).then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); });
  }

  var STATUS_STYLE = {
    pending: { text: 'Awaiting review', bg: '#e9ebf1', ink: '#1f2c4a', dot: '#1f2c4a' },
    ongoing: { text: 'Ongoing', bg: '#e8efe9', ink: '#2f5d3f', dot: '#2f5d3f' },
    review: { text: 'In firm review', bg: '#ece9f2', ink: '#463a63', dot: '#48376D' },
    closed: { text: 'Closed', bg: '#eeece6', ink: '#57544e', dot: '#a8a49c' },
  };
  var TITLES = { pending: 'Pending review', ongoing: 'Ongoing', review: 'In firm review', closed: 'Closed', all: 'Every case' };

  var el = {
    list: document.querySelector('.console-list'),
    listTitle: document.querySelector('.console-list-title'),
    listStandfirst: document.querySelector('.console-list-standfirst'),
    tabs: document.querySelectorAll('.console-status-tabs a'),
    rows: document.querySelector('.console-rows'),
    empty: document.querySelector('.console-empty'),

    detail: document.querySelector('.console-detail'),
    back: document.querySelector('.console-detail-back'),
    client: document.querySelector('.console-detail-client'),
    statusPill: document.querySelector('.console-detail-status-pill'),
    meta: document.querySelector('.console-detail-meta'),
    summary: document.querySelector('.console-summary'),
    provenance: document.querySelector('.console-provenance'),
    facts: document.querySelector('.console-facts'),
    exchanges: document.querySelector('.console-exchanges'),
    files: document.querySelector('.console-files'),

    pendingActions: document.querySelector('.console-pending-actions'),
    accept: document.querySelector('.console-accept'),
    declinePending: document.querySelector('.console-decline-pending'),

    mine: document.querySelector('.console-mine'),
    email: document.querySelector('.console-email'),
    phone: document.querySelector('.console-phone'),
    stages: document.querySelector('.console-stages'),
    feeExisting: document.querySelector('.console-fee-existing'),
    feeLine: document.querySelector('.console-fee-line'),
    feeState: document.querySelector('.console-fee-state'),
    feeRevise: document.querySelector('.console-fee-revise'),
    feeForm: document.querySelector('.console-fee-form'),
    feeTypes: document.querySelector('.console-fee-types'),
    feeAmount: document.querySelector('.console-fee-amount'),
    feeSend: document.querySelector('.console-fee-send'),
    notes: document.querySelector('.console-notes'),
    historyToggle: document.querySelector('.console-history-toggle'),
    history: document.querySelector('.console-history'),
    reviewActions: document.querySelector('.console-review-actions'),
    withdraw: document.querySelector('.console-withdraw'),
    ongoingActions: document.querySelector('.console-ongoing-actions'),
    complete: document.querySelector('.console-complete'),
    resolveHint: document.querySelector('.console-resolve-hint'),
    declineOngoing: document.querySelector('.console-decline-ongoing'),
    closedActions: document.querySelector('.console-closed-actions'),
    reopen: document.querySelector('.console-reopen'),

    banner: document.querySelector('.console-note-banner'),
  };

  var current = { view: 'list', status: 'pending', caseId: null, data: null, feeType: 'Fixed', editingFee: false, stageFile: null };

  function backStatusFor(status) {
    return status === 'pending' ? 'pending' : status === 'review' ? 'review' : status === 'closed' ? 'closed' : 'ongoing';
  }

  function showBanner(text) {
    el.banner.textContent = text;
    el.banner.style.display = text ? '' : 'none';
  }

  function renderList() {
    el.list.style.display = '';
    el.detail.style.display = 'none';

    el.tabs.forEach(function (tab) { tab.classList.toggle('active', tab.dataset.status === current.status); });

    fetch(urls.caseList + '?status=' + encodeURIComponent(current.status))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        el.tabs.forEach(function (tab) {
          var span = tab.querySelector('span');
          if (span && data.counts[tab.dataset.status] !== undefined) span.textContent = data.counts[tab.dataset.status];
        });

        el.listTitle.textContent = TITLES[current.status] || 'Cases';
        if (current.status === 'pending') {
          var n = data.counts.pending || 0;
          el.listStandfirst.textContent = n === 0 ? 'Nothing is waiting for you.' : n === 1 ? 'One file is waiting for you.' : n + ' files are waiting for you.';
        } else {
          el.listStandfirst.textContent = data.rows.length + (data.rows.length === 1 ? ' case' : ' cases');
        }

        el.rows.innerHTML = '';
        data.rows.forEach(function (row) {
          var a = document.createElement('a');
          a.className = 'console-row';
          a.href = '#/cases/' + row.id;

          var clientWrap = document.createElement('span');
          clientWrap.className = 'console-row-client';
          var dot = document.createElement('span');
          dot.className = 'console-row-dot';
          dot.style.background = (STATUS_STYLE[row.status] || {}).dot || '#a8a49c';
          var clientName = document.createElement('span');
          clientName.textContent = row.client;
          clientWrap.appendChild(dot);
          clientWrap.appendChild(clientName);

          var line = document.createElement('span');
          line.className = 'console-row-line';
          line.textContent = row.line;

          var where = document.createElement('span');
          where.className = 'console-row-where';
          where.textContent = row.where;

          var age = document.createElement('span');
          age.className = 'console-row-age';
          age.textContent = row.age;

          a.appendChild(clientWrap);
          a.appendChild(line);
          a.appendChild(where);
          a.appendChild(age);
          el.rows.appendChild(a);
        });

        el.empty.style.display = data.rows.length === 0 ? '' : 'none';
        el.empty.textContent = current.status === 'pending' ? 'Every file has been reviewed.' : 'Nothing here yet.';
      });
  }

  function renderExchanges(exchanges) {
    el.exchanges.innerHTML = '';
    (exchanges || []).forEach(function (x) {
      var wrap = document.createElement('div');
      wrap.className = 'console-exchange';

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'console-exchange-toggle';
      var q = document.createElement('span');
      q.className = 'console-exchange-q';
      q.textContent = x.q;
      var hint = document.createElement('span');
      hint.className = 'console-exchange-hint';
      hint.textContent = 'Show';
      button.appendChild(q);
      button.appendChild(hint);

      var answerWrap = document.createElement('div');
      answerWrap.className = 'console-exchange-a';
      var p = document.createElement('p');
      p.textContent = x.a;
      answerWrap.appendChild(p);

      button.addEventListener('click', function () {
        var open = wrap.classList.toggle('open');
        hint.textContent = open ? 'Hide' : 'Show';
      });

      wrap.appendChild(button);
      wrap.appendChild(answerWrap);
      el.exchanges.appendChild(wrap);
    });
  }

  function renderFiles(files) {
    el.files.innerHTML = '';
    (files || []).forEach(function (f) {
      var a = document.createElement('a');
      a.className = 'console-file';
      a.href = f.url;
      a.target = '_blank';
      a.rel = 'noopener';

      var ext = document.createElement('span');
      ext.className = 'console-file-ext';
      ext.textContent = fileExt(f.name);

      var info = document.createElement('span');
      info.className = 'console-file-info';
      var name = document.createElement('span');
      name.className = 'console-file-name';
      name.textContent = f.name;
      var size = document.createElement('span');
      size.className = 'console-file-size';
      size.textContent = fileSize(f.size);
      info.appendChild(name);
      info.appendChild(size);

      a.appendChild(ext);
      a.appendChild(info);
      el.files.appendChild(a);
    });
  }

  function renderStages(data) {
    el.stages.innerHTML = '';
    var records = data.records || [];
    data.stageNames.forEach(function (name, i) {
      var record = records[i];
      var isCurrent = data.status === 'ongoing' && data.mine && i === records.length;

      var row = document.createElement('div');
      row.className = 'console-stage';
      var dot = document.createElement('span');
      dot.className = 'console-stage-dot';
      dot.style.background = record ? '#1f2c4a' : 'transparent';
      dot.style.borderColor = i <= records.length ? '#1f2c4a' : '#cdc7bb';

      var body = document.createElement('div');
      body.className = 'console-stage-body';
      var label = document.createElement('span');
      label.className = 'console-stage-name';
      label.textContent = name;
      label.style.color = record ? '#57544e' : isCurrent ? '#111110' : '#6f6c65';
      body.appendChild(label);

      if (record) {
        var p = document.createElement('p');
        p.className = 'console-stage-record';
        p.textContent = record.text;
        body.appendChild(p);
        if (record.file) {
          var fileLine = document.createElement('span');
          fileLine.className = 'console-stage-record-file';
          fileLine.textContent = record.file.name;
          body.appendChild(fileLine);
        }
      } else if (isCurrent) {
        body.appendChild(buildStageForm(data, i));
      }

      row.appendChild(dot);
      row.appendChild(body);
      el.stages.appendChild(row);
    });
  }

  function buildStageForm(data, stageIndex) {
    var STAGE_PROMPTS = [
      'What was agreed with the client, and on what basis?',
      'What did you gather and from where? Attach it.',
      'The advice you sent, quoted or paraphrased.',
      'What was filed or agreed? Attach the document or summarise the negotiation.',
    ];
    var form = document.createElement('div');
    form.className = 'console-stage-form';

    var textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.placeholder = STAGE_PROMPTS[stageIndex] || '';

    var row = document.createElement('div');
    row.className = 'console-stage-form-row';

    var fileLabel = document.createElement('label');
    fileLabel.className = 'console-stage-file-label';
    fileLabel.textContent = 'Attach a file';
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    var stageFile = null;
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      fileLabel.textContent = 'Uploading…';
      var formData = new FormData();
      formData.append('file', f);
      fetch(urls.upload, { method: 'POST', headers: { 'X-CSRFToken': getCookie('csrftoken') }, body: formData })
        .then(function (r) { return r.json(); })
        .then(function (data2) {
          stageFile = data2;
          fileLabel.textContent = data2.name || 'Attach a file';
        })
        .catch(function () { fileLabel.textContent = 'Upload failed'; });
    });
    fileLabel.appendChild(fileInput);

    var recordBtn = document.createElement('button');
    recordBtn.type = 'button';
    recordBtn.className = 'console-stage-record-btn';
    recordBtn.textContent = 'Record this';
    textarea.addEventListener('input', function () {
      recordBtn.classList.toggle('ready', !!textarea.value.trim());
    });
    recordBtn.addEventListener('click', function () {
      var text = textarea.value.trim();
      if (!text) return;
      postJson(actionUrl(current.caseId), { action: 'record_stage', text: text, file: stageFile }).then(function (result) {
        if (result.ok) { current.data = result.data; renderDetail(); }
      });
    });

    row.appendChild(fileLabel);
    row.appendChild(recordBtn);
    form.appendChild(textarea);
    form.appendChild(row);
    return form;
  }

  function renderFee(data) {
    var fee = data.fee;
    if (fee && !current.editingFee) {
      el.feeExisting.style.display = '';
      el.feeForm.style.display = 'none';
      el.feeLine.textContent = fee.type + ' · ' + fee.amount;
      el.feeState.textContent = fee.accepted ? 'Accepted by the client' : 'Sent, awaiting the client';
    } else {
      el.feeExisting.style.display = 'none';
      el.feeForm.style.display = '';
      el.feeTypes.querySelectorAll('button').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.type === current.feeType);
      });
      el.feeSend.classList.toggle('ready', !!el.feeAmount.value.trim());
    }
  }

  function renderHistory(timeline) {
    el.history.innerHTML = '';
    (timeline || []).slice().reverse().forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'console-history-row';
      var when = document.createElement('span');
      when.className = 'console-history-when';
      when.textContent = formatWhen(t.when);
      var what = document.createElement('span');
      what.className = 'console-history-what';
      what.textContent = t.what;
      row.appendChild(when);
      row.appendChild(what);
      el.history.appendChild(row);
    });
  }

  function renderDetail() {
    var data = current.data;
    if (!data) return;
    el.list.style.display = 'none';
    el.detail.style.display = '';

    var backStatus = backStatusFor(data.status);
    el.back.href = '#/cases?status=' + backStatus;
    el.back.textContent = '← ' + TITLES[backStatus];

    el.client.textContent = data.client;
    var style = STATUS_STYLE[data.status] || {};
    el.statusPill.textContent = style.text || data.status;
    el.statusPill.style.background = style.bg || '#eeece6';
    el.statusPill.style.color = style.ink || '#57544e';
    el.meta.textContent = data.meta;

    el.summary.textContent = data.summary;
    el.provenance.textContent = data.provenance;

    el.facts.innerHTML = '';
    data.facts.forEach(function (f) {
      var wrap = document.createElement('div');
      wrap.className = 'console-fact';
      var value = document.createElement('span');
      value.className = 'console-fact-value';
      value.textContent = f.value;
      var name = document.createElement('span');
      name.className = 'console-fact-name';
      name.textContent = f.name;
      wrap.appendChild(value);
      wrap.appendChild(name);
      el.facts.appendChild(wrap);
    });

    renderExchanges(data.exchanges);
    renderFiles(data.files);

    el.pendingActions.style.display = data.status === 'pending' ? '' : 'none';
    var isMine = data.mine && data.status !== 'pending';
    el.mine.style.display = isMine ? '' : 'none';

    if (isMine) {
      el.email.textContent = data.email || 'No email on file';
      el.email.href = data.email ? 'mailto:' + data.email : '#';
      el.phone.textContent = data.phone || 'No phone on file';
      renderStages(data);
      renderFee(data);
      el.notes.value = data.notes || '';
      el.historyToggle.textContent = (el.history.style.display === 'none' ? 'Show' : 'Hide') + ' the history';
      renderHistory(data.timeline);

      var complete = (data.records || []).length >= data.stageNames.length;
      el.reviewActions.style.display = data.status === 'review' ? '' : 'none';
      el.ongoingActions.style.display = data.status === 'ongoing' ? '' : 'none';
      el.closedActions.style.display = data.status === 'closed' ? '' : 'none';
      el.complete.classList.toggle('ready', complete);
      el.resolveHint.textContent = complete ? 'An administrator verifies the record before it closes.' : 'Record every step before asking for closure.';
    }
  }

  el.tabs.forEach(function (tab) {
    tab.addEventListener('click', function () { showBanner(''); });
  });

  el.accept.addEventListener('click', function () {
    postJson(actionUrl(current.caseId), { action: 'accept' }).then(function (result) {
      if (result.ok) { showBanner('Taken on. This case is now yours.'); current.data = result.data; renderDetail(); }
      else { showBanner(result.data.error || 'That did not go through.'); }
    });
  });
  el.declinePending.addEventListener('click', function () {
    postJson(actionUrl(current.caseId), { action: 'decline' }).then(function () { location.hash = '/cases?status=pending'; });
  });
  el.declineOngoing.addEventListener('click', function () {
    postJson(actionUrl(current.caseId), { action: 'decline' }).then(function () { location.hash = '/cases?status=pending'; });
  });

  el.feeTypes.addEventListener('click', function (e) {
    if (e.target.dataset.type) { current.feeType = e.target.dataset.type; renderFee(current.data); }
  });
  el.feeAmount.addEventListener('input', function () { renderFee(current.data); });
  el.feeSend.addEventListener('click', function () {
    var amount = el.feeAmount.value.trim();
    if (!amount) return;
    postJson(actionUrl(current.caseId), { action: 'send_quote', type: current.feeType, amount: amount }).then(function (result) {
      if (result.ok) {
        current.data = result.data;
        current.editingFee = false;
        el.feeAmount.value = '';
        showBanner('Quote sent. The client sees it in writing and can accept or ask you about it.');
        renderDetail();
      }
    });
  });
  el.feeRevise.addEventListener('click', function () {
    current.editingFee = true;
    current.feeType = (current.data.fee || {}).type || 'Fixed';
    el.feeAmount.value = (current.data.fee || {}).amount || '';
    renderFee(current.data);
  });

  el.notes.addEventListener('blur', function () {
    postJson(actionUrl(current.caseId), { action: 'save_note', note: el.notes.value });
  });

  el.historyToggle.addEventListener('click', function () {
    el.history.style.display = el.history.style.display === 'none' ? '' : 'none';
    el.historyToggle.textContent = (el.history.style.display === 'none' ? 'Show' : 'Hide') + ' the history';
  });

  el.complete.addEventListener('click', function () {
    if (!el.complete.classList.contains('ready')) return;
    postJson(actionUrl(current.caseId), { action: 'complete' }).then(function (result) {
      if (result.ok) {
        showBanner('Sent for verification. An administrator checks the record before the case closes.');
        current.data = result.data;
        renderDetail();
      } else { showBanner(result.data.error || 'That did not go through.'); }
    });
  });
  el.withdraw.addEventListener('click', function () {
    postJson(actionUrl(current.caseId), { action: 'withdraw' }).then(function (result) {
      if (result.ok) { showBanner('Pulled back from review. It is yours again.'); current.data = result.data; renderDetail(); }
    });
  });
  el.reopen.addEventListener('click', function () {
    postJson(actionUrl(current.caseId), { action: 'reopen' }).then(function (result) {
      if (result.ok) { showBanner('Reopened.'); current.data = result.data; renderDetail(); }
    });
  });

  function route() {
    showBanner('');
    current.editingFee = false;
    var hash = (location.hash || '').replace(/^#/, '');
    var caseMatch = hash.match(/^\/cases\/([A-Za-z0-9-]+)/);
    if (caseMatch) {
      current.view = 'detail';
      current.caseId = caseMatch[1];
      fetch(detailUrl(current.caseId)).then(function (r) { return r.json(); }).then(function (data) {
        current.data = data;
        renderDetail();
      });
      return;
    }
    var statusMatch = hash.match(/status=([a-z]+)/);
    current.view = 'list';
    current.status = statusMatch ? statusMatch[1] : 'pending';
    renderList();
  }

  addEventListener('hashchange', route);
  if (!location.hash) location.hash = '/cases?status=pending';
  else route();
});
