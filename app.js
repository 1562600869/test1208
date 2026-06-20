(function () {
  'use strict';

  const STORAGE_WORDS = 'dictation_words';
  const STORAGE_HISTORY = 'dictation_history';
  const STORAGE_MISTAKES = 'dictation_mistakes';
  const PRACTICE_COUNT = 10;

  let words = loadData(STORAGE_WORDS, []);
  let history = loadData(STORAGE_HISTORY, []);
  let mistakes = loadData(STORAGE_MISTAKES, {});

  let practiceQueue = [];
  let currentIndex = 0;
  let practiceResults = [];
  let audioPlayer = null;

  function loadData(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }

  function saveData(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function initNav() {
    const btns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.dataset.view;
        btns.forEach(b => b.classList.toggle('active', b === btn));
        views.forEach(view => {
          view.classList.toggle('active', view.id === 'view-' + v);
        });
        if (v === 'stats') {
          renderStats();
        }
      });
    });
  }

  function renderWordList() {
    const list = $('word-list');
    const count = $('word-count');
    count.textContent = words.length;

    if (words.length === 0) {
      list.innerHTML = '<div class="empty-tip">词库为空，请添加单词</div>';
      return;
    }

    list.innerHTML = words.map((w, idx) => {
      const mCount = mistakes[w.text] || 0;
      return `
        <div class="word-item">
          <div class="word-info">
            <strong>${escapeHtml(w.text)}</strong>
            <span>${escapeHtml(w.meaning)}</span>
            ${mCount > 0 ? `<span class="mistake-count">答错 ${mCount} 次</span>` : ''}
          </div>
          <button class="btn btn-danger" data-idx="${idx}">删除</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.btn-danger').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx, 10);
        words.splice(idx, 1);
        saveData(STORAGE_WORDS, words);
        renderWordList();
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function initAddForm() {
    const form = $('add-word-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = $('word-text').value.trim();
      const meaning = $('word-meaning').value.trim();
      const audio = $('word-audio').value.trim();

      if (!text || !meaning || !audio) return;

      if (words.some(w => w.text.toLowerCase() === text.toLowerCase())) {
        alert('该单词已存在');
        return;
      }

      words.push({ text, meaning, audio });
      saveData(STORAGE_WORDS, words);
      form.reset();
      renderWordList();
    });
  }

  function initPractice() {
    audioPlayer = $('audio-player');

    $('start-practice').addEventListener('click', startPractice);
    $('restart-practice').addEventListener('click', startPractice);
    $('play-audio').addEventListener('click', playCurrentAudio);
    $('submit-answer').addEventListener('click', submitAnswer);
    $('next-word').addEventListener('click', nextWord);

    $('answer-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!$('submit-answer').classList.contains('hidden')) {
          submitAnswer();
        } else if (!$('next-word').classList.contains('hidden')) {
          nextWord();
        }
      }
    });
  }

  function startPractice() {
    if (words.length === 0) {
      alert('词库为空，请先添加单词');
      return;
    }

    const n = Math.min(PRACTICE_COUNT, words.length);
    practiceQueue = shuffle(words).slice(0, n);
    currentIndex = 0;
    practiceResults = [];

    $('practice-start').classList.add('hidden');
    $('practice-result').classList.add('hidden');
    $('practice-session').classList.remove('hidden');
    $('total-count').textContent = n;

    showCurrentWord();
  }

  function showCurrentWord() {
    const word = practiceQueue[currentIndex];
    $('current-index').textContent = currentIndex + 1;
    $('word-hint').textContent = '中文释义：' + word.meaning;
    $('answer-input').value = '';
    $('answer-input').disabled = false;
    $('answer-result').classList.add('hidden');
    $('submit-answer').classList.remove('hidden');
    $('next-word').classList.add('hidden');
    $('answer-input').focus();
    setTimeout(playCurrentAudio, 200);
  }

  function playCurrentAudio() {
    const word = practiceQueue[currentIndex];
    if (!word) return;
    audioPlayer.src = word.audio;
    audioPlayer.play().catch(err => {
      console.warn('Audio play failed:', err);
    });
  }

  function submitAnswer() {
    const word = practiceQueue[currentIndex];
    const userAnswer = $('answer-input').value.trim();
    const correct = userAnswer.toLowerCase() === word.text.toLowerCase();

    const result = {
      word: word.text,
      meaning: word.meaning,
      userAnswer: userAnswer,
      correct: correct
    };
    practiceResults.push(result);

    if (!correct) {
      mistakes[word.text] = (mistakes[word.text] || 0) + 1;
      saveData(STORAGE_MISTAKES, mistakes);
    }

    const resultEl = $('answer-result');
    resultEl.classList.remove('hidden', 'correct', 'wrong');
    resultEl.classList.add(correct ? 'correct' : 'wrong');
    if (correct) {
      resultEl.textContent = '✅ 回答正确！';
    } else {
      resultEl.innerHTML = `❌ 回答错误！正确答案：<strong>${escapeHtml(word.text)}</strong>`;
    }

    $('answer-input').disabled = true;
    $('submit-answer').classList.add('hidden');
    $('next-word').classList.remove('hidden');
    $('next-word').textContent = currentIndex === practiceQueue.length - 1 ? '查看结果' : '下一题';
  }

  function nextWord() {
    currentIndex++;
    if (currentIndex >= practiceQueue.length) {
      finishPractice();
    } else {
      showCurrentWord();
    }
  }

  function finishPractice() {
    const correctCount = practiceResults.filter(r => r.correct).length;
    const score = Math.round((correctCount / practiceQueue.length) * 100);

    history.push({
      date: Date.now(),
      score: score
    });
    if (history.length > 50) history = history.slice(-50);
    saveData(STORAGE_HISTORY, history);

    $('practice-session').classList.add('hidden');
    $('practice-result').classList.remove('hidden');
    $('final-score').textContent = score;

    const detail = $('result-detail');
    detail.innerHTML = practiceResults.map((r, i) => `
      <div class="result-item ${r.correct ? 'correct' : 'wrong'}">
        <strong>${i + 1}.</strong> ${escapeHtml(r.meaning)} — 
        你的答案: <strong>${escapeHtml(r.userAnswer) || '(空)'}</strong>
        ${!r.correct ? `，正确答案: <strong>${escapeHtml(r.word)}</strong>` : ''}
      </div>
    `).join('');
  }

  function renderStats() {
    drawChart();
    renderTopMistakes();
    renderHistory();
  }

  function drawChart() {
    const canvas = $('chart-canvas');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const displayW = Math.floor(rect.width * dpr);
    const displayH = Math.floor(rect.height * dpr);
    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW;
      canvas.height = displayH;
    }
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cssW = W / dpr;
    const cssH = H / dpr;

    ctx.clearRect(0, 0, cssW, cssH);

    const recent = history.slice(-10);
    const padding = { top: 30, right: 30, bottom: 40, left: 50 };
    const chartW = cssW - padding.left - padding.right;
    const chartH = cssH - padding.top - padding.bottom;

    ctx.fillStyle = '#333';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';

    if (recent.length === 0) {
      ctx.fillStyle = '#999';
      ctx.font = '14px sans-serif';
      ctx.fillText('暂无练习记录', cssW / 2, cssH / 2);
      return;
    }

    const n = recent.length;
    const stepX = n > 1 ? chartW / (n - 1) : 0;

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(cssW - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText((100 - i * 25) + '%', padding.left - 8, y + 4);
    }

    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    recent.forEach((h, i) => {
      const x = padding.left + stepX * i;
      ctx.fillText(String(i + 1), x, cssH - padding.bottom + 20);
    });

    ctx.textAlign = 'center';
    ctx.fillText('练习编号', cssW / 2, cssH - 6);

    ctx.save();
    ctx.translate(14, cssH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('正确率 (%)', 0, 0);
    ctx.restore();

    const points = recent.map((h, i) => ({
      x: padding.left + stepX * i,
      y: padding.top + chartH - (h.score / 100) * chartH
    }));

    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    points.forEach((p, i) => {
      ctx.fillStyle = '#667eea';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#333';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(recent[i].score + '%', p.x, p.y - 12);
    });
  }

  function renderTopMistakes() {
    const container = $('top-mistakes');
    const arr = Object.keys(mistakes).map(text => ({
      text,
      count: mistakes[text],
      meaning: (words.find(w => w.text === text) || {}).meaning || ''
    })).filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    if (arr.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无错误记录</div>';
      return;
    }

    container.innerHTML = arr.map((item, i) => `
      <div class="mistake-item">
        <div>
          <span class="rank">${i + 1}</span>
          <span class="word-name">
            <strong>${escapeHtml(item.text)}</strong>
            ${item.meaning ? `<div class="word-meaning">${escapeHtml(item.meaning)}</div>` : ''}
          </span>
        </div>
        <span class="count-badge">${item.count} 次</span>
      </div>
    `).join('');
  }

  function renderHistory() {
    const container = $('history-list');
    if (history.length === 0) {
      container.innerHTML = '<div class="empty-tip">暂无练习记录</div>';
      return;
    }

    const reversed = history.slice().reverse();
    container.innerHTML = reversed.map(h => `
      <div class="history-item">
        <span class="date">${formatDate(h.date)}</span>
        <span class="score">${h.score}%</span>
      </div>
    `).join('');
  }

  function init() {
    initNav();
    initAddForm();
    initPractice();
    renderWordList();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
