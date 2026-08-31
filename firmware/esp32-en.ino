// ==========================================
// Gate.ino | R.I.S.K.I Gate v6.4.2 (Workflow Adjusted)
//
// all resource are documented on https://github.com/rizkydaffy/iot-gate-ino
// ==========================================
//
// ==========================================
// v6.2 ADD — PATCH NOTES (webhook/network integration)
//   - Everything from v6.1 above and below this note is BYTE-FOR-BYTE
//     untouched: no state, timing, relay, or LS logic was modified.
//   - This patch ONLY adds: NVS-based provisioning, a WiFi + TCP client to
//     @betogate, and a network trigger that calls the EXISTING handleScan()
//     function — exactly as if "scan" had been typed over Serial.
//   - The Serial "scan" command path in loop() is left fully intact for
//     local/bench testing; it is simply no longer the only trigger source.
//   - Integration points (search for "v6.2 ADD" comments below):
//       1) New #includes
//       2) New globals (network/provisioning config)
//       3) New helper functions (network layer only)
//       4) ONE appended line at the end of setup()
//       5) ONE appended line at the end of loop()
// ==========================================

// ==========================================
// v6.3.2 ADD — PATCH NOTES (silent polling)
//   - ONLY CHANGE: all Serial.print/println calls inside the HTTP polling
//     path (pollWebhookHttp + its failure/error branches) are now gated
//     behind a single HTTP_DEBUG_VERBOSE flag, default false.
//   - The poll itself is UNCHANGED: it still fires every
//     HTTP_POLL_INTERVAL_MS (500 ms), still hits the server every time,
//     still detects the rising edge and calls handleScan() exactly as
//     before. Only the console output was removed.
//   - Why this helps: Serial.print() at 115200 baud briefly blocks the
//     CPU while the UART TX buffer drains. Doing 4-5 of those every
//     500 ms was the actual source of "heavy lifting" — not the polling
//     itself. Removing them makes loop() faster/more consistent without
//     touching timing, state machine, relay, or LS logic.
//   - To get the logs back for debugging, just set HTTP_DEBUG_VERBOSE
//     to true and re-upload. Nothing else needs to change.
// ==========================================
// v6.4.2 ADJUSTED - PATCH NOTES (Workflow)
//    - flow changes: (markdowned, not deleted) Flow A, we onl use flow B and C
//    - new flow: we're change the relay function from = if it on that mean alarm on, onto relay used as scan validate, how it work? users pull palete => alarm on (THE REQUEST ARE HANDLED WITH HARDWARE TEAM) and the relay jobs are to make the alarm of like : alarm => users scan => relay on  for bout 5s and after 5s the relay turn of again (it uses are just menated for hardware team as a triggered to make thier listen only the relay on, or the simple word are if it on  for 5s that means users has been scanned and process/flow start all over again from the start) 
//    - the new flow: FLOW B = 1. (no pallet / ls not touched) pallete sedang di luar, 2. (Ls got pressed) pallete terdeteksi masuk system standby, 3. (ls got pulled) PALLETE DI TARIK, SEGERA LAKUKAN SCAN [alarm on, we're not handle this, the hardware team handle all of the alarm thing] => 4. (User Scan) Berhasil melakukan scan, sistem reset ke awal [Relay on for 5s and get of afterward, hardware team could use this as triggered to turn of the alarm system they build]

#include <Preferences.h>
#include <WiFi.h>
#include <ArduinoJson.h>

enum SystemState {
  // v6.4.2: Only Flow B and C are active. Flow A is markdowned (kept for reference, not used).
  STATE_STANDBY,       // Flow B step 2: Pallet is in place, waiting for pull
  // STATE_AUTHORIZED,    // Flow A (markdowned): Scanned before pull - no longer used
  STATE_AUTHORIZED,    // Flow A (markdowned - kept to avoid compile break on legacy references)
  STATE_ALARM,         // Flow B step 3: Pallet pulled, alarm on (hardware handles alarm)
  STATE_EMPTY          // Flow C: Pallet pulled safely, waiting for return
};

// ==========================================
// --- HARDWARE CONFIGURATION ---
// ==========================================
const int RELAY_PIN = 18;
const int LS_PIN = 19; 

#define RELAY_ACTIVE LOW
#define RELAY_RELEASE HIGH

// Hardware Logic Definitions (Flipped to fix physical inversion)
#define LS_PRESSED HIGH     // Pallet di dalam (Flipped)
#define LS_UNPRESSED LOW    // Pallet ditarik keluar (Flipped)

// ==========================================
// --- TIMING CONFIGURATION ---
// ==========================================
const unsigned long DEBOUNCE_DELAY = 50;
const unsigned long PULL_CONFIRM_MS = 300;
const unsigned long POST_RELAY_IGNORE_MS = 400;

// ==========================================
// --- GLOBAL STATE ---
// ==========================================
SystemState currentState = STATE_STANDBY;
unsigned long sessionId = 0;

int lastLsState = HIGH;
int currentLsState = HIGH;
unsigned long lastDebounceTime = 0;

bool candidatePending = false;
int candidateState = HIGH;
unsigned long candidateSince = 0;

unsigned long ignoreLsUntil = 0;
int relayPhysicalState = RELAY_RELEASE;

// v6.4.2 ADD: relay pulse tracking (5s scan-confirmation pulse)
const unsigned long RELAY_PULSE_MS = 5000;
unsigned long relayPulseUntil = 0;  // 0 = no active pulse

// ==========================================
// --- v6.2 ADD: WEBHOOK / NETWORK CONFIG (NVS-backed) ---
// v6.3 UPDATE: cfgServerPort now targets the @betogate HTTP port (4001)
//              instead of the TCP port (4000). Re-provision ESP32 if needed.
// ==========================================
Preferences gatePrefs;

String cfgWifiSsid;
String cfgWifiPass;
String cfgServerIp;
int    cfgServerPort = 4000;  // v6.3: Express backend directly (no @betogate; was 4001)
String cfgMachineCode;        // e.g. "mc0203"
String cfgWebhookPath;        // e.g. "/webhook/mc0203/qr-1003"
bool   gateConfigLoaded = false;

unsigned long lastWifiAttempt = 0;
const unsigned long NET_RETRY_MS = 5000;
bool wifiConnectInProgress = false;
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;

// v6.3 ADD: HTTP polling state
unsigned long lastHttpPollMs    = 0;
const unsigned long HTTP_POLL_INTERVAL_MS = 500;  // poll every 500 ms (UNCHANGED)

// v6.4 ADD: multi-QR support — listen_qrs stored as comma-delimited NVS string
// rizky: MAX_LISTEN_QRS=8 is sufficient for genba SOP. Upgrade to dynamic alloc if >8 parts/machine.
#define MAX_LISTEN_QRS 8
String cfgListenQrs[MAX_LISTEN_QRS];
int    cfgListenQrCount = 0;
bool lastScannedState[MAX_LISTEN_QRS] = {};  // per-QR rising-edge state

// v6.3.2 ADD: silent polling toggle. Poll timing/behavior is unaffected;
// this only controls whether the polling path prints to Serial.

// MASALAH JARINGAN? UBAH KE HTTP_DEBUG_VERBOSE = true; UNTUK DEBUGGING
const bool HTTP_DEBUG_VERBOSE = true;  // set true to restore verbose logs

// ==========================================
// --- HELPERS ---
// ==========================================
void setRelay(int state, const char* reason) {
  if (state != relayPhysicalState) {
    digitalWrite(RELAY_PIN, state);
    relayPhysicalState = state;
    ignoreLsUntil = millis() + POST_RELAY_IGNORE_MS;
  }
}

// v6.4 NOTE: RELAY_PIN is now dedicated purely as the alarm siren output
// (no lock/gate hardware is wired to it). RELAY_ACTIVE = siren ON,
// RELAY_RELEASE = siren OFF. It is driven ACTIVE only on the single
// transition into STATE_ALARM, and RELEASE on every other transition
// below (including boot) — see the setRelay() calls throughout.

void enterState(SystemState newState, const char* msg) {
  currentState = newState;
  sessionId++;
  Serial.print("[SESSION #");
  Serial.print(sessionId);
  Serial.print("] ");
  Serial.println(msg);
}

// ==========================================
// --- v6.2 ADD: HELPERS (network layer only — does not call into
//     or alter any state-machine function except handleScan()) ---
// ==========================================
// v6.4: parse comma-delimited "qrs" NVS key into cfgListenQrs[]
void parseListenQrs(const String& raw) {
  cfgListenQrCount = 0;
  if (raw.length() == 0) return;
  int start = 0;
  for (int i = 0; i <= (int)raw.length() && cfgListenQrCount < MAX_LISTEN_QRS; i++) {
    if (i == (int)raw.length() || raw[i] == ',') {
      String qr = raw.substring(start, i);
      qr.trim();
      if (qr.length() > 0) cfgListenQrs[cfgListenQrCount++] = qr;
      start = i + 1;
    }
  }
}

bool loadGateWebhookConfig() {
  gatePrefs.begin("gatecfg", true);
  cfgWifiSsid    = gatePrefs.getString("ssid", "");
  cfgWifiPass    = gatePrefs.getString("pass", "");
  cfgServerIp    = gatePrefs.getString("srvip", "");
  cfgServerPort  = gatePrefs.getInt("srvport", 4000);
  cfgMachineCode = gatePrefs.getString("mc", "");
  cfgWebhookPath = gatePrefs.getString("hook", "");  // kept for compat
  parseListenQrs(gatePrefs.getString("qrs", ""));    // v6.4: multi-QR list
  gatePrefs.end();
  return cfgWifiSsid.length() > 0 && cfgServerIp.length() > 0;
}

// Blocks ONLY when no config exists yet (fresh/unprovisioned board).
// Mirrors @devportal's WebSerial payload: {"cmd":"config", ...}
void runSerialProvisioningIfNeeded() {
  if (loadGateWebhookConfig()) {
    gateConfigLoaded = true;
    WiFi.mode(WIFI_STA);   // set once here, never again per-attempt
    Serial.print("[PROVISION] Existing config loaded. Webhook: ");
    Serial.println(cfgWebhookPath);
    return;
  }

  Serial.println("[PROVISION] No NVS config found. Waiting for JSON over Serial (:4001 / /station/provisioning)...");
  while (true) {
    if (Serial.available() > 0) {
      String line = Serial.readStringUntil('\n');
      line.trim();
      if (line.length() == 0) continue;

      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, line);
      if (err || strcmp(doc["cmd"] | "", "config") != 0) {
        Serial.println("[PROVISION] Invalid payload, ignoring.");
        continue;
      }

      // v6.4: build comma-delimited qrs string from listen_qrs array
      String qrsJoined = "";
      JsonArray qrArr = doc["listen_qrs"].as<JsonArray>();
      for (JsonVariant v : qrArr) {
        if (qrsJoined.length() > 0) qrsJoined += ",";
        qrsJoined += v.as<String>();
      }

      gatePrefs.begin("gatecfg", false);
      gatePrefs.putString("ssid",    doc["wifi_ssid"]    | "");
      gatePrefs.putString("pass",    doc["wifi_pass"]    | "");
      gatePrefs.putString("srvip",   doc["server_ip"]    | "");
      gatePrefs.putInt("srvport",    doc["port"]          | 4000);
      gatePrefs.putString("mc",      doc["machine_code"] | "");
      gatePrefs.putString("hook",    doc["webhook_path"] | "");  // kept for compat
      gatePrefs.putString("qrs",     qrsJoined);                 // v6.4: multi-QR
      gatePrefs.end();

      Serial.println("[PROVISION] Config saved. Rebooting...");
      delay(300);
      ESP.restart();
    }
  }
}

static bool wifiWasConnected = false;
void connectWiFiIfNeeded() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      wifiConnectInProgress = false;
      Serial.println("[WIFI] wifi successfuly connected");
    }
    return;
  }
  wifiWasConnected = false;

  // A begin() is already resolving — do NOT call begin() again yet.
  // Calling it mid-handshake is what causes:
  //   E (...) wifi:sta is connecting, cannot set config
  if (wifiConnectInProgress) {
    if (millis() - lastWifiAttempt < WIFI_CONNECT_TIMEOUT_MS) return;
    // Attempt timed out — cleanly reset before allowing a fresh begin()
    WiFi.disconnect(true, true);
    wifiConnectInProgress = false;
  }

  if (millis() - lastWifiAttempt < NET_RETRY_MS) return;

  lastWifiAttempt = millis();
  wifiConnectInProgress = true;
  Serial.print("[WIFI] Attempting to connect to SSID: ");
  Serial.println(cfgWifiSsid);
  WiFi.begin(cfgWifiSsid.c_str(), cfgWifiPass.c_str());
}

// ==========================================
// --- v6.3 ADD: HTTP POLLING LAYER ---
// Polls GET /iot/{mc}/{qr} on the Express backend (port 4000).
// On rising edge (false→true) calls handleScan(), then resets via POST /reset.
// The webhook path stored in NVS ("/webhook/mc2/QR-1003") is parsed to extract
// mc and qr segments — no NVS schema change needed.
// ==========================================

/**
 * v6.4: Build poll path directly from cfgMachineCode + a specific QR id.
 * Works for both single and multi-QR provisioning.
 * e.g. cfgMachineCode="mc2", qrId="QR-1003" → "/iot/mc2/QR-1003"
 */
String iotPollPathFor(const String& qrId) {
  return "/iot/" + cfgMachineCode + "/" + qrId;
}

/**
 * Minimal HTTP/1.0 GET helper.
 * v6.4.1 FIX: pre-reserve responseBody to avoid heap fragmentation from
 * repeated String += inside the read loop. The IoT endpoint returns ~30 bytes
 * of JSON; 256 is generous headroom.
 */
bool httpGet(const char* path, String& responseBody) {
  WiFiClient hc;
  if (!hc.connect(cfgServerIp.c_str(), cfgServerPort)) return false;
  hc.printf("GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n",
            path, cfgServerIp.c_str());
  unsigned long t0 = millis();
  while (!hc.available()) {
    if (millis() - t0 > 2000) { hc.stop(); return false; }
    delay(5);
  }
  bool inBody = false;
  responseBody = "";
  responseBody.reserve(256);  // one alloc, no fragmentation
  while (hc.available() || hc.connected()) {
    String line = hc.readStringUntil('\n');
    if (!inBody) {
      if (line == "\r" || line.length() <= 1) inBody = true;
    } else {
      responseBody += line;
    }
  }
  hc.stop();
  responseBody.trim();
  return responseBody.length() > 0;
}

/**
 * Minimal HTTP/1.0 POST helper (no body).
 */
void httpPost(const char* path) {
  WiFiClient hc;
  if (!hc.connect(cfgServerIp.c_str(), cfgServerPort)) return;
  hc.printf("POST %s HTTP/1.0\r\nHost: %s\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            path, cfgServerIp.c_str());
  unsigned long t0 = millis();
  while (!hc.available()) {
    if (millis() - t0 > 2000) break;
    delay(5);
  }
  hc.stop();
}

/**
 * Core HTTP polling — called from maintainGateNetwork() every loop().
 * Detects rising edge on server scanned flag and calls the existing handleScan().
 * Resets state immediately before calling handleScan() to prevent double-trigger.
 * v6.3.2: All status/debug Serial output gated behind HTTP_DEBUG_VERBOSE.
 *         Poll cadence (HTTP_POLL_INTERVAL_MS) and trigger logic are UNCHANGED —
 *         only the console noise was removed to reduce per-poll UART blocking.
 */
unsigned long lastDebugPrintMs = 0;
const unsigned long DEBUG_PRINT_INTERVAL_MS = 10000;  // only used when verbose is on

void pollWebhookHttp() {
  if (WiFi.status() != WL_CONNECTED) {
    if (HTTP_DEBUG_VERBOSE) {
      unsigned long now2 = millis();
      if (now2 - lastDebugPrintMs > DEBUG_PRINT_INTERVAL_MS) {
        lastDebugPrintMs = now2;
        Serial.println("[HTTP] WiFi NOT connected. Waiting...");
      }
    }
    return;
  }

  unsigned long now = millis();
  if (now - lastHttpPollMs < HTTP_POLL_INTERVAL_MS) return;
  lastHttpPollMs = now;

  // v6.4: iterate all provisioned QRs — same handleScan() call, same rising-edge logic
  if (cfgListenQrCount == 0) {
    if (HTTP_DEBUG_VERBOSE && (now - lastDebugPrintMs > DEBUG_PRINT_INTERVAL_MS)) {
      lastDebugPrintMs = now;
      Serial.println("[HTTP] No QRs configured. Re-provision via /station/provisioning.");
    }
    return;
  }

  bool debugNow = HTTP_DEBUG_VERBOSE && (now - lastDebugPrintMs > DEBUG_PRINT_INTERVAL_MS);
  if (debugNow) lastDebugPrintMs = now;

  // v6.4.1 FIX: pre-built char buffers to avoid String heap churn in the hot loop.
  // The old code created new String objects per QR per tick → heap fragmentation → crash.
  char pollPath[64];    // "/iot/mc6/QR-1009" fits easily
  char resetPath[80];   // pollPath + "/reset"
  String body;
  body.reserve(256);    // one allocation, reused across all QRs this tick

  for (int i = 0; i < cfgListenQrCount; i++) {
    snprintf(pollPath, sizeof(pollPath), "/iot/%s/%s",
             cfgMachineCode.c_str(), cfgListenQrs[i].c_str());

    if (debugNow) {
      Serial.print("[HTTP] Polling: ");
      Serial.print(cfgServerIp);
      Serial.print(":");
      Serial.print(cfgServerPort);
      Serial.println(pollPath);
    }

    body = "";  // clear without dealloc — reserve keeps the buffer
    if (!httpGet(pollPath, body)) {
      if (debugNow) {
        Serial.print("[HTTP] FAILED to connect to ");
        Serial.print(cfgServerIp);
        Serial.print(":");
        Serial.println(cfgServerPort);
      }
      continue;  // try next QR
    }

    StaticJsonDocument<256> doc;
    DeserializationError jsonErr = deserializeJson(doc, body);
    if (jsonErr) {
      if (HTTP_DEBUG_VERBOSE) {
        Serial.print("[HTTP] JSON parse error on ");
        Serial.print(pollPath);
        Serial.print(": ");
        Serial.println(jsonErr.c_str());
      }
      continue;
    }

    bool scanned = doc["scanned"] | false;

    if (scanned && !lastScannedState[i]) {
      // Scan event — unconditional log (low-frequency, real event)
      Serial.print("[HTTP] >>> SCAN SIGNAL DETECTED on ");
      Serial.println(pollPath);
      snprintf(resetPath, sizeof(resetPath), "%s/reset", pollPath);
      httpPost(resetPath);  // reset FIRST to avoid double-trigger
      Serial.println("[HTTP] State reset sent.");
      handleScan();          // untouched state-machine handler
      // 5s cooldown: suspend polling so hardware devices settle before next tick.
      // rizky: simple timer push. Upgrade to per-QR cooldown if QRs need independent timers.
      lastHttpPollMs = millis() + 5000UL;
      Serial.println("[SYSTEM] 5s delay adjusted for hardware devices.");
      return;  // exit poll loop; resume next maintainGateNetwork() call after cooldown
    }

    lastScannedState[i] = scanned;
  }
}

void maintainGateNetwork() {
  if (!gateConfigLoaded) return;
  connectWiFiIfNeeded();
  pollWebhookHttp();
}

// ==========================================
// --- SETUP ---
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RELAY_PIN, OUTPUT_OPEN_DRAIN);
  // v6.4 UPDATE: boot with the siren OFF. Previously this was RELAY_ACTIVE
  // (energized at boot) which is what caused the siren to fire the instant
  // USB was plugged in. RELAY_PIN is now driven ACTIVE only when the code
  // actually enters STATE_ALARM (see handleConfirmedLsChange below).
  digitalWrite(RELAY_PIN, RELAY_RELEASE);
  relayPhysicalState = RELAY_RELEASE;

  pinMode(LS_PIN, INPUT_PULLUP);
  lastLsState = digitalRead(LS_PIN);
  currentLsState = lastLsState;
  candidateState = lastLsState;

  Serial.println("\n=============================================");
  Serial.println("  RISKI Gate v6.4.2 (Multi-QR)             ");
  Serial.println("=============================================");

  if (lastLsState == LS_PRESSED) {
    currentState = STATE_STANDBY;
    Serial.println("[STATUS] Ready: Pallet terdeteksi di posisi stand-by.");
  } else {
    currentState = STATE_EMPTY;
    Serial.println("[STATUS] Ready: Pallet sedang di luar.");
  }

  // v6.2 ADD — appended only, nothing above this line was changed
  runSerialProvisioningIfNeeded();
}

// ==========================================
// --- MAIN LOOP ---
// ==========================================
void loop() {
  unsigned long now = millis();

  // ---------- LS: electrical debounce (fast) ----------
  int reading = digitalRead(LS_PIN);
  if (reading != lastLsState) {
    lastDebounceTime = now;
  }
  if ((now - lastDebounceTime) > DEBOUNCE_DELAY) {
    if (reading != currentLsState) {
      currentLsState = reading;
      candidateState = reading;
      candidateSince = now;
      candidatePending = true;
    }
  }
  lastLsState = reading;

  // ---------- LS: intent confirmation (slow) ----------
  if (candidatePending) {
    bool ignoringNow = now < ignoreLsUntil;
    if (ignoringNow) {
      candidateSince = now; 
    } else if (now - candidateSince >= PULL_CONFIRM_MS) {
      candidatePending = false;
      handleConfirmedLsChange(candidateState);
    }
  }

  // ---------- SERIAL COMMANDS (Scanners + Re-provisioning) ----------
  if (Serial.available() > 0) {
    String input = Serial.readStringUntil('\n');
    input.trim();
    if (input == "scan") {
      handleScan();
    } else if (input.startsWith("{") && input.indexOf("\"cmd\":\"config\"") > 0) {
      // Intercept re-provisioning payload from WebSerial
      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, input);
      if (!err && strcmp(doc["cmd"] | "", "config") == 0) {
        // v6.4: build comma-delimited qrs from listen_qrs array
        String qrsJoined2 = "";
        JsonArray qrArr2 = doc["listen_qrs"].as<JsonArray>();
        for (JsonVariant v : qrArr2) {
          if (qrsJoined2.length() > 0) qrsJoined2 += ",";
          qrsJoined2 += v.as<String>();
        }

        gatePrefs.begin("gatecfg", false);
        gatePrefs.putString("ssid",    doc["wifi_ssid"]    | "");
        gatePrefs.putString("pass",    doc["wifi_pass"]    | "");
        gatePrefs.putString("srvip",   doc["server_ip"]    | "");
        gatePrefs.putInt("srvport",    doc["port"]          | 4000);
        gatePrefs.putString("mc",      doc["machine_code"] | "");
        gatePrefs.putString("hook",    doc["webhook_path"] | "");  // kept for compat
        gatePrefs.putString("qrs",     qrsJoined2);               // v6.4: multi-QR
        gatePrefs.end();
        Serial.println("[PROVISION] New config saved on-the-fly. Rebooting...");
        delay(300);
        ESP.restart();
      }
    } else {
      Serial.println("[WARN] Sistem otomatis. Gunakan Scanner QR/RFID.");
    }
  }

  // v6.4.2 ADD: relay pulse auto-release after RELAY_PULSE_MS
  if (relayPulseUntil > 0 && millis() >= relayPulseUntil) {
    relayPulseUntil = 0;
    setRelay(RELAY_RELEASE, "scan pulse expired - relay OFF");
    Serial.println("[RELAY] 5s scan pulse complete. Relay OFF.");
  }

  // v6.2 ADD — appended only, nothing above this line was changed
  maintainGateNetwork();
}

// ==========================================
// --- CONFIRMED PHYSICAL EVENT HANDLER ---
// ==========================================
void handleConfirmedLsChange(int state) {
  if (state == LS_UNPRESSED) {
    // === PALLET DITARIK KELUAR ===
    if (currentState == STATE_STANDBY) {
      // v6.4.2: Alarm is hardware-handled. ESP32 does NOT fire relay here.
      // Relay role changed: relay is now a 5s scan-confirmation pulse only.
      enterState(STATE_ALARM, "[WARN] PALLETE DI TARIK, SEGERA LAKUKAN SCAN - waiting for scan.");
    } 
    // Flow A (markdowned - STATE_AUTHORIZED branch kept to avoid dead-code compile issues)
    // else if (currentState == STATE_AUTHORIZED) { ... }
  } 
  else if (state == LS_PRESSED) {
    // === PALLET DIKEMBALIKAN KE DALAM ===
    if (currentState == STATE_ALARM) {
      Serial.println("[INFO] Pallet dikembalikan (LS tertekan). Harus SCAN untuk menutup sesi!");
    } 
    else if (currentState == STATE_EMPTY) {
      enterState(STATE_STANDBY, "[INFO] Pallet terdeteksi masuk - system standby.");
    }
  }
}

// ==========================================
// --- SCANNER HANDLER ---
// ==========================================
void handleScan() {
  // Flow A (markdowned): STATE_STANDBY scan-before-pull path removed from active flow.
  // if (currentState == STATE_STANDBY) { ... }

  if (currentState == STATE_ALARM) {
    // v6.4.2: Scan received during alarm.
    // Fire relay ON for 5s as scan-confirmation pulse (hardware team uses this
    // as trigger to turn off their alarm system). Then reset flow to start.
    setRelay(RELAY_ACTIVE, "scan confirmed - 5s pulse start");
    relayPulseUntil = millis() + RELAY_PULSE_MS;
    Serial.println("[RELAY] Scan confirmed. Relay ON for 5s (scan-confirmation pulse).");

    if (currentLsState == LS_UNPRESSED) {
      enterState(STATE_EMPTY, "[SUCCESS] Berhasil melakukan scan. Pallet aman di luar.");
    } else {
      enterState(STATE_STANDBY, "[SUCCESS] Berhasil melakukan scan, sistem reset ke awal.");
    }
  } 
  else if (currentState == STATE_STANDBY) {
    Serial.println("[INFO] Sistem standby. Pallet belum ditarik.");
  }
  else if (currentState == STATE_EMPTY) {
    Serial.println("[INFO] Pallet sedang di luar. Kembalikan ke posisi semula (LS tertekan) untuk memulai.");
  }
}
