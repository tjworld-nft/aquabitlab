<?php
/**
 * お問い合わせフォーム メール送信スクリプト
 * AquaBit LAB (aquabit-lab.com)
 * 
 * 日本語メール送信: ISO-2022-JP + Base64エンコーディング
 */

// 文字エンコーディング設定
mb_language("Japanese");
mb_internal_encoding("UTF-8");

// レスポンスはJSON（UTF-8）
header('Content-Type: application/json; charset=UTF-8');

// POST以外のリクエストを拒否
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => '不正なリクエストです。']);
    exit;
}

// ハニーポット（スパム対策）- このフィールドが入力されていたらスパム
if (!empty($_POST['website'])) {
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

// --- 日本語メール送信関数（UTF-8 + Base64） ---
function send_japanese_mail($to, $subject, $body, $from, $reply_to = '') {
    // 件名をUTF-8でBase64 MIMEエンコード
    $encoded_subject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
    
    // 本文をBase64エンコード
    $encoded_body = base64_encode($body);
    
    // ヘッダー構築
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "Content-Transfer-Encoding: base64\r\n";
    $headers .= "From: {$from}\r\n";
    if ($reply_to !== '') {
        $headers .= "Reply-To: {$reply_to}\r\n";
    }
    
    return mail($to, $encoded_subject, $encoded_body, $headers);
}

// --- 管理者宛メール ---
$admin_subject = '【AquaBit LAB】お問い合わせがありました';
$admin_body = "AquaBit LAB ウェブサイトからお問い合わせがありました。\n";
$admin_body .= "\n";
$admin_body .= "------------------------------------------------------------\n";
$admin_body .= "お名前: {$name}\n";
$admin_body .= "メールアドレス: {$email}\n";
$admin_body .= "電話番号: {$phone}\n";
$admin_body .= "\n";
$admin_body .= "お問い合わせ内容:\n";
$admin_body .= "{$message}\n";
$admin_body .= "------------------------------------------------------------\n";
$admin_body .= "\n";
$admin_body .= "送信日時: " . date('Y/m/d H:i:s') . "\n";

// --- 自動返信メール ---
$reply_subject = '【AquaBit LAB】お問い合わせありがとうございます';
$reply_body = "{$name} 様\n";
$reply_body .= "\n";
$reply_body .= "AquaBit LABにお問い合わせいただき、誠にありがとうございます。\n";
$reply_body .= "以下の内容でお問い合わせを受け付けました。\n";
$reply_body .= "\n";
$reply_body .= "------------------------------------------------------------\n";
$reply_body .= "お名前: {$name}\n";
$reply_body .= "メールアドレス: {$email}\n";
$reply_body .= "電話番号: {$phone}\n";
$reply_body .= "\n";
$reply_body .= "お問い合わせ内容:\n";
$reply_body .= "{$message}\n";
$reply_body .= "------------------------------------------------------------\n";
$reply_body .= "\n";
$reply_body .= "内容を確認の上、担当者よりご連絡させていただきます。\n";
$reply_body .= "通常2-3営業日以内にご返信いたします。\n";
$reply_body .= "\n";
$reply_body .= "※ このメールは自動送信されています。\n";
$reply_body .= "  このメールに直接ご返信いただいてもお答えできない場合がございます。\n";
$reply_body .= "\n";
$reply_body .= "------------------------------------------------------------\n";
$reply_body .= "AquaBit LAB\n";
$reply_body .= "https://aquabit-lab.com\n";
$reply_body .= "Mail: info@aquabit-lab.com\n";
$reply_body .= "------------------------------------------------------------\n";

// --- メール送信 ---
$from = 'info@aquabit-lab.com';
$admin_sent = send_japanese_mail($to, $admin_subject, $admin_body, $from, $email);
$reply_sent = send_japanese_mail($email, $reply_subject, $reply_body, $from);

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
