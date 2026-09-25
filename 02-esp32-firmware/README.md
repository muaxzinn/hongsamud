# 🔌 โฟลเดอร์ 02: ESP32 Firmware & Hardware (RFID + OLED I2C)

โฟลเดอร์นี้รวบรวมโค้ดและเอกสารสำหรับ **บอร์ด ESP32** ที่เชื่อมต่อกับเครื่องอ่านบัตร **RFID RC522 (MFRC522)** และหน้าจอแสดงผล **OLED 0.96 นิ้ว (I2C SSD1306)** เพื่อทำหน้าที่เป็น **"ตู้สแกนยืม-คืนหนังสืออัจฉริยะ (Smart Kiosk)"**

---

## 📁 ไฟล์ภายในโฟลเดอร์นี้

| ชื่อไฟล์ | คำอธิบายหน้าที่ |
|---|---|
| [`esp32_library_rfid_supabase.ino`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/02-esp32-firmware/esp32_library_rfid_supabase.ino) | **โค้ดหลักของบอร์ด ESP32** เขียนด้วยภาษา Arduino C++ พร้อมคอมเมนต์อธิบายทุกบล็อกคำสั่งอย่างละเอียด |
| [`platformio.ini`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/02-esp32-firmware/platformio.ini) | ไฟล์คอนฟิกและติดตั้งไลบรารีอัตโนมัติ สำหรับผู้ที่ใช้ **PlatformIO (VSCode)** |

---

## 🛠️ รายการอุปกรณ์ที่ต้องใช้ (BOM: Bill of Materials)

1. **บอร์ด ESP32 Dev Module** (30 หรือ 38 ขา) จำนวน 1 บอร์ด
2. **โมดูลอ่านบัตร RFID RC522 (13.56 MHz)** พร้อมบัตร Mifare Classic 1K และสติกเกอร์ Tag หนังสือ จำนวน 1 ชุด
3. **จอแสดงผล OLED 0.96 นิ้ว (SSD1306 I2C 128x64)** สีขาวหรือสีฟ้า จำนวน 1 ตัว
4. **Active Buzzer 5V/3.3V** จำนวน 1 ตัว (สำหรับเสียงเตือน)
5. **หลอด LED สีเขียว และ LED สีแดง** อย่างละ 1 หลอด พร้อมตัวต้านทาน 220Ω อย่างละ 1 ตัว
6. **สายไฟ Breadboard (Jumper Wires)** และโพรโทบอร์ดสำหรับทดลอง

---

## 📌 แผนผังการต่อสายวงจรอย่างละเอียด (Wiring Table)

> [!CAUTION]
> **2 จุดสำคัญที่ต้องระวังเป็นพิเศษ:**
> 1. **แรงดันไฟของ RC522:** ต้องต่อเข้าขา **3V3 (3.3V)** เท่านั้น **ห้ามต่อ 5V เด็ดขาด** เพราะชิป RC522 รองรับสูงสุด 3.3V หากต่อ 5V โมดูลจะไหม้ทันที!
> 2. **ขา SCL ของ OLED และ RST ของ RC522:** บอร์ด ESP32 ใช้ขา **GPIO 22** สำหรับสัญญาณนาฬิกา I2C (SCL) ของจอ OLED ดังนั้นขา **RST ของโมดูล RC522 จึงต้องย้ายมาต่อที่ GPIO 4** เพื่อป้องกันสัญญาณชนกัน

### ตารางการต่อสายวงจร:

| อุปกรณ์ | ขาของอุปกรณ์ | ขาบนบอร์ด ESP32 | คำอธิบายหน้าที่ | สีสายไฟที่แนะนำ |
|---|---|---|---|---|
| **OLED 0.96"** | **VCC** | **3V3 หรือ 5V** | ไฟเลี้ยงจอแสดงผล | แดง |
| *(I2C SSD1306)* | **GND** | **GND** | กราวด์ร่วม | ดำ |
| | **SCL (SCK)** | **GPIO 22** | I2C Clock Pin | เหลือง |
| | **SDA** | **GPIO 21** | I2C Data Pin | น้ำเงิน |
|---|---|---|---|---|
| **RFID RC522** | **3.3V** | **3V3** | **ไฟเลี้ยง (ห้ามต่อ 5V)** | แดง |
| *(SPI MFRC522)* | **RST** | **GPIO 4** | ขา Reset (ย้ายหลบ I2C) | ขาว |
| | **GND** | **GND** | กราวด์ร่วม | ดำ |
| | **IRQ** | *เว้นว่างไว้ (NC)* | ไม่ได้ใช้งาน | - |
| | **MISO** | **GPIO 19** | SPI Data In (Master In) | ม่วง |
| | **MOSI** | **GPIO 23** | SPI Data Out (Master Out)| เขียว |
| | **SCK** | **GPIO 18** | SPI Clock | ส้ม |
| | **SDA (SS)** | **GPIO 5** | SPI Chip Select (Reader 1) | น้ำตาล |
|---|---|---|---|---|
| **สัญญาณเตือน** | **Buzzer (+)** | **GPIO 25** | ขั้วบวก (ขั้วลบต่อ GND) | เหลือง |
| *(อุปกรณ์เสริม)* | **LED เขียว (+)**| **GPIO 26** | ทำรายการสำเร็จ (ต่อ R 220Ω)| เขียว |
| | **LED แดง (+)** | **GPIO 27** | ข้อผิดพลาด (ต่อ R 220Ω) | แดง |

---

## 💻 วิธีการอัปโหลดโค้ดลงบอร์ด

### ทางเลือกที่ 1: ผ่าน Arduino IDE (วิธีมาตรฐาน)
1. เปิดโปรแกรม **Arduino IDE**
2. ติดตั้งบอร์ด ESP32:
   - ไปที่ **File** $\rightarrow$ **Preferences**
   - ในช่อง *Additional boards manager URLs* ให้ใส่ URL:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - ไปที่ **Tools** $\rightarrow$ **Board** $\rightarrow$ **Boards Manager...** ค้นหา `esp32` โดย Espressif Systems แล้วกด **Install**
3. ติดตั้งไลบรารี (ไปที่ **Tools** $\rightarrow$ **Manage Libraries...**):
   - ค้นหาและติดตั้ง `MFRC522` โดย GithubCommunity
   - ค้นหาและติดตั้ง `Adafruit SSD1306` โดย Adafruit
   - ค้นหาและติดตั้ง `Adafruit GFX Library` โดย Adafruit
   - ค้นหาและติดตั้ง `ArduinoJson` โดย Benoit Blanchon (เวอร์ชัน 6 หรือ 7)
4. เปิดไฟล์ [`esp32_library_rfid_supabase.ino`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/02-esp32-firmware/esp32_library_rfid_supabase.ino)
5. แก้ไขชื่อไวไฟและคีย์ Supabase:
   ```cpp
   const char* WIFI_SSID     = "ชื่อไวไฟของคุณ";
   const char* WIFI_PASSWORD = "รหัสผ่านไวไฟ";

   const char* SUPABASE_URL = "https://your-project.supabase.co";
   const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   ```
6. ไปที่เมนู **Tools**:
   - Board: เลือก **ESP32 Dev Module**
   - Upload Speed: **921600** (หรือ 115200)
   - Port: เลือกพอร์ต COM / USB Serial ของบอร์ด ESP32
7. กดปุ่ม **Upload** (ลูกศรชี้ขวา) แล้วรอจนขึ้นข้อความ `Done uploading.`

---

### ทางเลือกที่ 2: ผ่าน PlatformIO บน VSCode
1. เปิดโปรแกรม Visual Studio Code ที่ติดตั้งส่วนขยาย PlatformIO IDE แล้ว
2. เปิดโฟลเดอร์ `02-esp32-firmware`
3. PlatformIO จะอ่านไฟล์ `platformio.ini` และดาวน์โหลดไลบรารีให้อัตโนมัติ
4. แก้ไข SSID และ Supabase URL ในไฟล์ `esp32_library_rfid_supabase.ino`
5. กดปุ่ม **Upload** (ลูกศรขวาล่างแถบสีฟ้า) เพื่อคอมไพล์และอัปโหลดทันที

---

## 📟 ขั้นตอนและแอนิเมชันบนหน้าจอ OLED

```
+------------------+      แตะบัตรสมาชิก       +------------------+
| SMART LIBRARY    |   ==================>   | STEP 2: BOOK     |
| READY TO SCAN    |                         | User: USER-4821  |
|   [TAP CARD]     |                         |   [TAP BOOK]     |
| WiFi: OK IP:...  |                         | Timeout in 15s...|
+------------------+                         +------------------+
         ▲                                             │
         │ แตะบัตรสำเร็จ หรือหมดเวลา                     │ แตะ Tag หนังสือ
         │                                             ▼
+------------------+      แสดงผล 4 วินาที     +------------------+
| BORROW SUCCESS!  |   <==================   | PROCESSING...    |
| Book: Clean Code |                         | Contacting Cloud |
| To: Somchai      |                         | Please wait...   |
| Due: 2026-10-02  |                         +------------------+
+------------------+
```

---

## ❓ คำถามและวิธีแก้ปัญหาที่พบบ่อย (Troubleshooting)

### 1. หน้าจอ OLED มืดสนิท ไม่มีภาพขึ้น
- **ตรวจสอบสาย:** ตรวจดูว่าสาย SDA ต่อที่ GPIO 21 และสาย SCL ต่อที่ GPIO 22 หรือไม่
- **ตรวจสอบ I2C Address:** หน้าจอส่วนใหญ่ใช้แอดเดรส `0x3C` แต่บางรุ่นราคาประหยัดใช้ `0x3D` ให้ลองเปลี่ยนบรรทัด `#define SCREEN_ADDRESS 0x3D`

### 2. แตะบัตร RFID แล้วไม่มีเสียง Beep และไม่มีอะไรเกิดขึ้น
- **ตรวจสอบแรงดันไฟ:** ตรวจสอบว่าโมดูล RC522 ได้รับไฟ 3.3V ที่เพียงพอหรือไม่
- **ตรวจสอบขา RST:** ย้ำว่าขา RST ต้องต่อที่ **GPIO 4** ตามโค้ดนี้
- **ตรวจสอบชนิดของบัตร:** โมดูล RC522 รองรับเฉพาะบัตรคลื่นความถี่ **13.56 MHz (Mifare Classic)** ไม่รองรับบัตรคอนโด/คีย์การ์ดความถี่ต่ำ 125 kHz (EM4100)

### 3. ขึ้นหน้าจอ "Supabase Unreachable" หรือ "WiFi Failed"
- ESP32 รองรับเฉพาะ Wi-Fi คลื่น **2.4 GHz** เท่านั้น กรุณาเชื่อมต่อกับสัญญาณ 2.4 GHz (ไม่รองรับ 5 GHz)
- ตรวจสอบ URL และ Key ในโค้ดว่าถูกต้องและไม่มีเครื่องหมายเว้นวรรคแปลกปลอม
