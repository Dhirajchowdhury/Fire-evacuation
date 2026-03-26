# ESP32 Integration Guide

## Zone Assignments

| Device ID       | Zone | Nodes Covered              |
|-----------------|------|----------------------------|
| esp32-zone-a    | A    | Room 1, Room 2             |
| esp32-zone-b    | B    | Corridor 1, Central Hub    |
| esp32-zone-c    | C    | Room 3, Room 4             |
| esp32-zone-d    | D    | Room 5, Corridor 2         |

---

## Endpoint

```
POST http://YOUR_SERVER_IP:4000/api/fire-alert
```

## Headers

```
Content-Type: application/json
```

## Fire Alert Payload

```json
{
  "zone": "A",
  "status": "fire",
  "device_id": "esp32-zone-a"
}
```

## All Clear Payload

```json
{
  "zone": "A",
  "status": "safe",
  "device_id": "esp32-zone-a"
}
```

## Response

```json
{
  "success": true,
  "zone": "A",
  "status": "fire",
  "message": "🔥 Fire detected in Zone A",
  "evacuationRoute": {
    "path": ["room_3", "corridor_2", "exit_2"],
    "exit": "exit_2",
    "blocked_zones": ["A"],
    "description": "Zone A on fire. Route: Room 3 → Corridor 2 → Exit 2"
  }
}
```

---

## Sample ESP32 Arduino C++ Code

Replace `YOUR_WIFI_SSID`, `YOUR_WIFI_PASSWORD`, and `YOUR_SERVER_IP` before flashing.
Adjust `ZONE_ID` and `DEVICE_ID` per device.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ── Configuration ────────────────────────────────────────────
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://YOUR_SERVER_IP:4000/api/fire-alert";
const char* ZONE_ID       = "A";          // Change per device: A / B / C / D
const char* DEVICE_ID     = "esp32-zone-a"; // Change per device

const int   SENSOR_PIN    = 34;           // Analog smoke/fire sensor pin
const int   FIRE_THRESHOLD = 2000;        // ADC threshold (0–4095)
const int   POLL_INTERVAL  = 2000;        // ms between sensor reads

// ── State ────────────────────────────────────────────────────
bool lastAlertWasFire = false;

// ── Helpers ──────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected: " + WiFi.localIP().toString());
}

void sendAlert(const char* status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected — skipping alert");
    return;
  }

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  // Build JSON payload
  StaticJsonDocument<128> doc;
  doc["zone"]      = ZONE_ID;
  doc["status"]    = status;
  doc["device_id"] = DEVICE_ID;

  String payload;
  serializeJson(doc, payload);

  int httpCode = http.POST(payload);

  if (httpCode == 200) {
    Serial.printf("✅ Alert sent: Zone %s → %s\n", ZONE_ID, status);
    String response = http.getString();
    Serial.println("Response: " + response);
  } else {
    Serial.printf("❌ HTTP error: %d\n", httpCode);
  }

  http.end();
}

// ── Setup ────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT);
  connectWiFi();
}

// ── Loop ─────────────────────────────────────────────────────
void loop() {
  int sensorValue = analogRead(SENSOR_PIN);
  bool fireDetected = sensorValue >= FIRE_THRESHOLD;

  Serial.printf("Sensor: %d | Fire: %s\n", sensorValue, fireDetected ? "YES" : "NO");

  // Only send alert on state change to avoid spamming the server
  if (fireDetected && !lastAlertWasFire) {
    sendAlert("fire");
    lastAlertWasFire = true;
  } else if (!fireDetected && lastAlertWasFire) {
    sendAlert("safe");
    lastAlertWasFire = false;
  }

  delay(POLL_INTERVAL);
}
```

### Required Libraries

Install via Arduino Library Manager:
- `ArduinoJson` by Benoit Blanchon
- `HTTPClient` (bundled with ESP32 Arduino core)

### Flashing Notes

- Board: **ESP32 Dev Module**
- Upload speed: **115200**
- Flash frequency: **80MHz**
- Partition scheme: **Default 4MB**
