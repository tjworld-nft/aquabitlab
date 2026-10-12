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

function respond($code, $ok, $message, $extra = []) {
    http_response_code($code);
    echo json_encode(array_merge(['success' => $ok, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

define('ABL_CONTACT_HANDLER', true);
require __DIR__ . '/contact-guard.php';
contact_check_origin();

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if ($method === 'GET' && ($_GET['action'] ?? '') === 'token') contact_issue_token();
if ($method !== 'POST') {
    header('Allow: GET, POST');
    respond(405, false, '不正なリクエストです。');
}
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 32768) respond(413, false, '入力内容が長すぎます。');
foreach ($_POST as $value) {
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) respond(400, false, '入力内容をご確認ください。');
}
// ハニーポットは従来どおり送信せず終了。自動返信も送らない。
if (trim($_POST['abl_hp'] ?? '') !== '') respond(200, true, 'お問い合わせを受け付けました。');
$token = contact_verify_token();

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

$topicKey = $_POST['topic'] ?? '';
$topic   = $topics[$topicKey] ?? $topics['other'];
$name    = preg_replace('/[\r\n]+/', ' ', field('name', 100));
$company = preg_replace('/[\r\n]+/', ' ', field('company', 120));
$email   = field('email', 200);
$phone   = preg_replace('/[\r\n]+/', ' ', field('phone', 40));
$message = field('message', 5000);

$errors = [];
if (!isset($topics[$topicKey])) { $errors[] = 'ご相談の種類を選んでください。'; }
foreach (['name' => 100, 'company' => 120, 'email' => 200, 'phone' => 40, 'message' => 5000] as $key => $max) {
    if (mb_strlen($_POST[$key] ?? '', 'UTF-8') > $max) $errors[] = '入力内容が長すぎます。';
}
if (preg_match('/[\x00-\x1F\x7F]/', $_POST['email'] ?? '')) { $errors[] = '有効なメールアドレスを入力してください。'; }
if ($name === '')    { $errors[] = 'お名前を入力してください。'; }
if ($email === '')   { $errors[] = 'メールアドレスを入力してください。'; }
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $errors[] = '有効なメールアドレスを入力してください。'; }
if ($message === '') { $errors[] = 'ご相談内容を入力してください。'; }
if (($_POST['agree'] ?? '') !== '1') { $errors[] = 'プライバシーポリシーへの同意が必要です。'; }

if ($errors) {
    respond(400, false, implode("\n", $errors));
}

// 検証エラーなら入力を直して同じトークンで再試行できる。送信を試す直前に使い切る。
unset($_SESSION['contact_tokens'][$token]);
if (!session_write_close()) contact_unavailable();
$reservation = contact_reserve($email, $message, $name);

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
    contact_release($reservation);
    respond(500, false, '送信に失敗しました。お手数ですが、info@aquabit-lab.com へ直接メールでご連絡ください。');
}
send_japanese_mail($email, $reply_subject, $reply_body, $from, $to);

respond(200, true, 'お問い合わせを受け付けました。確認メールをお送りしましたので、ご確認ください。');
