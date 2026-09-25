# 🌐 โฟลเดอร์ 03: Web Dashboard (Realtime Library Monitor)

โฟลเดอร์นี้รวบรวมไฟล์สำหรับ **หน้าเว็บ Dashboard ระบบห้องสมุดอัจฉริยะ** ซึ่งสร้างขึ้นด้วย HTML5 + Tailwind CSS + Lucide Icons และเชื่อมต่อกับ **Supabase JS Client SDK v2** โดยตรงแบบไร้เซิร์ฟเวอร์ (Client-side Serverless)

---

## 📁 ไฟล์ภายในโฟลเดอร์นี้

| ชื่อไฟล์ | คำอธิบายหน้าที่ |
|---|---|
| [`index.html`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/03-web-dashboard/index.html) | โครงสร้างหน้าเว็บ หน้าจอสถิติ ตาราง Realtime Feed และหน้าต่าง Modal สำหรับเพิ่มข้อมูล |
| [`app.js`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/03-web-dashboard/app.js) | ตรรกะการทำงานฝั่ง JavaScript, การรับข้อมูล Realtime WebSocket และการเรียกใช้ฟังก์ชันฐานข้อมูล |
| [`config.js`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/03-web-dashboard/config.js) | ไฟล์ใส่ค่าคอนฟิกเริ่มต้น `SUPABASE_URL` และ `SUPABASE_ANON_KEY` |

---

## 🌟 ฟังก์ชันการทำงานหลักของหน้าเว็บ

1. **มอนิเตอร์สด (Live Realtime Feed):**
   - ใช้ WebSocket เชื่อมต่อกับ Supabase Realtime
   - เมื่อมีสมาชิกแตะบัตรและหนังสือที่ตู้ ESP32 ข้อมูลจะเด้งขึ้นตารางทันทีในระดับมิลลิวินาที พร้อมเสียงแจ้งเตือนแบบ Web Audio
2. **จัดการคลังหนังสือ (Books Catalog):**
   - แสดงรายชื่อหนังสือทั้งหมด สถานะ (ว่าง / ถูกยืม), ผู้แต่ง
   - มีปุ่ม **"เพิ่มหนังสือใหม่"** พร้อมระบุรหัส QR และเลข RFID Tag ที่แปะบนตัวเล่ม
3. **จัดการสมาชิกและบัตร (Members & RFID):**
   - แสดงรายชื่อสมาชิก เบอร์โทรศัพท์ และเลข UID ของบัตรที่ผูกอยู่
   - มีปุ่ม **"ลงทะเบียนสมาชิกใหม่"** สำหรับบันทึกสมาชิกพร้อมเลข UID ของบัตรแข็ง
4. **เคาน์เตอร์เจ้าหน้าที่ (Manual Desk):**
   - ใช้ในกรณีฉุกเฉิน เช่น สมาชิกไม่ได้นำบัตรมา หรือต้องการทำรายการยืม-คืนผ่านหน้าจอคอมพิวเตอร์

---

## 💻 วิธีการเปิดใช้งานในเครื่องคอมพิวเตอร์ (Local Run)

คุณสามารถเปิดใช้งานหน้าเว็บได้ทันที 2 วิธี:

### วิธีที่ 1: ดับเบิลคลิกเปิดไฟล์ตรงๆ
- ดับเบิลคลิกที่ไฟล์ [`03-web-dashboard/index.html`](file:///Users/muaxzinn/Project/library-system-laravel-code%20%281%29/03-web-dashboard/index.html) เพื่อเปิดผ่าน Google Chrome, Safari, หรือ Edge ได้ทันที

### วิธีที่ 2: รันผ่าน Local Web Server (แนะนำ)
- หากใช้ **VSCode:** คลิกขวาที่ไฟล์ `index.html` แล้วเลือก **"Open with Live Server"**
- หรือรันผ่านคำสั่ง Python ใน Terminal:
  ```bash
  cd "03-web-dashboard"
  python3 -m http.server 8080
  ```
  จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:8080`

---

## ⚙️ การตั้งค่าเชื่อมต่อกับ Supabase

เมื่อเปิดหน้าเว็บขึ้นมาเป็นครั้งแรก:
1. หากมุมขวาบนขึ้นสถานะสีเหลืองว่า **"ยังไม่ได้ตั้งค่า API Key"**
2. ให้กดปุ่ม **"ตั้งค่า API"** บนแถบขวาบน
3. กรอก **Supabase Project URL** และ **anon / public key** ที่คัดลอกมาจาก Supabase Dashboard
4. กดปุ่ม **"บันทึกและเชื่อมต่อ"**
5. สถานะจะเปลี่ยนเป็น **"Supabase เชื่อมต่อสด"** สีเขียว พร้อมดึงข้อมูลมาแสดงผลทันที!

---

## 🚀 การนำหน้าเว็บขึ้น Hosting ฟรี (Vercel, Netlify, GitHub Pages)

หน้าเว็บนี้เป็นแบบ Static Web สามารถนำขึ้นโฮสติ้งฟรีได้ทันทีโดยไม่ต้องตั้งค่าเซิร์ฟเวอร์ Node.js หรือ PHP ใดๆ:

* **Vercel:** ในโฟลเดอร์หลักของโปรเจกต์มีไฟล์ `vercel.json` เตรียมไว้แล้ว เพียงแค่เชื่อมต่อ Git Repo บน Vercel แล้วกด Deploy
* **Netlify:** ลากโฟลเดอร์ `03-web-dashboard` ไปวางที่ [app.netlify.com/drop](https://app.netlify.com/drop) เว็บจะออนไลน์ใน 10 วินาที
* **GitHub Pages:** ไปที่เมนู Settings -> Pages บน GitHub แล้วเลือก Publish จากโฟลเดอร์ที่ต้องการ
*(ดูคู่มือฉบับเต็มอย่างละเอียดในไฟล์ `docs/DEPLOYMENT_GUIDE.md`)*
