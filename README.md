# AHA 수학 풀이

AHA는 학생이 입력한 수학 문제를 NVIDIA Build의 모델로 풀어 주는 로컬 웹 앱입니다. 화면과 서버는 Python 표준 라이브러리만 사용하며, 별도 패키지를 설치할 필요가 없습니다.

## 준비

- Python 3.7 이상
- NVIDIA Build API 키
- NVIDIA API 호출을 위한 인터넷 연결

프로젝트 폴더에서 `.env.example`을 복사해 `.env`를 만들고 API 키를 입력합니다.

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

`.env` 파일에서 `NVIDIA_API_KEY`를 실제 키로 바꿉니다. `NVIDIA_MODEL`은 기본값을 사용하며 `PORT`는 기본값 3000을 사용합니다. 키를 소스 코드나 브라우저에 입력하거나 공유하지 마세요.

## 실행

macOS/Linux:

```bash
python3 server.py
```

Windows:

```powershell
py -3 server.py
```

브라우저에서 <http://127.0.0.1:3000>을 엽니다. 서버를 종료하려면 터미널에서 `Ctrl+C`를 누릅니다. 다른 포트를 쓰려면 `.env`에 `PORT=3001`처럼 지정하고, 접속 주소도 해당 포트로 바꿉니다. 서버는 이 컴퓨터의 로컬 주소에서만 열립니다.

## 테스트

테스트는 외부 API를 호출하지 않고 표준 라이브러리 `unittest`로 실행합니다.

```bash
python3 -m unittest -v
python3 -m py_compile server.py
```

Windows에서는 `py -3 -m unittest -v`와 `py -3 -m py_compile server.py`를 사용합니다.
