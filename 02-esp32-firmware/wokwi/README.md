# 🧪 คู่มือการจำลอง ESP32 บน Wokwi Simulator ร่วมกับ Supabase จริง

เอกสารนี้จะพาคุณทดลองรันโค้ด **ESP32 + RFID (RC522) + OLED SSD1306** บนเว็บจำลอง [Wokwi.com](https://wokwi.com) โดยที่ **WiFi, อินเทอร์เน็ต, และฐานข้อมูล Supabase ทั้งหมดเป็นของจริง 100%!**

---

## 🌟 ทำไม Wokwi ถึงต่อกับ Supabase จริงได้?
Wokwi มีระบบจำลอง WiFi Network พิเศษชื่อ **`Wokwi-GUEST`** ซึ่งเชื่อมต่อไปยัง Internet ภายนอกผ่านเกตเวย์ของ Wokwi ทำให้บอร์ด ESP32 ในเบราว์เซอร์ของคุณสามารถยิง HTTPS POST ไปยัง Supabase REST API (`/rest/v1/rpc/handle_rfid_scan`) บนคลาวด์จริงได้โดยตรง!

---

## 📋 ขั้นตอนการเตรียมระบบ (ทำเพียงครั้งเดียว)

### ขั้นตอนที่ 1: เตรียมข้อมูลบัตรจำลองใน Supabase (SQL Editor)
ใน Wokwi ตัวอ่าน RFID (MFRC522) มีบัตรจำลองสำเร็จรูปให้เลือกหลายสี เพื่อให้ Supabase รู้จักบัตรเหล่านี้ ให้รัน SQL ดังนี้:

1. เปิด **Supabase Dashboard** -> เข้าโปรเจกต์ของคุณ
2. ไปที่เมนู **SQL Editor** ทางซ้ายมือ -> กด **New query**
3. คัดลอกโค้ดจากไฟล์ [`seed_wokwi_cards.sql`](file:///Users/muaxzinn/Project/hongsamud/01-supabase-backend/seed_wokwi_cards.sql) ไปวาง แล้วกด **RUN**:
   ```sql
   -- สรุป UID บัตรที่จะถูกลงทะเบียน:
   -- บัตรสมาชิก:
   --   11223344 (Green Card ใน Wokwi) -> สมชาย ใจดี
   --   01020304 (Blue Card ใน Wokwi)  -> สมหญิง รักเรียน
   -- หนังสือ:
   --   55667788 (Yellow Card ใน Wokwi) -> Clean Code
   --   AABBCCDD (Red Card ใน Wokwi)    -> Designing Data-Intensive Applications
   --   C0FFEE99 (Key Fob ใน Wokwi)     -> The Pragmatic Programmer
   ```

---

## 🚀 ขั้นตอนการเปิดโปรเจกต์ใน Wokwi Web

### วิธีที่ 1: สร้างโปรเจกต์ใหม่บน Wokwi.com (ง่ายที่สุด)
1. เปิดเบราว์เซอร์ไปที่: **[https://wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32)**
2. **ใส่โค้ดในแท็บ `sketch.ino`**:
   - เปิดไฟล์ [`02-esp32-firmware/wokwi/sketch.ino`](file:///Users/muaxzinn/Project/hongsamud/02-esp32-firmware/wokwi/sketch.ino)
   - คัดลอกโค้ดทั้งหมดไปวางแทนที่ในแท็บ `sketch.ino` ของ Wokwi
   - แก้ไขบรรทัดที่ 40-41 ใส่ **URL** และ **Anon Key** ของ Supabase คุณ:
     ```cpp
     const char* SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
     const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
     ```
3. **ติดตั้ง Libraries ใน Wokwi**:
   - กดที่แท็บ **Library Manager** (รูปกล่อง หรือกดปุ่ม `+` ในแถบไฟล์แล้วเลือก `libraries.txt`)
   - ใส่รายชื่อไลบรารี 4 ตัวนี้ลงไป (ตามไฟล์ [`libraries.txt`](file:///Users/muaxzinn/Project/hongsamud/02-esp32-firmware/wokwi/libraries.txt)):
     ```text
     MFRC522
     Adafruit SSD1306
     Adafruit GFX Library
     ArduinoJson@6.21.4
     ```
4. **วางผังวงจรในแท็บ `diagram.json`**:
   - กดสลับไปที่แท็บ **diagram.json**
   - คัดลอกเนื้อหาทั้งหมดจากไฟล์ [`02-esp32-firmware/wokwi/diagram.json`](file:///Users/muaxzinn/Project/hongsamud/02-esp32-firmware/wokwi/diagram.json) ไปวางทับทั้งหมด
   - คุณจะเห็นหน้าจอ OLED, เครื่องอ่าน RFID, ลำโพง Buzzer, และไฟ LED สีเขียว/แดง ปรากฏขึ้นบนหน้าจอทันที!

---

## 🎮 วิธีการทดสอบยืม-คืนหนังสือ (Interactive Simulation)

1. กดปุ่ม **Start the simulation** (ปุ่ม Play สีเขียวด้านบน)
2. สังเกตที่หน้าจอ Serial Monitor และจอ OLED:
   - บอร์ดจะเชื่อมต่อ WiFi `Wokwi-GUEST`
   - เมื่อต่อสำเร็จ จอ OLED จะแสดง **READY TO SCAN [TAP CARD]** และมีเสียง Beep ต้อนรับ

### 🟢 ทดสอบที่ 1: การยืมหนังสือ (Borrow Book)
1. **สแกนบัตรสมาชิก**:
   - คลิกที่ตัวอ่าน **RFID RC522** (แผงวงจรสีน้ำเงินด้านซ้าย)
   - กดปุ่ม **`g`** บนคีย์บอร์ด (เลือก Green Card - สมชาย ใจดี)
   - กดปุ่ม **`t`** บนคีย์บอร์ด (หรือกดปุ่ม **Tap** บนหน้าจอ)
   - 🔊 จะได้ยินเสียง Beep สั้น และหน้าจอ OLED จะเปลี่ยนเป็น:
     ```
     STEP 2: BOOK
     User: 11223344
     [TAP BOOK]
     Timeout in 15s...
     ```
2. **สแกนหนังสือ**:
   - กดปุ่ม **`y`** บนคีย์บอร์ด (เลือก Yellow Card - หนังสือ Clean Code)
   - กดปุ่ม **`t`** บนคีย์บอร์ด (หรือกดปุ่ม **Tap**)
3. **ผลลัพธ์**:
   - ESP32 จะยิงคำขอขึ้น **Supabase จริง**
   - จอ OLED แสดงผล:
     ```
     BORROW SUCCESS!
     Book: Clean Code
     To: สมชาย ใจดี (Wokwi Green)
     Due: YYYY-MM-DD
     ```
   - 💡 ไฟ LED สีเขียวติดสว่าง + ลำโพงส่งเสียงสำเร็จสองจังหวะ
   - เข้าไปดูใน Supabase -> Table `transactions` และ `books` จะเห็นสถานะเปลี่ยนเป็น `borrowed` ทันที!
   - หากเปิดหน้า **Web Dashboard** (`npm run dev`) ข้อมูลจะอัปเดตแบบ Realtime ทันที!

---

### 🔄 ทดสอบที่ 2: การคืนหนังสือ (Return Book - Auto Toggle)
1. แตะบัตรสมาชิกสมชายอีกครั้ง: กด **`g`** แล้วกด **`t`**
2. แตะหนังสือ Clean Code ซ้ำอีกครั้ง: กด **`y`** แล้วกด **`t`**
3. **ผลลัพธ์**:
   - ระบบตรวจพบว่าหนังสือเล่มนี้ถูกยืมโดยสมชายอยู่ จึงสลับเป็นการ **"คืนหนังสือ"** อัตโนมัติ!
   - จอ OLED แสดงผล:
     ```
     RETURN SUCCESS!
     Book: Clean Code
     By: สมชาย ใจดี
     Fine: 0 THB (On Time)
     ```
   - หนังสือเปลี่ยนสถานะกลับเป็น `available` ใน Supabase จริง!

---

### 🔴 ทดสอบที่ 3: กรณีเกิดข้อผิดพลาด (Security & Error Handling)
- **กรณีที่ 1 (แตะบัตรสมาชิกซ้ำ)**: แตะบัตรสมชาย (`g` + `t`) แล้วเผลอแตะบัตรสมชายซ้ำอีกรอบ -> ระบบจะส่งเสียงเตือนทุ้มสั้นและไม่ยอมให้ทำรายการ
- **กรณีที่ 2 (หมดเวลา)**: แตะบัตรสมาชิกแล้วปล่อยทิ้งไว้เกิน 15 วินาที -> ระบบจะ Timeout และกลับหน้าหลักอัตโนมัติ
- **กรณีที่ 3 (บัตรไม่ถูกต้อง)**: ลองกด **`n`** (NFC Tag ที่ยังไม่ได้ลงทะเบียน) -> Supabase จะตอบกลับว่าไม่พบบัตร จอ OLED จะแสดง **ERROR / DENIED** และไฟ LED สีแดงจะติดสว่าง!

---

## 📌 ตารางสรุปปุ่มลัดใน Wokwi Simulator

| ปุ่มลัด | ชนิดบัตร / Tag | UID | หน้าที่จำลอง |
|:---:|:---|:---:|:---|
| **`g`** | Green Card | `11223344` | บัตรสมาชิก: นายสมชาย ใจดี |
| **`b`** | Blue Card | `01020304` | บัตรสมาชิก: น.ส.สมหญิง รักเรียน |
| **`y`** | Yellow Card | `55667788` | หนังสือ: Clean Code |
| **`r`** | Red Card | `AABBCCDD` | หนังสือ: Designing Data-Intensive Apps |
| **`k`** | Key Fob | `C0FFEE99` | หนังสือ: The Pragmatic Programmer |
| **`t`** | **Tap Button** | - | แตะบัตรที่เลือกเข้ากับเครื่องอ่าน |
