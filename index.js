const { google } = require('googleapis');
const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

const auth = new google.auth.GoogleAuth({
  keyFile: './credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const spreadsheetId = '1VSL25sT6FQHjv1su9pfoNr6SmRigzJKHu03W8TVHX6Q';
let cachedData = [];

// Hàm đọc dữ liệu từ sheet
async function readSheet() {
    const sheets = google.sheets({ version: 'v4', auth });
    const range = "'Danh sách mua phiếu'!A4:E903";

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId, range
        });
        cachedData = response.data.values || [];
        return cachedData;
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

// API endpoint để lấy dữ liệu theo số phiếu
app.get('/api/search', (req, res) => {
    const searchNumbers = req.query.numbers.split(' ').map(num => num.trim());
    const results = cachedData.filter(row => 
        searchNumbers.includes(row[0]?.trim())
    );
    res.json(results);
});

// Cập nhật dữ liệu mỗi phút
setInterval(readSheet, 60000);

// Đọc dữ liệu lần đầu khi khởi động server
readSheet();

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});