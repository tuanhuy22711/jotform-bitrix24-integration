# 🔄 LUỒNG HOẠT ĐỘNG - Jotform Bitrix24 Integration

## 📋 **TỔNG QUAN HỆ THỐNG**

```
[Jotform Form] → [Webhook] → [Express Server] → [OAuth2] → [Bitrix24 CRM]
     │              │              │              │              │
  User submit    Parse data    Process data   API Call    Create Lead
```

---

## 🚀 **1. KHỞI ĐỘNG HỆ THỐNG**

### **1.1. Server Startup**
```javascript
// index.js → src/server.js
[Load Environment Variables] 
    ↓
[Initialize Express App]
    ↓ 
[Setup Middleware] (CORS, Body Parser, Logging)
    ↓
[Setup Routes] (/health, /oauth, /webhook)
    ↓
[Start Listening on Port 3000]
```

### **1.2. Routes được khởi tạo:**
- **Health**: `GET /health`, `GET /ping`
- **OAuth2**: `GET /oauth/authorize`, `GET /oauth/callback`, `GET /oauth/status`
- **Webhook**: `POST /webhook/jotform`, `POST /webhook/test`

---

## 🔐 **2. QUY TRÌNH OAUTH2 (Setup lần đầu)**

### **2.1. Authorization Flow:**
```
User truy cập: GET /oauth/authorize
    ↓
Server tạo authorization URL với:
├── client_id: local.68a050ddaec1b3.43408198
├── client_secret: qDLrdWyYY02LA3FVMtMg6aH3g5fF7w0RDgburwMZ3YzsIqloV2
├── redirect_uri: https://mart-guitars-educated-idea.trycloudflare.com/oauth/callback
└── scope: crm
    ↓
Redirect user đến Bitrix24 authorization page
    ↓
User login và approve permissions
    ↓
Bitrix24 callback: GET /oauth/callback?code=xxx&state=yyy
    ↓
Server exchange code for tokens:
├── access_token (để gọi API)
└── refresh_token (để refresh access_token)
    ↓
Store tokens và ready to use!
```

### **2.2. Token Management:**
```javascript
// src/services/bitrix24OAuth.js
class Bitrix24OAuth {
  exchangeCodeForToken(code) // Đổi code lấy token
  refreshAccessToken()       // Refresh khi token hết hạn  
  makeApiCall(method, params) // Gọi API với token
}
```

---

## 📨 **3. QUY TRÌNH WEBHOOK CHÍNH**

### **3.1. Jotform gửi webhook:**
```
User submit form trên Jotform
    ↓
Jotform tự động POST đến: /webhook/jotform
Content-Type: multipart/form-data
Body: {
  submissionID: "12345",
  rawRequest: "{\"q3_name\":{\"first\":\"John\",\"last\":\"Doe\"},...}"
}
```

### **3.2. Server xử lý webhook:**

**Bước 1: Nhận và validate request**
```javascript
// src/routes/webhook.js line 54-65
router.post('/jotform', upload.none(), async (req, res) => {
  // 1. Log request info
  logger.info('Jotform webhook received', {
    submissionID: req.body.submissionID,
    hasRawRequest: !!req.body.rawRequest,
    ip: req.ip
  });
  
  // 2. Validate submission ID
  const submissionId = req.body.submissionID;
  if (!submissionId) {
    return res.status(400).json({error: 'Missing submission ID'});
  }
```

**Bước 2: Parse dữ liệu form**
```javascript
// src/routes/webhook.js line 69-80
// Parse form data từ rawRequest (JSON string)
let formData = {};
if (req.body.rawRequest) {
  try {
    formData = JSON.parse(req.body.rawRequest);
  } catch (error) {
    return res.status(400).json({error: 'Invalid JSON in rawRequest'});
  }
}
```

**Bước 3: Trích xuất thông tin liên hệ**
```javascript
// src/routes/webhook.js line 10-48
function parseJotformData(formData, submissionId) {
  const contactData = {
    fullName: '',
    phone: '', 
    email: '',
    submissionId: submissionId,
    submittedAt: new Date().toISOString()
  };

  // Parse name từ q3_name: {first: "John", last: "Doe"}
  if (formData.q3_name) {
    const nameObj = formData.q3_name;
    if (typeof nameObj === 'object') {
      contactData.fullName = `${nameObj.first} ${nameObj.last}`.trim();
    }
  }

  // Parse phone từ q4_phoneNumber: {full: "+1234567890"}
  if (formData.q4_phoneNumber) {
    const phoneObj = formData.q4_phoneNumber;
    contactData.phone = phoneObj.full || phoneObj.toString();
  }

  // Parse email từ q5_email: "user@example.com"
  if (formData.q5_email) {
    contactData.email = formData.q5_email.toString();
  }

  return contactData;
}
```

**Bước 4: Validate dữ liệu**
```javascript
// src/routes/webhook.js line 90-95
if (!contactData.fullName && !contactData.email && !contactData.phone) {
  return res.status(400).json({
    success: false,
    error: 'No valid contact data found'
  });
}
```

**Bước 5: Tạo Lead trong Bitrix24**
```javascript
// src/routes/webhook.js line 98
const result = await createLead(contactData);
```

### **3.3. Tạo Lead trong Bitrix24:**

**Logic trong Bitrix24Service:**
```javascript
// src/services/bitrix24.js
class Bitrix24Service {
  async createLead(contactData) {
    // 1. Chuẩn bị dữ liệu lead
    const leadData = {
      fields: {
        TITLE: `Jotform Lead: ${contactData.fullName}`,
        NAME: extractFirstName(contactData.fullName),
        LAST_NAME: extractLastName(contactData.fullName),
        EMAIL: [{VALUE: contactData.email, VALUE_TYPE: 'WORK'}],
        PHONE: [{VALUE: contactData.phone, VALUE_TYPE: 'WORK'}],
        SOURCE_ID: 'WEBFORM',
        STATUS_ID: 'NEW',
        COMMENTS: `Submission ID: ${contactData.submissionId}...`
      }
    };

    // 2. Thử OAuth2 API call trước
    let result = await this.oauth.makeApiCall('crm.lead.add', leadData);
    
    // 3. Nếu OAuth2 fail, fallback về legacy webhook
    if (!result.success && config.bitrix24.restUrl) {
      result = await this.createLeadLegacy(contactData);
    }
    
    return result;
  }
}
```

**API Call Flow:**
```
[OAuth2 Method]
POST https://b24-7woulk.bitrix24.vn/rest/crm.lead.add.json
Headers: {Content-Type: application/json}
Body: {
  fields: {...},
  auth: "access_token_here"
}
    ↓ (if fails)
[Legacy Webhook Method]  
POST https://b24-7woulk.bitrix24.vn/rest/1/rg1j0gwz9z74hdqe/crm.lead.add.json
Body: {FIELDS: {...}}
```

---

## 📊 **4. RESPONSE FLOW**

### **4.1. Thành công:**
```javascript
// Webhook response
{
  "success": true,
  "message": "Lead created successfully in Bitrix24",
  "data": {
    "submissionId": "12345",
    "leadId": "67890",
    "processingTime": 1500
  }
}
```

### **4.2. Lỗi:**
```javascript
// Validation error
{
  "success": false, 
  "error": "No valid contact data found"
}

// API error
{
  "success": false,
  "error": "Failed to create lead in Bitrix24", 
  "details": "Token expired"
}
```

---

## 🔧 **5. ERROR HANDLING & FALLBACK**

### **5.1. Token Management:**
```
API Call with access_token
    ↓ (if token expired)
Auto refresh using refresh_token
    ↓ (retry with new token)
API Call again
    ↓ (if still fails)
Fallback to legacy webhook method
```

### **5.2. Logging Strategy:**
```
Request → Parse → Validate → API Call → Response
   │        │        │         │         │
  Log     Log      Log       Log       Log
 INFO    DEBUG    WARN     ERROR     INFO
```

---

## 🎯 **6. MONITORING ENDPOINTS**

### **6.1. Health Check:**
```bash
GET /health
# Kiểm tra kết nối Jotform & Bitrix24

GET /ping  
# Simple health check
```

### **6.2. OAuth Status:**
```bash
GET /oauth/status
# Kiểm tra trạng thái authorization

GET /oauth/authorize
# Bắt đầu authorization flow
```

### **6.3. Testing:**
```bash
POST /webhook/test
# Test tạo lead với dữ liệu mẫu
```

---

## 📝 **7. CONFIGURATION**

### **7.1. Environment Variables:**
```bash
# OAuth2 (Primary method)
BITRIX24_CLIENT_ID=local.68a050ddaec1b3.43408198
BITRIX24_CLIENT_SECRET=qDLrdWyYY02LA3FVMtMg6aH3g5fF7w0RDgburwMZ3YzsIqloV2
BITRIX24_DOMAIN=b24-7woulk.bitrix24.vn
BITRIX24_REDIRECT_URI=https://mart-guitars-educated-idea.trycloudflare.com/oauth/callback

# Legacy webhook (Fallback)
BITRIX24_REST_URL=https://b24-7woulk.bitrix24.vn/rest/1/rg1j0gwz9z74hdqe/
```

### **7.2. Data Flow:**
```
Environment → Config → Services → Routes → Response
```

---

## 🚀 **CÁCH SỬ DỤNG:**

1. **Setup OAuth2 (lần đầu):**
   ```bash
   GET http://localhost:3000/oauth/authorize
   ```

2. **Configure Jotform webhook:**
   ```
   URL: https://your-domain.com/webhook/jotform
   ```

3. **Test webhook:**
   ```bash
   POST http://localhost:3000/webhook/test
   ```

4. **Monitor:**
   ```bash
   GET http://localhost:3000/health
   GET http://localhost:3000/oauth/status
   ```
