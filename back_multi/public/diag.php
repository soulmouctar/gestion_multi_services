<?php
// Fichier de diagnostic temporaire - SUPPRIMER après utilisation
header('Content-Type: application/json');

$uploadsDir = __DIR__ . '/uploads';
$subfolders = ['avatars', 'users', 'products', 'clients', 'suppliers', 'containers', 'leases', 'banking/logos', 'banking/proofs'];

$result = [
    'php_user'        => get_current_user() ?: posix_getpwuid(posix_geteuid())['name'] ?? 'unknown',
    'uploads_path'    => $uploadsDir,
    'uploads_exists'  => is_dir($uploadsDir),
    'uploads_writable'=> is_writable($uploadsDir),
    'uploads_perms'   => is_dir($uploadsDir) ? substr(sprintf('%o', fileperms($uploadsDir)), -4) : 'N/A',
    'subfolders'      => [],
    'test_write'      => false,
    'app_url'         => getenv('APP_URL') ?: 'non défini',
    'doc_root'        => $_SERVER['DOCUMENT_ROOT'] ?? 'N/A',
    'script_dir'      => __DIR__,
];

// Test d'écriture réel
$testFile = $uploadsDir . '/_diag_test_' . time() . '.txt';
if (file_put_contents($testFile, 'test') !== false) {
    $result['test_write'] = true;
    unlink($testFile);
}

// Vérifier chaque sous-dossier
foreach ($subfolders as $sub) {
    $path = $uploadsDir . '/' . $sub;
    $result['subfolders'][$sub] = [
        'exists'   => is_dir($path),
        'writable' => is_dir($path) ? is_writable($path) : false,
        'perms'    => is_dir($path) ? substr(sprintf('%o', fileperms($path)), -4) : 'N/A',
    ];
}

echo json_encode($result, JSON_PRETTY_PRINT);
