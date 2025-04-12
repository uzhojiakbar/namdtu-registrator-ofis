import initSqlJs from "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js";

const SQL = await initSqlJs({
  locateFile: (file) =>
    `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`,
});

const response = await fetch("../bot.db"); // bot.db faylingiz shu yerda bo'lishi kerak
const buffer = await response.arrayBuffer();
const db = new SQL.Database(new Uint8Array(buffer));

const startDate = "2025-04-01";
const endDate = "2025-04-11";

const query = `
  SELECT category, COUNT(*) as count
  FROM logs
  WHERE date(timestamp) BETWEEN ? AND ?
  GROUP BY category
`;

const result = db.exec(query, [startDate, endDate]);

// Umumiy sonni topamiz
const totalCount = result[0].values.reduce((sum, row) => sum + row[1], 0);

// Jadval tayyorlaymiz
let html = `<table border="1" cellpadding="5">
  <tr><th>Kategoriya</th><th>Soni</th><th>Foizi</th></tr>`;

result[0].values.forEach(([category, count]) => {
  const percent = ((count / totalCount) * 100).toFixed(1);
  html += `<tr><td>${category}</td><td>${count}</td><td>${percent}%</td></tr>`;
});

html += `</table>`;

document.getElementById("output").innerHTML = html;
