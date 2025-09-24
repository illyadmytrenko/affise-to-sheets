// routes/affise.js
import axios from "axios";
import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

async function getAffiseDataConversions(dateFrom, dateTo) {
  const allConversions = [];
  const limit = 500;
  let page = 1;

  try {
    while (true) {
      const res = await axios.get(
        `${process.env.AFFISE_API_URL}/stats/conversions`,
        {
          headers: { "API-Key": process.env.AFFISE_API_KEY },
          params: {
            date_from: dateFrom,
            date_to: dateTo,
            status: 2,
            limit,
            page,
          },
        }
      );

      const data = res.data;
      if (!data?.conversions?.length) break;

      allConversions.push(...data.conversions);

      if (data.conversions.length < limit) break;
      page++;
    }

    return { conversions: allConversions };
  } catch (err) {
    console.error("Error fetching data:", err.message);
    return null;
  }
}

async function writeToSheets(values) {
  const existingRes = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: process.env.RANGE,
  });

  const existingValues = existingRes.data.values || [];
  const existingKeys = new Set();

  for (let i = 1; i < existingValues.length; i++) {
    const [date, , id] = existingValues[i];
    existingKeys.add(`${date}-${id}`);
  }

  const [headers, ...rows] = values;
  const newRows = rows.filter(
    ([date, , id]) => !existingKeys.has(`${date}-${id}`)
  );

  if (newRows.length === 0) {
    console.log("Нет новых данных для записи");
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SPREADSHEET_ID,
    range: process.env.RANGE,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: newRows },
  });

  console.log(`Добавлено ${newRows.length} строк`);
}

export default {
  async getConversions(req, res) {
    try {
      const dateFrom = req.query.date_from;
      const dateTo = req.query.date_to;

      if (!dateFrom || !dateTo) {
        return res
          .status(400)
          .json({ error: "date_from and date_to are required" });
      }

      const data = await getAffiseDataConversions(dateFrom, dateTo);
      if (!data) return res.status(500).json({ error: "No data from Affise" });

      const stats = data.conversions || [];

      const headers = [
        "Дата",
        "Наименование партнера",
        "ID партнера",
        "Revenue",
        "Payouts",
      ];

      const grouped = {};
      stats.forEach((item) => {
        const date = new Intl.DateTimeFormat("ru-RU", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(item.created_at));

        const partnerId = item.partner?.id || "unknown";
        const key = `${date}-${partnerId}`;

        if (!grouped[key]) {
          grouped[key] = {
            date,
            name: item.partner?.name || "",
            id: item.partner?.id || "",
            revenue: 0,
            payout: 0,
          };
        }

        grouped[key].revenue += item.revenue || 0;
        grouped[key].payout += item.payouts || 0;
      });

      const rows = Object.values(grouped).map((item) => [
        item.date,
        item.name,
        item.id,
        item.revenue,
        item.payout,
      ]);

      const values = [headers, ...rows];
      await writeToSheets(values);

      res.json({
        message: "Data successfully written to Google Sheets",
        count: rows.length,
      });
    } catch (err) {
      console.error("Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
};
