<?php
/**
 * お問い合わせフォーム メール送信スクリプト
 * AquaBit LAB (aquabit-lab.com)
 */

// 文字エンコーディング設定
mb_language("Japanese");
mb_internal_encoding("UTF-8");

// CORS設定（同一ドメインのみ許可）
header('Content-Type: application/json; charset=UTF-8');

// POST以外のリクエストを拒否
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '不正なリクエストです。']);
    exit;
}

// ハニーポット（スパム対策）- このフィールドが入力されていたらスパム
if (!empty($_POST['website'])) {
    // スパムボットには成功を返すが、実際には何もしない
    echo json_encode(['success' => true, 'message' => 'お問い合わせを受け付けました。']);
    exit;
}

// --- 入力データの取得とサニタイズ ---
$name    = isset($_POST['name'])    ? trim(strip_tags($_POST['name']))    : '';
$email   = isset($_POST['email'])   ? trim(strip_tags($_POST['email']))   : '';
$phone   = isset($_POST['phone'])   ? trim(strip_tags($_POST['phone']))   : '';
$message = isset($_POST['message']) ? trim(strip_tags($_POST['message'])) : '';

// --- バリデーション ---
$errors = [];

if ($name === '') {
    $errors[] = 'お名前を入力してください。';
}

if ($email === '') {
    $errors[] = 'メールアドレスを入力してください。';
} elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $errors[] = '有効なメールアドレスを入力してください。';
}

if ($message === '') {
    $errors[] = 'お問い合わせ内容を入力してください。';
}

if (!empty($errors)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => implode("\n", $errors)]);
    exit;
}

// --- 送信先設定 ---
$to = 'info@aquabit-lab.com';

// --- 管理者宛メール ---
$admin_subject = '【AquaBit LAB】お問い合わせがありました';
$admin_body = <<<EOT
AquaBit LAB ウェブサイトからお問い合わせがありました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ お名前
{$name}

■ メールアドレス
{$email}

■ 電話番号
{$phone}

■ お問い合わせ内容
{$message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

送信日時: %DATE%
EOT;

// 日時を挿入
$admin_body = str_replace('%DATE%', date('Y年m月d日 H:i:s'), $admin_body);

$admin_headers = "From: info@aquabit-lab.com\r\n";
$admin_headers .= "Reply-To: {$email}\r\n";
$admin_headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// --- 自動返信メール ---
$reply_subject = '【AquaBit LAB】お問い合わせありがとうございます';
$reply_body = <<<EOT
{$name} 様

AquaBit LABにお問い合わせいただき、誠にありがとうございます。
以下の内容でお問い合わせを受け付けました。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ お名前
{$name}

■ メールアドレス
{$email}

■ 電話番号
{$phone}

■ お問い合わせ内容
{$message}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

内容を確認の上、担当者よりご連絡させていただきます。
通常2〜3営業日以内にご返信いたします。

※ このメールは自動送信されています。
　 このメールに直接ご返信いただいてもお答えできない場合がございます。

─────────────────────────────
AquaBit LAB（アクアビットラボ）
https://aquabit-lab.com
Mail: info@aquabit-lab.com
─────────────────────────────
EOT;

$reply_headers = "From: info@aquabit-lab.com\r\n";
$reply_headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

// --- メール送信 ---
$admin_sent = mb_send_mail($to, $admin_subject, $admin_body, $admin_headers);
$reply_sent = mb_send_mail($email, $reply_subject, $reply_body, $reply_headers);

if ($admin_sent) {
    echo json_encode([
        'success' => true,
        'message' => 'お問い合わせを受け付けました。確認メールをお送りしましたのでご確認ください。'
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => '送信に失敗しました。お手数ですが、直接メールにてお問い合わせください。'
    ]);
}
