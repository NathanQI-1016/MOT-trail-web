const CONFIG = {
  width: 1000,
  height: 700,
  numObjects: 9,
  numTargets: 4,
  maxTrials: 10,
  radius: 32,
  initialSpeedParam: 5.72,
  speedToPixelsPerSecond: 60,
  adaptiveIncrease: 1.1,
  adaptiveDecrease: 0.9,
  fixationDuration: 5000,
  flashHalfDuration: 750,
  flashTimes: 4,
  motionDuration: 8000,
  selectionDuration: 8000,
  revealDuration: 350,
  answerFlashHalfDurations: [450, 300],
  answerFlashTimes: 2,
  progressFeedbackDuration: 1000,
  minSpawnGap: 8,
  backgroundColor: "#101827",
  textColor: "#ffffff",
  targetFlashColor: "#FF2D2D",
  ballNormalColor: "#FFD43B",
  ballSelectedColor: "#FF2D2D",
  ballMissedOrWrongColor: "#8B5CF6"
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
const speedReadout = document.getElementById("speedReadout");
const timeReadout = document.getElementById("timeReadout");
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
  updateExperimentStatus(now);
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
    drawBalls(() => CONFIG.ballNormalColor);
  }
}

function updateExperimentStatus(now) {
  const labels = {
    fixation: ["当前轮次：0 / 10", "当前阶段：注视准备"],
    flash: [`当前轮次：${state.trial} / ${CONFIG.maxTrials}`, "当前阶段：目标提示"],
    motion: [`当前轮次：${state.trial} / ${CONFIG.maxTrials}`, "当前阶段：运动中"],
    selection: [`当前轮次：${state.trial} / ${CONFIG.maxTrials}`, "当前阶段：选择中"],
    reveal: [`当前轮次：${state.trial} / ${CONFIG.maxTrials}`, "当前阶段：反馈"],
    answerFlash: [`当前轮次：${state.trial} / ${CONFIG.maxTrials}`, "当前阶段：反馈"],
    progressFeedback: [`当前轮次：${state.trial} / ${CONFIG.maxTrials}`, "当前阶段：反馈"]
  };
  const [title, detail] = labels[state.phase] || ["实验准备", "请保持专注并按照屏幕提示完成测试。"];
  phaseTitle.textContent = title;
  phaseDetail.textContent = detail;
  speedReadout.textContent = state.phase === "motion"
    ? "速度参数: 追踪中"
    : `速度参数: ${state.speedParam.toFixed(2)}`;
  timeReadout.textContent = `剩余时间: ${formatRemainingTime(now)}`;
}

function clearCanvas() {
  const gradient = ctx.createRadialGradient(
    CONFIG.width * 0.5,
    CONFIG.height * 0.42,
    40,
    CONFIG.width * 0.5,
    CONFIG.height * 0.45,
    CONFIG.width * 0.75
  );
  gradient.addColorStop(0, "#172554");
  gradient.addColorStop(0.52, "#101827");
  gradient.addColorStop(1, "#060b16");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  drawCanvasGrid();
}

function drawFixation() {
  drawCenteredText("+", CONFIG.width / 2, CONFIG.height / 2 + 6, 60);
}

function drawSpeed() {
  drawCanvasBadge(`速度: ${state.speedParam.toFixed(2)}`, 28, 28);
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
    drawModernBall(ball.x, ball.y, colorForIndex(index));
  });
}

function drawModernBall(x, y, color) {
  const palette = getBallPalette(color);
  ctx.save();
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 5;

  const gradient = ctx.createRadialGradient(
    x - CONFIG.radius * 0.22,
    y - CONFIG.radius * 0.26,
    CONFIG.radius * 0.08,
    x,
    y,
    CONFIG.radius
  );
  gradient.addColorStop(0, palette.center);
  gradient.addColorStop(0.72, palette.main);
  gradient.addColorStop(1, palette.edge);

  ctx.beginPath();
  ctx.arc(x, y, CONFIG.radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x - CONFIG.radius * 0.28, y - CONFIG.radius * 0.30, CONFIG.radius * 0.13, 0, Math.PI * 2);
  ctx.fillStyle = palette.glint;
  ctx.fill();
  ctx.restore();
}

function getBallPalette(color) {
  if (color === CONFIG.targetFlashColor || color === CONFIG.ballSelectedColor) {
    return {
      center: "#FF6B6B",
      main: "#FF2D2D",
      edge: "#D60000",
      glint: "rgba(255, 255, 255, 0.20)",
      shadow: "rgba(255, 45, 45, 0.38)"
    };
  }
  if (color === CONFIG.ballMissedOrWrongColor) {
    return {
      center: "#B794F8",
      main: "#8B5CF6",
      edge: "#6D28D9",
      glint: "rgba(255, 255, 255, 0.18)",
      shadow: "rgba(139, 92, 246, 0.38)"
    };
  }
  return {
    center: "#FFE680",
    main: "#FFD43B",
    edge: "#F59F00",
    glint: "rgba(255, 255, 255, 0.16)",
    shadow: "rgba(255, 212, 59, 0.32)"
  };
}

function drawCanvasGrid() {
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.08)";
  for (let x = 0; x <= CONFIG.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CONFIG.height);
    ctx.stroke();
  }
  for (let y = 0; y <= CONFIG.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CONFIG.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(34, 211, 238, 0.16)";
  ctx.strokeRect(0.5, 0.5, CONFIG.width - 1, CONFIG.height - 1);
  ctx.restore();
}

function drawCanvasBadge(text, x, y) {
  ctx.save();
  ctx.font = '700 22px "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  const metrics = ctx.measureText(text);
  const width = metrics.width + 30;
  const height = 42;
  ctx.fillStyle = "rgba(15, 23, 42, 0.62)";
  ctx.strokeStyle = "rgba(148, 163, 184, 0.32)";
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, width, height, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = CONFIG.textColor;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 15, y + height / 2);
  ctx.restore();
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
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

function formatRemainingTime(now) {
  const durationByPhase = {
    fixation: CONFIG.fixationDuration,
    flash: getFlashDuration(),
    motion: CONFIG.motionDuration,
    selection: CONFIG.selectionDuration,
    reveal: CONFIG.revealDuration,
    answerFlash: getAnswerFlashDuration(),
    progressFeedback: CONFIG.progressFeedbackDuration
  };
  const duration = durationByPhase[state.phase];
  if (!duration) {
    return "--";
  }
  const remaining = Math.max(0, duration - (now - state.phaseStart));
  return `${(remaining / 1000).toFixed(1)}s`;
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
