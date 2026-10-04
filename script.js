const form = document.querySelector("#solve-form");
const problemInput = document.querySelector("#problem");
const solveButton = document.querySelector("#solve-button");
const buttonLabel = document.querySelector(".button-label");
const statusMessage = document.querySelector("#status");
const result = document.querySelector("#result");
const resultProblem = document.querySelector("#result-problem-text");
const solutionText = document.querySelector("#solution-text");
const modeButtons = [...document.querySelectorAll(".mode-option")];
const resultMode = document.querySelector("#result-mode");
const reward = document.querySelector("#reward");
const rewardText = document.querySelector("#reward-text");
const xpLabel = document.querySelector("#xp-label");
const progressBar = document.querySelector("#progress-bar");

const xpStorageKey = "aha-xp";
const modeLabels = {
  key: "핵심만",
  friend: "친구처럼",
  hint: "힌트만",
};
let selectedMode = "friend";

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedMode = button.dataset.mode || "friend";
    modeButtons.forEach((modeButton) => {
      const isSelected = modeButton === button;
      modeButton.classList.toggle("is-selected", isSelected);
      modeButton.setAttribute("aria-pressed", String(isSelected));
    });
  });
});

updateProgress();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const problem = problemInput.value.trim();

  if (!problem) {
    showStatus("수학 문제를 먼저 입력해 주세요.", "error");
    problemInput.focus();
    return;
  }

  solveButton.disabled = true;
  buttonLabel.textContent = "풀이 중...";
  result.hidden = true;
  reward.hidden = true;
  showStatus("문제를 읽고 풀이를 만들고 있어요.", "loading");

  try {
    let response;
    try {
      response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem, mode: selectedMode }),
      });
    } catch {
      throw new Error("AI 풀이를 가져오는 중 문제가 발생했습니다. Node 서버가 실행 중인지 확인해 주세요.");
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error("AI 풀이를 가져오는 중 문제가 발생했습니다. Node 서버가 실행 중인지 확인해 주세요.");
    }

    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("AI 풀이를 가져오는 중 문제가 발생했습니다. 서버 응답을 읽을 수 없어요.");
    }

    if (!response.ok || data.success !== true || typeof data.solution !== "string") {
      throw new Error(data.error || "AI 풀이를 가져오는 중 문제가 발생했습니다.");
    }

    resultProblem.textContent = problem;
    solutionText.textContent = data.solution;
    resultMode.textContent = modeLabels[selectedMode];
    result.hidden = false;
    statusMessage.hidden = true;
    showReward();
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    showStatus(error.message || "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.", "error");
  } finally {
    solveButton.disabled = false;
    buttonLabel.textContent = "풀이 시작";
  }
});

function showStatus(message, state) {
  statusMessage.textContent = message;
  statusMessage.className = `status status-${state}`;
  statusMessage.hidden = false;
}

function getXp() {
  try {
    const storedXp = Number.parseInt(localStorage.getItem(xpStorageKey) || "0", 10);
    return Number.isFinite(storedXp) ? Math.max(0, Math.min(storedXp, 100)) : 0;
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
  const previousXp = getXp();
  const nextXp = Math.min(previousXp + 10, 100);

  try {
    localStorage.setItem(xpStorageKey, String(nextXp));
  } catch {
    // Progress is a small enhancement; solving should work even when storage is unavailable.
  }

  updateProgress();
  rewardText.textContent = nextXp === previousXp
    ? "대단해요! 오늘의 게이지를 모두 채웠어요."
    : `좋아요! 오늘의 게이지가 +${nextXp - previousXp} XP 채워졌어요.`;
  reward.hidden = false;
}
