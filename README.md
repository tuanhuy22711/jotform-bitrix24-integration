# Jotform-Bitrix24 Integration API

Ứng dụng API Node.js để tích hợp tự động giữa Jotform và Bitrix24 CRM. Khi có submission mới từ Jotform, ứng dụng sẽ tự động tạo contact và lead trong Bitrix24.

## 🌟 Tính năng

- ✅ Webhook handler cho Jotform submissions
- ✅ Tự động tạo contact trong Bitrix24 CRM
- ✅ Tự động tạo lead cho mỗi submission
- ✅ Tìm kiếm và cập nhật contact đã tồn tại
- ✅ Logging chi tiết với Winston
- ✅ Rate limiting và security middleware
- ✅ Health check endpoints
- ✅ Graceful shutdown handling
- ✅ Error handling và validation

## 🚀 Cài đặt

### Yêu cầu
- Node.js 16+ 
- npm hoặc yarn
- Jotform API key
- Bitrix24 REST API webhook URL

### Các bước cài đặt

1. **Clone và cài đặt dependencies:**
```bash
cd jotform-bitrix24-integration
npm install
```

2. **Cấu hình environment variables:**
```bash
cp .env.example .env
```

3. **Chỉnh sửa file `.env`:**
```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Jotform Configuration
JOTFORM_API_KEY=your_jotform_api_key_here
JOTFORM_API_URL=https://api.jotform.com
JOTFORM_FORM_ID=your_form_id_here

# Bitrix24 Configuration
BITRIX24_WEBHOOK_URL=your_bitrix24_webhook_url_here
BITRIX24_REST_URL=https://your-domain.bitrix24.com/rest/1/your_webhook_code

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

4. **Khởi chạy ứng dụng:**
```bash
npm start
```

## 📖 Cách sử dụng

### 1. Cấu hình Jotform Webhook

1. Vào Jotform form settings
2. Chọn "Integrations" > "Webhooks" 
3. Thêm webhook URL: `http://your-server.com/webhook/jotform`
4. Chọn "Complete Submission" trigger

### 2. Cấu hình Bitrix24 REST API

1. Vào Bitrix24 > Applications > REST API
2. Tạo incoming webhook mới
3. Copy webhook URL và paste vào `.env`

### 3. Test kết nối

```bash
# Test Jotform connection
curl http://localhost:3000/test/jotform

# Test Bitrix24 connection  
curl http://localhost:3000/test/bitrix24

# Health check
curl http://localhost:3000/health
```

## 🔗 API Endpoints

### Webhook Endpoints
- `POST /webhook/jotform` - Xử lý webhook từ Jotform
- `POST /webhook/test` - Test endpoint (chỉ development)

### Health Check
- `GET /health` - Kiểm tra trạng thái services
- `GET /ping` - Simple ping endpoint

### Information
- `GET /api/info` - Thông tin API và endpoints

### Test Endpoints (Development only)
- `GET /test/jotform` - Test Jotform connection
- `GET /test/bitrix24` - Test Bitrix24 connection

## 📊 Logging

Ứng dụng sử dụng Winston để logging:

- **Console output**: Hiển thị logs trong development
- **File logging**: Lưu logs vào `logs/app.log`
- **Error logging**: Lưu errors vào `logs/error.log`
- **HTTP request logging**: Log tất cả HTTP requests
- **API call logging**: Log các API calls tới external services
- **Webhook logging**: Log webhook processing

## 🛡️ Security Features

- **Helmet.js**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate limiting**: Giới hạn requests per IP
- **Request size limiting**: Giới hạn kích thước request body
- **Input validation**: Validate webhook payloads

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment (development/production) | No | development |
| `PORT` | Server port | No | 3000 |
| `JOTFORM_API_KEY` | Jotform API key | Yes | - |
| `JOTFORM_FORM_ID` | Jotform form ID | Yes | - |
| `BITRIX24_REST_URL` | Bitrix24 REST API URL | Yes | - |
| `LOG_LEVEL` | Logging level | No | info |

### Field Mapping

Ứng dụng tự động map các fields từ Jotform sang Bitrix24:

- **Full Name** → `NAME` + `LAST_NAME`
- **Email** → `EMAIL` (work type)
- **Phone** → `PHONE` (work type)
- **Submission metadata** → `COMMENTS`

## 🚀 Deployment

### PM2 (Recommended)

1. **Cài đặt PM2:**
```bash
npm install -g pm2
```

2. **Tạo PM2 config:**
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'jotform-bitrix24-api',
    script: './bin/start.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

3. **Deploy:**
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Docker

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

```bash
# Test webhook với sample data
curl -X POST http://localhost:3000/webhook/test \
  -H "Content-Type: application/json" \
  -d '{}'

# Test với Postman collection (nếu có)
npm run test:postman
```

## 📈 Monitoring

### Health Check Response
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "jotform": {
      "status": "up",
      "message": "Jotform connection is working"
    },
    "bitrix24": {
      "status": "up", 
      "message": "Bitrix24 connection is working"
    }
  }
}
```

### Logs Structure
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Webhook processed successfully",
  "meta": {
    "submissionId": "12345",
    "contactId": "67890",
    "duration": 1200
  }
}
```

## ❗ Troubleshooting

### Common Issues

1. **Connection refused to Bitrix24:**
   - Kiểm tra BITRIX24_REST_URL
   - Đảm bảo webhook còn active trong Bitrix24

2. **Jotform API authentication error:**
   - Kiểm tra JOTFORM_API_KEY
   - Đảm bảo API key có quyền truy cập form

3. **Webhook không nhận được data:**
   - Kiểm tra webhook URL trong Jotform
   - Kiểm tra firewall/proxy settings

### Debug Mode

```bash
NODE_ENV=development LOG_LEVEL=debug npm start
```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch  
5. Create Pull Request

## 📄 License

MIT License - xem [LICENSE](LICENSE) file.

## 📞 Support

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs trong `logs/` folder
2. Xem [troubleshooting section](#troubleshooting)
3. Tạo issue trên GitHub

---

Made with ❤️ for seamless Jotform-Bitrix24 integration
