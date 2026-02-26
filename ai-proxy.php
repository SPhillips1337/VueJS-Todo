<?php
/**
 * Simple PHP Proxy for Ollama API
 * Bypasses browser CORS restrictions by making the request server-side.
 */

header('Content-Type: application/json');

// Get the raw POST data
$rawData = file_get_contents('php://input');
$requestData = json_decode($rawData, true);

if (!$requestData || !isset($requestData['endpoint'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request. Missing endpoint.']);
    exit;
}

$endpoint = $requestData['endpoint'];
$payload = $requestData['payload'];

// Initialize cURL
$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json'
]);

// Execute request
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);

curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['error' => 'Proxy request failed: ' . $error]);
} else {
    http_response_code($httpCode);
    echo $response;
}
