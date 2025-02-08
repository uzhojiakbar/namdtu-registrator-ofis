require("dotenv").config();
const sqlite3 = require("sqlite3").verbose();
const TelegramBot = require("node-telegram-bot-api");
const path = require("path");

const token = process.env.BOT;
const bot = new TelegramBot(token, { polling: true });
const userStates = {};

const adminChatIds = ["2017025737"]; // Adminlarning chat IDlari

const dbPath = path.join(__dirname, "db", "telegram_bot.db");
const db = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) {
      console.error("Ma'lumotlar bazasi bilan bog'liq muammo:", err.message);
    } else {
      console.log("Ma'lumotlar bazasi ulandi va yaratildi:", dbPath);
    }
  }
);

// Inline tanlovlar
const inlineOptions = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "1.",
          callback_data: "query_1",
        },
      ],
      [{ text: "Tanlov 2", callback_data: "query_2" }],
      [{ text: "Tanlov 3", callback_data: "query_3" }],
      [{ text: "Tanlov 4", callback_data: "query_4" }],
      [{ text: "Tanlov 5", callback_data: "query_5" }],
    ],
  },
};

// Foydalanuvchiga tanlov yuborish
async function sendSelection(chatId) {
  await bot.sendMessage(
    chatId,
    "<i>Iltimos, tanlovni tanlang:</i> \n\n<b>1. AKADEMIK (O‘QUV) FAOLIYATI BO‘YICHA KO‘RSATILADIGAN XIZMATLAR.</b>\n<b>2. YOSHLAR MASALALARI VA MA’NAVIY-MA’RIFIY FAOLIYAT BO‘YICHA KO‘RSATILADIGAN XIZMATLAR.</b>\n<b>3. XALQARO ALOQALAR FAOLIYATI BO‘YICHA KO‘RSATILADIGAN XIZMATLAR.</b>\n<b>4. BUXGALTERIYA, MARKETING VA AMALIYOT FAOLIYATI BO‘YICHA KO‘RSATILADIGAN XIZMATLAR.</b>\n<b>5. ILMIY FAOLIYAT BO‘YICHA KO‘RSATILADIGAN XIZMATLAR.</b>\n<b>6. KO‘RSATILISHI ZARUR BO‘LGAN BOSHQA QO‘SHIMCHA XIZMATLAR.</b> ",
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "1.",
              callback_data: "query_1",
            },
          ],
          [{ text: "2.", callback_data: "query_2" }],
          [{ text: "3.", callback_data: "query_3" }],
          [{ text: "4.", callback_data: "query_4" }],
          [{ text: "5.", callback_data: "query_5" }],
          [{ text: "6.", callback_data: "query_6" }],
        ],
      },
    }
  );
}

async function askQuestion(chatId, question, key) {
  await bot.sendMessage(chatId, "<b>" + question + "</b>", {
    parse_mode: "HTML",
  });

  return new Promise((resolve) => {
    bot.once("message", (response) => {
      userStates[chatId][key] = response.text;
      db.run(
        `UPDATE users SET ${key} = ? WHERE userID = ?`,
        [response.text, chatId],
        (err) => {
          if (err) {
            console.error("Ma'lumotni yangilashda xato:", err.message);
          }
        }
      );
      resolve();
    });
  });
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  const { first_name, last_name, username } = msg.chat;
  const fullname = `${first_name}${last_name ? ` ${last_name}` : ""}`;

  const checkUser = `SELECT * FROM users WHERE userID = ?`;
  db.get(checkUser, [chatId], async (err, user) => {
    if (err) {
      console.error("Ma'lumotlarni olishda xato:", err.message);
      return bot.sendMessage(chatId, "Xatolik yuz berdi.");
    }

    if (!user) {
      // Yangi foydalanuvchi holatini yaratamiz
      userStates[chatId] = {};

      // Foydalanuvchini bazaga qo'shamiz
      const insertUser = `INSERT INTO users (userID, isAdmin, fullname, username, number, ID) VALUES (?, 0, ?, ?, ?, ?)`;
      db.run(
        insertUser,
        [
          chatId,
          fullname,
          username,
          "null", // Telefon raqami boshlanishda null
          "null", // ID raqami boshlanishda null
        ],
        async (err) => {
          if (err) {
            console.error(
              "Yangi foydalanuvchini qo'shishda xato:",
              err.message
            );
            return bot.sendMessage(chatId, "Ro'yxatdan o'tishda xato.");
          }

          // Telefon raqami so'raladi
          await askQuestion(
            chatId,
            "📞 Telefon raqamingizni kiriting (+998900000000 formatida):",
            "number"
          );

          // Ism va familiya so'raladi
          await askQuestion(
            chatId,
            "👤 Ismingizni va familiyangizni kiriting (masalan, Murodillayev Hojiakbar):",
            "fullname"
          );

          // ID raqami so'raladi
          await askQuestion(
            chatId,
            "🆔 ID karta raqamingizni kiriting (masalan, AB1234567):",
            "ID"
          );

          bot.sendMessage(
            chatId,
            "<b>✅ Siz muvaffaqiyatli ro'yxatdan o'tdingiz!</b>",
            {
              parse_mode: "HTML",
            }
          );
          await sendSelection(chatId); // Foydalanuvchiga tanlov yuborish
        }
      );
    } else {
      // Foydalanuvchi bazada mavjud, agar query bo'lsa
      if (user.number == "null") {
        console.log("null1");

        return;
      } else if (user.fullname == "null") {
        console.log("null2");

        return;
      } else if (user.ID == "null") {
        console.log("null3");
        return;
      } else if (user.query == "null") {
        console.log("null54");
        sendSelection(chatId); // Foydalanuvchiga tanlov yuborish
      } else if (msg.text === "/start") {
        sendSelection(chatId); // Foydalanuvchiga tanlov yuborish
      } else {
        const checkQ = `SELECT * FROM users WHERE userID = ?`;

        db.get(checkQ, [chatId], async (err, userr) => {
          if (err) {
            console.error("Tanlovni olishda xato:", err.message);
            return bot.sendMessage(chatId, "Tanlovni olishda xato.");
          }

          await bot.sendMessage(chatId, "<i>✅Habaringiz yuborildi.</i>", {
            parse_mode: "HTML",
          });

          if (msg.chat.id === chatId && userMessage !== "/start") {
            const getAdmins = `SELECT * FROM users WHERE isAdmin = 1`;

            db.all(getAdmins, (err, admins2) => {
              if (err) {
                console.error("Adminlarni olishda xato:", err.message);
                return;
              }

              // Adminlar ro'yxatini olish va ishlatish
              console.log(admins2);

              admins2.forEach((adminChatId) => {
                //   const message = `
                //     📬 **Yangi xabar!**

                //     🔹 **Foydalanuvchi:** ${msg.chat.first_name} ${
                //     msg.chat.last_name || ""
                //   }
                //     🔹 **Username:** @${msg.chat.username || "Noma"}
                //     🔹 **Tanlov:** ${userr.query || "Nomalum"}

                //     **Xabar mazmuni:**
                //     ${userMessage}
                //     `;

                const msg =
                  "<b>📬 Yangi xabar!</b>" +
                  "\n" +
                  "🔹 <b>Foydalanuvchi: </b> " +
                  userr.fullname +
                  "\n" +
                  "🔹 <b>Username:  " +
                  `@${userr.username}` +
                  "</b>" +
                  "\n" +
                  "🔹 <b>ID:  " +
                  `${userr.ID}` +
                  "\n" +
                  "</b>" +
                  "🔹 <b>Telefon raqami:  " +
                  `${userr.number}` +
                  "</b>" +
                  "\n" +
                  "🔹 <b>Tanlov: </b>" +
                  userr.query +
                  "\n\n" +
                  "<i>📩 Habar: \n" +
                  userMessage +
                  "</i>";

                // Adminlarga xabar yuborishda inline "Javob berish" tugmasini qo'shish

                if (
                  adminChatId.userID == "1286152423" ||
                  adminChatId.userID == "2017025737"
                ) {
                  bot.sendMessage(adminChatId.userID, msg, {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "Javob berish",
                            callback_data: `response_${userr.userID}`,
                          },
                          {
                            text: "ADMIN QILISH",
                            callback_data: `setadmin_${userr.userID}`,
                          },
                        ],
                      ],
                    },
                  });
                } else {
                  bot.sendMessage(adminChatId.userID, msg, {
                    parse_mode: "HTML",
                    reply_markup: {
                      inline_keyboard: [
                        [
                          {
                            text: "Javob berish",
                            callback_data: `response_${userr.userID}`,
                          },
                        ],
                      ],
                    },
                  });
                }
              });
            });

            const updateQuery = `UPDATE users SET query = ? WHERE userID = ?`;

            setTimeout(() => {
              if (userMessage) {
                db.run(updateQuery, ["null", chatId], async (err) => {
                  if (err) {
                    console.error("Tanlovni yangilashda xato:", err.message);
                    return bot.sendMessage(
                      chatId,
                      "Tanlovni yangilashda xato."
                    );
                  }

                  await sendSelection(chatId);
                });
              }
            }, 1000);
          }
        });
      }
    }
  });
});

// Tanlov amalga oshirilganda, query yangilanadi
bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  const updateQuery = `UPDATE users SET query = ? WHERE userID = ?`;

  if (data.startsWith("response_")) {
    const userId = data.split("_")[1]; // Foydalanuvchi ID sini ajratib olish

    bot.sendMessage(chatId, "Iltimos, javobingizni yuboring:");

    bot.once("message", (msg) => {
      const userMessage = msg.text;
      console.log("data", data);
      console.log("userId", userId);

      // Foydalanuvchiga javob yuborish
      bot.sendMessage(
        userId,
        `Sizga admindan javob keldi: \n\n<i> ${userMessage}</i> `,
        {
          parse_mode: "HTML",
        }
      );

      // Adminlarga javob yuborish
      bot.sendMessage(
        chatId,
        `<b>✅Habaringiz yuborildi: </b>\n\n <i>${userMessage}</i>`,
        {
          parse_mode: "HTML",
        }
      );
    });
  } else if (data.startsWith("setadmin_")) {
    const chatId = callbackQuery.message.chat.id; // chatId ni callbackQuery dan olish
    const userId = data.split("_")[1]; // Foydalanuvchi ID sini ajratib olish

    // Admin bo'lishi uchun update query
    const setAdmin = `UPDATE users SET isAdmin = ? WHERE userID = ?`;

    db.run(setAdmin, [1, userId], (err) => {
      // isAdmin qiymatini 1 ga o'zgartirish
      if (err) {
        console.error("Foydalanuvchini admin qilishda xato:", err.message);
        return bot.sendMessage(chatId, "Foydalanuvchini admin qilishda xato.");
      }

      bot.sendMessage(chatId, "Foydalanuvchi admin qilindi.");

      // Foydalanuvchiga admin bo'lganligini bildiruvchi xabar yuborish
      bot.sendMessage(userId, "Siz endi admin bo'ldingiz.");
    });
  } else
    db.run(updateQuery, [data, chatId], (err) => {
      if (err) {
        console.error("Tanlovni yangilashda xato:", err.message);
        return bot.sendMessage(chatId, "Tanlovni yangilashda xato.");
      }

      bot.sendMessage(chatId, " <b> 📩 Yaxshi,  Endi xabar yuboring.</b>", {
        parse_mode: "HTML",
      });

      // Foydalanuvchi xabar yuborishi uchun kutish
    });
});

console.log("Bot faol! 👋");
