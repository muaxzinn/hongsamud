-- ==============================================================================
-- 📚 SMART LIBRARY SYSTEM — SUPABASE DATABASE SCHEMA & FUNCTIONS
-- ระบบฐานข้อมูลและฟังก์ชันจัดการยืม-คืนหนังสือสำหรับ Supabase (PostgreSQL)
-- ==============================================================================
-- เอกสารนี้ประกอบด้วย:
-- 1. ตารางข้อมูลทั้งหมด (book_categories, books, borrowers, rfid_cards, transactions)
-- 2. ดัชนี (Indexes) เพื่อการค้นหา UID ที่รวดเร็วในระดับมิลลิวินาที
-- 3. ฟังก์ชัน RPC หลักสำหรับ ESP32 (handle_rfid_scan) พร้อมระบบป้องกัน Race Condition
-- 4. ฟังก์ชัน RPC สำหรับเคาน์เตอร์เจ้าหน้าที่ (admin_borrow_book, admin_return_book)
-- 5. การเปิดใช้งาน Supabase Realtime เพื่อแสดงผลสดบน Web Dashboard
-- 6. การกำหนดสิทธิ์ความปลอดภัย (Row Level Security & Policies)
-- ==============================================================================

-- ==============================================================================
-- ส่วนที่ 1: การสร้างตารางฐานข้อมูล (Tables Definition)
-- ==============================================================================

-- 1.1 ตารางหมวดหมู่หนังสือ (Book Categories)
-- ใช้กำหนดระยะเวลาที่อนุญาตให้ยืม และอัตราค่าปรับต่อวันของหนังสือแต่ละประเภท
CREATE TABLE IF NOT EXISTS book_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,                                 -- ชื่อหมวดหมู่ เช่น นวนิยาย, เทคโนโลยี
    borrow_duration_days INTEGER NOT NULL DEFAULT 7,            -- จำนวนวันที่ให้ยืมได้ (ค่าเริ่มต้น 7 วัน)
    fine_rate_per_day NUMERIC(10, 2) NOT NULL DEFAULT 0.00,     -- อัตราค่าปรับต่อวันกรณีส่งช้า (บาท/วัน)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 ตารางข้อมูลหนังสือ (Books)
-- รองรับทั้งรหัส QR Code (สำหรับแอดมินยิงบาร์โค้ด) และ RFID UID (Tag สติกเกอร์ที่แปะบนเล่ม)
CREATE TABLE IF NOT EXISTS books (
    id BIGSERIAL PRIMARY KEY,
    qr_code VARCHAR(100) UNIQUE NOT NULL,                       -- รหัส QR/Barcode ประจำเล่ม เช่น BK00001
    rfid_uid VARCHAR(100) UNIQUE,                              -- เลข UID ของ RFID Tag ที่แปะบนตัวเล่มจริง
    isbn VARCHAR(20),                                           -- เลข ISBN มาตรฐานสากล (ถ้ามี)
    title TEXT NOT NULL,                                        -- ชื่อหนังสือ
    author TEXT,                                                -- ชื่อผู้แต่ง / ผู้เรียบเรียง
    category_id BIGINT REFERENCES book_categories(id) ON DELETE SET NULL, -- เชื่อมโยงหมวดหมู่
    status VARCHAR(20) NOT NULL DEFAULT 'available'             -- สถานะปัจจุบันของเล่ม
        CHECK (status IN ('available', 'borrowed', 'reserved', 'lost', 'maintenance')),
    cover_image TEXT,                                           -- URL รูปหน้าปกหนังสือ
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                                      -- Soft Delete กรณีจำหน่ายหนังสือออก
);

-- 1.3 ตารางสมาชิก / ผู้ยืม (Borrowers)
CREATE TABLE IF NOT EXISTS borrowers (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,                                    -- ชื่อ-นามสกุล สมาชิก
    phone VARCHAR(20),                                          -- เบอร์โทรศัพท์ติดต่อ
    email VARCHAR(100),                                         -- อีเมลสำหรับแจ้งเตือน
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 ตารางบัตร RFID สมาชิก (RFID Cards)
-- ใช้จับคู่ระหว่างบัตรแข็ง RFID แต่ละใบ กับบัญชีสมาชิก (รองรับการเปลี่ยนบัตรใหม่ได้)
CREATE TABLE IF NOT EXISTS rfid_cards (
    id BIGSERIAL PRIMARY KEY,
    card_uid VARCHAR(100) UNIQUE NOT NULL,                      -- เลข Hex UID ที่อ่านได้จากบัตร เช่น A1B2C3D4
    borrower_id BIGINT REFERENCES borrowers(id) ON DELETE SET NULL, -- เจ้าของบัตร
    is_active BOOLEAN NOT NULL DEFAULT TRUE,                    -- สถานะการใช้งานบัตร (TRUE=ใช้งานได้, FALSE=ถูกระงับ)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 ตารางประวัติการยืม-คืนหนังสือ (Transactions)
-- จัดเก็บประวัติทุกรายการ พร้อม Snapshot หมวดหมู่และค่าปรับ ณ เวลาที่ยืม (กันข้อมูลย้อนหลังเพี้ยน)
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    borrower_id BIGINT NOT NULL REFERENCES borrowers(id) ON DELETE CASCADE,
    rfid_card_id BIGINT NOT NULL REFERENCES rfid_cards(id) ON DELETE CASCADE,
    admin_id BIGINT,                                            -- แอดมินผู้ทำรายการ (NULL หากยืมผ่านตู้ ESP32)
    category_snapshot VARCHAR(100) NOT NULL,                    -- Snapshot ชื่อหมวดหมู่ ณ ขณะยืม
    fine_rate_snapshot NUMERIC(10, 2) NOT NULL,                 -- Snapshot อัตราค่าปรับต่อวัน ณ ขณะยืม
    borrowed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),             -- วันเวลาที่ยืม
    due_date DATE NOT NULL,                                     -- วันครบกำหนดส่งคืน
    returned_at TIMESTAMPTZ,                                    -- วันเวลาที่นำมาคืนจริง (NULL ขณะยังไม่คืน)
    fine_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,           -- ยอดค่าปรับรวมที่คำนวณได้จริง (บาท)
    status VARCHAR(20) NOT NULL DEFAULT 'borrowed'              -- สถานะรายการยืม
        CHECK (status IN ('borrowed', 'returned', 'overdue', 'lost')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- ส่วนที่ 2: ดัชนีเพื่อเพิ่มความเร็วในการสืบค้น (Indexes)
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_rfid_uid ON books(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_books_qr_code ON books(qr_code);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_card_uid ON rfid_cards(card_uid);
CREATE INDEX IF NOT EXISTS idx_transactions_book_status ON transactions(book_id, status);
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_borrowed_at ON transactions(borrowed_at DESC);

-- ==============================================================================
-- ส่วนที่ 3: RPC Function หลักสำหรับ ESP32 (handle_rfid_scan)
-- ทำงานแบบ Auto-Toggle: ตัดสินใจยืม/คืน อัตโนมัติจากสถานะหนังสือ พร้อมล็อกแถวป้องกัน Race Condition
-- ==============================================================================

CREATE OR REPLACE FUNCTION handle_rfid_scan(
    p_user_rfid_uid TEXT,
    p_book_rfid_uid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- ให้รันด้วยสิทธิ์ผู้ดูแลเพื่อจัดการตารางทั้งหมดได้อย่างสมบูรณ์
AS $$
DECLARE
    v_rfid_card RECORD;
    v_book RECORD;
    v_category RECORD;
    v_active_txn RECORD;
    v_borrowed_at TIMESTAMPTZ;
    v_due_date DATE;
    v_returned_at TIMESTAMPTZ;
    v_late_days INTEGER;
    v_fine_amount NUMERIC(10, 2) := 0.00;
BEGIN
    -- ขั้นตอนที่ 1: ค้นหาและตรวจสอบบัตรสมาชิก (user_rfid_uid)
    -- ตัดช่องว่างและแปลงเป็นตัวพิมพ์เล็กเพื่อลดความคลาดเคลื่อนของการอ่านค่า
    SELECT rc.*, b.id AS b_id, b.full_name, b.phone
    INTO v_rfid_card
    FROM rfid_cards rc
    LEFT JOIN borrowers b ON b.id = rc.borrower_id
    WHERE LOWER(TRIM(rc.card_uid)) = LOWER(TRIM(p_user_rfid_uid))
      AND rc.is_active = TRUE;

    IF NOT FOUND OR v_rfid_card.borrower_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'action', NULL,
            'message', 'ไม่พบบัตรสมาชิกในระบบ กรุณาติดต่อลงทะเบียนที่เคาน์เตอร์'
        );
    END IF;

    -- ขั้นตอนที่ 2: ค้นหาและล็อกแถวหนังสือ (FOR UPDATE)
    -- ป้องกันปัญหา Race Condition กรณีมีตู้หลายตู้หรือสแกนซ้ำพร้อมกันในเสี้ยววินาที
    SELECT * INTO v_book
    FROM books
    WHERE LOWER(TRIM(rfid_uid)) = LOWER(TRIM(p_book_rfid_uid))
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'action', NULL,
            'message', 'ไม่พบ Tag หนังสือนี้ในระบบ กรุณาตรวจสอบกับบรรณารักษ์'
        );
    END IF;

    -- ขั้นตอนที่ 3A: กรณีหนังสือว่าง (available) -> ดำเนินการ "ยืมหนังสือ"
    IF v_book.status = 'available' THEN
        -- ดึงเงื่อนไขของหมวดหมู่หนังสือ
        SELECT * INTO v_category
        FROM book_categories
        WHERE id = v_book.category_id;

        v_borrowed_at := NOW();
        -- คำนวณวันกำหนดคืน = วันนี้ + จำนวนวันที่ให้ยืมของหมวดหมู่นั้น (ดีฟอลต์ 7 วัน)
        v_due_date := (v_borrowed_at + (COALESCE(v_category.borrow_duration_days, 7) || ' days')::INTERVAL)::DATE;

        -- บันทึกประวัติการยืมใหม่
        INSERT INTO transactions (
            book_id,
            borrower_id,
            rfid_card_id,
            admin_id,
            category_snapshot,
            fine_rate_snapshot,
            borrowed_at,
            due_date,
            status
        ) VALUES (
            v_book.id,
            v_rfid_card.borrower_id,
            v_rfid_card.id,
            NULL, -- เกิดจากตู้ ESP32 อัตโนมัติ ไม่มีแอดมินกด
            COALESCE(v_category.name, 'ทั่วไป'),
            COALESCE(v_category.fine_rate_per_day, 0.00),
            v_borrowed_at,
            v_due_date,
            'borrowed'
        );

        -- อัปเดตสถานะหนังสือในคลังเป็น 'borrowed'
        UPDATE books
        SET status = 'borrowed', updated_at = NOW()
        WHERE id = v_book.id;

        -- ส่งผลลัพธ์กลับในรูปแบบ JSON ให้ ESP32 นำไปแสดงบนจอ OLED ได้ทันที
        RETURN jsonb_build_object(
            'status', 'success',
            'action', 'borrowed',
            'message', 'ทำรายการยืมสำเร็จ',
            'book_title', v_book.title,
            'borrower_name', v_rfid_card.full_name,
            'due_date', TO_CHAR(v_due_date, 'YYYY-MM-DD')
        );

    -- ขั้นตอนที่ 3B: กรณีหนังสือถูกยืมอยู่ (borrowed) -> ตรวจสอบว่าใช่ผู้ยืมคนเดิมหรือไม่
    ELSIF v_book.status = 'borrowed' THEN
        -- ค้นหารายการยืมล่าสุดที่ยังไม่ได้คืน
        SELECT * INTO v_active_txn
        FROM transactions
        WHERE book_id = v_book.id AND status = 'borrowed'
        ORDER BY borrowed_at DESC
        LIMIT 1;

        -- ตรวจสอบว่าสมาชิกที่แตะบัตร คือคนเดียวกับที่ยืมไปหรือไม่
        IF FOUND AND v_active_txn.borrower_id = v_rfid_card.borrower_id THEN
            v_returned_at := NOW();

            -- ตรวจสอบการส่งคืนล่าช้า และคำนวณค่าปรับ
            IF (v_returned_at::DATE > v_active_txn.due_date) THEN
                v_late_days := (v_returned_at::DATE - v_active_txn.due_date);
                v_fine_amount := ROUND(v_late_days * v_active_txn.fine_rate_snapshot, 2);
            ELSE
                v_fine_amount := 0.00;
            END IF;

            -- อัปเดตประวัติการยืมว่าได้ทำการคืนแล้ว
            UPDATE transactions
            SET returned_at = v_returned_at,
                fine_amount = v_fine_amount,
                status = 'returned',
                updated_at = NOW()
            WHERE id = v_active_txn.id;

            -- เปลี่ยนสถานะหนังสือกลับเป็นพร้อมให้ยืม (available)
            UPDATE books
            SET status = 'available', updated_at = NOW()
            WHERE id = v_book.id;

            RETURN jsonb_build_object(
                'status', 'success',
                'action', 'returned',
                'message', CASE 
                    WHEN v_fine_amount > 0 THEN 'คืนสำเร็จ (เกินกำหนด ปรับ ' || v_fine_amount || ' บาท)'
                    ELSE 'ทำรายการคืนสำเร็จ'
                END,
                'book_title', v_book.title,
                'borrower_name', v_rfid_card.full_name,
                'fine_amount', v_fine_amount
            );
        ELSE
            -- กรณีเป็นสมาชิกท่านอื่นนำมาแตะ
            RETURN jsonb_build_object(
                'status', 'error',
                'action', NULL,
                'message', 'หนังสือเล่มนี้ถูกยืมโดยสมาชิกท่านอื่นอยู่ ไม่สามารถทำรายการได้'
            );
        END IF;

    -- ขั้นตอนที่ 3C: กรณีหนังสืออยู่ในสถานะอื่น เช่น ชำรุด (maintenance) หรือสูญหาย (lost)
    ELSE
        RETURN jsonb_build_object(
            'status', 'error',
            'action', NULL,
            'message', 'หนังสือเล่มนี้งดให้บริการชั่วคราว (สถานะ: ' || v_book.status || ')'
        );
    END IF;
END;
$$;

-- ==============================================================================
-- ส่วนที่ 4: ฟังก์ชันสำหรับเคาน์เตอร์เจ้าหน้าที่ (Admin Manual Functions)
-- ==============================================================================

-- 4.1 ฟังก์ชันยืมหนังสือผ่านเคาน์เตอร์ด้วยรหัส QR Code และชื่อ
CREATE OR REPLACE FUNCTION admin_borrow_book(
    p_qr_code TEXT,
    p_borrower_name TEXT,
    p_rfid_card_uid TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_book RECORD;
    v_rfid_card RECORD;
    v_borrower_id BIGINT;
    v_category RECORD;
    v_borrowed_at TIMESTAMPTZ := NOW();
    v_due_date DATE;
    v_txn_id BIGINT;
BEGIN
    SELECT * INTO v_book FROM books WHERE qr_code = p_qr_code AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'ไม่พบหนังสือรหัส QR นี้ในระบบ');
    END IF;

    IF v_book.status != 'available' THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'หนังสือเล่มนี้ไม่ว่าง (สถานะ: ' || v_book.status || ')');
    END IF;

    -- ค้นหาหรือสร้างบัตรสมาชิกให้อัตโนมัติ
    SELECT * INTO v_rfid_card FROM rfid_cards WHERE card_uid = p_rfid_card_uid;
    IF FOUND AND v_rfid_card.borrower_id IS NOT NULL THEN
        v_borrower_id := v_rfid_card.borrower_id;
        UPDATE borrowers SET full_name = p_borrower_name WHERE id = v_borrower_id;
    ELSE
        INSERT INTO borrowers (full_name) VALUES (p_borrower_name) RETURNING id INTO v_borrower_id;
        IF FOUND THEN
            UPDATE rfid_cards SET borrower_id = v_borrower_id, is_active = TRUE WHERE card_uid = p_rfid_card_uid;
        ELSE
            INSERT INTO rfid_cards (card_uid, borrower_id, is_active) VALUES (p_rfid_card_uid, v_borrower_id, TRUE);
        END IF;
    END IF;

    SELECT * INTO v_category FROM book_categories WHERE id = v_book.category_id;
    v_due_date := (v_borrowed_at + (COALESCE(v_category.borrow_duration_days, 7) || ' days')::INTERVAL)::DATE;

    INSERT INTO transactions (
        book_id, borrower_id, rfid_card_id, category_snapshot, fine_rate_snapshot, borrowed_at, due_date, status
    ) VALUES (
        v_book.id, v_borrower_id, (SELECT id FROM rfid_cards WHERE card_uid = p_rfid_card_uid LIMIT 1),
        COALESCE(v_category.name, 'ทั่วไป'), COALESCE(v_category.fine_rate_per_day, 0.00),
        v_borrowed_at, v_due_date, 'borrowed'
    ) RETURNING id INTO v_txn_id;

    UPDATE books SET status = 'borrowed', updated_at = NOW() WHERE id = v_book.id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'บันทึกการยืมสำเร็จ',
        'transaction_id', v_txn_id,
        'book_title', v_book.title,
        'borrower_name', p_borrower_name,
        'due_date', TO_CHAR(v_due_date, 'YYYY-MM-DD')
    );
END;
$$;

-- 4.2 ฟังก์ชันคืนหนังสือผ่านเคาน์เตอร์ด้วยรหัส QR Code
CREATE OR REPLACE FUNCTION admin_return_book(p_qr_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_book RECORD;
    v_txn RECORD;
    v_returned_at TIMESTAMPTZ := NOW();
    v_late_days INTEGER;
    v_fine_amount NUMERIC(10, 2) := 0.00;
BEGIN
    SELECT * INTO v_book FROM books WHERE qr_code = p_qr_code AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'ไม่พบหนังสือรหัส QR นี้');
    END IF;

    IF v_book.status != 'borrowed' THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'หนังสือเล่มนี้ไม่ได้อยู่ในสถานะถูกยืม');
    END IF;

    SELECT * INTO v_txn FROM transactions WHERE book_id = v_book.id AND status = 'borrowed' ORDER BY borrowed_at DESC LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'ไม่พบประวัติรายการยืมที่ยังค้างอยู่');
    END IF;

    IF (v_returned_at::DATE > v_txn.due_date) THEN
        v_late_days := (v_returned_at::DATE - v_txn.due_date);
        v_fine_amount := ROUND(v_late_days * v_txn.fine_rate_snapshot, 2);
    END IF;

    UPDATE transactions SET returned_at = v_returned_at, fine_amount = v_fine_amount, status = 'returned', updated_at = NOW() WHERE id = v_txn.id;
    UPDATE books SET status = 'available', updated_at = NOW() WHERE id = v_book.id;

    RETURN jsonb_build_object(
        'status', 'success',
        'message', 'บันทึกการคืนสำเร็จ',
        'book_title', v_book.title,
        'fine_amount', v_fine_amount
    );
END;
$$;

-- ==============================================================================
-- ส่วนที่ 5: การเปิดใช้งาน Supabase Realtime
-- ==============================================================================
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE books;

-- ==============================================================================
-- ส่วนที่ 6: การกำหนดสิทธิ์ความปลอดภัย (Row Level Security & Grants)
-- ==============================================================================
GRANT EXECUTE ON FUNCTION handle_rfid_scan(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_borrow_book(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_return_book(TEXT) TO anon, authenticated, service_role;

ALTER TABLE book_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read book_categories" ON book_categories FOR SELECT USING (true);
CREATE POLICY "Allow public insert book_categories" ON book_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update book_categories" ON book_categories FOR UPDATE USING (true);

CREATE POLICY "Allow public read books" ON books FOR SELECT USING (true);
CREATE POLICY "Allow public insert books" ON books FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update books" ON books FOR UPDATE USING (true);

CREATE POLICY "Allow public read borrowers" ON borrowers FOR SELECT USING (true);
CREATE POLICY "Allow public insert borrowers" ON borrowers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update borrowers" ON borrowers FOR UPDATE USING (true);

CREATE POLICY "Allow public read rfid_cards" ON rfid_cards FOR SELECT USING (true);
CREATE POLICY "Allow public insert rfid_cards" ON rfid_cards FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update rfid_cards" ON rfid_cards FOR UPDATE USING (true);

CREATE POLICY "Allow public read transactions" ON transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert transactions" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update transactions" ON transactions FOR UPDATE USING (true);
