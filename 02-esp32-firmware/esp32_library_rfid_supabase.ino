/*
 * ==============================================================================
 * 🚀 SMART LIBRARY SYSTEM — ESP32 + RFID (RC522) + OLED (SSD1306 I2C) + SUPABASE
 * ระบบยืม-คืนหนังสือห้องสมุดอัจฉริยะแบบ Serverless เชื่อมต่อตรงกับ Supabase Cloud
 * ==============================================================================
 * 
 * 📌 คุณสมบัติของเฟิร์มแวร์นี้:
 * 1. ควบคุมเครื่องอ่าน RFID (RC522) ผ่านบัส SPI มาตรฐาน
 * 2. แสดงผลผ่านหน้าจอ OLED 0.96 นิ้ว (SSD1306) ผ่านบัส I2C พร้อมแอนิเมชันและเลขนับถอยหลัง
 * 3. มีระบบสแกน 2 จังหวะ (Single Reader Mode):
 *    - จังหวะที่ 1: แตะบัตรสมาชิกห้องสมุด (Member Card) -> มีเสียง Beep สั้น ยืนยันการอ่าน
 *    - จังหวะที่ 2: แตะ Tag RFID บนตัวเล่มหนังสือ (Book Tag) -> ส่งคำขอขึ้น Supabase ทันที
 * 4. ยิงคำขอผ่าน HTTPS ไปยัง Supabase Stored Procedure (RPC) `handle_rfid_scan`
 * 5. ระบบตัดสินใจอัตโนมัติ (Auto-Toggle): หากหนังสือว่างจะทำการ "ยืม", หากถูกยืมอยู่จะทำการ "คืน"
 * 6. มีเสียงสัญญาณ Buzzer และไฟสถานะ LED เขียว/แดง แยกกรณีทำรายการสำเร็จและล้มเหลว
 * 
 * 📦 ไลบรารีที่จำเป็นสำหรับติดตั้งใน Arduino IDE:
 * 1. MFRC522 by GithubCommunity (v1.4.10 ขึ้นไป)
 * 2. Adafruit SSD1306 by Adafruit (v2.5.7 ขึ้นไป)
 * 3. Adafruit GFX Library by Adafruit
 * 4. ArduinoJson by Benoit Blanchon (เวอร์ชัน 6 หรือ 7)
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
// 1. ส่วนการตั้งค่าเครือข่าย WiFi (Wi-Fi Configuration)
// ==============================================================================
// หมายเหตุ: ESP32 รองรับคลื่นความถี่ 2.4 GHz เท่านั้น (ไม่รองรับ 5 GHz)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";         // ใส่ชื่อไวไฟของคุณ
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";     // ใส่รหัสผ่านไวไฟของคุณ

// ==============================================================================
// 2. ส่วนการตั้งค่า SUPABASE (Supabase Project Configuration)
// ==============================================================================
// นำค่ามาจากหน้า Supabase Dashboard -> Project Settings -> API
const char* SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co"; // URL โปรเจกต์ของคุณ
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY..."; // anon / public key

// Endpoint ของ RPC function handle_rfid_scan
// รูปแบบมาตรฐาน: https://<project>.supabase.co/rest/v1/rpc/handle_rfid_scan
String rpcEndpoint = String(SUPABASE_URL) + "/rest/v1/rpc/handle_rfid_scan";

// ==============================================================================
// 3. การกำหนดขาเชื่อมต่อจอแสดงผล OLED 0.96 นิ้ว (I2C SSD1306)
// ==============================================================================
#define SCREEN_WIDTH   128    // ความกว้างของจอ OLED (พิกเซล)
#define SCREEN_HEIGHT   64    // ความสูงของจอ OLED (พิกเซล)
#define OLED_RESET      -1    // ใช้ -1 หากจอ OLED ไม่มีขา Reset แยกต่างหาก
#define SCREEN_ADDRESS 0x3C   // I2C Address มาตรฐาน (จอ 0.96" ส่วนใหญ่เป็น 0x3C, บางรุ่นเป็น 0x3D)

// I2C Pins สำหรับ ESP32:
// SDA = GPIO 21
// SCL = GPIO 22
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==============================================================================
// 4. การกำหนดขาเชื่อมต่อเครื่องอ่าน RFID RC522 (SPI MFRC522)
// ==============================================================================
// ⚠️ ข้อควรระวัง: บัส I2C ใช้ขา GPIO 22 เป็น SCL ไปแล้ว 
// ดังนั้น ขา RST ของ RC522 จึงถูกย้ายมาใช้ GPIO 4 เพื่อป้องกันสัญญาณชนกัน!
#define RST_PIN          4    // ขา Reset ของโมดูล RC522 (ย้ายหลบ I2C SCL)
#define SS_PIN_USER      5    // ขา SS / SDA ของโมดูล RC522 (ตัวหลัก / บัตรสมาชิก)
#define SS_PIN_BOOK     14    // ขา SS ของ RC522 ตัวที่สอง (ใช้เฉพาะกรณีเปิด DUAL_READER_MODE)

// SPI Bus Pins มาตรฐานของ ESP32 (VSPI):
// SCK  = GPIO 18
// MISO = GPIO 19
// MOSI = GPIO 23
MFRC522 mfrc522User(SS_PIN_USER, RST_PIN);
MFRC522 mfrc522Book(SS_PIN_BOOK, RST_PIN);

// ==============================================================================
// 5. การกำหนดขาอุปกรณ์แจ้งเตือน (Buzzer & LEDs)
// ==============================================================================
#define BUZZER_PIN      25    // ขาต่อลำโพง Buzzer แจ้งเตือนเสียง
#define LED_GREEN       26    // ไฟสถานะสีเขียว: สแกนผ่าน / ยืม-คืนสำเร็จ
#define LED_RED         27    // ไฟสถานะสีแดง: เกิดข้อผิดพลาด / บัตรไม่ถูกต้อง

// โหมดการทำงานของเครื่องอ่าน:
// false = ใช้ตัวอ่าน RC522 ตัวเดียว สแกน 2 จังหวะ (แตะบัตรสมาชิก -> แตะหนังสือ) [แนะนำมากที่สุด]
// true  = ใช้ตัวอ่าน RC522 สองตัวพร้อมกันบนบัส SPI เดียวกัน
const bool DUAL_READER_MODE = false;

// ==============================================================================
// 6. ตัวแปรจัดการสถานะของเครื่องสแกน (State Machine)
// ==============================================================================
enum ScannerState {
  STATE_IDLE,                 // หน้าจอหลัก: รอต้อนรับและรอบัตรสมาชิก
  STATE_WAIT_BOOK,            // รับบัตรสมาชิกแล้ว: รอรับการแตะ Tag หนังสือ
  STATE_PROCESSING,           // กำลังส่งข้อมูลขึ้น Supabase และรอการตอบกลับ
  STATE_RESULT                // แสดงผลลัพธ์การยืมหรือคืน
};

ScannerState currentState = STATE_IDLE;
String scannedUserUID = "";    // เลข UID ของบัตรสมาชิก
String scannedBookUID = "";    // เลข UID ของ Tag หนังสือ
unsigned long userScanTime = 0;
const unsigned long TIMEOUT_MS = 15000; // หากแตะบัตรสมาชิกแล้วไม่แตะหนังสือใน 15 วินาที จะรีเซ็ตกลับหน้าแรก

// ==============================================================================
// 7. ฟังก์ชันควบคุมสัญญาณเสียงและไฟแสดงสถานะ
// ==============================================================================
void beep(int frequency, int durationMs) {
  tone(BUZZER_PIN, frequency, durationMs);
  delay(durationMs);
  noTone(BUZZER_PIN);
}

// สัญญาณเมื่อทำรายการสำเร็จ (ไฟเขียวติด + เสียง Beep สองจังหวะ)
void signalSuccess() {
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_RED, LOW);
  beep(1800, 100);
  delay(50);
  beep(2400, 180);
}

// สัญญาณเมื่อเกิดข้อผิดพลาด (ไฟแดงติด + เสียง Beep ทุ้มยาว)
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
// 8. ฟังก์ชันการวาดหน้าจอแสดงผลบน OLED (UI Display Functions)
// ==============================================================================

// วาดแถบหัวข้อด้านบนของจอ
void drawHeader(const char* title) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_BLACK, SSD1306_WHITE); // ตัวหนังสือดำ แถบพื้นขาว
  display.setCursor(0, 0);
  display.print(" ");
  display.print(title);
  for (int i = strlen(title); i < 20; i++) display.print(" ");
  display.println();
  display.setTextColor(SSD1306_WHITE);
  display.drawFastHLine(0, 10, 128, SSD1306_WHITE);
}

// หน้าจอบูตระบบและเชื่อมต่อ Wi-Fi
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

// หน้าจอปกติ (พร้อมให้สมาชิกแตะบัตร)
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

// หน้าจอขั้นตอนที่ 2: รอนำหนังสือมาแตะ
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

// หน้าจอกำลังประมวลผลคำขอ
void showProcessingScreen() {
  drawHeader("PROCESSING...");
  display.setTextSize(1);
  display.setCursor(0, 22);
  display.println("Contacting Supabase");
  display.setCursor(0, 38);
  display.println("Please wait a moment...");
  display.display();
}

// หน้าจอทำรายการ "ยืม" สำเร็จ
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

// หน้าจอทำรายการ "คืน" สำเร็จ
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

// หน้าจอแสดงข้อผิดพลาด
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
  uid.toUpperCase(); // แปลงเป็นตัวพิมพ์ใหญ่ เช่น "A1B2C3D4"
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

  Serial.println("\n-------------------------------------------");
  Serial.println(">>> Sending Scan Request to Supabase <<<");
  Serial.println("User RFID UID : " + userUid);
  Serial.println("Book RFID UID : " + bookUid);

  WiFiClientSecure client;
  client.setInsecure(); // ไม่ตรวจ Root CA Fingerprint เพื่อความเสถียรและสะดวกบน ESP32

  HTTPClient https;
  if (!https.begin(client, rpcEndpoint)) {
    Serial.println("[ERROR] Unable to connect to Supabase endpoint");
    signalError();
    showErrorScreen("Supabase Unreachable");
    delay(3000);
    return;
  }

  // กำหนด Header สำหรับ Supabase PostgREST RPC
  https.addHeader("Content-Type", "application/json");
  https.addHeader("apikey", SUPABASE_KEY);
  https.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);

  // สร้าง JSON Payload ส่งเข้า parameter p_user_rfid_uid และ p_book_rfid_uid
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
          showBorrowSuccessScreen(bookTitle, borrowerName, dueDate);
        } else if (action && strcmp(action, "returned") == 0) {
          float fine = resDoc["fine_amount"] | 0.0;
          showReturnSuccessScreen(bookTitle, borrowerName, fine);
        }
        delay(4000); // แสดงผลหน้าจอค้างไว้ 4 วินาทีก่อนกลับหน้าหลัก
      } else {
        // กรณี Supabase ตอบกลับสถานะ error
        signalError();
        showErrorScreen(message ? message : "Transaction Denied");
        delay(3500);
      }
    } else {
      signalError();
      showErrorScreen("JSON Parse Error");
      delay(3000);
    }
  } else {
    signalError();
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
  Serial.println("  ESP32 Smart Library System with OLED & Supabase Cloud  ");
  Serial.println("=======================================================");

  // กำหนดโหมดขา Output
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  clearSignals();

  // 1. เริ่มต้นบัส I2C สำหรับจอ OLED (SDA=GPIO 21, SCL=GPIO 22)
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("[ERROR] SSD1306 OLED not found at address 0x3C!"));
  } else {
    Serial.println(F("OLED Display Initialized Successfully."));
    display.clearDisplay();
    display.display();
  }

  // 2. เริ่มต้นบัส SPI สำหรับเครื่องอ่าน RFID (SCK=18, MISO=19, MOSI=23, SS=5)
  SPI.begin(18, 19, 23, SS_PIN_USER);
  mfrc522User.PCD_Init();
  Serial.printf("RFID Reader 1 Initialized (SS Pin: %d, RST Pin: %d)\n", SS_PIN_USER, RST_PIN);

  if (DUAL_READER_MODE) {
    mfrc522Book.PCD_Init();
    Serial.printf("RFID Reader 2 Initialized (SS Pin: %d)\n", SS_PIN_BOOK);
  }

  // 3. เริ่มต้นเชื่อมต่อ Wi-Fi
  connectWiFi();

  // 4. เข้าสู่สถานะพร้อมทำงาน
  currentState = STATE_IDLE;
  showIdleScreen();
  beep(1500, 100);
  Serial.println("Ready! Waiting for member card scan...");
}

// ==============================================================================
// 13. MAIN LOOP: วนรอบการทำงานหลัก
// ==============================================================================
void loop() {
  // ตรวจสอบการเชื่อมต่อ Wi-Fi อย่างสม่ำเสมอ
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    return;
  }

  // -------------------------------------------------------------
  // โหมดที่ 1: SINGLE READER MODE (สแกน 2 จังหวะ: บัตรสมาชิก -> หนังสือ)
  // -------------------------------------------------------------
  if (!DUAL_READER_MODE) {
    // ตรวจจับ Timeout: ถ้าแตะบัตรสมาชิกแล้ว ไม่ยอมแตะหนังสือภายใน 15 วินาที
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
        // อัปเดตเวลานับถอยหลังบนหน้าจอ OLED
        int remainSec = (TIMEOUT_MS - elapsed) / 1000;
        static int lastRemain = -1;
        if (remainSec != lastRemain) {
          lastRemain = remainSec;
          showWaitingBookScreen(remainSec);
        }
      }
    }

    // ตรวจสอบว่ามีบัตรมาแตะที่ Reader หรือไม่
    if (!mfrc522User.PICC_IsNewCardPresent() || !mfrc522User.PICC_ReadCardSerial()) {
      delay(40);
      return;
    }

    String readUid = getUIDString(mfrc522User);
    mfrc522User.PICC_HaltA();
    mfrc522User.PCD_StopCrypto1();

    // จังหวะที่ 1: สแกนบัตรสมาชิก (Member Card)
    if (currentState == STATE_IDLE) {
      scannedUserUID = readUid;
      userScanTime = millis();
      currentState = STATE_WAIT_BOOK;

      Serial.println("\n>> บัตรสมาชิกที่อ่านได้: " + scannedUserUID);
      beep(1800, 120);
      showWaitingBookScreen(TIMEOUT_MS / 1000);
      delay(600); // หน่วงเวลาป้องกันสแกนบัตรใบเดิมซ้ำ

    // จังหวะที่ 2: สแกน Tag หนังสือ (Book RFID)
    } else if (currentState == STATE_WAIT_BOOK) {
      // ตรวจสอบกรณีเผลอแตะบัตรสมาชิกใบเดิมซ้ำ
      if (readUid == scannedUserUID) {
        Serial.println(" [เตือน] คุณแตะบัตรสมาชิกใบเดิมซ้ำ กรุณาแตะ Tag ของหนังสือ!");
        beep(750, 200);
        delay(600);
        return;
      }

      scannedBookUID = readUid;
      Serial.println(">> Tag หนังสือที่อ่านได้: " + scannedBookUID);
      beep(1800, 120);

      // ยิงข้อมูลขึ้น Supabase
      sendScanToSupabase(scannedUserUID, scannedBookUID);

      // เสร็จสิ้นขั้นตอน รีเซ็ตกลับไปรอรับผู้ใช้คนถัดไป
      currentState = STATE_IDLE;
      scannedUserUID = "";
      scannedBookUID = "";
      showIdleScreen();
    }
  }

  // -------------------------------------------------------------
  // โหมดที่ 2: DUAL READER MODE (มีตัวอ่าน 2 ตัวทำงานแยกกัน)
  // -------------------------------------------------------------
  else {
    if (mfrc522User.PICC_IsNewCardPresent() && mfrc522User.PICC_ReadCardSerial()) {
      scannedUserUID = getUIDString(mfrc522User);
      mfrc522User.PICC_HaltA();
      mfrc522User.PCD_StopCrypto1();
      Serial.println(">> Reader 1 (Member): " + scannedUserUID);
      beep(1800, 60);
    }

    if (mfrc522Book.PICC_IsNewCardPresent() && mfrc522Book.PICC_ReadCardSerial()) {
      scannedBookUID = getUIDString(mfrc522Book);
      mfrc522Book.PICC_HaltA();
      mfrc522Book.PCD_StopCrypto1();
      Serial.println(">> Reader 2 (Book): " + scannedBookUID);
      beep(2200, 60);
    }

    if (scannedUserUID.length() > 0 && scannedBookUID.length() > 0) {
      sendScanToSupabase(scannedUserUID, scannedBookUID);
      scannedUserUID = "";
      scannedBookUID = "";
      showIdleScreen();
      delay(1500);
    }

    delay(80);
  }
}
