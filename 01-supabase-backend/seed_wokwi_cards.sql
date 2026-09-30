-- ==============================================================================
-- 🧪 SEED DATA FOR WOKWI SIMULATOR RFID CARDS & BOOKS
-- สคริปต์ลงทะเบียน UID สำหรับทดสอบใน Wokwi Simulator ร่วมกับ Supabase จริง
-- วิธีใช้: คัดลอกโค้ดทั้งหมดนี้ไปวางใน Supabase Dashboard -> SQL Editor แล้วกด RUN
-- ==============================================================================

-- 1. เพิ่ม/อัปเดตสมาชิกตัวอย่างสำหรับทดสอบบน Wokwi
INSERT INTO borrowers (id, full_name, phone, email)
VALUES 
    (1, 'สมชาย ใจดี (Wokwi Green)', '081-234-5678', 'somchai@wokwi.test'),
    (2, 'สมหญิง รักเรียน (Wokwi Blue)', '089-876-5432', 'somying@wokwi.test')
ON CONFLICT (id) DO UPDATE SET 
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

-- 2. ลงทะเบียน UID บัตรสมาชิกของ Wokwi Simulator
-- ใน Wokwi Simulator มีปุ่มลัดสำหรับเลือกบัตร:
-- [g] = Green Card  -> UID: '11223344' (จำลองเป็นบัตรของสมชาย)
-- [b] = Blue Card   -> UID: '01020304' (จำลองเป็นบัตรของสมหญิง)
INSERT INTO rfid_cards (card_uid, borrower_id, is_active)
VALUES 
    ('11223344', 1, TRUE),
    ('01020304', 2, TRUE)
ON CONFLICT (card_uid) DO UPDATE SET 
    borrower_id = EXCLUDED.borrower_id,
    is_active = TRUE;

-- 3. ลงทะเบียน UID หนังสือสำหรับ Wokwi Simulator
-- ใน Wokwi Simulator:
-- [y] = Yellow Card -> UID: '55667788'
-- [r] = Red Card    -> UID: 'AABBCCDD'
-- [k] = Key Fob     -> UID: 'C0FFEE99'
INSERT INTO books (qr_code, rfid_uid, title, author, category_id, status)
VALUES 
    ('WOKWI-BK01', '55667788', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 2, 'available'),
    ('WOKWI-BK02', 'AABBCCDD', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 2, 'available'),
    ('WOKWI-BK03', 'C0FFEE99', 'The Pragmatic Programmer: Your Journey To Mastery', 'David Thomas, Andrew Hunt', 2, 'available')
ON CONFLICT (qr_code) DO UPDATE SET 
    rfid_uid = EXCLUDED.rfid_uid,
    title = EXCLUDED.title,
    status = 'available';

-- 4. แสดงผลยืนยันการตั้งค่า
SELECT 'Wokwi RFID Cards & Books registered successfully!' AS status,
       'Member Card 1: 11223344 (Green Card)' AS member_1,
       'Member Card 2: 01020304 (Blue Card)' AS member_2,
       'Book 1: 55667788 (Yellow Card)' AS book_1,
       'Book 2: AABBCCDD (Red Card)' AS book_2,
       'Book 3: C0FFEE99 (Key Fob)' AS book_3;
