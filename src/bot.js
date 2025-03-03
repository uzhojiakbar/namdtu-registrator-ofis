require('dotenv').config(); // .env fayldan token olish
const {Telegraf, Markup, session} = require('telegraf');
const db = require('./db/database');

const bot = new Telegraf(process.env.BOT_TOKEN); // Bot tokeningizni yuklash

// Sessiyani boshqarish (foydalanuvchi holatini saqlash)
bot.use(session({
    defaultSession: () => ({state: null})
}));

const roleTranslation = (role) => {
    if (role === 'academic') {
        return "📖 Akademik (O‘quv) faoliyati"
    } else if (role === 'youth') {
        return "👨‍🎓 Yoshlar masalalari"
    } else if (role === 'international') {
        return "🌍 Xalqaro aloqalar"
    } else if (role === 'finance') {
        return "💰 Buxgalteriya, marketing, amaliyot"
    } else if (role === 'science') {
        return "🔬 Ilmiy faoliyat"
    } else if (role === 'other') {
        return "❓ Qo‘shimcha xizmatlar"
    } else if (role === 'chief') {
        return "🏆 ENG KATTA ADMIN"
    } else {
        return "Nomalum"
    }
}

const roleTranslationCategory = (role) => {
    role = role.replace("category_", ""); // "category_" qismini olib tashlash
    if (role === 'academic') {
        return "📖 Akademik (O‘quv) faoliyati"
    } else if (role === 'youth') {
        return "👨‍🎓 Yoshlar masalalari"
    } else if (role === 'international') {
        return "🌍 Xalqaro aloqalar"
    } else if (role === 'finance') {
        return "💰 Buxgalteriya, marketing, amaliyot"
    } else if (role === 'science') {
        return "🔬 Ilmiy faoliyat"
    } else if (role === 'other') {
        return "❓ Qo‘shimcha xizmatlar"
    } else if (role === 'chief') {
        return "🏆 ENG KATTA ADMIN"
    } else {
        return "Nomalum"
    }
}


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
        console.log(user)
        if (user) {
            if (user?.role === "user") {
                return ctx.reply("✅ *Hammasi tayyor* \n\n*Bosh menyu dasiz!*", mainMenuMarkup());
            } else if (user?.role === "admin") {
                return ctx.reply("> *✅ Salom Admin*\n\n*Sizning lavozimingiz*: _`" + (roleTranslation(user?.admin_role || "oth") || "Nomalum") + "`_", {
                    parse_mode: "MarkdownV2",
                    ...AdminMenu()
                });
            }


        }

        // Agar foydalanuvchi ro'yxatdan o'tmagan bo'lsa, ro'yxatdan o'tish jarayonini boshlaymiz
        ctx.session.state = 'waiting_for_name'; // Sessiya holati o'rnatiladi
        return ctx.reply("👋 Salom! Iltimos, to‘liq ismingizni yuboring (Familiya Ism):");
    });
});

const chiefs = [
    2017025737,
    1286152423
]
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
                 SET full_name   = ?,
                     passport_id = ?,
                     phone       = ?
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
                db.get(
                    `SELECT *
                     FROM requests
                     WHERE user_id = ?
                       AND javob = 0`,
                    [chatId],
                    (err, request) => {
                        if (err) {
                            console.error("Error checking request:", err);
                            return ctx.reply("❌ Murojaatni tekshirishda xatolik yuz berdi.");
                        }

                        if (request) {
                            return ctx.reply("Sizda hali javob berilmagan so'rov bor. Iltimos javob kelguncha kuting.");
                        }
                        db.run(
                            `INSERT INTO requests (user_id, category, message)
                             VALUES (?, ?, ?)`,
                            [chatId, ctx.session.category, userInput],
                            (err) => {
                                if (err) {
                                    console.log(err)
                                    return ctx.reply("❌ Xatolik yuz berdi.")
                                }
                                ;

                                // Adminni topish va unga murojaatni yuborish
                                db.all(
                                    `SELECT *
                                     FROM users
                                     WHERE admin_role = ?
                                       AND is_admin = 1`,
                                    [ctx.session.category],
                                    (err, admins) => {
                                        if (err) {
                                            console.error("Database error:", err);
                                            return;
                                        }

                                        if (admins.length === 0) {
                                            console.log("No admins found for category:", ctx.session.category);

                                            chiefs.map((id) => {
                                                bot.telegram.sendMessage(
                                                    id,
                                                    `❗️ ${roleTranslationCategory(ctx.session.category)} bo'limda hech qanday admin topilmagani va bu xolat xavfli xolatligi uchun ushbu habar sizga yuborildii!\n\n\n\n` +
                                                    `📩 <b>Yangi murojaat:</b>\n\n` +
                                                    `📂 <b>Kategoriya:</b> ${roleTranslation(ctx.session.category)}\n` +
                                                    `👤 <b>Foydalanuvchi:</b> ${user.full_name}\n` +
                                                    `🛂 <b>Passport ID:</b> ${user.passport_id}\n` +
                                                    `📱 <b>Telefon:</b> ${user.phone}\n` +
                                                    (user.username ? `🔗 <b>Telegram:</b> ${user.username}\n` : "") +
                                                    `\n<i>${message}</i>`,
                                                    {
                                                        parse_mode: "HTML",
                                                        ...Markup.inlineKeyboard([
                                                            [Markup.button.callback("✉️ Javob berish", `reply_to_${Number.parseInt(user.telegram_id)}_${id}`)],
                                                            [Markup.button.callback("⚙️ Admin qilish", `admin_id_${Number.parseInt(user.telegram_id)}_category_${ctx.session.category.replace("category_", "")}`)]
                                                        ])
                                                    }
                                                );
                                            })
                                            return;
                                        }

                                        admins.forEach(admin => {
                                            const adminTelegramId = Number(admin.telegram_id);
                                            if (!adminTelegramId) {
                                                console.error("Invalid telegram_id:", admin.telegram_id);
                                                return;
                                            }
                                            const chiefsSet = new Set(chiefs);
                                            console.log("CHIEFS", chiefsSet.has(adminTelegramId))
                                            console.log("adminTelegramId", adminTelegramId)
                                            console.log("admins", admins)
                                                bot.telegram.sendMessage(
                                                    adminTelegramId,
                                                    `📩 <b>Yangi murojaat:</b>\n\n` +
                                                    `📂 <b>Kategoriya:</b> ${roleTranslation(ctx.session.category)}\n` +
                                                    `👤 <b>Foydalanuvchi:</b> ${user.full_name}\n` +
                                                    `🛂 <b>Passport ID:</b> ${user.passport_id}\n` +
                                                    `📱 <b>Telefon:</b> ${user.phone}\n` +
                                                    (user.username ? `🔗 <b>Telegram:</b> ${user.username}\n` : "") +
                                                    `\n<i>${message}</i>`,
                                                    {
                                                        parse_mode: "HTML",
                                                        ...Markup.inlineKeyboard([
                                                                [Markup.button.callback("✉️ Javob berish", `reply_to_${Number.parseInt(user.telegram_id)}_${adminTelegramId}`)]
                                                            ]
                                                        )
                                                    }
                                                );
                                        });

                                        chiefs.map((id) => {
                                            bot.telegram.sendMessage(
                                                id,
                                                `❗️ USHBU HABAR SIZ CHIEF BO'LGANINGIZ UCHUN KO'RINMOQDA !\n\n\n\n` +
                                                `📩 <b>Yangi murojaat:</b>\n\n` +
                                                `📂 <b>Kategoriya:</b> ${roleTranslation(ctx.session.category)}\n` +
                                                `👤 <b>Foydalanuvchi:</b> ${user.full_name}\n` +
                                                `🛂 <b>Passport ID:</b> ${user.passport_id}\n` +
                                                `📱 <b>Telefon:</b> ${user.phone}\n` +
                                                (user.username ? `🔗 <b>Telegram:</b> ${user.username}\n` : "") +
                                                `\n<i>${message}</i>`,
                                                {
                                                    parse_mode: "HTML",
                                                    ...Markup.inlineKeyboard([
                                                        [Markup.button.callback("✉️ Javob berish", `reply_to_${Number.parseInt(user.telegram_id)}_${id}`)],
                                                        [Markup.button.callback("⚙️ Admin qilish", `admin_id_${Number.parseInt(user.telegram_id)}_category_${ctx.session.category.replace("category_", "")}`)]
                                                    ])
                                                }
                                            );
                                        })


                                        ctx.session.state = null;
                                        ctx.session.category = null
                                    }
                                );
                                return ctx.reply("✅ Murojaatingiz muvaffaqiyatli yuborildi!", mainMenuMarkup());
                            }
                        );
                    });
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

            console.log("USERID", userId)
            console.log("ctx.session", ctx.session)
            const adminId = ctx.session.adminId;
            db.get(
                `SELECT *
                 FROM requests
                 WHERE user_id = ?
                   AND javob = 0`,
                [userId],
                (err, request) => {
                    if (err) {
                        console.error("Error checking request:", err);
                        return ctx.reply("❌ Murojaatni tekshirishda xatolik yuz berdi.");
                    }

                    console.log("request", request)
                    if (!request) {
                        return ctx.reply("❌ Javob berish uchun murojaat topilmadi yoki allaqachon javob berilgan.");
                    }

                    // Agar so'rov topilsa, javobni yangilash
                    db.run(
                        `UPDATE requests
                         SET javob      = 1,
                             reply_text = ?
                         WHERE user_id = ?
                           AND javob = 0`,
                        [replyText, userId],
                        function (err) {
                            if (err) {
                                console.error("Error updating request:", err);
                                return ctx.reply("❌ Javob yuborishda xatolik yuz berdi.");
                            }

                            // Javob yuborish
                            db.get(`SELECT *
                                    FROM users
                                    WHERE telegram_id = ?`, [adminId], (err, admin) => {
                                if (err || !admin) return ctx.reply("❌ Admin topilmadi.");

                                bot.telegram.sendMessage(userId,
                                    `📩 <b>Admin javobi:</b>\n\n` +
                                    `👤 <b>Admin:</b> ${admin.full_name}\n` +
                                    `📱 <b>Telefon:</b> ${admin.phone}\n\n` +
                                    `<i>${replyText}</i>`,
                                    {parse_mode: "HTML"}
                                );

                                ctx.session.state = null;
                                ctx.session.requestUserId = null;
                                ctx.session.adminId = null;
                                return ctx.reply("✅ Javob foydalanuvchiga yuborildi!");
                            });
                        }
                    );
                }
            );
            break
        }
        default:
            return ctx.reply("❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.");
    }
});

bot.action(/reply_to_(\d+)_(\d+)/, (ctx) => {
    ctx.session.state = "waiting_for_reply";
    ctx.session.requestUserId = parseInt(ctx.match[1]);
    ctx.session.adminId = parseInt(ctx.match[2]);
    ctx.session.categoryRe = ctx.match[3];
    return ctx.reply("✍️ Iltimos, foydalanuvchiga yuborish uchun javob matnini kiriting:");
});


// Admin qilish tugmasini bosganda ishlovchi function
bot.action(/admin_id_(\d+)_category_(\w+)/, async (ctx) => {
    const userId = parseInt(ctx.match[1]); // Foydalanuvchi ID'si
    const category = ctx.match[2]; // Kategoriya

    // Session holatini o'rnatish
    ctx.session.state = "waiting_for_admin_action";
    console.log("Admin qilish jarayoni", ctx);

    ctx.session.requestUserId = userId;
    ctx.session.category = category;

    db.each("SELECT * FROM users where telegram_id = ?", [userId], (err, row) => {
        if (err) {
            console.error(err);
        } else {
            if (!row) {
                return ctx.reply("Foydalanuvchi topilmadi.");
            }

            return ctx.reply(
                `⚙️ Admin qilish uchun: \n\n` +
                `👤 Foydalanuvchi: ${row.full_name}\n` +
                `📂 Kategoriya: ${roleTranslation(category)}\n` +
                `Iltimos, admin qilishni tasdiqlang.`,
                Markup.inlineKeyboard([
                    [Markup.button.callback("✅ Tasdiqlash", `confirm_admin_${userId}_${category}`)],
                    [Markup.button.callback("❌ Bekor qilish", `cancel_admin_${userId}`)]
                ])
            );
        }
    });
});

// Admin qilishni tasdiqlash yoki bekor qilish
bot.action(/confirm_admin_(\d+)_(\w+)/, async (ctx) => {
    const userId = parseInt(ctx.match[1]); // Foydalanuvchi ID
    const category = ctx.match[2]; // Kategoriya
    await makeUserAdmin(userId, category); // Admin qilish funksiyasi
    await ctx.telegram.sendMessage(userId, `⚙️ Siz ushbu bo'limga admin qilindiz: \n${roleTranslation(category)}`);
    await ctx.reply(`⚙️ ${userId} admin qilindi, kategoriya: \n${roleTranslation(category)}`);
});

// Admin qilishni bekor qilish
bot.action(/cancel_admin_(\d+)/, async (ctx) => {
    await ctx.reply(`Bekor qilindi`);
});

// Admin qilishni amalga oshiruvchi funksiya
async function makeUserAdmin(userId, category) {
    const updateQuery = `UPDATE users
                         SET is_admin   = 1,
                             role       = 'admin',
                             admin_role = ?
                         WHERE telegram_id = ?`;

    db.run(updateQuery, [category, userId], function (err) {
        if (err) {
            console.log(`Xatolik yuz berdi: ${err.message}`);
        } else if (this.changes === 0) {
            console.log("Foydalanuvchi topilmadi.");
        }
    });

}

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

const mainMenuMarkup = () => {
    return Markup.inlineKeyboard([
        [Markup.button.callback("🆕 Yangi murojaat", "new_request")],
        [Markup.button.callback("📜 Mening murojaatlarim", "my_requests")],
        [Markup.button.callback("ℹ️ Men haqimda", "about_me")]
    ]);
};

const AdminMenu = () => {
    return Markup.inlineKeyboard([
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
            WHERE telegram_id = ?`, [Number.parseInt(chatId)], (err, user) => {
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
