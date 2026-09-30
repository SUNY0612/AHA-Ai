import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectDirectory = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const maxProblemLength = 4000;

const publicFiles = {
  "/": { name: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { name: "styles.css", type: "text/css; charset=utf-8" },
  "/script.js": { name: "script.js", type: "text/javascript; charset=utf-8" },
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) {
      const error = new Error("요청이 너무 큽니다.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleRequest(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (request.method === "GET") {
    const file = publicFiles[pathname];
    if (!file) {
      if (pathname.startsWith("/api/")) {
        sendJson(response, 404, { success: false, error: "요청한 API 주소를 찾을 수 없습니다." });
        return;
      }
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("페이지를 찾을 수 없습니다.");
      return;
    }

    const content = await readFile(join(projectDirectory, file.name));
    response.writeHead(200, {
      "Content-Type": file.type,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(content);
    return;
  }

  if (request.method !== "POST" || pathname !== "/api/solve") {
    sendJson(response, 404, { success: false, error: "요청한 주소를 찾을 수 없습니다." });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    sendJson(response, statusCode, {
      success: false,
      error: statusCode === 413 ? "요청 내용이 너무 큽니다." : "문제 요청을 읽지 못했어요. 다시 시도해 주세요.",
    });
    return;
  }

  const problem = payload?.problem;
  if (typeof problem !== "string" || !problem.trim()) {
    sendJson(response, 400, { success: false, error: "수학 문제를 먼저 입력해 주세요." });
    return;
  }
  if (problem.length > maxProblemLength) {
    sendJson(response, 400, { success: false, error: "문제는 4,000자 이하로 입력해 주세요." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { success: false, error: ".env 파일에 OpenAI API 키를 설정해 주세요." });
    return;
  }

  try {
    const apiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "당신은 중·고등학생을 돕는 친절한 수학 선생님입니다. 문제에서 구할 것을 먼저 파악하고, 한국어로 풀이를 단계별로 설명하세요. 각 단계에서 왜 그렇게 계산하는지 간단히 말하고 최종 답을 명확히 표시하세요. 가능한 범위에서 계산을 다시 확인하세요. 확실하지 않거나 정보가 부족하면 추측하지 말고 알리세요. 쉬운 중·고등학교 수준의 표현을 사용하세요.",
          },
          { role: "user", content: `다음 수학 문제를 풀어 주세요.\n\n${problem.trim()}` },
        ],
      }),
    });

    if (!apiResponse.ok) {
      console.error("OpenAI API returned status", apiResponse.status);
      sendJson(response, 502, { success: false, error: "AI 풀이를 가져오지 못했어요. API 설정을 확인한 뒤 다시 시도해 주세요." });
      return;
    }

    const result = await apiResponse.json();
    const solution = result.choices?.[0]?.message?.content?.trim();
    if (!solution) {
      sendJson(response, 502, { success: false, error: "AI가 풀이를 생성하지 못했어요. 문제를 조금 더 구체적으로 입력해 주세요." });
      return;
    }

    sendJson(response, 200, { success: true, solution });
  } catch (error) {
    console.error("Could not reach OpenAI API:", error.message);
    sendJson(response, 502, { success: false, error: "AI 풀이를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  }
}

const server = createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error("Request failed:", error.message);
    if (!response.headersSent) {
      const pathname = new URL(request.url, "http://localhost").pathname;
      if (pathname.startsWith("/api/")) {
        sendJson(response, 500, { success: false, error: "AI 풀이를 가져오는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요." });
      } else {
        response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("서버 오류가 발생했습니다.");
      }
    } else {
      response.end();
    }
  });
});

server.listen(port, "localhost", () => {
  console.log(`AHA is running at http://127.0.0.1:${port}`);
});