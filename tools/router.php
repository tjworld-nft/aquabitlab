<?php
// ローカル確認用ルーター（本番の .htaccess と同じURLの動きを再現する）
//   php -S 127.0.0.1:8983 -t . tools/router.php
// send-mail.php は ABL_MAIL_DRYRUN=1 でメールを実際には送らない。
$root = realpath(__DIR__ . '/..');
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));

if ($path === '/send-mail.php') {
    putenv('ABL_MAIL_DRYRUN=1');
    require $root . '/send-mail.php';
    return true;
}
// 本番と同じく .html 付きURLはクリーンURLへ301
if (preg_match('#^/(.+)\.html$#', $path, $m) && $m[1] !== 'index' && is_file($root . $path)) {
    $qs = $_SERVER['QUERY_STRING'] ?? '';
    header('Location: /' . $m[1] . ($qs !== '' ? '?' . $qs : ''), true, 301);
    return true;
}
if ($path === '/index.html') { header('Location: /', true, 301); return true; }
$file = $root . $path;
if ($path !== '/' && is_file($file)) {
    if (preg_match('/\.(webp|jpg|png|svg|js|css|woff2|mp4|txt|xml|ico|json)$/', $path)) {
        return false; // PHP組み込みサーバーにそのまま配信させる
    }
    return false;
}
if (is_dir($file) && is_file(rtrim($file, '/') . '/index.html')) {
    if (substr($path, -1) !== '/') { header('Location: ' . $path . '/', true, 301); return true; }
    header('Content-Type: text/html; charset=UTF-8');
    readfile(rtrim($file, '/') . '/index.html');
    return true;
}
if (is_file($root . rtrim($path, '/') . '.html')) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($root . rtrim($path, '/') . '.html');
    return true;
}
http_response_code(404);
header('Content-Type: text/html; charset=UTF-8');
if (is_file($root . '/404.html')) readfile($root . '/404.html'); else echo 'Not Found';
return true;
