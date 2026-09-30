/*
 * ==============================================================================
 * 🚀 SMART LIBRARY SYSTEM — ESP32 + RFID (RC522) + OLED + SUPABASE (WOKWI EDITION)
 * ระบบยืม-คืนหนังสือห้องสมุดอัจฉริยะ จำลองการทำงานบน Wokwi Simulator เชื่อมต่อ Supabase Cloud จริง
 * ==============================================================================
 * 
 * 📌 คำแนะนำสำหรับการทดลองบน Wokwi Simulator:
 * 1. WiFi บน Wokwi จะเชื่อมต่อกับ "Wokwi-GUEST" เสมือนจริงและออก Internet ได้ 100%
 * 2. เปลี่ยนค่า SUPABASE_URL และ SUPABASE_KEY ด้านล่างให้เป็นของโปรเจกต์จริงของคุณ
 * 3. ปุ่มลัดเมื่อคลิกที่ตัวอ่าน RFID (MFRC522):
 *    - กดปุ่ม 'g' แล้วกด 't' : สแกน Green Card (UID: 11223344) -> บัตรสมาชิก
 *    - กดปุ่ม 'y' แล้วกด 't' : สแกน Yellow Card (UID: 55667788) -> หนังสือ Clean Code
 *    - กดปุ่ม 'r' แล้วกด 't' : สแกน Red Card (UID: AABBCCDD) -> หนังสือ Data-Intensive Apps
 *    - กดปุ่ม 'k' แล้วกด 't' : สแกน Key Fob (UID: C0FFEE99) -> หนังสือ The Pragmatic Programmer
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Wire.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ==============================================================================
// 1. ส่วนการตั้งค่าเครือข่าย WiFi (สำหรับ Wokwi Simulator)
// ==============================================================================
// Wokwi จำลอง Access Point พิเศษชื่อ "Wokwi-GUEST" ไม่ต้องใส่รหัสผ่าน
const char* WIFI_SSID     = "Wokwi-GUEST";
const char* WIFI_PASSWORD = "";

// ==============================================================================
// 2. ส่วนการตั้งค่า SUPABASE (Supabase Project Configuration)
// ==============================================================================
// นำค่ามาจาก Supabase Dashboard -> Project Settings -> API
const char* SUPABASE_URL = "https://adejdtyxhgejtteuspwb.supabase.co"; // URL โปรเจกต์ Supabase ของคุณ
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkZWpkdHl4aGdlanR0ZXVzcHdiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAzMzIyMTcsImV4cCI6MjEwNTkwODIxN30.td0BKgaK7Fp0O7waBKc-pXJWhAMZx8cxvMTytEeHX70"; // anon / public key

// ฟังก์ชันสร้าง URL ของ RPC function handle_rfid_scan พร้อมตัด Slash ท้าย และ /rest/v1 ออกอัตโนมัติ
String getRpcEndpoint() {
  String url = String(SUPABASE_URL);
  url.trim();
  while (url.endsWith("/")) {
    url.remove(url.length() - 1);
  }
  if (url.endsWith("/rest/v1")) {
    url.remove(url.length() - 8);
  }
  while (url.endsWith("/")) {
    url.remove(url.length() - 1);
  }
  return url + "/rest/v1/rpc/handle_rfid_scan";
}

// ==============================================================================
// 3. กำหนดขาจอแสดงผล OLED 0.96 นิ้ว (I2C SSD1306)
// ==============================================================================
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT   64
#define OLED_RESET      -1
#define SCREEN_ADDRESS 0x3C   // I2C Address มาตรฐาน (0x3C)

// I2C Pins สำหรับ ESP32: SDA = GPIO 21, SCL = GPIO 22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==============================================================================
// 4. กำหนดขาเครื่องอ่าน RFID RC522 (SPI MFRC522)
// ==============================================================================
// RST = GPIO 4 (ย้ายหลบ I2C SCL GPIO 22 เพื่อไม่ให้ชนกัน)
// SS  = GPIO 5 (Chip Select)
#define RST_PIN          4
#define SS_PIN_USER      5

// SPI Bus Pins มาตรฐานของ ESP32 (VSPI):
// SCK = 18, MISO = 19, MOSI = 23
MFRC522 mfrc522(SS_PIN_USER, RST_PIN);

// ==============================================================================
// 5. กำหนดขาอุปกรณ์แจ้งเตือน (Buzzer & LEDs)
// ==============================================================================
#define BUZZER_PIN      25    // ลำโพง Buzzer
#define LED_GREEN       26    // ไฟสถานะสีเขียว (สำเร็จ)
#define LED_RED         27    // ไฟสถานะสีแดง (ผิดพลาด / ปฏิเสธ)

// ==============================================================================
// 6. ตัวแปรจัดการสถานะของเครื่องสแกน (State Machine)
// ==============================================================================
enum ScannerState {
  STATE_IDLE,                 // หน้าจอหลัก: รอต้อนรับและรอบัตรสมาชิก
  STATE_WAIT_BOOK,            // รับบัตรสมาชิกแล้ว: รอรับการแตะ Tag หนังสือ
  STATE_PROCESSING,           // กำลังส่งข้อมูลขึ้น Supabase
  STATE_RESULT                // แสดงผลลัพธ์การยืมหรือคืน
};

ScannerState currentState = STATE_IDLE;
String scannedUserUID = "";    // เลข UID ของบัตรสมาชิก
String scannedBookUID = "";    // เลข UID ของ Tag หนังสือ
unsigned long userScanTime = 0;
const unsigned long TIMEOUT_MS = 15000; // หมดเวลารอหนังสือ 15 วินาที

// ==============================================================================
// 7. ฟังก์ชันควบคุมสัญญาณเสียงและไฟแสดงสถานะ
// ==============================================================================
void beep(int frequency, int durationMs) {
  tone(BUZZER_PIN, frequency, durationMs);
  delay(durationMs);
  noTone(BUZZER_PIN);
}

void signalSuccess() {
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  beep(1800, 100);
  delay(50);
  beep(2400, 180);
}

void signalError() {
  digitalWrite(LED_RED, HIGH);
  digitalWrite(LED_GREEN, LOW);
  beep(650, 450);
}

void clearSignals() {
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
}

// ==============================================================================
// 8. ฟังก์ชันการวาดหน้าจอแสดงผลบน OLED (UI Display)
// ==============================================================================
void drawHeader(const char* title) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
  display.setCursor(0, 0);
  display.print(" ");
  display.print(title);
  for (int i = strlen(title); i < 20; i++) display.print(" ");
  display.println();
  display.setTextColor(SSD1306_WHITE);
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);
}

void showBootScreen(const char* msg) {
  drawHeader("SMART LIBRARY");
  display.setCursor(0, 18);
  display.setTextSize(1);
  display.println("Connecting WiFi...");
  display.setCursor(0, 32);
  display.println(WIFI_SSID);
  display.setCursor(0, 48);
  display.println(msg);
  display.display();
}

void showIdleScreen() {
  drawHeader("SMART LIBRARY");
  display.setTextSize(1);
  display.setCursor(0, 16);
  display.println("READY TO SCAN");

  display.setCursor(0, 30);
  display.setTextSize(2);
  display.println("[TAP CARD]");

  display.setTextSize(1);
  display.setCursor(0, 52);
  display.print("WiFi: OK  IP: ");
  display.print(WiFi.localIP().toString().substring(0, 11));
  display.display();
}

void showWaitingBookScreen(int remainingSeconds) {
  drawHeader("STEP 2: BOOK");
  display.setTextSize(1);
  display.setCursor(0, 14);
  display.print("User: ");
  display.println(scannedUserUID);

  display.setCursor(0, 28);
  display.setTextSize(2);
  display.println("[TAP BOOK]");

  display.setTextSize(1);
  display.setCursor(0, 52);
  display.printf("Timeout in %ds...", remainingSeconds);
  display.display();
}

void showProcessingScreen() {
  drawHeader("PROCESSING...");
  display.setTextSize(1);
  display.setCursor(0, 22);
  display.println("Contacting Supabase");
  display.setCursor(0, 38);
  display.println("Please wait a moment...");
  display.display();
}

void showBorrowSuccessScreen(const char* title, const char* borrower, const char* dueDate) {
  drawHeader("BORROW SUCCESS!");
  display.setTextSize(1);
  display.setCursor(0, 15);
  display.print("Book: ");
  display.println(title);

  display.setCursor(0, 30);
  display.print("To: ");
  display.println(borrower);

  display.setCursor(0, 46);
  display.print("Due: ");
  display.setTextSize(2);
  display.println(dueDate);
  display.display();
}

void showReturnSuccessScreen(const char* title, const char* borrower, float fine) {
  drawHeader("RETURN SUCCESS!");
  display.setTextSize(1);
  display.setCursor(0, 15);
  display.print("Book: ");
  display.println(title);

  display.setCursor(0, 30);
  display.print("By: ");
  display.println(borrower);

  display.setCursor(0, 48);
  if (fine > 0) {
    display.setTextColor(SSD1306_BLACK, SSD1306_WHITE);
    display.printf(" FINE: %.2f THB ", fine);
    display.setTextColor(SSD1306_WHITE);
  } else {
    display.println("Fine: 0 THB (On Time)");
  }
  display.display();
}

void showErrorScreen(const char* message) {
  drawHeader("ERROR / DENIED");
  display.setTextSize(1);
  display.setCursor(0, 18);
  display.println(message);
  display.setCursor(0, 52);
  display.println("Please try again.");
  display.display();
}

// ==============================================================================
// 9. ฟังก์ชันแปลง UID จาก Byte Array เป็น Hex String
// ==============================================================================
String getUIDString(MFRC522 &mfrc) {
  String uid = "";
  for (byte i = 0; i < mfrc.uid.size; i++) {
    if (mfrc.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ==============================================================================
// 10. ฟังก์ชันเชื่อมต่อเครือข่าย Wi-Fi
// ==============================================================================
void connectWiFi() {
  showBootScreen("Init WiFi...");
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(400);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected!");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    beep(1800, 100);
    showBootScreen("Connected!");
    delay(800);
  } else {
    Serial.println("\nWiFi Connection Failed! Please check SSID/Password.");
    showBootScreen("WiFi Failed!");
    delay(2000);
  }
}

// ==============================================================================
// 11. ฟังก์ชันส่งข้อมูลเข้า SUPABASE RPC VIA HTTPS
// ==============================================================================
void sendScanToSupabase(String userUid, String bookUid) {
  currentState = STATE_PROCESSING;
  showProcessingScreen();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERROR] WiFi not connected. Trying to reconnect...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      signalError();
      showErrorScreen("No WiFi Connection");
      delay(3000);
      return;
    }
  }

  String endpoint = getRpcEndpoint();
  Serial.println("\n-------------------------------------------");
  Serial.println(">>> Sending Scan Request to Supabase <<<");
  Serial.println("Endpoint: " + endpoint);
  Serial.println("User RFID UID : " + userUid);
  Serial.println("Book RFID UID : " + bookUid);

  WiFiClientSecure client;
  client.setInsecure(); // ไม่ตรวจ Fingerprint เพื่อความสะดวกและเสถียรบน ESP32

  HTTPClient https;
  if (!https.begin(client, endpoint)) {
    Serial.println("[ERROR] Unable to connect to Supabase endpoint");
    signalError();
    showErrorScreen("Supabase Unreachable");
    delay(3000);
    return;
  }

  https.addHeader("Content-Type", "application/json");
  https.addHeader("apikey", SUPABASE_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);

  // สร้าง JSON Payload ส่งเข้า Stored Procedure
  StaticJsonDocument<256> reqDoc;
  reqDoc["p_user_rfid_uid"] = userUid;
  reqDoc["p_book_rfid_uid"] = bookUid;

  String reqBody;
  serializeJson(reqDoc, reqBody);

  int httpCode = https.POST(reqBody);
  String response = https.getString();

  Serial.printf("HTTP Code: %d\n", httpCode);
  Serial.println("Response Body: " + response);

  if (httpCode > 0) {
    StaticJsonDocument<512> resDoc;
    DeserializationError error = deserializeJson(resDoc, response);

    if (!error) {
      const char* status = resDoc["status"];
      const char* action = resDoc["action"];
      const char* message = resDoc["message"];

      if (status && strcmp(status, "success") == 0) {
        signalSuccess();
        const char* bookTitle = resDoc["book_title"];
        const char* borrowerName = resDoc["borrower_name"];

        if (action && strcmp(action, "borrowed") == 0) {
          const char* dueDate = resDoc["due_date"];
          Serial.printf(">> [SUCCESS] Borrowed: %s by %s, Due: %s\n", bookTitle, borrowerName, dueDate);
          showBorrowSuccessScreen(bookTitle, borrowerName, dueDate);
        } else if (action && strcmp(action, "returned") == 0) {
          float fine = resDoc["fine_amount"] | 0.0;
          Serial.printf(">> [SUCCESS] Returned: %s by %s, Fine: %.2f THB\n", bookTitle, borrowerName, fine);
          showReturnSuccessScreen(bookTitle, borrowerName, fine);
        }
        delay(4000); // แสดงผลหน้าจอ 4 วินาทีก่อนกลับหน้าหลัก
      } else {
        // กรณี Supabase ตอบกลับ error (เช่น ไม่พบบัตร, หนังสือถูกคนอื่นยืม)
        signalError();
        Serial.printf(">> [ERROR FROM SUPABASE] %s\n", message ? message : "Denied");
        showErrorScreen(message ? message : "Transaction Denied");
        delay(3500);
      }
    } else {
      signalError();
      Serial.println("[ERROR] Failed to parse JSON response");
      showErrorScreen("JSON Parse Error");
      delay(3000);
    }
  } else {
    signalError();
    Serial.printf("[ERROR] HTTP Request Failed, code: %d\n", httpCode);
    showErrorScreen("HTTP Request Failed");
    delay(3000);
  }

  https.end();
  clearSignals();
  Serial.println("-------------------------------------------\n");
}

// ==============================================================================
// 12. SETUP: เริ่มต้นระบบการทำงาน
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=======================================================");
  Serial.println("  ESP32 Smart Library System on WOKWI SIMULATOR  ");
  Serial.println("=======================================================");

  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  clearSignals();

  // 1. เริ่มต้น I2C สำหรับ OLED (SDA=GPIO 21, SCL=GPIO 22)
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("[ERROR] SSD1306 OLED not found at address 0x3C!"));
  } else {
    Serial.println(F("[OK] OLED Display Initialized Successfully."));
    display.clearDisplay();
    display.display();
  }

  // 2. เริ่มต้น SPI สำหรับ RFID (SCK=18, MISO=19, MOSI=23, SS=5)
  SPI.begin(18, 19, 23, SS_PIN_USER);
  mfrc522.PCD_Init();
  Serial.printf("[OK] RFID Reader Initialized (SS Pin: %d, RST Pin: %d)\n", SS_PIN_USER, RST_PIN);

  // 3. เริ่มต้นเชื่อมต่อ WiFi Wokwi-GUEST
  connectWiFi();

  // 4. เข้าสู่สถานะพร้อมทำงาน
  currentState = STATE_IDLE;
  showIdleScreen();
  beep(1500, 100);

  Serial.println("\n>>> พร้อมทำงานแล้ว! รอนำบัตรสมาชิกมาแตะ <<<");
  Serial.println("คำแนะนำการทดสอบใน Wokwi:");
  Serial.println(" 1. คลิกที่เครื่องอ่าน RFID (กล่องสีฟ้า)");
  Serial.println(" 2. กด 'g' แล้วกด 't' เพื่อแตะบัตรสมาชิก (Green Card UID: 11223344)");
  Serial.println(" 3. กด 'y' แล้วกด 't' เพื่อแตะหนังสือ (Yellow Card UID: 55667788)");
  Serial.println("-------------------------------------------------------\n");
}

// ==============================================================================
// 13. MAIN LOOP: วนรอบการทำงานหลัก
// ==============================================================================
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  // จัดการ Timeout เมื่อแตะบัตรสมาชิกแล้วไม่แตะหนังสือใน 15 วินาที
  if (currentState == STATE_WAIT_BOOK) {
    unsigned long elapsed = millis() - userScanTime;
    if (elapsed > TIMEOUT_MS) {
      Serial.println("\n[TIMEOUT] ยกเลิกรายการเนื่องจากไม่มีการแตะหนังสือในเวลาที่กำหนด");
      signalError();
      showErrorScreen("Scan Book Timeout!");
      delay(2000);
      clearSignals();
      currentState = STATE_IDLE;
      scannedUserUID = "";
      scannedBookUID = "";
      showIdleScreen();
      return;
    } else {
      int remainSec = (TIMEOUT_MS - elapsed) / 1000;
      static int lastRemain = -1;
      if (remainSec != lastRemain) {
        lastRemain = remainSec;
        showWaitingBookScreen(remainSec);
      }
    }
  }

  // ตรวจจับการแตะบัตรที่ RC522
  if (!mfrc522.PICC_IsNewCardPresent() || !mfrc522.PICC_ReadCardSerial()) {
    delay(40);
    return;
  }

  String readUid = getUIDString(mfrc522);
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  // จังหวะที่ 1: สแกนบัตรสมาชิก (Member Card)
  if (currentState == STATE_IDLE) {
    scannedUserUID = readUid;
    userScanTime = millis();
    currentState = STATE_WAIT_BOOK;

    Serial.println("\n>> [สแกนจังหวะที่ 1] บัตรสมาชิก: " + scannedUserUID);
    beep(1800, 120);
    showWaitingBookScreen(TIMEOUT_MS / 1000);
    delay(600); // หน่วงเวลาป้องกันสแกนซ้ำ

  // จังหวะที่ 2: สแกน Tag หนังสือ (Book RFID)
  } else if (currentState == STATE_WAIT_BOOK) {
    if (readUid == scannedUserUID) {
      Serial.println(" [เตือน] คุณแตะบัตรสมาชิกใบเดิมซ้ำ กรุณาแตะ Tag ของหนังสือ!");
      beep(750, 200);
      delay(600);
      return;
    }

    scannedBookUID = readUid;
    Serial.println(">> [สแกนจังหวะที่ 2] Tag หนังสือ: " + scannedBookUID);
    beep(1800, 120);

    // ส่งคำขอขึ้น Supabase จริง
    sendScanToSupabase(scannedUserUID, scannedBookUID);

    // เสร็จสิ้นรายการ รีเซ็ตกลับไปหน้าหลัก
    currentState = STATE_IDLE;
    scannedUserUID = "";
    scannedBookUID = "";
    showIdleScreen();
  }
}
