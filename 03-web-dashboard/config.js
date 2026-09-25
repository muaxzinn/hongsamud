/**
 * ==============================================================================
 * ⚙️ SUPABASE CONFIGURATION FILE
 * ไฟล์กำหนดค่าการเชื่อมต่อเริ่มต้นสำหรับหน้าเว็บ Dashboard
 * ==============================================================================
 * คุณสามารถนำ Project URL และ anon key จากหน้า Supabase Dashboard 
 * (Project Settings -> API) มาใส่ที่นี่ เพื่อให้หน้าเว็บเชื่อมต่อได้ทันที
 * หรือจะเปิดหน้าเว็บแล้วกดปุ่ม "ตั้งค่า API" บนมุมขวาบนเพื่อบันทึกผ่านหน้าจอก็ได้เช่นกัน
 */

window.DEFAULT_CONFIG = {
  // ใส่ URL ของโปรเจกต์ Supabase เช่น "https://xxxxxxxxxxxx.supabase.co"
  SUPABASE_URL: "https://YOUR_PROJECT_REF.supabase.co",

  // ใส่ anon / public key (รหัสยาวๆ ที่ขึ้นต้นด้วย eyJhbG...)
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
};
