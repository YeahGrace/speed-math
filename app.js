document.addEventListener('touchmove', function (e) {
    if (e.scale !== 1) e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('gesturechange', e => e.preventDefault());
document.addEventListener('gestureend', e => e.preventDefault());

const THEME_KEY = 'speed_math_theme';

const MODE_DESC = {
    two: {
        title: '两位数乘法进位',
        desc: '个位数乘以一位数结果 <strong>&gt; 10</strong> 且 <strong>不等于整十数</strong>，总乘积 <strong>&gt; 100</strong>。<br>建议每题控制在 <strong>2 秒</strong>以内完成。',
    },
    three: {
        title: '三位数乘法进位',
        desc: '个位数乘以一位数结果 <strong>&gt; 10</strong> 且 <strong>不等于整十数</strong>。<br>建议每题控制在 <strong>3 秒</strong>以内完成。',
    },
    div2: {
        title: '三位数÷两位数',
        desc: '正确答案精确到小数点后两位（四舍五入）。<br>你的答案与正确答案误差 <strong>&lt; 3%</strong> 即为正确。',
    },
    div1: {
        title: '三位数÷一位数',
        desc: '正确答案精确到小数点后两位（四舍五入）。<br>你的答案与正确答案误差 <strong>&lt; 1%</strong> 即为正确。',
    },
    sum: {
        title: '多数相加',
        desc: '多个多位数相加，答案与正确结果误差 <strong>&lt; 3%</strong> 即为正确。<br>点击「开始练习」后设置参数。',
    },
};

const app = {
    currentProblem: null,
    stats: { total: 0, correct: 0 },
    problemStartTime: 0,
    sessionStartTime: 0,
    totalTimerInterval: null,
    mode: 'two',
    questionCount: 10,
    history: [],
    usedKeys: new Set(),
    sumCount: 3,
    sumDigits: 3,
    hwStrokes: [],
    hwCurrentStroke: null,
    hwCtx: null,

    initTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.getElementById('themeBtn').textContent = '🌙';
        }
    },

    toggleTheme() {
        const html = document.documentElement;
        const btn = document.getElementById('themeBtn');
        const isDark = html.getAttribute('data-theme') === 'dark';
        if (isDark) {
            html.setAttribute('data-theme', 'light');
            btn.textContent = '☀️';
            localStorage.setItem(THEME_KEY, 'light');
        } else {
            html.setAttribute('data-theme', 'dark');
            btn.textContent = '🌙';
            localStorage.setItem(THEME_KEY, 'dark');
        }
    },

    selectMode(btn, mode) {
        document.querySelectorAll('#modeGroup .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.mode = mode;
        const info = MODE_DESC[mode];
        document.getElementById('subtitleText').textContent = info.title;
        document.getElementById('modeDesc').innerHTML = info.desc;
        if (mode.startsWith('div')) {
            document.getElementById('startDesc').innerHTML = '除法速算练习，<br>帮助你提升除法估算能力。';
        } else if (mode === 'sum') {
            document.getElementById('startDesc').innerHTML = '多数相加练习，<br>帮助你提升多位数加法能力。';
        } else {
            document.getElementById('startDesc').innerHTML = '所有题目均为<strong>有进位</strong>的乘法题目，<br>帮助你强化速算中最容易出错的环节。';
        }
    },

    selectCount(btn, count) {
        document.querySelectorAll('#questionCountGroup .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.questionCount = count;
    },

    selectSumCount(btn, count) {
        document.querySelectorAll('#sumCountGroup .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sumCount = count;
    },

    selectSumDigits(btn, digits) {
        document.querySelectorAll('#sumDigitsGroup .toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.sumDigits = digits;
    },

    start() {
        if (this.mode === 'sum') {
            document.getElementById('sumModal').classList.add('active');
            return;
        }
        this._doStart();
    },

    confirmSumSettings() {
        document.getElementById('sumModal').classList.remove('active');
        this._doStart();
    },

    closeSumModal() {
        document.getElementById('sumModal').classList.remove('active');
    },

    _resetHandwriting() {
        document.getElementById('handwritingOverlay').classList.remove('active');
        this.hwStrokes = [];
        this.hwCurrentStroke = null;
    },

    _doStart() {
        this._resetHandwriting();
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('resultScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        document.getElementById('globalSettings').classList.add('hidden');
        document.getElementById('keyboardWrapper').classList.remove('hidden');

        document.getElementById('pageTitle').classList.add('hidden');
        document.getElementById('subtitleText').classList.add('hidden');

        this.stats = { total: 0, correct: 0 };
        this.history = [];
        this.usedKeys.clear();
        this.sessionStartTime = performance.now();
        document.getElementById('backBtn').classList.remove('hidden');
        this.updateStats();
        this.nextProblem();
        this.startTotalTimer();
    },

    restart() {
        this._resetHandwriting();
        this.stats = { total: 0, correct: 0 };
        this.history = [];
        this.usedKeys.clear();
        this.sessionStartTime = performance.now();
        document.getElementById('backBtn').classList.remove('hidden');
        document.getElementById('pageTitle').classList.add('hidden');
        document.getElementById('subtitleText').classList.add('hidden');
        this.updateStats();
        this.nextProblem();
        this.startTotalTimer();
    },

    backToStart() {
        this._resetHandwriting();
        document.getElementById('resultScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('startScreen').classList.remove('hidden');
        document.getElementById('globalSettings').classList.remove('hidden');
        document.getElementById('backBtn').classList.add('hidden');
        document.getElementById('keyboardWrapper').classList.add('hidden');
        document.getElementById('pageTitle').classList.remove('hidden');
        document.getElementById('subtitleText').classList.remove('hidden');
        clearInterval(this.totalTimerInterval);
    },

    startTotalTimer() {
        clearInterval(this.totalTimerInterval);
        this.totalTimerInterval = setInterval(() => {
            const elapsed = (performance.now() - this.sessionStartTime) / 1000;
            document.getElementById('statTotalTime').textContent = Math.max(0, elapsed).toFixed(1) + 's';
        }, 100);
    },

    hasCarry(a, b) {
        const unitProduct = (a % 10) * b;
        return unitProduct > 10 && unitProduct % 10 !== 0;
    },

    generateProblem() {
        const isThreeDigit = this.mode === 'three';
        const isDiv2 = this.mode === 'div2';
        const isDiv1 = this.mode === 'div1';
        const isSum = this.mode === 'sum';

        if (isSum) {
            const min = Math.pow(10, this.sumDigits - 1);
            const max = Math.pow(10, this.sumDigits) - 1;
            let attempts = 0;
            while (attempts < 100) {
                const numbers = [];
                for (let i = 0; i < this.sumCount; i++) {
                    numbers.push(Math.floor(Math.random() * (max - min + 1)) + min);
                }
                const key = numbers.slice().sort((a, b) => a - b).join('+');
                if (!this.usedKeys.has(key)) {
                    this.usedKeys.add(key);
                    const answer = numbers.reduce((s, n) => s + n, 0);
                    return { numbers, answer, op: '+' };
                }
                attempts++;
            }
            this.usedKeys.clear();
            return this.generateProblem();
        }

        if (isDiv2) {
            let problems = [];
            for (let a = 100; a <= 999; a++) {
                for (let b = 10; b <= 99; b++) {
                    if (a <= b) continue;
                    const raw = a / b;
                    const rounded = Math.round(raw * 100) / 100;
                    if (Math.abs(raw - rounded) < 0.001) continue;
                    const key = `${a}÷${b}`;
                    if (this.usedKeys.has(key)) continue;
                    problems.push({ a, b, answer: rounded, op: '÷' });
                }
            }
            if (problems.length === 0) {
                this.usedKeys.clear();
                return this.generateProblem();
            }
            const p = problems[Math.floor(Math.random() * problems.length)];
            this.usedKeys.add(`${p.a}÷${p.b}`);
            return p;
        }

        if (isDiv1) {
            let problems = [];
            for (let a = 100; a <= 999; a++) {
                for (let b = 2; b <= 9; b++) {
                    const raw = a / b;
                    const rounded = Math.round(raw * 100) / 100;
                    if (Math.abs(raw - rounded) < 0.001) continue;
                    const key = `${a}÷${b}`;
                    if (this.usedKeys.has(key)) continue;
                    problems.push({ a, b, answer: rounded, op: '÷' });
                }
            }
            if (problems.length === 0) {
                this.usedKeys.clear();
                return this.generateProblem();
            }
            const p = problems[Math.floor(Math.random() * problems.length)];
            this.usedKeys.add(`${p.a}÷${p.b}`);
            return p;
        }

        const minA = isThreeDigit ? 100 : 10;
        const maxA = isThreeDigit ? 999 : 99;

        let problems = [];
        for (let a = minA; a <= maxA; a++) {
            for (let b = 2; b <= 9; b++) {
                if (!this.hasCarry(a, b)) continue;
                if (!isThreeDigit && a * b <= 100) continue;
                const key = `${a}×${b}`;
                if (this.usedKeys.has(key)) continue;
                problems.push({ a, b, answer: a * b, op: '×' });
            }
        }
        if (problems.length === 0) {
            this.usedKeys.clear();
            return this.generateProblem();
        }
        const p = problems[Math.floor(Math.random() * problems.length)];
        this.usedKeys.add(`${p.a}×${p.b}`);
        return p;
    },

    nextProblem() {
        if (this.stats.total >= this.questionCount) {
            this.showResult();
            return;
        }

        this.currentProblem = this.generateProblem();
        const el = document.getElementById('problem');

        if (this.mode === 'sum') {
            el.className = 'problem-sum';
            const nums = this.currentProblem.numbers;
            const lastIdx = nums.length - 1;
            el.innerHTML = nums.map((n, i) =>
                `<div class="sum-row"><span class="sum-op">${i === lastIdx ? '+' : '&nbsp;'}</span><span class="sum-num">${n}</span></div>`
            ).join('') + '<div class="sum-divider"></div>';
        } else {
            el.className = 'problem';
            el.textContent = `${this.currentProblem.a} ${this.currentProblem.op || '×'} ${this.currentProblem.b}`;
        }

        const input = document.getElementById('answerInput');
        input.value = '';
        input.className = 'answer-input';
        input.focus();

        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
        });

        document.getElementById('feedback').textContent = '';
        this.problemStartTime = performance.now();
    },

    numInput(num) {
        const input = document.getElementById('answerInput');
        if (input.value.length >= 10) return;
        input.value += num;
    },

    numClear() {
        document.getElementById('answerInput').value = '';
    },

    numBackspace() {
        const input = document.getElementById('answerInput');
        input.value = input.value.slice(0, -1);
    },

    numToggleSign() {
        const input = document.getElementById('answerInput');
        if (input.value.startsWith('-')) {
            input.value = input.value.substring(1);
        } else if (input.value.length > 0) {
            input.value = '-' + input.value;
        }
    },

    numDot() {
        const input = document.getElementById('answerInput');
        if (!input.value.includes('.')) {
            input.value += '.';
        }
    },

    submit() {
        const input = document.getElementById('answerInput');
        const userAnswer = parseFloat(input.value);

        if (isNaN(userAnswer)) return;

        const problemTimeMs = performance.now() - this.problemStartTime;
        const problemTimeSec = problemTimeMs / 1000;

        let correct;
        if (this.mode === 'sum') {
            const err = Math.abs(userAnswer - this.currentProblem.answer) / this.currentProblem.answer;
            correct = err < 0.03;
        } else if (this.mode.startsWith('div')) {
            const err = Math.abs(userAnswer - this.currentProblem.answer) / this.currentProblem.answer;
            const threshold = this.mode === 'div2' ? 0.03 : 0.01;
            correct = err < threshold;
        } else {
            correct = Math.abs(userAnswer - this.currentProblem.answer) < 0.0001;
        }

        this.stats.total++;
        if (correct) this.stats.correct++;

        input.className = 'answer-input ' + (correct ? 'correct' : 'wrong');
        const feedback = document.getElementById('feedback');
        feedback.className = 'feedback ' + (correct ? 'correct' : 'wrong');

        document.querySelectorAll('.num-btn').forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
        });

        if (correct) {
            feedback.textContent = '✓ 正确';
        } else {
            feedback.textContent = `✗ 正确答案：${this.currentProblem.answer}`;
            input.classList.add('shake');
            setTimeout(() => input.classList.remove('shake'), 300);
        }

        let problemText;
        if (this.mode === 'sum') {
            problemText = this.currentProblem.numbers.join(' + ');
        } else {
            problemText = `${this.currentProblem.a} ${this.currentProblem.op || '×'} ${this.currentProblem.b}`;
        }

        this.history.push({
            idx: this.stats.total,
            problem: problemText,
            userAnswer,
            correct,
            answer: this.currentProblem.answer,
            time: problemTimeSec
        });
        this.updateStats();

        if (this.stats.total >= this.questionCount) {
            clearInterval(this.totalTimerInterval);
            setTimeout(() => this.showResult(), 500);
        } else {
            setTimeout(() => this.nextProblem(), 500);
        }
    },

    showResult() {
        this._resetHandwriting();
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('resultScreen').classList.remove('hidden');
        document.getElementById('backBtn').classList.add('hidden');
        document.getElementById('keyboardWrapper').classList.add('hidden');
        document.getElementById('pageTitle').classList.remove('hidden');
        document.getElementById('subtitleText').classList.add('hidden');

        const totalTimeSec = (performance.now() - this.sessionStartTime) / 1000;
        const wrongCount = this.questionCount - this.stats.correct;
        const accuracy = Math.round(this.stats.correct / this.questionCount * 100);

        document.getElementById('resultCorrect').textContent = this.stats.correct;
        document.getElementById('resultWrong').textContent = wrongCount;
        document.getElementById('resultTotalTimeResult').textContent = Math.max(0, totalTimeSec).toFixed(2) + 's';
        document.getElementById('resultAccuracy').textContent = accuracy + '%';

        const mins = Math.floor(totalTimeSec / 60);
        const secs = totalTimeSec % 60;
        const timeStr = mins > 0 ? `${mins}分${secs.toFixed(1)}秒` : `${secs.toFixed(1)}秒`;

        const modeNames = {
            two: '两位数×一位数',
            three: '三位数×一位数',
            div2: '三位数÷两位数',
            div1: '三位数÷一位数',
            sum: '多数相加',
        };
        document.getElementById('resultSummary').textContent =
            `本次${modeNames[this.mode]}练习 ${this.questionCount} 题，总用时 ${timeStr}`;

        const tbody = document.getElementById('resultTableBody');
        tbody.innerHTML = this.history.map(h => `
            <tr>
                <td>${h.idx}</td>
                <td>${h.problem}</td>
                <td class="${h.correct ? 'correct' : ''}">${h.answer}</td>
                <td class="${h.correct ? '' : 'user-wrong'}">${h.userAnswer}</td>
                <td>${h.time.toFixed(3)}s</td>
                <td class="status-mark ${h.correct ? 'correct' : 'wrong'}">${h.correct ? '✓' : '✗'}</td>
            </tr>
        `).join('');
    },

    updateStats() {
        document.getElementById('statCount').textContent = `${this.stats.total}/${this.questionCount}`;
        const accuracy = this.stats.total > 0
            ? Math.round(this.stats.correct / this.stats.total * 100) + '%'
            : '--';
        document.getElementById('statAccuracy').textContent = accuracy;
    },

    // 手写涂鸦
    openHandwriting() {
        const overlay = document.getElementById('handwritingOverlay');
        const canvas = document.getElementById('handwritingCanvas');
        overlay.classList.add('active');
        document.getElementById('keyboardWrapper').classList.add('hidden');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        this.hwCtx = canvas.getContext('2d');
        this.hwCtx.lineCap = 'round';
        this.hwCtx.lineJoin = 'round';
        this.hwCtx.lineWidth = 3;
        this.hwCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1a1a2e';
        this.hwStrokes = [];
        this._bindHandwritingEvents(canvas);
    },

    _bindHandwritingEvents(canvas) {
        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return { x: clientX - rect.left, y: clientY - rect.top };
        };

        const start = (e) => {
            e.preventDefault();
            const pos = getPos(e);
            this.hwCurrentStroke = [pos];
            this.hwStrokes.push(this.hwCurrentStroke);
            this.hwCtx.beginPath();
            this.hwCtx.moveTo(pos.x, pos.y);
        };

        const move = (e) => {
            e.preventDefault();
            if (!this.hwCurrentStroke) return;
            const pos = getPos(e);
            this.hwCurrentStroke.push(pos);
            this.hwCtx.lineTo(pos.x, pos.y);
            this.hwCtx.stroke();
        };

        const end = (e) => {
            e.preventDefault();
            this.hwCurrentStroke = null;
        };

        canvas.ontouchstart = start;
        canvas.ontouchmove = move;
        canvas.ontouchend = end;
        canvas.onmousedown = start;
        canvas.onmousemove = move;
        canvas.onmouseup = end;
    },

    hwClear() {
        const canvas = document.getElementById('handwritingCanvas');
        this.hwCtx.clearRect(0, 0, canvas.width, canvas.height);
        this.hwStrokes = [];
    },

    hwUndo() {
        if (this.hwStrokes.length === 0) return;
        this.hwStrokes.pop();
        const canvas = document.getElementById('handwritingCanvas');
        this.hwCtx.clearRect(0, 0, canvas.width, canvas.height);
        this.hwStrokes.forEach(stroke => {
            if (stroke.length === 0) return;
            this.hwCtx.beginPath();
            this.hwCtx.moveTo(stroke[0].x, stroke[0].y);
            for (let i = 1; i < stroke.length; i++) {
                this.hwCtx.lineTo(stroke[i].x, stroke[i].y);
            }
            this.hwCtx.stroke();
        });
    },

    hwClose() {
        document.getElementById('handwritingOverlay').classList.remove('active');
        this.hwStrokes = [];
        this.hwCurrentStroke = null;
        if (!document.getElementById('gameScreen').classList.contains('hidden')) {
            document.getElementById('keyboardWrapper').classList.remove('hidden');
        }
    },

    initKeyboardResize() {
        const handle = document.getElementById('dragHandle');
        const wrapper = document.getElementById('keyboardWrapper');
        if (!handle || !wrapper) return;

        let startY = 0;
        let startGap = 6;
        let startBtnPad = 14;
        let startFont = 20;
        let startMinH = 48;

        const onStart = (e) => {
            e.preventDefault();
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startY = clientY;
            const style = getComputedStyle(wrapper);
            startGap = parseFloat(style.getPropertyValue('--pad-gap')) || 6;
            startBtnPad = parseFloat(style.getPropertyValue('--btn-padding').split(' ')[0]) || 14;
            startFont = parseFloat(style.getPropertyValue('--btn-font-size')) || 20;
            startMinH = parseFloat(style.getPropertyValue('--btn-min-height')) || 48;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);
        };

        const onMove = (e) => {
            e.preventDefault();
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const delta = clientY - startY;
            const factor = delta / 80;
            const newGap = Math.max(2, Math.min(16, startGap + factor * 4));
            const newBtnPad = Math.max(6, Math.min(32, startBtnPad + factor * 8));
            const newFont = Math.max(14, Math.min(34, startFont + factor * 6));
            const newMinH = Math.max(36, Math.min(80, startMinH + factor * 12));
            wrapper.style.setProperty('--pad-gap', newGap + 'px');
            wrapper.style.setProperty('--btn-padding', newBtnPad + 'px 4px');
            wrapper.style.setProperty('--btn-font-size', newFont + 'px');
            wrapper.style.setProperty('--btn-min-height', newMinH + 'px');
        };

        const onEnd = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        };

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, { passive: false });
    },
};

app.initTheme();
app.initKeyboardResize();
