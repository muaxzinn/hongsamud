# 🗄️ โฟลเดอร์ 01: Supabase Backend (Cloud Database & RPC)

โฟลเดอร์นี้รวบรวมไฟล์สำหรับนำไปรันบน **Supabase Cloud** ซึ่งทำหน้าที่เป็น **เซิร์ฟเวอร์ฐานข้อมูลและ Backend อัจฉริยะ (100% Serverless)** ของระบบทั้งหมด โดยที่คุณไม่ต้องเปิดคอมพิวเตอร์ทิ้งไว้เพื่อรันโปรแกรม PHP/Laravel เลยแม้แต่วินาทีเดียว!

---

## 📁 ไฟล์ภายในโฟลเดอร์นี้

| ชื่อไฟล์ | คำอธิบายหน้าที่ |
|---|---|
| [`schema.sql`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/01-supabase-backend/schema.sql) | **(สำคัญที่สุด)** โค้ด SQL สำหรับสร้างตารางทั้งหมด, ดัชนี (Index), ฟังก์ชัน RPC `handle_rfid_scan`, การเปิด Supabase Realtime และสิทธิ์ความปลอดภัย RLS |
| [`seed_data.sql`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/01-supabase-backend/seed_data.sql) | ข้อมูลตัวอย่างเริ่มต้นสำหรับใช้ทดสอบการสแกน (หมวดหมู่, สมาชิก, บัตร RFID, หนังสือ) |

---

## 🛠️ ขั้นตอนการติดตั้งบน Supabase แบบละเอียด (Step-by-Step)

### ขั้นตอนที่ 1: สมัครและสร้างโปรเจกต์ Supabase
1. เข้าไปที่เว็บไซต์ [https://supabase.com](https://supabase.com)
2. กดปุ่ม **"Start your project"** แล้วล็อกอินด้วยบัญชี GitHub หรือ Google
3. ในหน้า Dashboard กดปุ่ม **"New project"**
   - **Organization:** เลือกบัญชีของคุณ
   - **Name:** ตั้งชื่อโปรเจกต์ เช่น `smart-library-system`
   - **Database Password:** ตั้งรหัสผ่านฐานข้อมูล (แนะนำให้ใช้รหัสผ่านที่ปลอดภัย และจดบันทึกไว้)
   - **Region:** แนะนำให้เลือก **Singapore (ap-southeast-1)** เพื่อความเร็วในการเชื่อมต่อที่ต่ำที่สุดจากประเทศไทย
   - **Pricing Plan:** เลือก **Free Tier** (ฟรี 100%)
4. กดปุ่ม **"Create new project"** แล้วรอประมาณ 1 - 2 นาที เพื่อให้ Supabase จัดเตรียมเซิร์ฟเวอร์

---

### ขั้นตอนที่ 2: รันคำสั่ง SQL สร้างโครงสร้างฐานข้อมูล
1. เมื่อโปรเจกต์พร้อมแล้ว ให้ดูเมนูแถบด้านซ้าย คลิกที่ **"SQL Editor"** (ไอคอนรูป `>_`)
2. กดปุ่ม **"New query"** (หรือไอคอนเครื่องหมายบวก `+`)
3. เปิดไฟล์ [`01-supabase-backend/schema.sql`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/01-supabase-backend/schema.sql) คัดลอกโค้ดทั้งหมดมาวางในช่องว่าง
4. กดปุ่ม **"Run"** (สีเขียวขวาล่าง หรือกดคีย์ลัด `Ctrl + Enter` / `Cmd + Enter`)
5. ระบบจะขึ้นข้อความ `Success. No rows returned` แสดงว่าตารางและฟังก์ชันทั้งหมดถูกสร้างเรียบร้อยแล้ว
6. *(แนะนำ)* สร้างหน้า Query ใหม่ นำโค้ดจาก [`01-supabase-backend/seed_data.sql`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/01-supabase-backend/seed_data.sql) ไปวางแล้วกด **"Run"** เพื่อสร้างข้อมูลเริ่มต้นสำหรับทดสอบ

---

### ขั้นตอนที่ 3: ตรวจสอบตารางและคัดลอกค่า API สำหรับอุปกรณ์
1. คลิกเมนู **"Table Editor"** ทางแถบซ้าย คุณจะพบตารางทั้ง 5 ตาราง:
   - `book_categories` : หมวดหมู่หนังสือ
   - `books` : ข้อมูลหนังสือและเลข RFID Tag
   - `borrowers` : รายชื่อสมาชิก
   - `rfid_cards` : บัตร RFID ที่ผูกกับสมาชิก
   - `transactions` : ประวัติการยืม-คืน
2. คลิกเมนู **"Project Settings"** (ไอคอนฟันเฟืองล่างซ้าย) $\rightarrow$ เลือก **"API"**
3. คัดลอกค่าสำคัญ 2 ตัวนี้ไว้:
   - **Project URL:** รูปแบบ `https://xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - **anon / public key:** รหัสยาวๆ ที่ขึ้นต้นด้วย `eyJhbGciOiJIUzI1NiIsIn...`
   *(ค่า 2 ตัวนี้จะถูกนำไปใส่ในโค้ดของ ESP32 และหน้าเว็บ Dashboard)*

---

## 🔍 โครงสร้างและตรรกะของฟังก์ชัน `handle_rfid_scan`

ฟังก์ชันนี้คือหัวใจหลักที่บอร์ด ESP32 จะยิงคำขอเข้ามาทาง HTTPS POST:
`POST https://<project>.supabase.co/rest/v1/rpc/handle_rfid_scan`

### พารามิเตอร์ที่รับเข้า:
```json
{
  "p_user_rfid_uid": "USER-CARD-4821",
  "p_book_rfid_uid": "BOOK-RFID-0001"
}
```

### การทำงานภายใน (Internal Logic):
1. **ค้นหาบัตรสมาชิก (`p_user_rfid_uid`):** หากไม่พบบัตรหรือบัตรถูกปิดใช้งาน จะตอบกลับ Error ทันที
2. **ค้นหาและล็อกแถวหนังสือ (`p_book_rfid_uid`):** ใช้คำสั่ง `SELECT ... FOR UPDATE` เพื่อล็อกแถวหนังสือ ป้องกัน Race Condition ไม่ให้ผู้อื่นยืมหนังสือเล่มเดียวกันในเสี้ยววินาทีเดียวกัน
3. **Auto-Toggle (ยืม/คืน อัตโนมัติ):**
   - **ถ้าสถานะเป็น 'available':**
     - คำนวณวันครบกำหนดส่งคืน (`due_date`) = วันนี้ + จำนวนวันที่ให้ยืมของหมวดหมู่นั้น
     - บันทึกรายการใหม่ลงในตาราง `transactions`
     - เปลี่ยนสถานะหนังสือเป็น `borrowed`
     - ส่ง JSON แจ้งสำเร็จกลับไปให้ ESP32
   - **ถ้าสถานะเป็น 'borrowed':**
     - ตรวจสอบว่าคนที่แตะบัตร เป็นคนเดียวกับที่ยืมไปหรือไม่
     - ถ้าใช่: คำนวณค่าปรับหากส่งคืนเกินกำหนด (`(วันคืน - due_date) * fine_rate`), บันทึกเวลาคืนลง `transactions`, เปลี่ยนสถานะหนังสือกลับเป็น `available`
     - ถ้าไม่ใช่: ส่ง JSON แจ้ง Error ว่าหนังสือเล่มนี้ถูกยืมโดยคนอื่นอยู่
   - **ถ้าสถานะเป็น 'lost' หรือ 'maintenance':** แจ้ง Error งดให้บริการชั่วคราว

---

## 🧪 วิธีทดสอบฟังก์ชันใน Supabase SQL Editor โดยตรง

คุณสามารถทดสอบการทำงานของฟังก์ชันได้ทันทีโดยไม่ต้องต่อบอร์ด ESP32 ด้วยการรันคำสั่ง SQL:

```sql
-- ทดสอบที่ 1: ยืมหนังสือ (สมชาย ใจดี ยืม Clean Code)
SELECT handle_rfid_scan('USER-CARD-4821', 'BOOK-RFID-0001');

-- ทดสอบที่ 2: สแกนซ้ำเพื่อคืนหนังสือเล่มเดิม
SELECT handle_rfid_scan('USER-CARD-4821', 'BOOK-RFID-0001');

-- ทดสอบที่ 3: ทดสอบกรณีบัตรไม่มีในระบบ (จะได้รับ Error)
SELECT handle_rfid_scan('INVALID-CARD-999', 'BOOK-RFID-0001');
```
