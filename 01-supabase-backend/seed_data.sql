-- ==============================================================================
-- 📚 SEED DATA FOR SMART LIBRARY SYSTEM (SUPABASE)
-- ข้อมูลตัวอย่างเริ่มต้นสำหรับทดสอบระบบ
-- ==============================================================================

-- 1. เพิ่มหมวดหมู่หนังสือตัวอย่าง
INSERT INTO book_categories (id, name, borrow_duration_days, fine_rate_per_day)
VALUES 
    (1, 'นวนิยายและวรรณกรรม', 7, 5.00),
    (2, 'คอมพิวเตอร์และเทคโนโลยี', 14, 10.00),
    (3, 'วิทยาศาสตร์และดาราศาสตร์', 7, 5.00),
    (4, 'การบริหารธุรกิจและการเงิน', 7, 5.00)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    borrow_duration_days = EXCLUDED.borrow_duration_days,
    fine_rate_per_day = EXCLUDED.fine_rate_per_day;

-- 2. เพิ่มรายชื่อสมาชิกตัวอย่าง
INSERT INTO borrowers (id, full_name, phone, email)
VALUES 
    (1, 'สมชาย ใจดี', '081-234-5678', 'somchai@example.com'),
    (2, 'สมหญิง รักเรียน', '089-876-5432', 'somying@example.com'),
    (3, 'กิตติศักดิ์ พัฒนาการ', '086-111-2233', 'kittisak@example.com')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

-- 3. เพิ่มบัตร RFID และผูกกับสมาชิก
-- หมายเหตุ: เมื่อคุณนำบัตรแข็ง RFID จริงของคุณมาแตะ ให้ดูเลข UID จาก Serial Monitor หรือจอ OLED 
-- แล้วนำมาแทนค่าในฟิลด์ card_uid นี้
INSERT INTO rfid_cards (card_uid, borrower_id, is_active)
VALUES 
    ('USER-CARD-4821', 1, TRUE),
    ('A1B2C3D4', 2, TRUE),
    ('E4F5A6B7', 3, TRUE)
ON CONFLICT (card_uid) DO UPDATE SET is_active = EXCLUDED.is_active;

-- 4. เพิ่มหนังสือตัวอย่าง พร้อมกำหนดทั้ง QR Code และ RFID Tag บนตัวเล่ม
INSERT INTO books (qr_code, rfid_uid, title, author, category_id, status)
VALUES 
    ('BK00001', 'BOOK-RFID-0001', 'Clean Code: A Handbook of Agile Software Craftsmanship', 'Robert C. Martin', 2, 'available'),
    ('BK00002', 'BOOK-RFID-0002', 'Designing Data-Intensive Applications', 'Martin Kleppmann', 2, 'available'),
    ('BK00003', 'BOOK-RFID-0003', 'The Pragmatic Programmer: Your Journey To Mastery', 'David Thomas, Andrew Hunt', 2, 'available'),
    ('BK00004', 'BOOK-RFID-0004', 'เจ้าชายน้อย (The Little Prince)', 'Antoine de Saint-Exupéry', 1, 'available'),
    ('BK00005', 'BOOK-RFID-0005', 'Cosmos: มหัศจรรย์แห่งจักรวาล', 'Carl Sagan', 3, 'available')
ON CONFLICT (qr_code) DO NOTHING;

-- 5. ตัวอย่างรายการยืมในอดีต (เพื่อให้หน้า Web Dashboard มีกราฟและประวัติแสดงผลทันที)
INSERT INTO transactions (
    book_id, borrower_id, rfid_card_id, admin_id, category_snapshot, fine_rate_snapshot, borrowed_at, due_date, returned_at, fine_amount, status
) VALUES 
    (1, 1, 1, NULL, 'คอมพิวเตอร์และเทคโนโลยี', 10.00, NOW() - INTERVAL '3 days', (NOW() + INTERVAL '11 days')::DATE, NULL, 0.00, 'borrowed')
ON CONFLICT DO NOTHING;

-- ปรับสถานะหนังสือเล่ม 1 ให้เป็น borrowed ตามรายการตัวอย่าง
UPDATE books SET status = 'borrowed' WHERE id = 1;
