require('dotenv').config();

const { google } = require('googleapis');
const express = require('express');
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.static('public'));
app.use(express.json());

let credentials;
try {
    // Thử đọc từ biến môi trường trước
    if (process.env.GOOGLE_CREDENTIALS) {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    } else {
        // Nếu không có biến môi trường, đọc từ file
        credentials = require('./credentials.json');
    }
} catch (error) {
    console.error('Error loading credentials:', error);
    process.exit(1);
}

const auth = new google.auth.GoogleAuth({
    credentials,
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

// API endpoint để lấy dữ liệu theo số phiếu hoặc tên người mua
app.get('/api/search', (req, res) => {
    const query = req.query.query.trim();
    const MAX_RESULTS = 25;

    // Lấy thông tin client
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    // Phân tích user agent
    const deviceInfo = {
        isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(userAgent),
        browser: 
            /Chrome/i.test(userAgent) ? 'Chrome' :
            /Firefox/i.test(userAgent) ? 'Firefox' :
            /Safari/i.test(userAgent) ? 'Safari' :
            /Edge/i.test(userAgent) ? 'Edge' :
            /Opera|OPR/i.test(userAgent) ? 'Opera' : 'Unknown',
        os: 
            /Windows/i.test(userAgent) ? 'Windows' :
            /Mac OS/i.test(userAgent) ? 'MacOS' :
            /Android/i.test(userAgent) ? 'Android' :
            /iOS/i.test(userAgent) ? 'iOS' :
            /Linux/i.test(userAgent) ? 'Linux' : 'Unknown'
    };
    
    // Lấy thời gian hiện tại
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

    // Kiểm tra xem query chỉ chứa số, dấu cách và dấu *
    const isNumberSearch = /^[\d\s*]+$/.test(query);

    let results;
    if (isNumberSearch) {
        const numberQueries = query.split(' ').filter(q => q.length > 0);
        results = cachedData.filter(row => {
            if (!row[0]) return false;
            const ticketNumber = row[0].trim();
            return numberQueries.some(pattern => {
                if (pattern.includes('*')) {
                    // Chuyển đổi pattern thành regex
                    // Thay thế * bằng \d (một chữ số bất kỳ)
                    const regexPattern = pattern.replace(/\*/g, '\\d');
                    const regex = new RegExp(regexPattern);
                    return regex.test(ticketNumber);
                }
                return ticketNumber.includes(pattern);
            });
        }).slice(0, MAX_RESULTS);
    } else {
        const searchTerm = query.toLowerCase();
        results = cachedData.filter(row =>
            row[1]?.trim().toLowerCase().includes(searchTerm)
        ).slice(0, MAX_RESULTS);
    }

    // Log thông tin tìm kiếm
    console.log(
        `[${timestamp}] ` +
        `IP: ${clientIP} | ` +
        `Device: ${deviceInfo.isMobile ? 'Mobile' : 'Desktop'} | ` +
        `OS: ${deviceInfo.os} | ` +
        `Browser: ${deviceInfo.browser} | ` +
        `Search: "${query}" | ` +
        `Type: ${isNumberSearch ? 'Number' : 'Name'} | ` +
        `Results: ${results.length}`
    );

    res.json(results);
});

// Cập nhật dữ liệu mỗi giây
setInterval(readSheet, 5000);

// Đọc dữ liệu lần đầu khi khởi động server
readSheet();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});