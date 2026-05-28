const CONFIG = {
  width: 800,
  height: 600,
  numObjects: 9,
  numTargets: 4,
  maxTrials: 10,
  radius: 24,
  borderWidth: 2,
  initialSpeedParam: 5.72,
  speedToPixelsPerSecond: 60,
  adaptiveIncrease: 1.1,
  adaptiveDecrease: 0.9,
  fixationDuration: 5000,
  flashHalfDuration: 500,
  flashTimes: 3,
  motionDuration: 8000,
  selectionDuration: 5000,
  revealDuration: 350,
  answerFlashHalfDurations: [450, 300],
  answerFlashTimes: 2,
  progressFeedbackDuration: 750,
  minSpawnGap: 8,
  backgroundColor: "#808080",
  textColor: "#ffffff",
  targetFlashColor: "#ff0000",
  ballNormalColor: "#ffff00",
  ballSelectedColor: "#ff0000",
  ballMissedOrWrongColor: "#800080",
  borderColor: "#ffffff"
};

const canvas = document.getElementById("motCanvas");
const ctx = canvas.getContext("2d");
const landingPage = document.getElementById("landingPage");
const siteHeader = document.getElementById("siteHeader");
const introPanel = document.getElementById("introPanel");
const experimentPanel = document.getElementById("experimentPanel");
const resultsPanel = document.getElementById("resultsPanel");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const backHomeButton = document.getElementById("backHomeButton");
const resultHomeButton = document.getElementById("resultHomeButton");
const phaseTitle = document.getElementById("phaseTitle");
const phaseDetail = document.getElementById("phaseDetail");
const summaryStats = document.getElementById("summaryStats");
const resultsBody = document.getElementById("resultsBody");
const openTestButtons = document.querySelectorAll(".js-open-test");

const bounds = {
  minX: CONFIG.radius,
  maxX: CONFIG.width - CONFIG.radius,
  minY: CONFIG.radius,
  maxY: CONFIG.height - CONFIG.radius
};

const state = {
  phase: "instruction",
  phaseStart: 0,
  lastFrameTime: 0,
  animationId: null,
  trial: 0,
  speedParam: CONFIG.initialSpeedParam,
  balls: [],
  targetIndices: new Set(),
  selectedIndices: new Set(),
  progressSymbols: [],
  trialRecords: []
};

openTestButtons.forEach((button) => {
  button.addEventListener("click", showTestIntro);
});
startButton.addEventListener("click", startExperiment);
restartButton.addEventListener("click", startExperiment);
backHomeButton.addEventListener("click", showHome);
resultHomeButton.addEventListener("click", showHome);
canvas.addEventListener("click", handleCanvasClick);

function showTestIntro() {
  cancelAnimationFrame(state.animationId);
  state.phase = "instruction";
  landingPage.classList.add("hidden");
  experimentPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  introPanel.classList.remove("hidden");
  siteHeader.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showHome() {
  cancelAnimationFrame(state.animationId);
  state.phase = "instruction";
  introPanel.classList.add("hidden");
  experimentPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  landingPage.classList.remove("hidden");
  siteHeader.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function startExperiment() {
  cancelAnimationFrame(state.animationId);
  state.phase = "fixation";
  state.phaseStart = performance.now();
  state.lastFrameTime = state.phaseStart;
  state.trial = 0;
  state.speedParam = CONFIG.initialSpeedParam;
  state.balls = generateNonOverlappingBalls();
  state.targetIndices = new Set();
  state.selectedIndices = new Set();
  state.progressSymbols = [];
  state.trialRecords = [];

  landingPage.classList.add("hidden");
  introPanel.classList.add("hidden");
  resultsPanel.classList.add("hidden");
  siteHeader.classList.add("hidden");
  experimentPanel.classList.remove("hidden");

  state.animationId = requestAnimationFrame(loop);
}

function loop(now) {
  const deltaSeconds = Math.min((now - state.lastFrameTime) / 1000, 0.05);
  state.lastFrameTime = now;

  update(now, deltaSeconds);
  draw(now);

  if (state.phase !== "summary") {
    state.animationId = requestAnimationFrame(loop);
  }
}

function update(now, deltaSeconds) {
  const elapsed = now - state.phaseStart;

  if (state.phase === "fixation" && elapsed >= CONFIG.fixationDuration) {
    beginTrial(now);
    return;
  }

  if (state.phase === "flash" && elapsed >= getFlashDuration()) {
    transitionTo("motion", now);
    return;
  }

  if (state.phase === "motion") {
    moveBalls(deltaSeconds);
    if (elapsed >= CONFIG.motionDuration) {
      state.selectedIndices = new Set();
      transitionTo("selection", now);
    }
    return;
  }

  if (state.phase === "selection") {
    if (elapsed >= CONFIG.selectionDuration || state.selectedIndices.size >= CONFIG.numTargets) {
      transitionTo("reveal", now);
    }
    return;
  }

  if (state.phase === "reveal" && elapsed >= CONFIG.revealDuration) {
    transitionTo("answerFlash", now);
    return;
  }

  if (state.phase === "answerFlash" && elapsed >= getAnswerFlashDuration()) {
    recordTrialResult();
    transitionTo("progressFeedback", now);
    return;
  }

  if (state.phase === "progressFeedback" && elapsed >= CONFIG.progressFeedbackDuration) {
    if (state.trial >= CONFIG.maxTrials) {
      showSummary();
    } else {
      beginTrial(now);
    }
  }
}

function beginTrial(now) {
  state.trial += 1;
  state.targetIndices = pickRandomIndices(CONFIG.numObjects, CONFIG.numTargets);
  state.selectedIndices = new Set();

  // 每轮重新随机运动方向，但位置继承上一轮结束位置。
  for (const ball of state.balls) {
    const direction = randomUnitVector();
    ball.vx = direction.x;
    ball.vy = direction.y;
  }

  transitionTo("flash", now);
}

function transitionTo(phase, now) {
  state.phase = phase;
  state.phaseStart = now;
  state.lastFrameTime = now;
}

function recordTrialResult() {
  const selectedTargets = [...state.selectedIndices].filter((index) => state.targetIndices.has(index));
  const correctCount = selectedTargets.length;
  const accuracy = correctCount / CONFIG.numTargets;
  const perfect = setsEqual(state.selectedIndices, state.targetIndices);
  const resultSymbol = perfect ? "★" : "—";

  state.progressSymbols.push(resultSymbol);
  state.trialRecords.push({
    trial: state.trial,
    speedParam: state.speedParam,
    targetNumbers: toDisplayNumbers(state.targetIndices),
    selectedNumbers: toDisplayNumbers(state.selectedIndices),
    correctCount,
    accuracy,
    perfect
  });

  state.speedParam *= perfect ? CONFIG.adaptiveIncrease : CONFIG.adaptiveDecrease;
}

function draw(now) {
  updateExperimentStatus();
  clearCanvas();

  if (state.phase === "fixation") {
    drawFixation();
    return;
  }

  if (state.phase === "flash") {
    drawBallsForFlash(now);
    drawSpeed();
    return;
  }

  if (state.phase === "motion") {
    drawBalls(() => CONFIG.ballNormalColor);
    return;
  }

  if (state.phase === "selection") {
    drawBalls((index) => state.selectedIndices.has(index) ? CONFIG.ballSelectedColor : CONFIG.ballNormalColor);
    drawSpeed();
    drawFixation();
    return;
  }

  if (state.phase === "reveal") {
    drawBallsForReveal();
    return;
  }

  if (state.phase === "answerFlash") {
    drawBallsForAnswerFlash(now);
    return;
  }

  if (state.phase === "progressFeedback") {
    drawProgress();
  }
}

function updateExperimentStatus() {
  const labels = {
    fixation: ["注视准备", "请注视中央十字，正式测试即将开始。"],
    flash: [`第 ${state.trial} / ${CONFIG.maxTrials} 轮：目标提示`, "请记住闪烁为红色的 4 个目标小球。"],
    motion: [`第 ${state.trial} / ${CONFIG.maxTrials} 轮：动态追踪`, "请持续追踪目标小球，运动阶段不显示速度和进程。"],
    selection: [`第 ${state.trial} / ${CONFIG.maxTrials} 轮：选择目标`, "请点击你认为的目标小球，最多选择 4 个。"],
    reveal: [`第 ${state.trial} / ${CONFIG.maxTrials} 轮：选择反馈`, "红色为选对目标，紫色为误选或漏选目标。"],
    answerFlash: [`第 ${state.trial} / ${CONFIG.maxTrials} 轮：目标答案`, "正确目标正在闪烁，方便核对追踪结果。"],
    progressFeedback: [`第 ${state.trial} / ${CONFIG.maxTrials} 轮：进程记录`, "左侧显示当前实验进程，下一轮即将开始。"]
  };
  const [title, detail] = labels[state.phase] || ["实验准备", "请保持专注并按照屏幕提示完成测试。"];
  phaseTitle.textContent = title;
  phaseDetail.textContent = detail;
}

function clearCanvas() {
  ctx.fillStyle = CONFIG.backgroundColor;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
}

function drawFixation() {
  drawCenteredText("+", CONFIG.width / 2, CONFIG.height / 2 + 6, 60);
}

function drawSpeed() {
  drawText(`速度: ${state.speedParam.toFixed(2)}`, 95, 34, 24, "left");
}

function drawProgress() {
  drawText("进程", 35, 70, 22, "left");
  for (let i = 0; i < CONFIG.maxTrials; i += 1) {
    const symbol = state.progressSymbols[i] || "○";
    drawText(`${String(i + 1).padStart(2, "0")}  ${symbol}`, 35, 105 + i * 28, 20, "left");
  }
}

function drawBallsForFlash(now) {
  const elapsed = now - state.phaseStart;
  const halfIndex = Math.floor(elapsed / CONFIG.flashHalfDuration);
  const targetVisible = halfIndex % 2 === 0;

  drawBalls((index) => {
    if (targetVisible && state.targetIndices.has(index)) {
      return CONFIG.targetFlashColor;
    }
    return CONFIG.ballNormalColor;
  });
}

function drawBallsForReveal() {
  drawBalls((index) => {
    const isTarget = state.targetIndices.has(index);
    const isSelected = state.selectedIndices.has(index);

    if (isTarget && isSelected) {
      return CONFIG.ballSelectedColor;
    }
    if ((isSelected && !isTarget) || (isTarget && !isSelected)) {
      return CONFIG.ballMissedOrWrongColor;
    }
    return CONFIG.ballNormalColor;
  });
}

function drawBallsForAnswerFlash(now) {
  const elapsed = now - state.phaseStart;
  const cycleDuration = CONFIG.answerFlashHalfDurations[0] + CONFIG.answerFlashHalfDurations[1];
  const inCycle = elapsed % cycleDuration;
  const targetVisible = inCycle < CONFIG.answerFlashHalfDurations[0];

  drawBalls((index) => {
    if (targetVisible && state.targetIndices.has(index)) {
      return CONFIG.targetFlashColor;
    }
    return CONFIG.ballNormalColor;
  });
}

function drawBalls(colorForIndex) {
  state.balls.forEach((ball, index) => {
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, CONFIG.radius, 0, Math.PI * 2);
    ctx.fillStyle = colorForIndex(index);
    ctx.fill();
    ctx.lineWidth = CONFIG.borderWidth;
    ctx.strokeStyle = CONFIG.borderColor;
    ctx.stroke();
  });
}

function drawCenteredText(text, x, y, size) {
  drawText(text, x, y, size, "center");
}

function drawText(text, x, y, size, align) {
  ctx.fillStyle = CONFIG.textColor;
  ctx.font = `${size}px "Microsoft YaHei", "PingFang SC", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function moveBalls(deltaSeconds) {
  const speed = state.speedParam * CONFIG.speedToPixelsPerSecond;

  for (const ball of state.balls) {
    ball.x += ball.vx * speed * deltaSeconds;
    ball.y += ball.vy * speed * deltaSeconds;
  }

  keepInsideBoundary();
  resolveCollisions();
  keepInsideBoundary();
}

function keepInsideBoundary() {
  for (const ball of state.balls) {
    if (ball.x > bounds.maxX) {
      ball.x = bounds.maxX;
      ball.vx = -Math.abs(ball.vx);
    } else if (ball.x < bounds.minX) {
      ball.x = bounds.minX;
      ball.vx = Math.abs(ball.vx);
    }

    if (ball.y > bounds.maxY) {
      ball.y = bounds.maxY;
      ball.vy = -Math.abs(ball.vy);
    } else if (ball.y < bounds.minY) {
      ball.y = bounds.minY;
      ball.vy = Math.abs(ball.vy);
    }
  }
}

function resolveCollisions() {
  const minDistance = CONFIG.radius * 2;

  for (let i = 0; i < state.balls.length; i += 1) {
    for (let j = i + 1; j < state.balls.length; j += 1) {
      const a = state.balls[i];
      const b = state.balls[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distance = Math.hypot(dx, dy);

      if (distance === 0) {
        const direction = randomUnitVector();
        dx = direction.x;
        dy = direction.y;
        distance = 1;
      }

      if (distance < minDistance) {
        const nx = dx / distance;
        const ny = dy / distance;
        const overlap = minDistance - distance;

        a.x += nx * overlap / 2;
        a.y += ny * overlap / 2;
        b.x -= nx * overlap / 2;
        b.y -= ny * overlap / 2;

        const relativeVx = a.vx - b.vx;
        const relativeVy = a.vy - b.vy;
        const velocityAlongNormal = relativeVx * nx + relativeVy * ny;

        // 只在两球相向运动时修正速度，避免贴近后反复抖动。
        if (velocityAlongNormal < 0) {
          a.vx -= velocityAlongNormal * nx;
          a.vy -= velocityAlongNormal * ny;
          b.vx += velocityAlongNormal * nx;
          b.vy += velocityAlongNormal * ny;
          normalizeBallVelocity(a);
          normalizeBallVelocity(b);
        }
      }
    }
  }
}

function handleCanvasClick(event) {
  if (state.phase !== "selection" || state.selectedIndices.size >= CONFIG.numTargets) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  for (let i = state.balls.length - 1; i >= 0; i -= 1) {
    const ball = state.balls[i];
    if (Math.hypot(x - ball.x, y - ball.y) <= CONFIG.radius && !state.selectedIndices.has(i)) {
      state.selectedIndices.add(i);
      break;
    }
  }
}

function generateNonOverlappingBalls() {
  const balls = [];
  const minDistance = CONFIG.radius * 2 + CONFIG.minSpawnGap;
  const maxAttempts = 10000;

  for (let i = 0; i < CONFIG.numObjects; i += 1) {
    let placed = false;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const candidate = {
        x: randomBetween(bounds.minX, bounds.maxX),
        y: randomBetween(bounds.minY, bounds.maxY),
        vx: 0,
        vy: 0
      };

      if (balls.every((ball) => Math.hypot(candidate.x - ball.x, candidate.y - ball.y) >= minDistance)) {
        balls.push(candidate);
        placed = true;
        break;
      }
    }

    if (!placed) {
      throw new Error("无法生成不重叠的小球位置，请减小小球半径或减少小球数量。");
    }
  }

  return balls;
}

function randomUnitVector() {
  const angle = Math.random() * Math.PI * 2;
  return {
    x: Math.cos(angle),
    y: Math.sin(angle)
  };
}

function normalizeBallVelocity(ball) {
  const length = Math.hypot(ball.vx, ball.vy);
  if (length === 0) {
    const direction = randomUnitVector();
    ball.vx = direction.x;
    ball.vy = direction.y;
    return;
  }
  ball.vx /= length;
  ball.vy /= length;
}

function pickRandomIndices(total, count) {
  const indices = [...Array(total).keys()];

  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  return new Set(indices.slice(0, count));
}

function setsEqual(a, b) {
  if (a.size !== b.size) {
    return false;
  }
  for (const item of a) {
    if (!b.has(item)) {
      return false;
    }
  }
  return true;
}

function toDisplayNumbers(indexSet) {
  return [...indexSet].map((index) => index + 1).sort((a, b) => a - b);
}

function getFlashDuration() {
  return CONFIG.flashTimes * CONFIG.flashHalfDuration * 2;
}

function getAnswerFlashDuration() {
  return CONFIG.answerFlashTimes * (CONFIG.answerFlashHalfDurations[0] + CONFIG.answerFlashHalfDurations[1]);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function showSummary() {
  state.phase = "summary";
  cancelAnimationFrame(state.animationId);
  landingPage.classList.add("hidden");
  introPanel.classList.add("hidden");
  experimentPanel.classList.add("hidden");
  siteHeader.classList.add("hidden");
  resultsPanel.classList.remove("hidden");

  const averageSpeed = average(state.trialRecords.map((record) => record.speedParam));
  const maxSpeed = Math.max(...state.trialRecords.map((record) => record.speedParam));
  const averageAccuracy = average(state.trialRecords.map((record) => record.accuracy));

  summaryStats.innerHTML = `
    <div class="summary-card">
      <span class="summary-label">平均速度参数</span>
      <span class="summary-value">${averageSpeed.toFixed(2)}</span>
    </div>
    <div class="summary-card">
      <span class="summary-label">最高速度参数</span>
      <span class="summary-value">${maxSpeed.toFixed(2)}</span>
    </div>
    <div class="summary-card">
      <span class="summary-label">平均准确率</span>
      <span class="summary-value">${formatPercent(averageAccuracy)}</span>
    </div>
  `;

  resultsBody.innerHTML = state.trialRecords.map((record) => `
    <tr>
      <td>${record.trial}</td>
      <td>${record.speedParam.toFixed(2)}</td>
      <td>${record.targetNumbers.join(", ")}</td>
      <td>${record.selectedNumbers.length ? record.selectedNumbers.join(", ") : "未选择"}</td>
      <td>${record.correctCount}</td>
      <td>${formatPercent(record.accuracy)}</td>
      <td>${record.perfect ? "是" : "否"}</td>
    </tr>
  `).join("");
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}
