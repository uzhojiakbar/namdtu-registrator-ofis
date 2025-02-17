require('dotenv').config(); // .env fayldan token olish
const {Telegraf, Markup, session} = require('telegraf');
const db = require('./db/database');

const bot = new Telegraf(process.env.BOT_TOKEN); // Bot tokeningizni yuklash

// Sessiyani boshqarish (foydalanuvchi holatini saqlash)
bot.use(session({
    defaultSession: () => ({state: null})
}));

// Ro‘yxatdan o‘tish jarayoni uchun holat boshqaruvi
// /start komandasi
bot.start(async (ctx) => {
    const chatId = ctx.chat.id;

    // Sessiya holatini tozalaymiz (agar avvalgi ishlashdan qoldiq mavjud bo'lsa)
    ctx.session.state = null;

    // Foydalanuvchini ma'lumotlar bazasida qidiramiz
    db.get(`SELECT *
            FROM users
            WHERE telegram_id = ?`, [chatId], (err, user) => {
        if (err) {
            console.error(err.message);
            return ctx.reply("❌ Maʼlumotlar bazasida xatolik yuz berdi.");
        }

        if (user) {
            // Foydalanuvchi ro'yxatdan o'tgan bo'lsa, asosiy menyuga qaytariladi
            return ctx.reply("✅ Siz allaqachon ro'yxatdan o'tgansiz! Bosh menyuga o'tamiz...", mainMenuMarkup());
        }

        // Agar foydalanuvchi ro'yxatdan o'tmagan bo'lsa, ro'yxatdan o'tish jarayonini boshlaymiz
        ctx.session.state = 'waiting_for_name'; // Sessiya holati o'rnatiladi
        return ctx.reply("👋 Salom! Iltimos, to‘liq ismingizni yuboring (Familiya Ism):");
    });
});

// Matnli javoblarni boshqarish
bot.on("text", async (ctx) => {
    console.log("Foydalanuvchi holati:", ctx.session.state); // Sessiya holati nazorati

    if (!ctx.session.state) {
        // Sessiya holati aniqlanmagan bo‘lsa foydalanuvchini to‘liq yo‘naltirish
        return ctx.reply("❌ Iltimos, menyudan biror amalni tanlang yoki /start ni yuboring.");
    }

    const chatId = ctx.chat.id; // Foydalanuvchini telegram_id sifatida ishlatamiz
    const userInput = ctx.message.text.trim();
    const message = ctx.message.text.trim();

    switch (ctx.session.state) {
        // Ro‘yxatdan o‘tish jarayonining holati
        case "waiting_for_name": {
            ctx.session.fullName = userInput; // Foydalanuvchining ismi
            ctx.session.state = "waiting_for_passport"; // Keyingi bosqichga o'tiladi
            return ctx.reply("🛂 Iltimos, Passport ID yuboring (format: AB1234567):");
        }

        case "waiting_for_passport": {
            if (!/^[A-Z]{2}\d{7}$/.test(userInput)) {
                return ctx.reply("❌ Passport ID noto‘g‘ri. Format: AB1234567.");
            }
            ctx.session.passportId = userInput; // Passportni sessiyada saqlaymiz
            ctx.session.state = "waiting_for_phone"; // Telefon raqami bosqichiga o'tamiz
            return ctx.reply("📱 Iltimos, telefon raqamingizni kiritib yuboring (+99890-000-00-00):");
        }

        case "waiting_for_phone": {
            if (!/^\+998\d{2}-\d{3}-\d{2}-\d{2}$/.test(userInput)) {
                return ctx.reply("❌ Telefon raqam noto‘g‘ri. Format: +99890-000-00-00.");
            }

            const username = ctx.from.username ? `@${ctx.from.username}` : null; // Username olish

            // Ma'lumotlarni bazaga saqlash
            db.run(
                `INSERT INTO users (telegram_id, full_name, passport_id, username, phone)
                 VALUES (?, ?, ?, ?, ?)`,
                [chatId, ctx.session.fullName, ctx.session.passportId, username, userInput],
                (err) => {
                    if (err) {
                        console.error(err.message);
                        return ctx.reply("❌ Maʼlumotlar bazasiga yozishda xatolik yuz berdi.");
                    }

                    ctx.session.state = null; // Sessiyani tozalaydi
                    return ctx.reply(
                        "✅ Siz muvaffaqiyatli ro‘yxatdan o‘tdingiz! Bosh menyuga qayting:",
                        mainMenuMarkup()
                    );
                }
            );
            break;
        }

        // Ma'lumotni yangilash
        case "updating_name": {
            ctx.session.fullName = userInput; // Yangi ism saqlanadi
            ctx.session.state = "updating_passport"; // Keyingi qadam
            return ctx.reply("🛂 Iltimos, yangi Passport ID ni kiriting (format: AB1234567):");
        }

        case "updating_passport": {
            if (!/^[A-Z]{2}\d{7}$/.test(userInput)) {
                return ctx.reply("❌ Passport ID noto‘g‘ri. Format: AB1234567.");
            }
            ctx.session.passportId = userInput; // Yangi passport IDni sessiyada saqlaymiz
            ctx.session.state = "updating_phone"; // Telefonni yangilash bosqichi
            return ctx.reply("📱 Yangi telefon raqamingizni kiriting (+99890-000-00-00):");
        }

        case "updating_phone": {
            if (!/^\+998\d{2}-\d{3}-\d{2}-\d{2}$/.test(userInput)) {
                return ctx.reply("❌ Telefon raqami noto‘g‘ri. Format: +99890-000-00-00.");
            }

            db.run(
                `UPDATE users
                 SET full_name = ?,
                     passport_id = ?,
                     phone = ?
                 WHERE telegram_id = ?`,
                [ctx.session.fullName, ctx.session.passportId, userInput, chatId],
                (err) => {
                    if (err) {
                        console.error(err.message);
                        return ctx.reply("❌ Ma'lumotlaringizni yangilashda xatolik yuz berdi.");
                    }
                    ctx.session.state = null; // Yangilash tugashi bilan sessiyani tozalash
                    return ctx.reply("✅ Ma'lumotlaringiz muvaffaqiyatli yangilandi! Bosh menyu:", mainMenuMarkup());
                }
            );
            break;
        }

        // Yangi murojaat qilish bo‘yicha holat
        case "waiting_for_message": {
            if (!ctx.session.category) {
                ctx.session.state = null;
                return ctx.reply("❌ Kategoriya tanlanmagan. Avval bo'lim tanlang.");
            }

            db.get(`SELECT *
                    FROM users
                    WHERE telegram_id = ?`, [chatId], (err, user) => {
                if (err || !user) return ctx.reply("❌ Ro‘yxatdan o‘tmagan foydalanuvchi.");

                console.log("user: ", user)
                console.log("ctx.session.category: ", ctx.session.category)
                db.run(
                    `INSERT INTO requests (user_id, category, message)
                     VALUES (?, ?, ?)`,
                    [chatId, ctx.session.category, userInput],
                    (err) => {
                        if (err) return ctx.reply("❌ Xatolik yuz berdi.");

                        // Adminni topish va unga murojaatni yuborish
                        db.get(`SELECT * FROM users WHERE admin_role = ? AND is_admin = 1`,
                            [ctx.session.category], (err, admin) => {
                                if (!err && admin) {
                                    bot.telegram.sendMessage(admin.telegram_id,
                                        `📩 <b>Yangi murojaat:</b>\n\n` +
                                        `📂 <b>Kategoriya:</b> ${ctx.session.category}\n` +
                                        `👤 <b>Foydalanuvchi:</b> ${user.full_name}\n` +
                                        `🛂 <b>Passport ID:</b> ${user.passport_id}\n` +
                                        `📱 <b>Telefon:</b> ${user.phone}\n` +
                                        (user.username ? `🔗 <b>Telegram:</b> ${user.username}\n` : "") +
                                        `\n<i>${message}</i>`,
                                        {
                                            parse_mode: "HTML",
                                            ...Markup.inlineKeyboard([
                                                [Markup.button.callback("✉️ Javob berish", `reply_to_${Number.parseInt(user.telegram_id)}_${admin.telegram_id}`)]
                                            ])
                                        }
                                    );

                                    ctx.session.state = null;
                                    ctx.session.category = null;
                                }
                            });



                        return ctx.reply("✅ Murojaatingiz muvaffaqiyatli yuborildi!", mainMenuMarkup());
                    }
                );
            });
            break;
        }

        // Anonim murojaatlar uchun holat
        case "waiting_for_anonymous_message": {
            const message = ctx.message.text.trim();

            db.run(
                `INSERT INTO requests (user_id, category, message, is_anonymous)
                 VALUES (?, ?, ?, ?)`,
                [chatId, 'Anonim', message, 1], // Foydalanuvchi ID sifatida telegram_id
                (err) => {
                    if (err) {
                        console.error(err.message);
                        return ctx.reply("❌ Anonim murojaatingizni saqlashda xatolik yuz berdi.");
                    }

                    ctx.session.state = null; // Sessiya tozalanadi
                    return ctx.reply("✅ Anonim murojaatingiz muvaffaqiyatli yuborildi!");
                }
            );
            break;
        }

        case "waiting_for_reply": {
            const replyText = ctx.message.text.trim();
            const userId = ctx.session.requestUserId;
            console.log("ctx.session",ctx.session)
            const adminId = ctx.session.adminId;

            db.get(`SELECT * FROM users WHERE telegram_id = ?`, [adminId], (err, admin) => {
                console.log("ADMIN",admin)
                console.log("replyText",replyText)
                console.log("userId",userId)
                console.log("adminId",adminId)

                if (err || !admin) return ctx.reply("❌ Admin topilmadi.");

                bot.telegram.sendMessage(userId,
                    `📩 <b>Admin javobi:</b>\n\n` +
                    `👤 <b>Admin:</b> ${admin.full_name}\n` +
                    `📱 <b>Telefon:</b> ${admin.phone}\n\n` +
                    `<i>${replyText}</i>`,
                    { parse_mode: "HTML" }
                );

                ctx.session.state = null;
                ctx.session.requestUserId = null;
                ctx.session.adminId = null;
                return ctx.reply("✅ Javob foydalanuvchiga yuborildi!");
            });
            break
        }
        default:
            return ctx.reply("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    }
});

bot.action(/reply_to_(\d+)_(\d+)/, (ctx) => {
    ctx.session.state = "waiting_for_reply";
    console.log("ctxctxctxctx",ctx)
    ctx.session.requestUserId = parseInt(ctx.match[1]);
    ctx.session.adminId = parseInt(ctx.match[2]);
    return ctx.reply("✍️ Iltimos, foydalanuvchiga yuborish uchun javob matnini kiriting:");
});


// Kategoriya tugmasi bosilgandan keyin
bot.action(/category_(.+)/, (ctx) => {
    console.log("category", ctx.match.input);
    const category = ctx.match[1]; // Tanlangan kategoriyani olish
    ctx.session.category = category; // Sessiyada kategoriya saqlanadi
    ctx.session.state = "waiting_for_message"; // Endi foydalanuvchi murojaat matnini kiritishi kerak

    let categoryName = "";
    switch (category) {
        case "academic":
            categoryName = "Akademik (O‘quv) faoliyati bo‘yicha xizmatlar";
            break;
        case "youth":
            categoryName = "Yoshlar masalalari va ma’naviy-ma’rifiy faoliyat bo‘yicha xizmatlar";
            break;
        case "international":
            categoryName = "Xalqaro aloqalar faoliyati bo‘yicha xizmatlar";
            break;
        case "finance":
            categoryName = "Buxgalteriya, marketing va amaliyot faoliyati bo‘yicha xizmatlar";
            break;
        case "science":
            categoryName = "Ilmiy faoliyat bo‘yicha xizmatlar";
            break;
        case "other":
            categoryName = "Ko‘rsatilishi zarur bo‘lgan boshqa qo‘shimcha xizmatlar";
            break;
    }

    return ctx.reply(
        `✅ Siz "${categoryName}" kategoriyasini tanladingiz. Endi murojaatingiz matnini kiriting:`
    );
});

// Matnli javoblarni boshqarish
const mainMenuMarkup = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🆕 Yangi murojaat", "new_request")],
        [Markup.button.callback("📜 Mening murojaatlarim", "my_requests")],
        [Markup.button.callback("🤐 Anonim murojaat", "anonymous_request")],
        [Markup.button.callback("ℹ️ Men haqimda", "about_me")]
    ]);
};

// "Yangi murojaat" tugmasi uchun action
bot.action("new_request", (ctx) => {
    ctx.session.state = "waiting_for_category"; // Sessiya holatini tanlov kutish holatiga o'rnatamiz
    return ctx.reply(
        "📂 Iltimos, murojaatingiz uchun kategoriya tanlang:",
        Markup.inlineKeyboard([
            [Markup.button.callback("📖 Akademik (O‘quv) faoliyati", "category_academic")],
            [Markup.button.callback("👨‍🎓 Yoshlar masalalari", "category_youth")],
            [Markup.button.callback("🌍 Xalqaro aloqalar", "category_international")],
            [Markup.button.callback("💰 Buxgalteriya, marketing, amaliyot", "category_finance")],
            [Markup.button.callback("🔬 Ilmiy faoliyat", "category_science")],
            [Markup.button.callback("❓ Qo‘shimcha xizmatlar", "category_other")]
        ])
    );
});

// "Mening murojaatlarim" action
// "Mening murojaatlarim" tugmasi action
bot.action("my_requests", (ctx) => {
    const chatId = ctx.chat.id;

    // Foydalanuvchini ma'lumotlar bazasidan topamiz
    db.get(`SELECT id
            FROM users
            WHERE telegram_id = ?`, [chatId], (err, user) => {
        if (err) {
            console.error(err.message);
            return ctx.reply("❌ Maʼlumotlar bazasida xatolik yuz berdi.");
        }

        if (!user) {
            return ctx.reply("❌ Siz ro'yxatdan o'tmagansiz. Iltimos, /start ni yuboring.");
        }

        // Foydalanuvchining murojaatlarini olib kelamiz
        db.all(`SELECT category, message, created_at
                FROM requests
                WHERE user_id = ?
                ORDER BY created_at DESC`, [chatId], (err, requests) => {
            if (err) {
                console.error(err.message);
                return ctx.reply("❌ Maʼlumotlar bazasidan murojaatlarni olishda xatolik yuz berdi.");
            }

            if (requests.length === 0) {
                return ctx.reply("📭 Hozircha hech qanday murojaatingiz yo'q.");
            }

            // Birinchi murojaatni ko'rsatish
            showRequest(ctx, requests, 0);
        });
    });
});

// Murojaatni ko'rsatish uchun yangi yordamchi funksiya
function showRequest(ctx, requests, index) {
    const total = requests.length;
    const currentRequest = requests[index];

    const response = `📂 <b>Kategoriya:</b> ${currentRequest.category}\n` +
        `📅 <b>Sana:</b> ${currentRequest.created_at}\n` +
        `✉️ <b>Murojaat:</b> ${currentRequest.message}\n` +
        `\n<b>${index + 1}/${total}</b> - murojaat`;

    // Tugmalar
    const navigationButtons = Markup.inlineKeyboard([
        [
            // "Oldingi" tugmasi
            Markup.button.callback("⬅️ Oldingi", `request_prev_${index}`),

            // Hozirgi / Umumiy
            Markup.button.callback(`${index + 1}/${total}`, "current"),

            // "Keyingi" tugmasi
            Markup.button.callback("Keyingi ➡️", `request_next_${index}`)
        ]
    ]);

    // Xabarni jo'natish (yoki tahrirlash)
    if (ctx.update.callback_query) {
        ctx.editMessageText(response, {parse_mode: "HTML", ...navigationButtons});
    } else {
        ctx.reply(response, {parse_mode: "HTML", ...navigationButtons});
    }
}

// Tugmalarni boshqarish
bot.action(/request_prev_(\d+)/, (ctx) => {
    const currentIndex = parseInt(ctx.match[1]); // Hozirgi index
    const chatId = ctx.chat.id;

    // Ma'lumotlar bazasidan murojaatlarni qayta olish
    db.all(`SELECT category, message, created_at
            FROM requests
            WHERE user_id = ?
            ORDER BY created_at DESC`, [chatId], (err, requests) => {
        if (err) {
            console.error(err.message);
            return ctx.reply("❌ Maʼlumotlar bazasidan murojaatlarni olishda xatolik yuz berdi.");
        }

        // Oldingi murojaatga o'tish
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : requests.length - 1;
        showRequest(ctx, requests, prevIndex);
    });
});
bot.action(/request_next_(\d+)/, (ctx) => {
    const currentIndex = parseInt(ctx.match[1]); // Hozirgi index
    const chatId = ctx.chat.id;

    // Ma'lumotlar bazasidan murojaatlarni qayta olish
    db.all(`SELECT category, message, created_at
            FROM requests
            WHERE user_id = ?
            ORDER BY created_at DESC`, [chatId], (err, requests) => {
        if (err) {
            console.error(err.message);
            return ctx.reply("❌ Maʼlumotlar bazasidan murojaatlarni olishda xatolik yuz berdi.");
        }

        // Keyingi murojaatga o'tish
        const nextIndex = currentIndex < requests.length - 1 ? currentIndex + 1 : 0;
        showRequest(ctx, requests, nextIndex);
    });
});
bot.action("anonymous_request", (ctx) => {
    ctx.session.state = "waiting_for_anonymous_message";
    return ctx.reply("📩 Iltimos, anonim murojaatingizni yuboring:");
});

// "Men haqimda" action
bot.action("about_me", (ctx) => {
    const chatId = ctx.chat.id;

    // Ma'lumotlar bazasidan foydalanuvchi ma'lumotlarini olish
    db.get(
        `SELECT full_name, passport_id, phone, username
         FROM users
         WHERE telegram_id = ?`,
        [chatId],
        (err, user) => {
            if (err) {
                console.error(err.message);
                return ctx.reply("❌ Maʼlumotlar bazasida xatolik yuz berdi.");
            }

            if (!user) {
                return ctx.reply("❌ Siz ro'yxatdan o'tmagansiz. Iltimos, /start komandasini yuborib ro'yxatdan o'ting.");
            }

            // Foydalanuvchi maʼlumotlarini chiqarish
            let response = `👤 <b>Siz haqingizda ma'lumotlar</b>:\n\n`;
            response += `📝 <b>Ism:</b> ${user.full_name}\n`;
            response += `🛂 <b>Passport ID:</b> ${user.passport_id}\n`;
            response += `📱 <b>Telefon:</b> ${user.phone}\n`;
            response += user.username
                ? `🔗 <b>Telegram:</b> @${user.username}\n`
                : `🔗 <b>Telegram:</b> Yo'q\n`;

            // Ma'lumot va "yangilash" tugmasi bilan javob
            ctx.reply(response, {
                parse_mode: "HTML",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("♻️ Ma'lumotni yangilash", "update_info")]
                ])
            });
        }
    );
});

bot.action("update_info", (ctx) => {
    ctx.session.state = "updating_name"; // Yangilash jarayonini "ismni so'rash" qadamidan boshlaymiz
    return ctx.reply("📝 Iltimos, yangi to‘liq ismingizni kiriting:");
});
// Triggerni boshlash
bot.launch()
    .then(() => console.log("🚀 Bot ishlayapti. No Problem BRO!"))
    .catch((err) => console.error("❌ Botni ishga tushirishda xatolik yuz berdi:", err));
