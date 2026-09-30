const form = document.querySelector("#solve-form");
const problemInput = document.querySelector("#problem");
const solveButton = document.querySelector("#solve-button");
const buttonLabel = document.querySelector(".button-label");
const statusMessage = document.querySelector("#status");
const result = document.querySelector("#result");
const resultProblem = document.querySelector("#result-problem-text");
const solutionText = document.querySelector("#solution-text");

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
  showStatus("문제를 읽고 풀이를 만들고 있어요.", "loading");

  try {
    let response;
    try {
      response = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problem }),
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
    result.hidden = false;
    statusMessage.hidden = true;
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