#!/usr/bin/env python3
"""Exercise the contact endpoint locally; never contacts production or sends mail.

Run: python3 tools/test_contact.py
Requires PHP CLI with mbstring. Each test gets private session/state directories,
an HTTP server bound to 127.0.0.1, and a fake sendmail executable. Test-only IP
overrides exist solely in a generated router outside the repository.
"""

import concurrent.futures
import http.cookies
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
PHP = shutil.which("php")


class Client:
    def __init__(self, server, ip="192.0.2.1"):
        self.server = server
        self.ip = ip
        self.cookie = ""

    def request(self, fields=None, path="/send-mail.php", dry_run=False, extra_headers=None):
        headers = {"X-Test-IP": self.ip}
        headers.update(extra_headers or {})
        if self.cookie:
            headers["Cookie"] = self.cookie
        if dry_run:
            headers["X-Test-Dry-Run"] = "1"
        data = None if fields is None else urllib.parse.urlencode(fields).encode()
        request = urllib.request.Request(self.server.url + path, data, headers)
        # No proxy, redirects, or remote hosts participate in the tests.
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            response = opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            for value in response.headers.get_all("Set-Cookie", []):
                parsed = http.cookies.SimpleCookie(value)
                if "ABL_CONTACT" in parsed:
                    self.cookie = "ABL_CONTACT=" + parsed["ABL_CONTACT"].value
            body = response.read().decode("utf-8")
            try:
                result = json.loads(body)
            except json.JSONDecodeError as error:
                raise AssertionError(f"Non-JSON response {response.status}: {body[:1000]}") from error
            return response.status, result, response.headers

    def token(self, age=4):
        status, result, headers = self.request(path="/send-mail.php?action=token")
        assert status == 200 and result.get("success") is True, (status, result)
        assert re.fullmatch(r"[a-f0-9]{64}", result.get("token", "")), result
        assert result.get("expires_in") == 7200, result
        assert result.get("min_wait") == 3, result
        assert "no-store" in headers.get("Cache-Control", ""), headers
        assert self.cookie, "No session cookie was issued"
        if age:
            self.age_session(age)
        return result["token"]

    def age_session(self, seconds):
        """Advance only this test session's clock without slow real-time sleeps.

        PHP's default session serializer encodes Unix timestamps as i:...;.
        Only integer timestamps in the current test's one-day range are changed.
        No production file or session is opened.
        """
        session_id = self.cookie.split("=", 1)[1]
        session_file = self.server.sessions / ("sess_" + session_id)
        payload = session_file.read_text()
        now = int(time.time())
        changed = 0

        def age(match):
            nonlocal changed
            value = int(match[1])
            if now - 86400 < value <= now + 5:
                changed += 1
                return f"i:{value - seconds};"
            return match[0]

        payload = re.sub(r"i:(\d{10});", age, payload)
        assert changed, "Cannot find the token issuance timestamp in the test session"
        session_file.write_text(payload)

    def submit(self, token=None, **updates):
        fields = {
            "name": "検証担当",
            "email": "inquiry@example.test",
            "company": "検証用株式会社",
            "phone": "",
            "topic": "ai",
            "message": "業務の自動化について相談したいです。",
            "agree": "1",
            "abl_hp": "",
        }
        if token is not None:
            fields["form_token"] = token
        fields.update(updates)
        return self.request(fields)


class Server:
    def __init__(self):
        self.temp = tempfile.TemporaryDirectory(prefix="abl-contact-test-")
        self.root = Path(self.temp.name)
        self.state = self.root / "state"
        self.sessions = self.state / "sessions"
        self.mail_log = self.root / "mail.jsonl"
        self.mail_fail = self.root / "mail-fail"
        self.log = (self.root / "php.log").open("w+")
        self.process = None
        try:
            self.start()
        except BaseException:
            self.close()
            raise

    def start(self):
        transport = self.root / "sendmail-test"
        # PHP mail() launches only this executable, which records locally and
        # never invokes an MTA, SMTP client, or network connection.
        transport.write_text(
            f"#!{sys.executable}\n"
            "import fcntl, json, os, sys\n"
            "payload = sys.stdin.read()\n"
            "with open(os.environ['ABL_TEST_MAIL_LOG'], 'a') as out:\n"
            "    fcntl.flock(out, fcntl.LOCK_EX)\n"
            "    out.write(json.dumps({'args': sys.argv[1:], 'mail': payload}) + '\\n')\n"
            "sys.exit(1 if os.path.exists(os.environ['ABL_TEST_MAIL_FAIL']) else 0)\n"
        )
        transport.chmod(0o700)
        router = self.root / "router.php"
        router.write_text(
            "<?php\n"
            "$_SERVER['REMOTE_ADDR'] = $_SERVER['HTTP_X_TEST_IP'] ?? '192.0.2.1';\n"
            "putenv('ABL_MAIL_DRYRUN=' . (($_SERVER['HTTP_X_TEST_DRY_RUN'] ?? '') === '1' ? '1' : '0'));\n"
            "require " + json.dumps(str(ROOT / "send-mail.php")) + ";\n"
        )
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        self.url = f"http://127.0.0.1:{port}"
        env = dict(os.environ)
        env.update({
            "ABL_CONTACT_STATE_DIR": str(self.state),
            "ABL_TEST_MAIL_LOG": str(self.mail_log),
            "ABL_TEST_MAIL_FAIL": str(self.mail_fail),
            "PHP_CLI_SERVER_WORKERS": "4",
            "ABL_MAIL_DRYRUN": "0",
        })
        self.process = subprocess.Popen([
            PHP, "-d", f"sendmail_path={transport}",
            "-d", f"session.save_path={self.sessions}",
            "-d", "session.serialize_handler=php", "-d", "display_errors=0",
            "-S", f"127.0.0.1:{port}", "-t", str(ROOT), str(router),
        ], stdout=self.log, stderr=self.log, env=env, start_new_session=True)
        for _ in range(100):
            if self.process.poll() is not None:
                raise RuntimeError("PHP test server exited: " + self.output())
            try:
                with socket.create_connection(("127.0.0.1", port), timeout=0.1):
                    return
            except OSError:
                time.sleep(0.025)
        raise RuntimeError("PHP test server did not start: " + self.output())

    def mails(self):
        if not self.mail_log.exists():
            return []
        return [json.loads(line) for line in self.mail_log.read_text().splitlines()]

    def output(self):
        self.log.flush()
        self.log.seek(0)
        return self.log.read()

    def close(self):
        if self.process:
            try:
                os.killpg(self.process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            self.process.wait(timeout=5)
        self.log.close()
        self.temp.cleanup()


@unittest.skipUnless(PHP, "PHP CLI is required")
class ContactSecurityTests(unittest.TestCase):
    def setUp(self):
        self.server = Server()
        self.addCleanup(self.server.close)
        self.client = Client(self.server)

    def accepted(self, result):
        status, payload, _ = result
        self.assertEqual(status, 200, payload)
        self.assertIs(payload.get("success"), True, payload)

    def rejected(self, result, mails_before=0, codes=(400, 403, 409, 429, 503)):
        status, payload, _ = result
        self.assertIn(status, codes, payload)
        self.assertIs(payload.get("success"), False, payload)
        self.assertEqual(len(self.server.mails()), mails_before)

    def test_japanese_and_english_inquiries_reach_fake_mail_transport(self):
        token = self.client.token()
        self.accepted(self.client.submit(token))
        other = Client(self.server, "192.0.2.2")
        self.accepted(other.submit(other.token(), name="Alex Example",
                                   email="alex@example.test",
                                   message="Could we discuss automation for our business?"))
        self.assertEqual(len(self.server.mails()), 4)

    def test_missing_and_forged_tokens_never_send(self):
        self.rejected(self.client.submit())
        self.rejected(self.client.submit("0" * 64))
        self.client.token()
        self.rejected(self.client.submit("f" * 64))

    def test_token_is_bound_to_its_session(self):
        token = self.client.token()
        other = Client(self.server)
        other.token()
        self.rejected(other.submit(token))
        self.accepted(self.client.submit(token))

    def test_fast_timestamp_cannot_be_spoofed_by_old_client_ts(self):
        token = self.client.token(age=0)
        self.rejected(self.client.submit(token, ts="1000000000000"))
        self.client.age_session(4)
        self.accepted(self.client.submit(token))

    def test_expired_token_never_sends(self):
        token = self.client.token(age=7201)
        self.rejected(self.client.submit(token))

    def test_future_token_timestamp_never_sends(self):
        token = self.client.token(age=-60)
        self.rejected(self.client.submit(token))

    def test_cookie_and_origin_protection(self):
        status, _, headers = self.client.request(path="/send-mail.php?action=token")
        self.assertEqual(status, 200)
        cookie = headers.get("Set-Cookie", "").lower()
        self.assertIn("httponly", cookie)
        self.assertIn("samesite=strict", cookie)
        self.rejected(self.client.request(path="/send-mail.php?action=token",
                      extra_headers={"Origin": "https://attacker.example"}), codes=(403,))
        self.rejected(self.client.request(path="/send-mail.php?action=token",
                      extra_headers={"Sec-Fetch-Site": "cross-site"}), codes=(403,))

    def test_token_replay_with_changed_content_never_sends(self):
        token = self.client.token()
        self.accepted(self.client.submit(token))
        self.rejected(self.client.submit(token, email="changed@example.test",
                                        message="別の内容に変えてもトークンは再利用できません。"), 2)

    def test_two_open_tabs_can_each_submit(self):
        first = self.client.token()
        second = self.client.token()
        self.assertNotEqual(first, second)
        self.accepted(self.client.submit(first))
        self.accepted(self.client.submit(second, email="second@example.test",
                                        message="別件のお問い合わせです。"))
        self.assertEqual(len(self.server.mails()), 4)

    def test_validation_error_can_be_corrected_with_same_token(self):
        token = self.client.token()
        self.rejected(self.client.submit(token, email="invalid"))
        self.accepted(self.client.submit(token))

    def test_arrays_in_all_scalar_fields_are_rejected_without_php_warnings(self):
        for field in ("form_token", "name", "email", "message", "company", "phone", "topic", "agree", "abl_hp"):
            with self.subTest(field=field):
                token = self.client.token()
                fields = {"form_token": token, "name": "検証", "email": "array@example.test",
                          "message": "配列を許さない確認です。", "topic": "ai", "agree": "1", "abl_hp": ""}
                fields.pop(field, None)
                fields[field + "[]"] = "malformed"
                self.rejected(self.client.request(fields))
        self.assertNotRegex(self.server.output(), r"PHP (?:Warning|Fatal error|Deprecated)")

    def test_unknown_topic_and_invalid_consent_rejected(self):
        token = self.client.token()
        self.rejected(self.client.submit(token, topic="invalid-topic"))
        self.rejected(self.client.submit(token, agree="0"))
        self.rejected(self.client.submit(token, agree="yes"))
        self.accepted(self.client.submit(token))

    def test_header_injection_rejected(self):
        token = self.client.token()
        self.rejected(self.client.submit(token, email="valid@example.test\r\nBcc: another@example.test"))

    def test_overlong_fields_rejected(self):
        token = self.client.token()
        self.rejected(self.client.submit(token, name="a" * 101))
        self.rejected(self.client.submit(token, message="a" * 5001))
        self.rejected(self.client.submit(token, message="a" * 33000), codes=(413,))

    def test_honeypot_never_sends(self):
        token = self.client.token()
        result = self.client.submit(token, abl_hp="https://example.test/bot")
        self.assertIn(result[0], (200, 400, 403))
        self.assertEqual(len(self.server.mails()), 0)

    def test_duplicate_email_and_body_blocked_across_ip(self):
        self.accepted(self.client.submit(self.client.token()))
        other = Client(self.server, "192.0.2.2")
        self.rejected(other.submit(other.token()), 2, codes=(409, 429))

    def test_duplicate_normalizes_email_case_and_body_whitespace(self):
        self.accepted(self.client.submit(self.client.token(), message="Please discuss automation"))
        other = Client(self.server, "192.0.2.2")
        self.rejected(other.submit(other.token(), email="INQUIRY@example.test",
                                   message="  please\n discuss\t automation  "), 2, codes=(409,))

    def test_ip_rate_limit_runs_even_in_dry_run(self):
        for number in range(4):
            client = Client(self.server)
            token = client.token()
            fields = {"form_token": token, "name": "検証", "email": f"dry{number}@example.test",
                      "message": f"dry-run inquiry number {number}", "topic": "ai", "agree": "1", "abl_hp": ""}
            result = client.request(fields, dry_run=True)
            if number < 3:
                self.accepted(result)
            else:
                self.rejected(result, codes=(429,))
        self.assertEqual(len(self.server.mails()), 0)

    def test_email_rate_limit_across_different_ips(self):
        for number in range(4):
            client = Client(self.server, f"192.0.2.{number + 1}")
            result = client.submit(client.token(), message=f"Different inquiry number {number}")
            if number < 3:
                self.accepted(result)
            else:
                self.rejected(result, 6, codes=(429,))

    def test_repeated_body_rate_limit_across_ips_and_emails(self):
        for number in range(4):
            client = Client(self.server, f"192.0.2.{number + 1}")
            result = client.submit(client.token(), name=f"Customer {number}",
                                   email=f"body{number}@example.test",
                                   message="This repeated automated inquiry has enough characters to identify a repeated campaign.")
            if number < 3:
                self.accepted(result)
            else:
                self.rejected(result, 6, codes=(429,))

    def test_short_common_question_allows_distinct_customers(self):
        for number in range(4):
            client = Client(self.server, f"192.0.2.{number + 1}")
            self.accepted(client.submit(client.token(), name=f"Customer {number}",
                                        email=f"short{number}@example.test", message="料金を教えてください。"))
        self.assertEqual(len(self.server.mails()), 8)

    def test_ip_day_limit_survives_expired_short_window(self):
        state_path = self.server.state / "submissions.json"
        for number in range(21):
            client = Client(self.server)
            result = client.submit(client.token(), email=f"day{number}@example.test",
                                   message=f"Daily limit inquiry number {number}")
            if number < 20:
                self.accepted(result)
                # All prior requests remain inside the daily window but outside
                # the ten-minute window; no production clock is changed.
                state = json.loads(state_path.read_text())
                for event in state["events"]:
                    event["t"] = int(time.time()) - 601
                state_path.write_text(json.dumps(state))
            else:
                self.rejected(result, 40, codes=(429,))

    def test_concurrent_ip_limit_is_atomic(self):
        clients = [Client(self.server) for _ in range(6)]
        tokens = [client.token() for client in clients]
        barrier = threading.Barrier(len(clients))

        def submit(number):
            barrier.wait(timeout=5)
            return clients[number].submit(tokens[number], email=f"race{number}@example.test",
                                          message=f"Concurrent inquiry number {number}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(clients)) as pool:
            results = list(pool.map(submit, range(len(clients))))
        self.assertEqual(sum(result[0] == 200 for result in results), 3, results)
        self.assertEqual(sum(result[0] == 429 for result in results), 3, results)
        self.assertEqual(len(self.server.mails()), 6)

    def test_concurrent_duplicates_only_send_one_pair_of_mails(self):
        clients = [Client(self.server, f"192.0.2.{number + 1}") for number in range(4)]
        tokens = [client.token() for client in clients]
        barrier = threading.Barrier(len(clients))

        def submit(number):
            barrier.wait(timeout=5)
            return clients[number].submit(tokens[number])

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(clients)) as pool:
            results = list(pool.map(submit, range(len(clients))))
        self.assertEqual(sum(result[0] == 200 for result in results), 1, results)
        self.assertEqual(sum(result[0] == 409 for result in results), 3, results)
        self.assertEqual(len(self.server.mails()), 2)

    def test_concurrent_replays_only_send_one_pair_of_mails(self):
        token = self.client.token()
        clients = [Client(self.server, f"192.0.2.{number + 1}") for number in range(4)]
        for client in clients:
            client.cookie = self.client.cookie
        barrier = threading.Barrier(len(clients))

        def submit(number):
            barrier.wait(timeout=5)
            return clients[number].submit(token, email=f"replay{number}@example.test",
                                          message=f"Concurrent token reuse inquiry number {number}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=len(clients)) as pool:
            results = list(pool.map(submit, range(len(clients))))
        self.assertEqual(sum(result[0] == 200 for result in results), 1, results)
        self.assertEqual(sum(result[0] == 403 for result in results), 3, results)
        self.assertEqual(len(self.server.mails()), 2)

    def test_unavailable_state_directory_fails_closed(self):
        token = self.client.token()
        # A regular file at the configured directory path is reliably unwritable
        # as a directory, even when the test process has elevated privileges.
        if self.server.state.exists():
            shutil.rmtree(self.server.state)
        self.server.state.write_text("not a directory")
        self.rejected(self.client.submit(token), codes=(503,))

    def test_corrupt_state_fails_closed(self):
        for contents in ("{truncated", "{}", '{"secret":"' + "a" * 64 + '","events":[{}]}'):
            with self.subTest(contents=contents):
                token = self.client.token()
                (self.server.state / "submissions.json").write_text(contents)
                self.rejected(self.client.submit(token), codes=(503,))

    @unittest.skipIf(hasattr(os, "geteuid") and os.geteuid() == 0, "root ignores ordinary write permissions")
    def test_unwritable_state_directory_fails_closed(self):
        token = self.client.token()
        self.server.state.chmod(0o500)
        try:
            self.rejected(self.client.submit(token), codes=(503,))
        finally:
            self.server.state.chmod(0o700)

    def test_failed_mail_releases_reservation_for_retry(self):
        self.server.mail_fail.touch()
        result = self.client.submit(self.client.token())
        self.assertEqual(result[0], 500, result)
        self.assertIs(result[1].get("success"), False)
        self.assertEqual(len(self.server.mails()), 1, "Failed admin mail must not trigger an auto-reply")
        state = json.loads((self.server.state / "submissions.json").read_text())
        self.assertEqual(state["events"], [], "Failed mail must release duplicate/rate reservation")
        self.server.mail_fail.unlink()
        self.accepted(self.client.submit(self.client.token()))
        self.assertEqual(len(self.server.mails()), 3)

    def test_store_contains_no_plaintext_contact_or_ip_data(self):
        self.accepted(self.client.submit(self.client.token()))
        files = [path for path in self.server.state.rglob("*") if path.is_file()]
        self.assertTrue(files, "No persistent rate-limit state was written")
        state_text = "\n".join(path.read_text(errors="replace") for path in files)
        for value in ("inquiry@example.test", "192.0.2.1", "検証担当", "業務の自動化", "検証用株式会社"):
            self.assertNotIn(value, state_text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
