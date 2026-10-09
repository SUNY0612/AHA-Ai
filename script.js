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
let streamingCardViews = [];
let activeWritingElement = null;

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
  const submittedMode = selectedMode;
  buttonLabel.textContent = "아하가 생각 중...";
  result.hidden = true;
  reward.hidden = true;
  checkPanel.hidden = true;
  answerRevealStatus.hidden = true;
  showStatus("칠판에 하나씩 적고 있어. 잠깐만 기다려줘!", "loading");

  let streamStarted = false;
  try {
    const data = await postSolutionStream({
      problem: currentProblem,
      mode: submittedMode,
    }, {
      onStarted: () => {
        streamStarted = true;
        currentMode = submittedMode;
        currentSolution = null;
        resultProblem.textContent = currentProblem;
        resultMode.textContent = modeLabels[currentMode];
        checkButton.hidden = currentMode === "hint";
        checkButton.disabled = true;
        result.hidden = false;
        statusMessage.hidden = true;
        resetStreamingBoard(currentMode === "hint");
        result.scrollIntoView({ behavior: "smooth", block: "start" });
      },
      onProgress: updateStreamingBoard,
    });
    if (!data.solution || !Array.isArray(data.solution.steps)) {
      throw new Error("풀이 형식이 올바르지 않아요. 다시 한 번 눌러 주세요.");
    }

    currentMode = submittedMode;
    currentSolution = data.solution;
    resultProblem.textContent = currentProblem;
    resultMode.textContent = modeLabels[currentMode];
    checkButton.hidden = currentMode === "hint";
    statusMessage.hidden = true;
    showReward();
    await finishStreamingBoard(currentSolution, currentMode === "hint");
  } catch (error) {
    if (streamStarted) {
      boardStatus.textContent = "풀이를 마저 적지 못했어.";
      checkButton.hidden = true;
      checkButton.disabled = false;
      if (currentMode === "hint") {
        revealAnswerButton.hidden = false;
        revealAnswerButton.disabled = false;
      }
    }
    showStatus(error.message || "풀이를 가져오지 못했어요. 다시 시도해 줘.", "error");
  } finally {
    solveButton.disabled = false;
    buttonLabel.textContent = "같이 풀기";
  }
});

async function renderChalkboard(solution, hideAnswer) {
  const sequence = ++renderSequence;
  solutionIntro.textContent = "";
  solutionIntro.classList.add("is-writing");
  solutionSteps.replaceChildren();
  streamingCardViews = [];
  answerBlock.hidden = true;
  answerBlock.classList.remove("is-visible");
  solutionAnswer.textContent = "";
  revealAnswerButton.hidden = !hideAnswer;

  const intro = solution.intro || "좋아, 문제를 같이 살펴보자.";
  await writeText(solutionIntro, intro, sequence);
  solutionIntro.classList.remove("is-writing");

  const stepCards = (solution.steps || []).map((step, index) => createStepCard(step, index));
  streamingCardViews = stepCards;
  for (const [index, view] of stepCards.entries()) {
    if (sequence !== renderSequence) return;
    boardStatus.textContent = stepCards.length ? `${index + 1} / ${stepCards.length} 적고 있어` : "풀이를 정리했어";
    solutionSteps.append(view.card);
    view.card.classList.add("is-visible");
    view.explanation.classList.add("is-writing");
    await writeText(view.explanation, step.explanation || "이 부분을 다시 같이 살펴보자.", sequence);
    view.explanation.classList.remove("is-writing");
    if (view.equation && step.equation) {
      view.equation.hidden = false;
      view.equation.classList.add("is-writing");
      await writeText(view.equation, step.equation, sequence);
      view.equation.classList.remove("is-writing");
    }
  }

  if (sequence !== renderSequence) return;
  boardStatus.textContent = hideAnswer ? "여기까지만, 이제 네 차례!" : "칠판 풀이 완료";
  if (!hideAnswer && solution.answer) {
    answerBlock.hidden = false;
    answerBlock.classList.add("is-visible");
    solutionAnswer.classList.add("is-writing");
    await writeText(solutionAnswer, solution.answer, sequence);
    solutionAnswer.classList.remove("is-writing");
  }
  checkButton.disabled = false;
}

function resetStreamingBoard(hideAnswer) {
  renderSequence += 1;
  activeWritingElement?.classList.remove("is-writing");
  activeWritingElement = null;
  streamingCardViews = [];
  solutionIntro.textContent = "";
  solutionIntro.classList.remove("is-writing");
  solutionSteps.replaceChildren();
  solutionAnswer.textContent = "";
  solutionAnswer.classList.remove("is-writing");
  answerBlock.hidden = true;
  answerBlock.classList.remove("is-visible");
  revealAnswerButton.hidden = true;
  boardStatus.textContent = "아하가 풀이를 만들고 있어";
  checkButton.disabled = true;
  if (hideAnswer) answerRevealStatus.hidden = true;
}

function updateStreamingBoard(partial) {
  if (typeof partial.intro === "string") updateProgressiveText(solutionIntro, partial.intro);

  (partial.steps || []).forEach((partialStep, index) => {
    let view = streamingCardViews[index];
    if (!view) {
      const step = { explanation: "", equation: "" };
      view = createStepCard(step, index, true);
      streamingCardViews[index] = view;
      solutionSteps.append(view.card);
      view.card.classList.add("is-visible");
    }

    Object.assign(view.step, partialStep);
    updateProgressiveText(view.explanation, partialStep.explanation || "");
    if (view.equation && partialStep.equation) {
      view.equation.hidden = false;
      updateProgressiveText(view.equation, partialStep.equation);
    }
    if (partialStep.explanation || partialStep.equation) {
      boardStatus.textContent = `${index + 1}번째 풀이를 적고 있어`;
    }
  });

  if (typeof partial.answer === "string" && partial.answer) {
    answerBlock.hidden = false;
    answerBlock.classList.add("is-visible");
    updateProgressiveText(solutionAnswer, partial.answer);
    boardStatus.textContent = "마지막 답을 적고 있어";
  }
}

async function finishStreamingBoard(solution, hideAnswer) {
  const sequence = ++renderSequence;
  updateProgressiveText(solutionIntro, solution.intro || "좋아, 문제를 같이 살펴보자.");
  solutionIntro.classList.remove("is-writing");

  (solution.steps || []).forEach((step, index) => {
    let view = streamingCardViews[index];
    if (!view) {
      view = createStepCard({ ...step }, index, true);
      streamingCardViews[index] = view;
      solutionSteps.append(view.card);
      view.card.classList.add("is-visible");
    }
    Object.assign(view.step, step);
    updateProgressiveText(view.explanation, step.explanation || "이 부분을 다시 같이 살펴보자.");
    view.explanation.classList.remove("is-writing");
    view.numberButton.disabled = false;
    if (view.equation) {
      view.equation.hidden = !step.equation;
      if (step.equation) updateProgressiveText(view.equation, step.equation);
      view.equation.classList.remove("is-writing");
    }
  });

  if (hideAnswer) {
    answerBlock.hidden = true;
    revealAnswerButton.hidden = false;
    boardStatus.textContent = "여기까지만, 이제 네 차례!";
  } else {
    revealAnswerButton.hidden = true;
    answerBlock.hidden = Boolean(!solution.answer);
    if (solution.answer) {
      updateProgressiveText(solutionAnswer, solution.answer);
      solutionAnswer.classList.remove("is-writing");
      answerBlock.classList.add("is-visible");
    }
    boardStatus.textContent = "칠판 풀이 완료";
  }
  activeWritingElement?.classList.remove("is-writing");
  activeWritingElement = null;
  checkButton.disabled = false;
  if (sequence !== renderSequence) return;
}

function updateProgressiveText(element, nextText) {
  const currentText = element.textContent;
  if (currentText === nextText) return;

  if (nextText.startsWith(currentText)) {
    element.append(document.createTextNode(nextText.slice(currentText.length)));
  } else {
    element.textContent = nextText;
  }

  activeWritingElement?.classList.remove("is-writing");
  activeWritingElement = element;
  element.classList.add("is-writing");
}

async function writeText(element, text, sequence) {
  const characters = typeof Intl.Segmenter === "function"
    ? [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text)].map((item) => item.segment)
    : Array.from(text);
  for (const character of characters) {
    if (sequence !== renderSequence) return;
    element.append(document.createTextNode(character));
    await wait(24);
  }
}

function createStepCard(step, index, streaming = false) {
  const card = document.createElement("article");
  card.className = "chalk-step";

  const numberButton = document.createElement("button");
  numberButton.className = "step-number";
  numberButton.type = "button";
  numberButton.textContent = String(index + 1);
  numberButton.setAttribute("aria-label", `${index + 1}번 풀이 다시 설명 듣기`);
  numberButton.setAttribute("aria-expanded", "false");
  numberButton.disabled = streaming;

  const content = document.createElement("div");
  content.className = "chalk-step-content";
  const explanation = document.createElement("p");
  explanation.className = "chalk-explanation";
  explanation.textContent = streaming ? "" : step.explanation || "이 부분을 다시 같이 살펴보자.";
  content.append(explanation);

  let equation = null;
  if (step.equation || streaming) {
    equation = document.createElement("p");
    equation.className = "chalk-equation";
    equation.textContent = step.equation;
    equation.hidden = !step.equation;
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
  return { card, explanation, equation, numberButton, step };
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
  let revealFailed = false;

  try {
    const data = await postSolutionStream({
      problem: currentProblem,
      mode: "key",
    }, {
      onStarted: () => {
        currentSolution = null;
        answerRevealStatus.textContent = "아하가 칠판에 풀이를 적고 있어.";
        resetStreamingBoard(false);
      },
      onProgress: updateStreamingBoard,
    });
    if (!data.solution || !Array.isArray(data.solution.steps)) {
      throw new Error("정답을 확인하지 못했어요.");
    }
    currentSolution = data.solution;
    resultMode.textContent = "힌트만 · 정답 공개";
    checkButton.hidden = false;
    answerRevealStatus.hidden = true;
    await finishStreamingBoard(currentSolution, false);
  } catch (error) {
    revealFailed = true;
    answerRevealStatus.textContent = error.message || "정답을 가져오지 못했어. 다시 눌러 줘.";
    revealAnswerButton.hidden = false;
  } finally {
    revealAnswerButton.disabled = false;
    if (!revealAnswerButton.hidden) revealAnswerButton.textContent = revealFailed ? "정답 다시 보기" : "정답도 볼래";
  }
});

async function postSolutionStream(payload, handlers = {}) {
  let response;
  try {
    response = await fetch("/api/solve-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("서버에 연결하지 못했어. Node 서버가 실행 중인지 확인해 줘.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("application/json")) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "풀이 요청을 시작하지 못했어.");
  }
  if (!response.ok || !contentType.toLowerCase().includes("text/event-stream") || !response.body) {
    throw new Error("풀이 스트림을 열지 못했어. 다시 시도해 줘.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "message";
  let dataLines = [];
  let completion = null;

  const dispatchEvent = () => {
    if (!dataLines.length) {
      eventName = "message";
      return;
    }
    let eventData;
    try {
      eventData = JSON.parse(dataLines.join("\n"));
    } catch {
      dataLines = [];
      eventName = "message";
      return;
    }
    dataLines = [];
    const dispatchedName = eventName;
    eventName = "message";

    if (dispatchedName === "started") handlers.onStarted?.(eventData);
    if (dispatchedName === "progress") handlers.onProgress?.(eventData);
    if (dispatchedName === "complete") completion = eventData;
    if (dispatchedName === "error") throw new Error(eventData.error || "풀이를 가져오지 못했어.");
  };

  const processLine = (line) => {
    if (!line) {
      dispatchEvent();
    } else if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    lines.forEach(processLine);
  }
  buffer += decoder.decode();
  if (buffer) processLine(buffer);
  dispatchEvent();

  if (!completion?.success || !completion.solution) {
    throw new Error("풀이를 끝까지 받지 못했어. 다시 시도해 줘.");
  }
  return completion;
}

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
