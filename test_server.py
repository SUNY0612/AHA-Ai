import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import types
import unittest
from http.server import ThreadingHTTPServer
from unittest import mock
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server as aha_server


SOLUTION = {
    "intro": "같이 인수분해해 보자.",
    "steps": [
        {"explanation": "곱해서 5, 더해서 6인 수를 찾아.", "equation": "(x − 1)(x − 5) = 0"},
    ],
    "answer": "x = 1 또는 x = 5",
}


class LocalServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), aha_server.AHARequestHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = "http://127.0.0.1:{}".format(cls.httpd.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        cls.thread.join(timeout=2)

    def post_json(self, path, payload=None, raw_body=None):
        body = raw_body
        if body is None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request = Request(
            self.base_url + path,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            response = urlopen(request, timeout=3)
        except HTTPError as error:
            response = error
        with response:
            data = json.loads(response.read().decode("utf-8"))
            return response.code, data

    def test_static_routes_are_allowlisted(self):
        with urlopen(self.base_url + "/", timeout=3) as response:
            self.assertEqual(response.status, 200)
            self.assertIn("text/html", response.headers.get("Content-Type", ""))
            self.assertIn("막힌 문제".encode("utf-8"), response.read())

        for path in ("/.env", "/.env.example", "/plan.md"):
            with self.subTest(path=path):
                with self.assertRaises(HTTPError) as error:
                    urlopen(self.base_url + path, timeout=3)
                self.assertEqual(error.exception.code, 404)
                error.exception.close()

    def test_env_file_load_respects_existing_environment_values(self):
        file_key = "AHA_TEST_ENV_FILE_{}".format(os.getpid())
        override_key = "AHA_TEST_ENV_OVERRIDE_{}".format(os.getpid())
        with tempfile.TemporaryDirectory() as directory:
            env_path = Path(directory) / ".env"
            env_path.write_text(
                "{}=\"from-file\"\n{}=from-file\n".format(file_key, override_key),
                encoding="utf-8",
            )
            with mock.patch.dict(aha_server.os.environ):
                aha_server.os.environ.pop(file_key, None)
                aha_server.os.environ[override_key] = "from-process"
                aha_server.load_env_file(env_path)
                self.assertEqual(aha_server.os.environ[file_key], "from-file")
                self.assertEqual(aha_server.os.environ[override_key], "from-process")

    def test_macos_without_default_ca_paths_uses_existing_certifi_bundle(self):
        certifi = mock.Mock()
        certifi.where.return_value = "/bundled/python-ca.pem"
        with mock.patch.object(aha_server.sys, "platform", "darwin"):
            with mock.patch.object(
                aha_server.ssl,
                "get_default_verify_paths",
                return_value=types.SimpleNamespace(cafile=None, capath=None),
            ):
                with mock.patch.dict(sys.modules, {"certifi": certifi}):
                    with mock.patch.object(aha_server.os.path, "isfile", return_value=True):
                        with mock.patch.object(
                            aha_server.ssl,
                            "create_default_context",
                            return_value=mock.sentinel.ssl_context,
                        ) as create_context:
                            context = aha_server._create_ssl_context()

        self.assertIs(context, mock.sentinel.ssl_context)
        create_context.assert_called_once_with(cafile="/bundled/python-ca.pem")

    def test_solve_route_preserves_response_shape_and_mode(self):
        with mock.patch.object(aha_server, "generate_solution", return_value=SOLUTION) as generate:
            status, data = self.post_json("/api/solve", {
                "problem": "x^2 - 6x + 5 = 0",
                "mode": "friend",
            })

        self.assertEqual(status, 200)
        self.assertEqual(data, {"success": True, "solution": SOLUTION, "mode": "friend"})
        generate.assert_called_once_with("x^2 - 6x + 5 = 0", "friend")

    def test_solve_validation_rejects_empty_and_oversized_problems(self):
        status, data = self.post_json("/api/solve", {"problem": " "})
        self.assertEqual(status, 400)
        self.assertIn("문제를 먼저", data["error"])

        status, data = self.post_json("/api/solve", {"problem": "x" * 4001})
        self.assertEqual(status, 400)
        self.assertIn("4,000자", data["error"])

    def test_request_body_limit_rejects_large_payload(self):
        status, data = self.post_json(
            "/api/solve",
            raw_body=b" " * (aha_server.MAX_BODY_LENGTH + 1),
        )
        self.assertEqual(status, 413)
        self.assertIn("너무 큽니다", data["error"])

    def test_solve_reports_missing_api_key_without_calling_network(self):
        with mock.patch.dict(aha_server.os.environ, {"NVIDIA_API_KEY": ""}):
            status, data = self.post_json("/api/solve", {"problem": "x + 1 = 2"})

        self.assertEqual(status, 503)
        self.assertIn("NVIDIA_API_KEY", data["error"])

    def test_check_route_returns_check_contract(self):
        check = {
            "matches": True,
            "feedback": "계산이 맞아.",
            "correctedSteps": [],
            "correctedAnswer": "x = 1 또는 x = 5",
        }
        with mock.patch.object(aha_server, "request_structured_completion", return_value=check) as request:
            status, data = self.post_json("/api/check", {
                "problem": "x^2 - 6x + 5 = 0",
                "solution": SOLUTION,
            })

        self.assertEqual(status, 200)
        self.assertEqual(data, {"success": True, "check": check})
        self.assertEqual(request.call_args[0][0], "aha_math_check")

    def test_again_route_returns_explanation_contract(self):
        explanation = {"explanation": "곱과 합을 만족하는 두 수를 찾으면 돼.", "equation": "1 × 5 = 5"}
        with mock.patch.object(
            aha_server,
            "request_structured_completion",
            return_value=explanation,
        ) as request:
            status, data = self.post_json("/api/again", {
                "problem": "x^2 - 6x + 5 = 0",
                "stepNumber": 1,
                "step": SOLUTION["steps"][0],
                "previousAttempts": ["첫 설명"],
            })

        self.assertEqual(status, 200)
        self.assertEqual(data, {"success": True, "explanation": explanation})
        self.assertEqual(request.call_args[0][0], "aha_step_explanation")

    def test_stream_route_emits_started_progress_and_complete(self):
        def generate(problem, mode, on_content_chunk=None):
            serialized = json.dumps(SOLUTION, ensure_ascii=False)
            for offset in range(0, len(serialized), 9):
                chunk = serialized[offset:offset + 9]
                on_content_chunk(chunk, serialized[:offset + len(chunk)])
            return SOLUTION

        with mock.patch.object(aha_server, "generate_solution", side_effect=generate):
            request = Request(
                self.base_url + "/api/solve-stream",
                data=json.dumps({"problem": "x^2 - 6x + 5 = 0", "mode": "friend"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urlopen(request, timeout=3) as response:
                self.assertEqual(response.status, 200)
                self.assertIn("text/event-stream", response.headers.get("Content-Type", ""))
                body = response.read().decode("utf-8")

        self.assertIn("event: started", body)
        self.assertIn("event: progress", body)
        self.assertIn("event: complete", body)
        event_data = {}
        for block in body.strip().split("\n\n"):
            lines = block.splitlines()
            event_name = lines[0].split(":", 1)[1].strip()
            event_payload = lines[1].split(":", 1)[1].strip()
            event_data[event_name] = json.loads(event_payload)
        self.assertEqual(event_data["progress"]["intro"], SOLUTION["intro"])

    def test_malformed_json_returns_client_error(self):
        status, data = self.post_json("/api/solve", raw_body=b"{")
        self.assertEqual(status, 400)
        self.assertFalse(data["success"])


if __name__ == "__main__":
    unittest.main()
