const form = document.querySelector("#solve-form");
const problemInput = document.querySelector("#problem");
const solveButton = document.querySelector("#solve-button");
const buttonLabel = document.querySelector(".button-label");
const statusMessage = document.querySelector("#status");
const result = document.querySelector("#result");
const resultProblem = document.querySelector("#result-problem-text");
const resultMode = document.querySelector("#result-mode");
const solutionIntro = document.querySelector("#solution-intro");
const solutionSteps = document.querySelector("#solution-steps");
const answerBlock = document.querySelector("#answer-block");
const solutionAnswer = document.querySelector("#solution-answer");
const revealAnswerButton = document.querySelector("#reveal-answer-button");
const answerRevealStatus = document.querySelector("#answer-reveal-status");
const boardStatus = document.querySelector("#board-status");
const checkButton = document.querySelector("#check-button");
const checkPanel = document.querySelector("#check-panel");
const reward = document.querySelector("#reward");
const rewardText = document.querySelector("#reward-text");
const xpLabel = document.querySelector("#xp-label");
const progressBar = document.querySelector("#progress-bar");
const modeButtons = [...document.querySelectorAll(".mode-option")];

const xpStorageKey = "aha-xp";
const modeLabels = { key: "핵심만", friend: "친구처럼", hint: "힌트만" };
let selectedMode = "friend";
let currentMode = "friend";
let currentProblem = "";
let currentSolution = null;
let renderSequence = 0;

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.mode || "friend";
    modeButtons.forEach((modeButton) => {
      const selected = modeButton === button;
      modeButton.classList.toggle("is-selected", selected);
      modeButton.setAttribute("aria-pressed", String(selected));
    });
  });
});

updateProgress();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  currentProblem = problemInput.value.trim();

  if (!currentProblem) {
    showStatus("문제를 먼저 적어줘.", "error");
    problemInput.focus();
    return;
  }

  solveButton.disabled = true;
  buttonLabel.textContent = "아하가 생각 중...";
  result.hidden = true;
  reward.hidden = true;
  checkPanel.hidden = true;
  answerRevealStatus.hidden = true;
  showStatus("칠판에 하나씩 적고 있어. 잠깐만 기다려줘!", "loading");

  try {
    const data = await postJson("/api/solve", {
      problem: currentProblem,
      mode: selectedMode,
    });
    if (!data.solution || !Array.isArray(data.solution.steps)) {
      throw new Error("풀이 형식이 올바르지 않아요. 다시 한 번 눌러 주세요.");
    }

    currentMode = selectedMode;
    currentSolution = data.solution;
    resultProblem.textContent = currentProblem;
    resultMode.textContent = modeLabels[currentMode];
    checkButton.hidden = currentMode === "hint";
    result.hidden = false;
    statusMessage.hidden = true;
    showReward();
    await renderChalkboard(currentSolution, currentMode === "hint");
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showStatus(error.message || "풀이를 가져오지 못했어요. 다시 시도해 줘.", "error");
  } finally {
    solveButton.disabled = false;
    buttonLabel.textContent = "같이 풀기";
  }
});

async function renderChalkboard(solution, hideAnswer) {
  const sequence = ++renderSequence;
  solutionIntro.textContent = solution.intro || "좋아, 문제를 같이 살펴보자.";
  solutionSteps.replaceChildren();
  answerBlock.hidden = true;
  answerBlock.classList.remove("is-visible");
  solutionAnswer.textContent = "";
  revealAnswerButton.hidden = !hideAnswer;

  const stepCards = (solution.steps || []).map((step, index) => createStepCard(step, index));
  stepCards.forEach((card) => solutionSteps.append(card));

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  for (const [index, card] of stepCards.entries()) {
    if (sequence !== renderSequence) return;
    boardStatus.textContent = stepCards.length ? `${index + 1} / ${stepCards.length} 적고 있어` : "풀이를 정리했어";
    if (!reduceMotion) await wait(650);
    if (sequence !== renderSequence) return;
    card.classList.add("is-visible");
  }

  if (sequence !== renderSequence) return;
  boardStatus.textContent = hideAnswer ? "여기까지만, 이제 네 차례!" : "칠판 풀이 완료";
  if (!hideAnswer && solution.answer) {
    solutionAnswer.textContent = solution.answer;
    answerBlock.hidden = false;
    if (!reduceMotion) answerBlock.classList.add("is-visible");
  }
}

function createStepCard(step, index) {
  const card = document.createElement("article");
  card.className = "chalk-step";

  const numberButton = document.createElement("button");
  numberButton.className = "step-number";
  numberButton.type = "button";
  numberButton.textContent = String(index + 1);
  numberButton.setAttribute("aria-label", `${index + 1}번 풀이 다시 설명 듣기`);
  numberButton.setAttribute("aria-expanded", "false");

  const content = document.createElement("div");
  content.className = "chalk-step-content";
  const explanation = document.createElement("p");
  explanation.className = "chalk-explanation";
  explanation.textContent = step.explanation || "이 부분을 다시 같이 살펴보자.";
  content.append(explanation);

  if (step.equation) {
    const equation = document.createElement("p");
    equation.className = "chalk-equation";
    equation.textContent = step.equation;
    content.append(equation);
  }

  const againPanel = document.createElement("div");
  againPanel.className = "again-panel";
  againPanel.hidden = true;
  const againPrompt = document.createElement("p");
  againPrompt.className = "again-prompt";
  againPrompt.textContent = "어떤 부분이 헷갈리는지 같이 다시 볼게.";
  const againResponses = document.createElement("div");
  againResponses.className = "again-responses";
  const againStatus = document.createElement("p");
  againStatus.className = "again-status";
  againStatus.setAttribute("role", "status");
  againStatus.setAttribute("aria-live", "polite");
  const moreButton = document.createElement("button");
  moreButton.className = "again-more-button";
  moreButton.type = "button";
  moreButton.textContent = "아직 헷갈려 · 다른 설명 듣기";
  againPanel.append(againPrompt, againResponses, againStatus, moreButton);

  let attempts = [];
  let isExplaining = false;
  const askAgain = async () => {
    if (isExplaining) return;
    isExplaining = true;
    moreButton.disabled = true;
    againStatus.textContent = "아하가 다른 설명을 생각 중이야...";
    againStatus.classList.remove("is-error");

    try {
      const data = await postJson("/api/again", {
        problem: currentProblem,
        stepNumber: index + 1,
        step,
        previousAttempts: attempts.slice(-3).map((attempt) => attempt.explanation),
      });
      const alternate = data.explanation;
      if (!alternate || typeof alternate.explanation !== "string") {
        throw new Error("다시 설명을 만들지 못했어.");
      }
      attempts.push(alternate);
      const responseCard = document.createElement("div");
      responseCard.className = "again-response";
      const responseText = document.createElement("p");
      responseText.textContent = alternate.explanation;
      responseCard.append(responseText);
      if (alternate.equation) {
        const responseEquation = document.createElement("p");
        responseEquation.className = "again-equation";
        responseEquation.textContent = alternate.equation;
        responseCard.append(responseEquation);
      }
      againResponses.append(responseCard);
      againStatus.textContent = "이 설명은 어때? 더 쉽게도 바꿔볼 수 있어.";
    } catch (error) {
      againStatus.textContent = error.message || "다시 설명을 가져오지 못했어.";
      againStatus.classList.add("is-error");
    } finally {
      isExplaining = false;
      moreButton.disabled = false;
    }
  };

  numberButton.addEventListener("click", () => {
    const open = againPanel.hidden;
    againPanel.hidden = !open;
    numberButton.setAttribute("aria-expanded", String(open));
    if (open && attempts.length === 0) askAgain();
  });
  moreButton.addEventListener("click", askAgain);

  card.append(numberButton, content, againPanel);
  return card;
}

checkButton.addEventListener("click", async () => {
  if (!currentSolution || checkButton.disabled) return;
  checkButton.disabled = true;
  checkButton.textContent = "다시 계산 중...";
  checkPanel.className = "check-panel is-loading";
  checkPanel.textContent = "풀이를 처음부터 다시 계산해 확인하고 있어.";
  checkPanel.hidden = false;

  try {
    const data = await postJson("/api/check", {
      problem: currentProblem,
      solution: currentSolution,
    });
    const check = data.check;
    if (!check || typeof check.matches !== "boolean") {
      throw new Error("검산 결과를 읽지 못했어요.");
    }

    checkPanel.replaceChildren();
    checkPanel.className = `check-panel ${check.matches ? "check-ok" : "check-correction"}`;
    const title = document.createElement("strong");
    title.textContent = check.matches ? "한 번 더 계산해 봤어. 풀이가 맞아!" : "다시 계산해 보니 고칠 부분이 있어.";
    const feedback = document.createElement("p");
    feedback.textContent = check.feedback;
    const note = document.createElement("small");
    note.textContent = "AI 검산도 참고용이야. 중요한 문제라면 직접 한 번 더 확인해 줘.";
    checkPanel.append(title, feedback);

    if (!check.matches && Array.isArray(check.correctedSteps)) {
      currentSolution = {
        intro: "다시 계산한 풀이로 칠판을 고쳤어.",
        steps: check.correctedSteps,
        answer: check.correctedAnswer || "",
      };
      await renderChalkboard(currentSolution, false);
    }

    checkPanel.append(note);
  } catch (error) {
    checkPanel.className = "check-panel check-error";
    checkPanel.textContent = error.message || "검산을 완료하지 못했어요. 다시 눌러 주세요.";
  } finally {
    checkButton.disabled = false;
    checkButton.textContent = "AHA CHECK";
  }
});

revealAnswerButton.addEventListener("click", async () => {
  revealAnswerButton.disabled = true;
  revealAnswerButton.textContent = "정답을 확인 중...";
  answerRevealStatus.hidden = false;
  answerRevealStatus.textContent = "정답을 꺼내고 있어.";

  try {
    const data = await postJson("/api/solve", {
      problem: currentProblem,
      mode: "key",
    });
    if (!data.solution || !Array.isArray(data.solution.steps)) {
      throw new Error("정답을 확인하지 못했어요.");
    }
    currentSolution = data.solution;
    resultMode.textContent = "힌트만 · 정답 공개";
    checkButton.hidden = false;
    answerRevealStatus.hidden = true;
    revealAnswerButton.hidden = true;
    await renderChalkboard(currentSolution, false);
  } catch (error) {
    answerRevealStatus.textContent = error.message || "정답을 가져오지 못했어. 다시 눌러 줘.";
  } finally {
    revealAnswerButton.disabled = false;
    if (!revealAnswerButton.hidden) revealAnswerButton.textContent = "정답도 볼래";
  }
});

async function postJson(path, payload) {
  let response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("서버에 연결하지 못했어. Node 서버가 실행 중인지 확인해 줘.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("서버 응답을 읽지 못했어. 페이지를 새로고침해 줘.");
  }

  const data = await response.json().catch(() => null);
  if (!data) throw new Error("서버 응답을 읽지 못했어. 다시 시도해 줘.");
  if (!response.ok || data.success !== true) {
    throw new Error(data.error || "요청을 완료하지 못했어.");
  }
  return data;
}

function showStatus(message, state) {
  statusMessage.textContent = message;
  statusMessage.className = `status status-${state}`;
  statusMessage.hidden = false;
}

function getXp() {
  try {
    const xp = Number.parseInt(localStorage.getItem(xpStorageKey) || "0", 10);
    return Number.isFinite(xp) ? Math.max(0, Math.min(xp, 100)) : 0;
  } catch {
    return 0;
  }
}

function updateProgress() {
  const xp = getXp();
  xpLabel.textContent = `${xp} / 100 XP`;
  progressBar.style.width = `${xp}%`;
}

function showReward() {
  const before = getXp();
  const after = Math.min(before + 10, 100);
  try {
    localStorage.setItem(xpStorageKey, String(after));
  } catch {
    // 풀이 기능은 브라우저 저장 공간이 꺼져 있어도 동작해야 해.
  }

  updateProgress();
  rewardText.textContent = after === before
    ? "대단해! 오늘의 게이지를 모두 채웠어."
    : `좋아! 오늘의 게이지가 +${after - before} XP 채워졌어.`;
  reward.hidden = false;
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}
