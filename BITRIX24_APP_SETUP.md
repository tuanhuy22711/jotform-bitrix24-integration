# 🚀 HƯỚNG DẪN TẠO ỨNG DỤNG BITRIX24

## 📋 **THÔNG TIN CẦN ĐIỀN**

### **1. Thông tin ứng dụng:**
```
Tên ứng dụng: Jotform-Bitrix24 Integration
Mô tả: Tích hợp tự động từ Jotform submissions vào Bitrix24 CRM
```

### **2. Cấu hình URL:**

**Đường dẫn xử lý của bạn*** (OAuth Callback):
```
https://mart-guitars-educated-idea.trycloudflare.com/oauth/callback
```

**Đường dẫn cài đặt ban đầu** (Install/Setup):
```
https://mart-guitars-educated-idea.trycloudflare.com/oauth/authorize
```

### **3. Cài đặt:**
- ✅ **Ứng dụng cục bộ**
- ✅ **Máy chủ tĩnh** 
- ✅ **Chỉ kịch bản (không có giao diện người dùng)**
- ✅ **Hỗ trợ BitrixMobile**

### **4. Văn bản menu (Tiếng Việt):**
```
Jotform Integration
```

### **5. Quyền truy cập:**
- ✅ **CRM (crm)** - Tạo và quản lý leads, contacts
- ✅ **User (user)** - Đọc thông tin user

---

## 🔗 **LUỒNG OAUTH2 SAU KHI TẠO APP**

### **Bước 1: Lấy thông tin App**
Sau khi tạo app, Bitrix24 sẽ cung cấp:
```
Client ID: local.xxxxxxxxx.xxxxxxxx  
Client Secret: xxxxxxxxxxxxxxxxxxxxxxx
```

### **Bước 2: Cập nhật .env**
```bash
BITRIX24_CLIENT_ID=local.xxxxxxxxx.xxxxxxxx
BITRIX24_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxx
```

### **Bước 3: Authorization Flow**
```
1. User visit: GET /oauth/authorize
2. Redirect to Bitrix24 authorization
3. User approve permissions
4. Bitrix24 callback: GET /oauth/callback?code=xxx
5. Exchange code for access_token
6. Ready to use!
```

---

## 🧪 **TESTING**

### **1. Khởi động server:**
```bash
node index.js
```

### **2. Test authorization:**
```bash
curl http://localhost:3000/oauth/authorize
```

### **3. Test connection:**
```bash
curl http://localhost:3000/oauth/status
```

### **4. Test webhook:**
```bash
curl -X POST http://localhost:3000/webhook/test
```

---

## 📝 **GHI CHÚ QUAN TRỌNG**

1. **Cloudflare Tunnel**: Đảm bảo `https://mart-guitars-educated-idea.trycloudflare.com` đang chạy và forward đến `localhost:3000`

2. **SSL Required**: Bitrix24 yêu cầu HTTPS cho OAuth callbacks

3. **Domain Whitelist**: URL callback phải chính xác khớp với cấu hình trong app

4. **Scope Permissions**: Chỉ request quyền cần thiết (crm, user)

5. **Token Storage**: Trong production cần lưu tokens vào database an toàn

---

## 🔧 **TROUBLESHOOTING**

### **Lỗi thường gặp:**

**1. Invalid redirect_uri:**
- Kiểm tra URL callback chính xác
- Đảm bảo HTTPS

**2. Invalid client_id/secret:**
- Cập nhật đúng thông tin từ app Bitrix24
- Kiểm tra file .env

**3. Scope denied:**
- Đảm bảo app có quyền CRM
- User phải approve permissions

**4. Token expired:**
- Hệ thống tự động refresh token
- Nếu không được, authorize lại

---

## 📱 **ỨNG DỤNG HOÀN CHỈNH**

Sau khi setup xong:

```
[Jotform Form] → [Webhook] → [Your Server] → [OAuth2] → [Bitrix24 CRM]
     │              │              │              │              │
  User submit    Parse data    Authenticate   API Call    Create Lead
```

**Endpoints available:**
- `GET /health` - Health check
- `GET /oauth/authorize` - Start authorization
- `GET /oauth/callback` - Handle callback  
- `GET /oauth/status` - Check authorization status
- `POST /webhook/jotform` - Jotform webhook handler
- `POST /webhook/test` - Test lead creation
