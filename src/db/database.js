const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bot.db'); // Ma'lumotlar bazasi fayli

// Ma'lumotlar bazasida kerakli jadval tuzilmalari
db.serialize(() => {
    // Foydalanuvchilar jadvali
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER UNIQUE PRIMARY KEY AUTOINCREMENT, -- Foydalanuvchi ID
        telegram_id TEXT UNIQUE, -- Telegram ID (unique)
        full_name TEXT NOT NULL, -- To'liq ism (Familiya, Ism)
        passport_id TEXT UNIQUE NOT NULL, -- Passport ID (masalan: AB1234567, unique)
        username TEXT, -- Telegram username (agar mavjud bo'lsa)
        phone TEXT NOT NULL, -- Telefon raqami (+99890-000-00-00 formatda)
        is_admin INTEGER DEFAULT 0, -- Adminlik holati: 0 - oddiy foydalanuvchi, 1 - admin
        role TEXT DEFAULT 'user', -- Role: "user", "admin", yoki "chief"
        admin_role TEXT DEFAULT NULL -- Admin roli (qaysi tanlov bo'limiga mas'ul, faqat adminlar uchun)
    )`);

    // Murojaatlar (Requests) jadvali
    db.run(`
        CREATE TABLE IF NOT EXISTS requests (
                                                id INTEGER PRIMARY KEY AUTOINCREMENT, -- Murojaat ID
                                                user_id INTEGER NOT NULL, -- Kimdan murojaat kelgan (users jadvaliga bog'liq)
                                                category TEXT NOT NULL, -- Kategoriya (tanlov bo'limlari: texnik, o‘quv va boshqalar)
                                                message TEXT NOT NULL, -- Foydalanuvchi murojaati
                                                is_anonymous INTEGER DEFAULT 0, -- Anonimmi: 0 - yo'q, 1 - ha
                                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Murojaat qachon yuborilgan
                                                javob INTEGER DEFAULT 0, -- Javob berilganligini bildiruvchi ustun
                                                reply_text TEXT DEFAULT NULL, -- Admin javobi (default NULL)
                                                FOREIGN KEY(user_id) REFERENCES users(id) -- Foydalanuvchilar jadvaliga bog'lanish
            );

        )`);

    // Kunlik statistika (foydalanuvchilar va murojaatlar haqida statistikani yig'ish uchun)
    db.run(`CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT, -- Statistika ID
        date TEXT NOT NULL, -- Sana (masalan, 2023-01-01)
        total_users INTEGER DEFAULT 0, -- Umumiy foydalanuvchilar soni
        total_requests INTEGER DEFAULT 0, -- Umumiy murojaatlar soni
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Qachon yaratildi
    )`);
});

module.exports = db;