<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Configuration de la base de données
$db_config = [
    'host' => '127.0.0.1',
    'port' => 3306,
    'dbname' => 'saas_management',
    'username' => 'root',
    'password' => ''
];

try {
    // Connexion à la base de données
    $pdo = new PDO(
        "mysql:host={$db_config['host']};port={$db_config['port']};dbname={$db_config['dbname']};charset=utf8mb4",
        $db_config['username'],
        $db_config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );

    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

    // Router simple
    switch ($path) {
        case '/api/tenants':
            handleTenants($pdo, $method);
            break;
        default:
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Endpoint not found']);
            break;
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection error: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage()
    ]);
}

function handleTenants($pdo, $method) {
    switch ($method) {
        case 'GET':
            getTenants($pdo);
            break;
        case 'POST':
            createTenant($pdo);
            break;
        case 'PUT':
            updateTenant($pdo);
            break;
        case 'DELETE':
            deleteTenant($pdo);
            break;
        default:
            http_response_code(405);
            echo json_encode(['success' => false, 'message' => 'Method not allowed']);
            break;
    }
}

function getTenants($pdo) {
    try {
        // Récupérer tous les tenants
        $stmt = $pdo->query("
            SELECT id, name, email, phone, subscription_status, created_at, updated_at 
            FROM tenants 
            ORDER BY created_at DESC
        ");
        $tenants = $stmt->fetchAll();

        // Pour chaque tenant, récupérer ses modules
        foreach ($tenants as &$tenant) {
            $stmt = $pdo->prepare("
                SELECT m.id, m.code, m.name,
                       tm.tenant_id, tm.module_id, tm.is_active
                FROM modules m
                JOIN tenant_modules tm ON m.id = tm.module_id
                WHERE tm.tenant_id = ?
            ");
            $stmt->execute([$tenant['id']]);
            $modules = $stmt->fetchAll();

            $tenant['modules'] = array_map(function($module) {
                return [
                    'id' => (int)$module['id'],
                    'code' => $module['code'],
                    'name' => $module['name'],
                    'icon' => 'cil-apps', // Icône par défaut
                    'enabled' => true, // Tous les modules sont activés par défaut
                    'pivot' => [
                        'tenant_id' => (int)$module['tenant_id'],
                        'module_id' => (int)$module['module_id'],
                        'is_active' => (bool)$module['is_active']
                    ]
                ];
            }, $modules);

            $tenant['users'] = [];
            $tenant['subscriptions'] = [];
            
            // Convertir les IDs en entiers
            $tenant['id'] = (int)$tenant['id'];
        }

        echo json_encode([
            'success' => true,
            'data' => $tenants,
            'message' => 'Tenants retrieved successfully from MySQL database'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

function createTenant($pdo) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Validation
        if (!isset($input['name']) || !isset($input['email']) || !isset($input['subscription_status'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }

        // Vérifier si l'email existe déjà
        $stmt = $pdo->prepare("SELECT id FROM tenants WHERE email = ?");
        $stmt->execute([$input['email']]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email already exists']);
            return;
        }

        // Insérer le tenant
        $stmt = $pdo->prepare("
            INSERT INTO tenants (name, email, phone, subscription_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, NOW(), NOW())
        ");
        $stmt->execute([
            $input['name'],
            $input['email'],
            $input['phone'] ?? null,
            $input['subscription_status']
        ]);

        $id = $pdo->lastInsertId();
        
        // Récupérer le tenant créé
        $stmt = $pdo->prepare("SELECT * FROM tenants WHERE id = ?");
        $stmt->execute([$id]);
        $tenant = $stmt->fetch();
        $tenant['id'] = (int)$tenant['id'];

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'data' => $tenant,
            'message' => 'Tenant created successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

function updateTenant($pdo) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $_GET['id'] ?? null;

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing tenant ID']);
            return;
        }

        if (!isset($input['name']) || !isset($input['email']) || !isset($input['subscription_status'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing required fields']);
            return;
        }

        // Vérifier si le tenant existe
        $stmt = $pdo->prepare("SELECT id FROM tenants WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Tenant not found']);
            return;
        }

        // Vérifier si l'email est utilisé par un autre tenant
        $stmt = $pdo->prepare("SELECT id FROM tenants WHERE email = ? AND id != ?");
        $stmt->execute([$input['email'], $id]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Email already exists']);
            return;
        }

        // Mettre à jour le tenant
        $stmt = $pdo->prepare("
            UPDATE tenants 
            SET name = ?, email = ?, phone = ?, subscription_status = ?, updated_at = NOW()
            WHERE id = ?
        ");
        $stmt->execute([
            $input['name'],
            $input['email'],
            $input['phone'] ?? null,
            $input['subscription_status'],
            $id
        ]);

        // Récupérer le tenant mis à jour
        $stmt = $pdo->prepare("SELECT * FROM tenants WHERE id = ?");
        $stmt->execute([$id]);
        $tenant = $stmt->fetch();
        $tenant['id'] = (int)$tenant['id'];

        echo json_encode([
            'success' => true,
            'data' => $tenant,
            'message' => 'Tenant updated successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}

function deleteTenant($pdo) {
    try {
        $id = $_GET['id'] ?? null;

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Missing tenant ID']);
            return;
        }

        // Vérifier si le tenant existe
        $stmt = $pdo->prepare("SELECT id FROM tenants WHERE id = ?");
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Tenant not found']);
            return;
        }

        // Supprimer d'abord les relations avec les modules
        $stmt = $pdo->prepare("DELETE FROM tenant_modules WHERE tenant_id = ?");
        $stmt->execute([$id]);

        // Supprimer le tenant
        $stmt = $pdo->prepare("DELETE FROM tenants WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Tenant deleted successfully'
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database error: ' . $e->getMessage()
        ]);
    }
}
?>
