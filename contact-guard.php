<?php
// send-mail.php 専用。公開URLから直接呼んでも何も実行しない。
if (!defined('ABL_CONTACT_HANDLER')) {
    http_response_code(404);
    exit;
}

function contact_unavailable() {
    error_log('AquaBit contact protection storage unavailable');
    respond(503, false, '現在フォームを利用できません。入力内容を控えて、時間をおいてお試しいただくか、info@aquabit-lab.com へメールでご連絡ください。');
}

function contact_state_dir() {
    static $dir;
    if ($dir !== null) return $dir;
    // 環境変数はローカル検証用。リクエストから設定できない。
    $dir = getenv('ABL_CONTACT_STATE_DIR') ?: rtrim(sys_get_temp_dir(), '/') . '/abl-contact-v2-' . substr(hash('sha256', __DIR__), 0, 16);
    if ((!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) || !is_writable($dir)) {
        contact_unavailable();
    }
    return $dir;
}

function contact_session() {
    $sessions = contact_state_dir() . '/sessions';
    if (!is_dir($sessions) && !@mkdir($sessions, 0700) && !is_dir($sessions)) contact_unavailable();
    session_name('ABL_CONTACT');
    session_save_path($sessions);
    if (!@session_start([
        'use_strict_mode' => 1,
        'use_only_cookies' => 1,
        'cookie_httponly' => 1,
        'cookie_secure' => PHP_SAPI !== 'cli-server',
        'cookie_samesite' => 'Strict',
        'cookie_path' => '/',
        'cookie_lifetime' => 0,
        'gc_maxlifetime' => 7200,
        'gc_probability' => 1,
        'gc_divisor' => 100,
    ])) contact_unavailable();
    $tokens = $_SESSION['contact_tokens'] ?? [];
    if (!is_array($tokens)) $tokens = [];
    $_SESSION['contact_tokens'] = array_filter($tokens, function ($issued) {
        return is_int($issued) && $issued <= time() && time() - $issued <= 7200;
    });
}

function contact_check_origin() {
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') {
        respond(403, false, 'お問い合わせページから送信してください。');
    }
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = ['https://aquabit-lab.com'];
    // ローカルPHPサーバーでのみローカルOriginを認める。
    $host = $_SERVER['HTTP_HOST'] ?? '';
    if (PHP_SAPI === 'cli-server' && preg_match('/^(127\.0\.0\.1|localhost)(:[0-9]+)?$/D', $host)) {
        $allowed[] = 'http://' . $host;
    }
    if ($origin !== '' && !in_array($origin, $allowed, true)) {
        respond(403, false, 'お問い合わせページから送信してください。');
    }
}

function contact_issue_token() {
    contact_session();
    // 複数タブで別々に入力しても、先に開いたフォームを無効にしない。
    while (count($_SESSION['contact_tokens']) >= 20) array_shift($_SESSION['contact_tokens']);
    $token = bin2hex(random_bytes(32));
    $_SESSION['contact_tokens'][$token] = time();
    if (!session_write_close()) contact_unavailable();
    echo json_encode(['success' => true, 'token' => $token, 'expires_in' => 7200, 'min_wait' => 3]);
    exit;
}

function contact_verify_token() {
    $token = $_POST['form_token'] ?? '';
    if (!is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token) || empty($_COOKIE['ABL_CONTACT'])) {
        respond(403, false, '送信の確認が必要です。入力内容はそのままで、もう一度送信してください。', ['refresh_token' => true]);
    }
    contact_session();
    $issued = $_SESSION['contact_tokens'][$token] ?? null;
    if ($issued === null) {
        session_write_close();
        respond(403, false, '送信の確認期限が切れました。入力内容はそのままで、もう一度送信してください。', ['refresh_token' => true]);
    }
    if (time() - $issued < 3) {
        session_write_close();
        respond(400, false, '少し時間をおいて、もう一度送信してください。');
    }
    // 入力検証後に使い切る。それまではセッションのロックで同時使用を防ぐ。
    return $token;
}

function contact_state_open() {
    $file = contact_state_dir() . '/submissions.json';
    $fp = @fopen(contact_state_dir() . '/submissions.lock', 'c+');
    if (!$fp) contact_unavailable();
    $until = microtime(true) + 2;
    while (!flock($fp, LOCK_EX | LOCK_NB)) {
        if (microtime(true) >= $until) { fclose($fp); contact_unavailable(); }
        usleep(10000);
    }
    @chmod(contact_state_dir() . '/submissions.lock', 0600);
    $exists = is_file($file);
    $raw = $exists ? @file_get_contents($file, false, null, 0, 4000001) : '';
    if ($raw === false || strlen($raw) > 4000000) contact_unavailable();
    $state = !$exists ? ['secret' => bin2hex(random_bytes(32)), 'events' => []] : json_decode($raw, true);
    if (!is_array($state) || !isset($state['secret'], $state['events']) ||
        !is_string($state['secret']) || !preg_match('/^[a-f0-9]{64}$/D', $state['secret']) || !is_array($state['events'])) {
        contact_unavailable();
    }
    $events = [];
    foreach ($state['events'] as $event) {
        if (!is_array($event) || !isset($event['id'], $event['t'], $event['ip'], $event['email'], $event['body'], $event['duplicate']) || !is_int($event['t'])) contact_unavailable();
        foreach (['id', 'ip', 'email', 'body', 'duplicate'] as $key) {
            if (!is_string($event[$key]) || !ctype_xdigit($event[$key])) contact_unavailable();
        }
        if (time() - $event['t'] < 86400) $events[] = $event;
    }
    $state['events'] = $events;
    return [$fp, $state];
}

function contact_state_write($fp, $state) {
    // 別ファイルに書き切ってから置換。書き込み失敗で既存の制限記録を失わない。
    $json = json_encode($state);
    $temp = @tempnam(contact_state_dir(), 'write-');
    if ($json === false || $temp === false) contact_unavailable();
    $written = @file_put_contents($temp, $json);
    if ($written !== strlen($json) || !@rename($temp, contact_state_dir() . '/submissions.json')) {
        @unlink($temp);
        contact_unavailable();
    }
    flock($fp, LOCK_UN);
    fclose($fp);
}

function contact_reserve($email, $message, $name) {
    // 同じロック内で読み取り・判定・更新する。IPを替えた連投もメール/本文で抑える。
    list($fp, $state) = contact_state_open();
    $normal = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $message)), 'UTF-8');
    $mail = mb_strtolower($email, 'UTF-8');
    // 短い定型の質問は別のお客さま同士で一致しやすいため、名前も合わせて照合する。
    $bodyKey = mb_strlen($normal, 'UTF-8') < 30 ? $normal . "\n" . mb_strtolower($name, 'UTF-8') : $normal;
    $hash = function ($kind, $value) use ($state) { return hash_hmac('sha256', $kind . ':' . $value, $state['secret']); };
    $entry = [
        'id' => bin2hex(random_bytes(16)), 't' => time(),
        'ip' => $hash('ip', $_SERVER['REMOTE_ADDR'] ?? 'unknown'),
        'email' => $hash('email', $mail), 'body' => $hash('body', $bodyKey),
        'duplicate' => $hash('duplicate', $mail . "\n" . $normal),
    ];
    $ipShort = $ipDay = $emailHour = $bodyHour = 0;
    foreach ($state['events'] as $event) {
        $age = time() - $event['t'];
        if (hash_equals($entry['duplicate'], $event['duplicate'])) {
            flock($fp, LOCK_UN); fclose($fp);
            error_log('AquaBit contact rejected: duplicate');
            respond(409, false, '同じ内容の連続送信はできません。追加のご相談は、内容を変更して送信するかメールでご連絡ください。');
        }
        if (hash_equals($entry['ip'], $event['ip'])) { $ipDay++; if ($age < 600) $ipShort++; }
        if ($age < 3600 && hash_equals($entry['email'], $event['email'])) $emailHour++;
        if ($age < 3600 && hash_equals($entry['body'], $event['body'])) $bodyHour++;
    }
    if ($ipShort >= 3 || $ipDay >= 20 || $emailHour >= 3 || $bodyHour >= 3) {
        flock($fp, LOCK_UN); fclose($fp);
        error_log('AquaBit contact rejected: rate_limit');
        respond(429, false, '短い時間に何度も送信されています。時間をおいてお試しいただくか、info@aquabit-lab.com へメールでご連絡ください。');
    }
    if (count($state['events']) >= 5000) contact_unavailable();
    $state['events'][] = $entry;
    contact_state_write($fp, $state);
    return $entry['id'];
}

function contact_release($id) {
    list($fp, $state) = contact_state_open();
    $state['events'] = array_values(array_filter($state['events'], function ($e) use ($id) { return $e['id'] !== $id; }));
    contact_state_write($fp, $state);
}
