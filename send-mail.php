<?php
/**
 * お問い合わせフォーム メール送信スクリプト
 * AquaBit LAB (aquabit-lab.com)
 *
 * 日本語メール送信: UTF-8 + Base64
 * ローカル確認（tools/router.php）では ABL_MAIL_DRYRUN=1 が立ち、実際には送信しない。
 */

mb_language("Japanese");
mb_internal_encoding("UTF-8");

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

function respond($code, $ok, $message) {
    http_response_code($code);
    echo json_encode(['success' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, false, '不正なリクエストです。');
}

// ハニーポット（人間には見えない欄）。入力されていたら送信したふりをして終える
if (!empty($_POST['abl_hp'])) {
    respond(200, true, 'お問い合わせを受け付けました。');
}

// 表示から送信までが速すぎるもの（ボット）を弾く。ts はフォームの表示時刻（ミリ秒・JSが入れる）
if (isset($_POST['ts']) && ctype_digit((string)$_POST['ts'])) {
    $elapsed = time() - intdiv((int)$_POST['ts'], 1000);
    if ($elapsed < 3) {
        respond(400, false, '送信が速すぎます。少し時間をおいて、もう一度お試しください。');
    }
}

// 同じ接続元からの連続送信を制限（10分に3回まで）。記録は一時フォルダに置き、中身はIPのハッシュと時刻だけ
function rate_limited($limit = 3, $window = 600) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = rtrim(sys_get_temp_dir(), '/') . '/abl-contact-' . substr(hash('sha256', 'abl' . $ip), 0, 24);
    $now = time();
    $hits = [];
    if (@is_file($file)) {
        foreach (explode("\n", (string)@file_get_contents($file)) as $t) {
            if ($t !== '' && ctype_digit($t) && $now - (int)$t < $window) { $hits[] = (int)$t; }
        }
    }
    if (count($hits) >= $limit) { return true; }
    $hits[] = $now;
    @file_put_contents($file, implode("\n", $hits), LOCK_EX);
    return false;
}
if (getenv('ABL_MAIL_DRYRUN') !== '1' && rate_limited()) {
    respond(429, false, '短い時間に何度も送信されています。しばらくしてから、もう一度お試しください。');
}

function field($key, $max) {
    $v = isset($_POST[$key]) ? trim(strip_tags((string)$_POST[$key])) : '';
    $v = str_replace(["\r\n", "\r"], "\n", $v);
    return mb_substr($v, 0, $max);
}

$topics = [
    'ai'       => 'AI導入の相談',
    'build'    => '制作のご依頼（Web・アプリ・映像など）',
    'training' => '研修・講演・ウェビナーのご依頼',
    'salon'    => 'AI学習サロンについて',
    'marine'   => 'マリン事業（ダイビング）',
    'other'    => 'その他・取材・コラボ',
];

$topicKey = isset($_POST['topic']) ? (string)$_POST['topic'] : 'other';
$topic   = $topics[$topicKey] ?? $topics['other'];
$name    = preg_replace('/[\r\n]+/', ' ', field('name', 100));
$company = preg_replace('/[\r\n]+/', ' ', field('company', 120));
$email   = preg_replace('/[\r\n]+/', '', field('email', 200));
$phone   = preg_replace('/[\r\n]+/', ' ', field('phone', 40));
$message = field('message', 5000);

$errors = [];
if ($name === '')    { $errors[] = 'お名前を入力してください。'; }
if ($email === '')   { $errors[] = 'メールアドレスを入力してください。'; }
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = '有効なメールアドレスを入力してください。'; }
if ($message === '') { $errors[] = 'ご相談内容を入力してください。'; }
if (empty($_POST['agree'])) { $errors[] = 'プライバシーポリシーへの同意が必要です。'; }

if ($errors) {
    respond(400, false, implode("\n", $errors));
}

$to = 'info@aquabit-lab.com';
$from = 'info@aquabit-lab.com';

function send_japanese_mail($to, $subject, $body, $from, $reply_to = '') {
    if (getenv('ABL_MAIL_DRYRUN') === '1') {
        return true;   // ローカル確認用：送らずに成功扱い
    }
    $encoded_subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: base64\r\n";
    $headers .= "From: AquaBit LAB <{$from}>\r\n";
    if ($reply_to !== '') {
        $headers .= "Reply-To: {$reply_to}\r\n";
    }
    return mail($to, $encoded_subject, chunk_split(base64_encode($body)), $headers);
}

$line = str_repeat('-', 56);
$summary  = "ご相談の種類: {$topic}\n";
$summary .= "お名前: {$name}\n";
if ($company !== '') { $summary .= "会社名・屋号: {$company}\n"; }
$summary .= "メールアドレス: {$email}\n";
$summary .= "電話番号: " . ($phone !== '' ? $phone : '（なし）') . "\n\n";
$summary .= "ご相談内容:\n{$message}\n";

$admin_subject = "【AquaBit LAB】{$topic}（{$name} 様）";
$admin_body  = "AquaBit LAB のサイトからお問い合わせがありました。\n\n{$line}\n{$summary}{$line}\n\n";
$admin_body .= "送信日時: " . date('Y/m/d H:i:s') . "\n";

$reply_subject = '【AquaBit LAB】お問い合わせを受け付けました';
$reply_body  = "AquaBit LAB（アクアビットラボ）です。\n\n";
$reply_body .= "このたびは、お問い合わせありがとうございます。\n";
$reply_body .= "サイトのフォームから「{$topic}」のご相談を受け付けました。\n";
$reply_body .= "内容を確認のうえ、通常2〜3営業日以内にお返事します。\n\n";
$reply_body .= "※ このメールは自動送信です。お心当たりのない場合は、お手数ですがこのメールを破棄してください。\n\n";
$reply_body .= "AquaBit LAB\nhttps://aquabit-lab.com/\nMail: info@aquabit-lab.com\n";

$admin_sent = send_japanese_mail($to, $admin_subject, $admin_body, $from, $email);
if (!$admin_sent) {
    respond(500, false, '送信に失敗しました。お手数ですが、info@aquabit-lab.com へ直接メールでご連絡ください。');
}
send_japanese_mail($email, $reply_subject, $reply_body, $from, $to);

respond(200, true, 'お問い合わせを受け付けました。確認メールをお送りしましたので、ご確認ください。');
