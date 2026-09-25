# 🚀 คู่มือการ Deploy และขึ้นระบบ Cloud อย่างละเอียด (Master Deployment Guide)

คู่มือนี้จัดทำขึ้นเพื่อให้ใครก็ตามที่เปิดโปรเจกต์นี้ สามารถนำโปรเจกต์ไปติดตั้งและเปิดใช้งานจริงบนระบบคลาวด์ระดับโลกได้ฟรี 100% โดยครอบคลุมทั้ง **Supabase Cloud**, **GitHub**, **Vercel** และ **Netlify**

---

## 📑 สารบัญ
1. [การตั้งค่าฐานข้อมูล Supabase Cloud](#1-การตั้งค่าฐานข้อมูล-supabase-cloud)
2. [การนำโค้ดขึ้น GitHub](#2-การนำโค้ดขึ้น-github)
3. [การ Deploy หน้าเว็บบน Vercel (แนะนำที่สุด)](#3-การ-deploy-หน้าเว็บบน-vercel-แนะนำที่สุด)
4. [การ Deploy หน้าเว็บบน Netlify (ทางเลือกแบบลากวาง)](#4-การ-deploy-หน้าเว็บบน-netlify-ทางเลือกแบบลากวาง)
5. [การตั้งค่าและการแฟลชโค้ดลงบอร์ด ESP32](#5-การตั้งค่าและการแฟลชโค้ดลงบอร์ด-esp32)
6. [การทดสอบระบบเชื่อมโยงแบบครบวงจร (End-to-End Test)](#6-การทดสอบระบบเชื่อมโยงแบบครบวงจร-end-to-end-test)

---

## 1. การตั้งค่าฐานข้อมูล Supabase Cloud

Supabase คือหัวใจหลักของระบบที่ทำหน้าที่แทนเซิร์ฟเวอร์แบบเดิมทั้งหมด

1. **สมัครบัญชี:** เข้าไปที่ [https://supabase.com](https://supabase.com) แล้วล็อกอินด้วย GitHub
2. **สร้างโปรเจกต์ใหม่:**
   - กด **"New project"**
   - ตั้งชื่อโปรเจกต์ เช่น `smart-library-system`
   - กำหนดรหัสผ่านฐานข้อมูล (Database Password)
   - เลือก **Region:** `Singapore (ap-southeast-1)` (ใกล้ไทยที่สุด ค่า Ping ต่ำ)
   - เลือก **Pricing Plan:** `Free Tier` แล้วกด **"Create new project"**
3. **ติดตั้งตารางและฟังก์ชัน RPC:**
   - รอ 1-2 นาทีจนหน้า Dashboard พร้อมใช้งาน
   - คลิกเมนู **"SQL Editor"** ทางแถบซ้าย (ไอคอน `>_`)
   - เปิดไฟล์ [`01-supabase-backend/schema.sql`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/01-supabase-backend/schema.sql)
   - คัดลอกโค้ดทั้งหมด วางลงใน SQL Editor แล้วกดปุ่ม **"Run"**
   - เมื่อขึ้นว่า `Success` ให้เปิดหน้าใหม่ แล้วนำโค้ดจาก [`01-supabase-backend/seed_data.sql`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/01-supabase-backend/seed_data.sql) ไปรันต่อเพื่อสร้างข้อมูลตัวอย่างเริ่มต้น
4. **จดบันทึกค่า API:**
   - ไปที่ **Project Settings** (ไอคอนฟันเฟืองล่างซ้าย) $\rightarrow$ **API**
   - คัดลอกค่า:
     - `Project URL` (เช่น `https://xyzabc12345.supabase.co`)
     - `anon / public key` (รหัสยาวๆ)

---

## 2. การนำโค้ดขึ้น GitHub

1. เปิด Terminal ในโฟลเดอร์ของโปรเจกต์:
   ```bash
   cd "/Users/muaxzinn/Project/library-system-laravel-code (1)"
   ```

2. ตรวจสอบและเริ่มต้น Git:
   ```bash
   git init
   git add .
   git commit -m "feat: complete serverless smart library system with supabase and esp32"
   ```

3. สร้าง Repository ใหม่บน GitHub:
   - เข้า [https://github.com/new](https://github.com/new)
   - ตั้งชื่อ เช่น `smart-library-supabase-esp32`
   - เลือก Public หรือ Private ตามความต้องการ
   - กด **Create repository**

4. ส่งโค้ดขึ้น GitHub:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/smart-library-supabase-esp32.git
   git push -u origin main
   ```

---

## 3. การ Deploy หน้าเว็บบน Vercel (แนะนำที่สุด)

Vercel เป็นแพลตฟอร์ม Cloud Hosting ที่มี CDN ทั่วโลก โหลดไว และอัปเดตอัตโนมัติทุกครั้งที่คุณ Push โค้ดขึ้น GitHub

1. เข้าเว็บไซต์ [https://vercel.com](https://vercel.com) แล้วล็อกอินด้วย GitHub
2. กดปุ่ม **"Add New..."** $\rightarrow$ **"Project"**
3. ค้นหา Repository `smart-library-supabase-esp32` แล้วกดปุ่ม **"Import"**
4. ในหน้าตั้งค่าโปรเจกต์ (Configure Project):
   - **Framework Preset:** เลือก `Other`
   - **Root Directory:** ให้เว้นเป็น `./` (เพราะโปรเจกต์มีไฟล์ `vercel.json` ชี้ไปที่โฟลเดอร์ `03-web-dashboard/` ให้อัตโนมัติ)
5. กดปุ่ม **"Deploy"**
   - รอเพียง 15-20 วินาที ระบบจะสร้างโดเมนสดให้คุณทันที เช่น `https://smart-library-supabase-esp32.vercel.app`
6. เปิดหน้าเว็บของคุณ:
   - กดปุ่ม **"ตั้งค่า API"** มุมขวาบน
   - ใส่ `Project URL` และ `anon key` จากขั้นตอนที่ 1 แล้วกดบันทึก หน้าเว็บจะเริ่มดึงข้อมูลสดทันที!

---

## 4. การ Deploy หน้าเว็บบน Netlify (ทางเลือกแบบลากวาง)

หากคุณไม่ต้องการใช้คำสั่ง Git หรือต้องการขึ้นเว็บด่วนภายใน 10 วินาที:

1. เข้าสู่ระบบที่ [https://app.netlify.com](https://app.netlify.com)
2. ไปที่ [https://app.netlify.com/drop](https://app.netlify.com/drop)
3. ลากโฟลเดอร์ **`03-web-dashboard`** จากเครื่องของคุณไปปล่อยในกรอบสี่เหลี่ยมบนหน้าจอ
4. Netlify จะอัปโหลดและเปิดหน้าเว็บสดให้ทันที พร้อมแจกโดเมนฟรี เช่น `https://unique-name-1234.netlify.app`

---

## 5. การตั้งค่าและการแฟลชโค้ดลงบอร์ด ESP32

1. เปิดโปรแกรม **Arduino IDE**
2. ติดตั้งไลบรารี 4 ตัว:
   - `MFRC522`
   - `Adafruit SSD1306`
   - `Adafruit GFX Library`
   - `ArduinoJson`
3. เปิดไฟล์ [`02-esp32-firmware/esp32_library_rfid_supabase.ino`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/02-esp32-firmware/esp32_library_rfid_supabase.ino)
4. ใส่ค่า Wi-Fi และ Supabase URL/Key:
   ```cpp
   const char* WIFI_SSID     = "ชื่อไวไฟของคุณ";
   const char* WIFI_PASSWORD = "รหัสผ่านไวไฟ";

   const char* SUPABASE_URL = "https://your-project-id.supabase.co";
   const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
   ```
5. ต่อสายวงจรตามตารางใน [`02-esp32-firmware/README.md`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/02-esp32-firmware/README.md)
6. เสียบสาย USB เลือกพอร์ตให้ถูกต้อง แล้วกด **Upload**

---

## 6. การทดสอบระบบเชื่อมโยงแบบครบวงจร (End-to-End Test)

1. เปิดหน้าเว็บ Dashboard บน Vercel / Netlify
2. สังเกตที่มุมขวาบนของหน้าเว็บจะต้องขึ้นสถานะ: **"Supabase เชื่อมต่อสด"** (จุดสีเขียว)
3. นำบัตร RFID สมาชิกแตะที่เครื่องอ่าน RC522:
   - จอ OLED จะแสดงผล `[TAP BOOK]` พร้อมมีเสียง Beep 1 ครั้ง
4. นำ Tag RFID หนังสือแตะตาม:
   - จอ OLED จะแสดงผล `PROCESSING...` $\rightarrow$ `BORROW SUCCESS!`
   - มีเสียง Beep 2 ครั้ง และไฟเขียวติดสว่าง
5. **มองดูหน้าเว็บ Dashboard:**
   - รายการยืมจะเด้งขึ้นมาในตารางแบบสดๆ (Realtime) ทันที โดยที่หน้าเว็บไม่ได้รีเฟรชหรือกระพริบเลย!
6. เมื่อนำบัตรเดิมและหนังสือเล่มเดิมมาแตะซ้ำ:
   - จอ OLED จะขึ้น `RETURN SUCCESS!` บันทึกการคืน และคำนวณค่าปรับหากส่งช้าโดยอัตโนมัติ
