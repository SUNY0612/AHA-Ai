# Python 서버 전환 계획

## 목표와 범위

- 학생 컴퓨터에서 Node.js와 추가 패키지 설치 없이 `python3 server.py`로 로컬 서버를 실행한다. Windows에서는 `py -3 server.py`를 사용한다.
- 브라우저용 `index.html`, `solve.html`, `styles.css`, `script.js`는 유지한다. 서버/API 코드만 Python 표준 라이브러리로 옮긴다. Flask나 `pip` 의존성은 추가하지 않는다.
- 서버는 `127.0.0.1:3000`에만 바인딩한다. NVIDIA API 호출에는 인터넷 연결이 필요하다.

## 1. 실행 환경과 기존 계약 확인

- 학생 컴퓨터에서 `python3 --version` 또는 `py -3 --version`을 확인한다. `ThreadingHTTPServer`를 사용할 수 있는 Python 3.7 이상을 기준으로 하되, 실제 설치 버전에 맞춰 문법과 실행 명령을 확정한다.
- 현재 화면이 사용하는 경로(`/`, `/solve`, `/styles.css`, `/script.js`)와 API(`/api/solve`, `/api/solve-stream`, `/api/check`, `/api/again`)를 기준선으로 기록한다.
- 요청 제한, 응답 JSON 필드, SSE 이벤트(`started`, `progress`, `complete`, `error`), 오류 메시지와 상태 코드를 기존 `server.js`에 맞춘다. 기존 미커밋 변경은 보존한다.

## 2. Python 서버 및 NVIDIA 호출 이식

- `server.py`에 `http.server.ThreadingHTTPServer` 기반 라우팅을 만든다. 정적 파일은 위 네 경로만 제공하고 `.env` 등 다른 파일은 공개하지 않는다.
- 표준 라이브러리로 `.env`의 `NVIDIA_API_KEY`, `NVIDIA_MODEL`, 선택적 `PORT`를 읽는다. 환경변수 설정값을 우선하고, 키를 응답이나 로그에 출력하지 않는다.
- `urllib.request`로 NVIDIA Chat Completions API를 호출한다. 기존 모델 기본값, 프롬프트/모드, JSON 스키마, 검증 규칙, 타임아웃 및 API 오류 처리를 보존한다.
- 일반 풀이·정답 확인·다시 설명의 JSON 형식과 입력 길이 제한을 기존 브라우저 코드가 기대하는 형태로 유지한다.

## 3. 스트리밍과 칠판 효과 유지

- `/api/solve-stream`에서 NVIDIA 스트림을 읽어 단계별 진행 상황을 SSE로 즉시 전송하고 매 이벤트를 flush한다. UTF-8 분할, 부분 JSON, 연결 종료, 빈 답변 및 API 오류를 처리한다.
- 브라우저의 기존 `script.js`가 별도 수정 없이 단계별 글자 출력, AHA CHECK, AHA AGAIN을 사용할 수 있는지 확인한다. 필요한 경우에만 프런트엔드의 계약 불일치 부분을 최소 수정한다.

## 4. 검증, 문서화, 전환

- `python3 -m py_compile server.py`와 모의 NVIDIA 응답을 사용하는 테스트로 네 API의 성공/실패, 잘못된 입력, 크기 초과, SSE 분할 수신을 검증한다.
- 실제 API 키로 `x^2 -6x +5=0` 풀이를 확인하고, 친구처럼/힌트 모드·AHA CHECK·AHA AGAIN·점진적 출력이 브라우저에서 작동하는지 확인한다. 키나 전체 API 응답은 테스트 로그에 남기지 않는다.
- `.env`에 웹으로 접근할 수 없는지, Node.js 없이 실행되는지, 서버가 로컬 주소에만 열리는지 확인한다.
- 실행 방법과 환경변수 예시를 README 및 `AGENTS.md`에 반영한다. 기능 동등성이 확인된 뒤에만 `server.js`와 Node 전용 실행 설정을 제거하거나 사용 중단 표시한다.

## 완료 기준

추가 패키지 설치 없이 Python 명령 하나로 실행되고, 기존 화면·네 API·스트리밍 동작이 유지되며, API 키가 브라우저에 노출되지 않아야 한다.
