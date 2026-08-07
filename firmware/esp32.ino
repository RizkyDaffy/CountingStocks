

#include <Preferences.h>
#include <WiFi.h>
#include <ArduinoJson.h>

enum ShisutemuJoutai {
  JOUTAI_SUTANBAI,
  JOUTAI_NINSHOU_ZUMI,
  JOUTAI_ARAAMU,
  JOUTAI_KARA
};

const int RIREI_PIN = 18;
const int RIMITTO_SUICCHI_PIN = 19; 

#define RIREI_AKUTIBU LOW
#define RIREI_KAIJYO HIGH

#define SUICCHI_ON HIGH
#define SUICCHI_OFF LOW

const unsigned long DEBAUNSU_CHIEN_MS = 50;
const unsigned long HIKIDASHI_KAKUNIN_MS = 300;
const unsigned long RIREI_GO_MUSHI_MS = 400;

ShisutemuJoutai genzaiJoutai = JOUTAI_SUTANBAI;
unsigned long sesshonIdo = 0;

int zenkaiSuicchiJoutai = HIGH;
int genzaiSuicchiJoutai = HIGH;
unsigned long saishuDebaunsuJikoku = 0;

bool kouhoHoryuuChuu = false;
int kouhoJoutai = HIGH;
unsigned long kouhoKaishiJikoku = 0;

unsigned long suicchiMushiKigen = 0;
int rireiButsuriJoutai = RIREI_KAIJYO;

const unsigned long RIREI_PARUSU_MS = 5000;
unsigned long rireiParusuKigen = 0;

Preferences geetoSettei;

String setteiWifiSsid;
String setteiWifiPasu;
String setteiSaabaaIp;
int    setteiSaabaaPooto = 4005;
String setteiMashinKoodo;
String setteiUebbuhukkuPasu;
bool   geetoSetteiYomikomiZumi = false;

unsigned long saishuWifiSaishikouJikoku = 0;
const unsigned long NETTO_SAISHIKOU_MS = 5000;
bool wifiZetsuzokuChuu = false;
const unsigned long WIFI_ZETSUZOKU_TAIMUAUTTO_MS = 15000;

unsigned long saishuHttpPooringuMs    = 0;
const unsigned long HTTP_POORINGU_KANKAKU_MS = 500;

#define SAIDAI_JUSHIN_QR_SUU 8
String setteiJushinQrList[SAIDAI_JUSHIN_QR_SUU];
int    setteiJushinQrSuu = 0;
bool saishuSukyanJoutai[SAIDAI_JUSHIN_QR_SUU] = {};

const bool HTTP_DEBAGGU_SHOUSAI = false;

void rireiSettei(int joutai, const char* riyuu) {
  if (joutai != rireiButsuriJoutai) {
    digitalWrite(RIREI_PIN, joutai);
    rireiButsuriJoutai = joutai;
    suicchiMushiKigen = millis() + RIREI_GO_MUSHI_MS;
  }
}

void joutaiSeni(ShisutemuJoutai shinJoutai, const char* meseeji) {
  genzaiJoutai = shinJoutai;
  sesshonIdo++;
  Serial.print("[セッション #");
  Serial.print(sesshonIdo);
  Serial.print("] ");
  Serial.println(meseeji);
}

void jushinQrKaiseki(const String& namaDeeta) {
  setteiJushinQrSuu = 0;
  if (namaDeeta.length() == 0) return;
  int kaishi = 0;
  for (int i = 0; i <= (int)namaDeeta.length() && setteiJushinQrSuu < SAIDAI_JUSHIN_QR_SUU; i++) {
    if (i == (int)namaDeeta.length() || namaDeeta[i] == ',') {
      String qr = namaDeeta.substring(kaishi, i);
      qr.trim();
      if (qr.length() > 0) setteiJushinQrList[setteiJushinQrSuu++] = qr;
      kaishi = i + 1;
    }
  }
}

bool geetoSetteiYomikomi() {
  geetoSettei.begin("gatecfg", true);
  setteiWifiSsid    = geetoSettei.getString("ssid", "");
  setteiWifiPasu    = geetoSettei.getString("pass", "");
  setteiSaabaaIp    = geetoSettei.getString("srvip", "");
  setteiSaabaaPooto = geetoSettei.getInt("srvport", 4005);
  setteiMashinKoodo = geetoSettei.getString("mc", "");
  setteiUebbuhukkuPasu = geetoSettei.getString("hook", "");
  jushinQrKaiseki(geetoSettei.getString("qrs", ""));
  geetoSettei.end();
  return setteiWifiSsid.length() > 0 && setteiSaabaaIp.length() > 0;
}

void shiriaruSetteiJikkou() {
  if (geetoSetteiYomikomi()) {
    geetoSetteiYomikomiZumi = true;
    WiFi.mode(WIFI_STA);
    Serial.print("[初期設定] 既存の設定を読み込みました。Webhook: ");
    Serial.println(setteiUebbuhukkuPasu);
    return;
  }

  Serial.println("[初期設定] NVS設定が見つかりません。シリアル経由(:4001 / /station/provisioning)でJSONデータを受信待機中...");
  while (true) {
    if (Serial.available() > 0) {
      String jushinGyou = Serial.readStringUntil('\n');
      jushinGyou.trim();
      if (jushinGyou.length() == 0) continue;

      StaticJsonDocument<512> doc;
      DeserializationError eraa = deserializeJson(doc, jushinGyou);
      if (eraa || strcmp(doc["cmd"] | "", "config") != 0) {
        Serial.println("[初期設定] 無効なデータ受信。無視します。");
        continue;
      }

      String ketsugouQr = "";
      JsonArray qrHairetsu = doc["listen_qrs"].as<JsonArray>();
      for (JsonVariant v : qrHairetsu) {
        if (ketsugouQr.length() > 0) ketsugouQr += ",";
        ketsugouQr += v.as<String>();
      }

      geetoSettei.begin("gatecfg", false);
      geetoSettei.putString("ssid",    doc["wifi_ssid"]    | "");
      geetoSettei.putString("pass",    doc["wifi_pass"]    | "");
      geetoSettei.putString("srvip",   doc["server_ip"]    | "");
      geetoSettei.putInt("srvport",    doc["port"]          | 4005);
      geetoSettei.putString("mc",      doc["machine_code"] | "");
      geetoSettei.putString("hook",    doc["webhook_path"] | "");
      geetoSettei.putString("qrs",     ketsugouQr);
      geetoSettei.end();

      Serial.println("[初期設定] 設定を保存しました。再起動します...");
      delay(300);
      ESP.restart();
    }
  }
}

void wifiZetsuzokuIji() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiZetsuzokuChuu = false;
    return;
  }

  if (wifiZetsuzokuChuu) {
    if (millis() - saishuWifiSaishikouJikoku < WIFI_ZETSUZOKU_TAIMUAUTTO_MS) return;
    WiFi.disconnect(true, true);
    wifiZetsuzokuChuu = false;
  }

  if (millis() - saishuWifiSaishikouJikoku < NETTO_SAISHIKOU_MS) return;

  saishuWifiSaishikouJikoku = millis();
  wifiZetsuzokuChuu = true;
  Serial.print("[Wi-Fi] SSIDへ接続試行中: ");
  Serial.println(setteiWifiSsid);
  WiFi.begin(setteiWifiSsid.c_str(), setteiWifiPasu.c_str());
}

String iotPooringuPasuSeisei(const String& qrId) {
  return "/iot/" + setteiMashinKoodo + "/" + qrId;
}

bool httpGetJikkou(const char* pasu, String& outouBodei) {
  WiFiClient hc;
  if (!hc.connect(setteiSaabaaIp.c_str(), setteiSaabaaPooto)) return false;
  hc.printf("GET %s HTTP/1.0\r\nHost: %s\r\nConnection: close\r\n\r\n",
            pasu, setteiSaabaaIp.c_str());
  unsigned long t0 = millis();
  while (!hc.available()) {
    if (millis() - t0 > 2000) { hc.stop(); return false; }
    delay(5);
  }
  bool bodeiNai = false;
  outouBodei = "";
  outouBodei.reserve(256);
  while (hc.available() || hc.connected()) {
    String gyou = hc.readStringUntil('\n');
    if (!bodeiNai) {
      if (gyou == "\r" || gyou.length() <= 1) bodeiNai = true;
    } else {
      outouBodei += gyou;
    }
  }
  hc.stop();
  outouBodei.trim();
  return outouBodei.length() > 0;
}

void httpPostJikkou(const char* pasu) {
  WiFiClient hc;
  if (!hc.connect(setteiSaabaaIp.c_str(), setteiSaabaaPooto)) return;
  hc.printf("POST %s HTTP/1.0\r\nHost: %s\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",
            pasu, setteiSaabaaIp.c_str());
  unsigned long t0 = millis();
  while (!hc.available()) {
    if (millis() - t0 > 2000) break;
    delay(5);
  }
  hc.stop();
}

unsigned long saishuDebagguShutsuryokuMs = 0;
const unsigned long DEBAGGU_SHUTSURYOKU_KANKAKU_MS = 10000;

void uebbuhukkuPooringuJikkou() {
  if (WiFi.status() != WL_CONNECTED) {
    if (HTTP_DEBAGGU_SHOUSAI) {
      unsigned long genzai2 = millis();
      if (genzai2 - saishuDebagguShutsuryokuMs > DEBAGGU_SHUTSURYOKU_KANKAKU_MS) {
        saishuDebagguShutsuryokuMs = genzai2;
        Serial.println("[HTTP] Wi-Fi未接続です。待機中...");
      }
    }
    return;
  }

  unsigned long genzai = millis();
  if (genzai - saishuHttpPooringuMs < HTTP_POORINGU_KANKAKU_MS) return;
  saishuHttpPooringuMs = genzai;

  if (setteiJushinQrSuu == 0) {
    if (HTTP_DEBAGGU_SHOUSAI && (genzai - saishuDebagguShutsuryokuMs > DEBAGGU_SHUTSURYOKU_KANKAKU_MS)) {
      saishuDebagguShutsuryokuMs = genzai;
      Serial.println("[HTTP] QRコードが設定されていません。/station/provisioningで再設定してください。");
    }
    return;
  }

  bool debagguJikkou = HTTP_DEBAGGU_SHOUSAI && (genzai - saishuDebagguShutsuryokuMs > DEBAGGU_SHUTSURYOKU_KANKAKU_MS);
  if (debagguJikkou) saishuDebagguShutsuryokuMs = genzai;

  char pooringuPasu[64];
  char risettoPasu[80];
  String outouBodei;
  outouBodei.reserve(256);

  for (int i = 0; i < setteiJushinQrSuu; i++) {
    snprintf(pooringuPasu, sizeof(pooringuPasu), "/iot/%s/%s",
             setteiMashinKoodo.c_str(), setteiJushinQrList[i].c_str());

    if (debagguJikkou) {
      Serial.print("[HTTP] ポーリング中: ");
      Serial.print(setteiSaabaaIp);
      Serial.print(":");
      Serial.print(setteiSaabaaPooto);
      Serial.println(pooringuPasu);
    }

    outouBodei = "";
    if (!httpGetJikkou(pooringuPasu, outouBodei)) {
      if (debagguJikkou) {
        Serial.print("[HTTP] 接続失敗: ");
        Serial.print(setteiSaabaaIp);
        Serial.print(":");
        Serial.println(setteiSaabaaPooto);
      }
      continue;
    }

    StaticJsonDocument<256> doc;
    DeserializationError jsonEraa = deserializeJson(doc, outouBodei);
    if (jsonEraa) {
      if (HTTP_DEBAGGU_SHOUSAI) {
        Serial.print("[HTTP] JSON解析エラー (パス: ");
        Serial.print(pooringuPasu);
        Serial.print("): ");
        Serial.println(jsonEraa.c_str());
      }
      continue;
    }

    bool sukyanZumi = doc["scanned"] | false;

    if (sukyanZumi && !saishuSukyanJoutai[i]) {
      Serial.print("[HTTP] >>> スキャン信号検知 (パス: ");
      Serial.println(pooringuPasu);
      snprintf(risettoPasu, sizeof(risettoPasu), "%s/reset", pooringuPasu);
      httpPostJikkou(risettoPasu);
      Serial.println("[HTTP] リセット信号を送信しました。");
      sukyanShori();
      saishuHttpPooringuMs = millis() + 9000UL;
      Serial.println("[システム] ハードウェア安定化のため9秒間のクールダウンを適用しました。");
      return;
    }

    saishuSukyanJoutai[i] = sukyanZumi;
  }
}

void nettowakuIji() {
  if (!geetoSetteiYomikomiZumi) return;
  wifiZetsuzokuIji();
  uebbuhukkuPooringuJikkou();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(RIREI_PIN, OUTPUT_OPEN_DRAIN);
  digitalWrite(RIREI_PIN, RIREI_KAIJYO);
  rireiButsuriJoutai = RIREI_KAIJYO;

  pinMode(RIMITTO_SUICCHI_PIN, INPUT_PULLUP);
  zenkaiSuicchiJoutai = digitalRead(RIMITTO_SUICCHI_PIN);
  genzaiSuicchiJoutai = zenkaiSuicchiJoutai;
  kouhoJoutai = zenkaiSuicchiJoutai;

  Serial.println("\n=============================================");
  Serial.println("  RISKI Gate v6.4.2 (マルチQR / 日本語化仕様)  ");
  Serial.println("=============================================");

  if (zenkaiSuicchiJoutai == SUICCHI_ON) {
    genzaiJoutai = JOUTAI_SUTANBAI;
    Serial.println("[状態] 準備完了: パレットがスタンバイ位置に検知されています。");
  } else {
    genzaiJoutai = JOUTAI_KARA;
    Serial.println("[状態] 準備完了: パレットは現在外部に出ています。");
  }

  shiriaruSetteiJikkou();
}

void loop() {
  unsigned long genzaiJikoku = millis();

  int yomitori = digitalRead(RIMITTO_SUICCHI_PIN);
  if (yomitori != zenkaiSuicchiJoutai) {
    saishuDebaunsuJikoku = genzaiJikoku;
  }
  if ((genzaiJikoku - saishuDebaunsuJikoku) > DEBAUNSU_CHIEN_MS) {
    if (yomitori != genzaiSuicchiJoutai) {
      genzaiSuicchiJoutai = yomitori;
      kouhoJoutai = yomitori;
      kouhoKaishiJikoku = genzaiJikoku;
      kouhoHoryuuChuu = true;
    }
  }
  zenkaiSuicchiJoutai = yomitori;

  if (kouhoHoryuuChuu) {
    bool genzaiMushiChuu = genzaiJikoku < suicchiMushiKigen;
    if (genzaiMushiChuu) {
      kouhoKaishiJikoku = genzaiJikoku; 
    } else if (genzaiJikoku - kouhoKaishiJikoku >= HIKIDASHI_KAKUNIN_MS) {
      kouhoHoryuuChuu = false;
      kakuteiSuicchiShori(kouhoJoutai);
    }
  }

  if (Serial.available() > 0) {
    String nyuuryoku = Serial.readStringUntil('\n');
    nyuuryoku.trim();
    if (nyuuryoku == "scan" || nyuuryoku == "sukyan") {
      sukyanShori();
    } else if (nyuuryoku.startsWith("{") && nyuuryoku.indexOf("\"cmd\":\"config\"") > 0) {
      StaticJsonDocument<512> doc;
      DeserializationError eraa2 = deserializeJson(doc, nyuuryoku);
      if (!eraa2 && strcmp(doc["cmd"] | "", "config") == 0) {
        String ketsugouQr2 = "";
        JsonArray qrHairetsu2 = doc["listen_qrs"].as<JsonArray>();
        for (JsonVariant v : qrHairetsu2) {
          if (ketsugouQr2.length() > 0) ketsugouQr2 += ",";
          ketsugouQr2 += v.as<String>();
        }

        geetoSettei.begin("gatecfg", false);
        geetoSettei.putString("ssid",    doc["wifi_ssid"]    | "");
        geetoSettei.putString("pass",    doc["wifi_pass"]    | "");
        geetoSettei.putString("srvip",   doc["server_ip"]    | "");
        geetoSettei.putInt("srvport",    doc["port"]          | 4005);
        geetoSettei.putString("mc",      doc["machine_code"] | "");
        geetoSettei.putString("hook",    doc["webhook_path"] | "");
        geetoSettei.putString("qrs",     ketsugouQr2);
        geetoSettei.end();
        Serial.println("[初期設定] 新しい設定を保存しました。再起動します...");
        delay(300);
        ESP.restart();
      }
    } else {
      Serial.println("[警告] 自動システムです。QR/RFIDスキャナーを使用してください。");
    }
  }

  if (rireiParusuKigen > 0 && millis() >= rireiParusuKigen) {
    rireiParusuKigen = 0;
    rireiSettei(RIREI_KAIJYO, "scan pulse expired - relay OFF");
    Serial.println("[リレー] 5秒間のスキャン確認パルス完了。リレーOFF。");
  }

  nettowakuIji();
}

void kakuteiSuicchiShori(int joutai) {
  if (joutai == SUICCHI_OFF) {
    if (genzaiJoutai == JOUTAI_SUTANBAI) {
      joutaiSeni(JOUTAI_ARAAMU, "[警告] パレットが引き出されました。至急スキャンしてください - スキャン待機中。");
    } 
  } 
  else if (joutai == SUICCHI_ON) {
    if (genzaiJoutai == JOUTAI_ARAAMU) {
      Serial.println("[情報] パレットが戻されました(スイッチ押下)。セッション終了にはスキャンが必要です！");
    } 
    else if (genzaiJoutai == JOUTAI_KARA) {
      joutaiSeni(JOUTAI_SUTANBAI, "[情報] パレット検知完了 - システムはスタンバイ状態です。");
    }
  }
}

void sukyanShori() {

  if (genzaiJoutai == JOUTAI_ARAAMU) {
    rireiSettei(RIREI_AKUTIBU, "scan confirmed - 5s pulse start");
    rireiParusuKigen = millis() + RIREI_PARUSU_MS;
    Serial.println("[リレー] スキャン確認。5秒間リレーON (スキャン確認パルス)。");

    if (genzaiSuicchiJoutai == SUICCHI_OFF) {
      joutaiSeni(JOUTAI_KARA, "[成功] スキャン完了。パレットは安全に外部にあります。");
    } else {
      joutaiSeni(JOUTAI_SUTANBAI, "[成功] スキャン完了。システムは初期状態にリセットされました。");
    }
  } 
  else if (genzaiJoutai == JOUTAI_SUTANBAI) {
    Serial.println("[情報] システムはスタンバイ状態です。パレットはまだ引き出されていません。");
  }
  else if (genzaiJoutai == JOUTAI_KARA) {
    Serial.println("[情報] パレットは現在外部にあります。元に戻して(スイッチ押下)から開始してください。");
  }
}

