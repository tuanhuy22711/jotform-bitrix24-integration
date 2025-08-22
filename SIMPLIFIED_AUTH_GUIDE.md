# Hướng dẫn cấu hình Simplified Method cho Bitrix24

## Tổng quan

Simplified Method for Obtaining OAuth 2.0 Tokens là phương thức đơn giản để tích hợp với Bitrix24, được sử dụng khi ứng dụng hoạt động trong Bitrix24 interface. Hướng dẫn này dựa trên tài liệu chính thức của Bitrix24.

## Các phương thức cài đặt

### 1. Direct Installation POST Data (Simplified Method)

Khi ứng dụng được mở trong Bitrix24 interface, nó nhận được dữ liệu POST sau:

```php
array (
    'DOMAIN' => 'account.bitrix24.com',
    'PROTOCOL' => '1',
    'LANG' => 'en',
    'APP_SID' => 'dd8cec11e347088fe87c44870a9f1dba',
    'AUTH_ID' => 'ahodg4h37n89vo17gbkgq0x1l825nnb5',
    'AUTH_EXPIRES' => '3600',
    'REFRESH_ID' => '2lg086mxijlpvwh0h7r4nl19udm4try5',
    'member_id' => 'a223c6b3710f85df22e9377d6c4f7553',
    'status' => 'P'
)
```

**Các tham số quan trọng:**
- `AUTH_ID` - Token chính để truy cập REST API
- `REFRESH_ID` - Token bổ sung để gia hạn authorization
- `DOMAIN` - Domain của account
- `member_id` - ID duy nhất của account

### 2. Application Installation Event (ONAPPINSTALL)

Đây là phương thức được khuyến nghị. Khi ứng dụng được cài đặt, handler sẽ nhận POST request với dữ liệu:

```php
array(
    'event' => 'ONAPPINSTALL',
    'data' => array(
        'VERSION' => '1',
        'LANGUAGE_ID' => 'en',
    ),
    'ts' => '1466439714',
    'auth' => array(
        'access_token' => 's6p6eclrvim6da22ft9ch94ekreb52lv',
        'expires_in' => '3600',
        'scope' => 'entity,im',
        'domain' => 'account.bitrix24.com',
        'server_endpoint' => 'https://oauth.bitrix.info/rest/',
        'status' => 'F',
        'client_endpoint' => 'https://account.bitrix24.com/rest/',
        'member_id' => 'a223c6b3710f85df22e9377d6c4f7553',
        'refresh_token' => '4s386p3q0tr8dy89xvmt96234v3dljg8',
        'application_token' => '51856fefc120afa4b628cc82d3935cce',
    ),
)
```

## Cấu hình trong ứng dụng Node.js

### 1. Environment Variables

```env
# Bitrix24 Configuration
BITRIX24_DOMAIN=b24-7woulk.bitrix24.vn
BITRIX24_CLIENT_ID=your_client_id_here
BITRIX24_CLIENT_SECRET=your_client_secret_here
BITRIX24_REDIRECT_URI=https://your-domain.com/oauth/callback

# Installation Event Callback (khuyến nghị)
BITRIX24_INSTALL_CALLBACK=https://your-domain.com/install
```

### 2. Cấu hình Installation Event Callback

Trong ứng dụng Bitrix24, cấu hình:
- **Callback link for the installation event**: `https://your-domain.com/install`
- **Uses only API**: Có thể chọn nếu ứng dụng không có interface

### 3. Xử lý Installation Data

Ứng dụng sẽ tự động xử lý cả hai phương thức:

1. **Direct Installation**: Khi truy cập URL cài đặt
2. **ONAPPINSTALL Event**: Khi có callback event

## Sử dụng AUTH_ID

Với giá trị của tham số `AUTH_ID`, bạn có thể ngay lập tức thực hiện requests đến API:

```javascript
// URL format: https://domain.bitrix24.com/rest/AUTH_ID/method
const webhookUrl = `https://${domain}/rest/${AUTH_ID}/${method}`;
```

## Các method có sẵn

### ✅ Với AUTH_ID (Simplified Method):
- `user.current` - Thông tin user hiện tại
- `app.info` - Thông tin ứng dụng
- `placement.bind` - Bind placement
- `placement.unbind` - Unbind placement
- `event.bind` - Bind events
- `event.unbind` - Unbind events

### ✅ Với OAuth2 (ONAPPINSTALL):
- Tất cả CRM methods: `crm.lead.add`, `crm.contact.add`, etc.
- User methods: `user.get`, `user.access`
- App methods: `app.option.get`, `app.option.set`

## Test và Debug

### 1. Test Installation

```bash
# Test direct installation
curl -X POST "https://your-domain.com/?DOMAIN=b24-7woulk.bitrix24.vn&PROTOCOL=1&LANG=vn&APP_SID=your_app_sid" \
  -d "AUTH_ID=your_auth_id&REFRESH_ID=your_refresh_id&member_id=your_member_id&status=P"

# Test ONAPPINSTALL event
curl -X POST "https://your-domain.com/install" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "event=ONAPPINSTALL&auth[access_token]=your_access_token&auth[refresh_token]=your_refresh_token&auth[domain]=b24-7woulk.bitrix24.vn"
```

### 2. Test API Methods

```bash
# Test simplified auth
curl -X GET http://localhost:3000/api/simplified-auth-test

# Test webhook
curl -X POST http://localhost:3000/webhook/test
```

## Troubleshooting

### Lỗi thường gặp:

1. **"Method not found" với AUTH_ID**
   - **Nguyên nhân**: AUTH_ID có giới hạn quyền truy cập
   - **Giải pháp**: Sử dụng ONAPPINSTALL event để có full access

2. **"Invalid token"**
   - **Nguyên nhân**: AUTH_ID đã hết hạn
   - **Giải pháp**: Cài đặt lại ứng dụng

3. **"Access denied"**
   - **Nguyên nhân**: Ứng dụng không có quyền
   - **Giải pháp**: Kiểm tra cấu hình trong Bitrix24

### Debug:

```bash
# Xem logs
tail -f logs/app.log

# Test connection
curl -X GET http://localhost:3000/api/status

# Test available methods
curl -X GET http://localhost:3000/api/simplified-auth-test
```

## Khuyến nghị

### Cho Development/Testing:
- ✅ Sử dụng AUTH_ID (Simplified Method)
- ✅ Đơn giản, nhanh chóng
- ✅ Phù hợp cho prototype

### Cho Production:
- ✅ Sử dụng ONAPPINSTALL event
- ✅ Full CRM access
- ✅ Token refresh tự động
- ✅ Bảo mật tốt hơn

## Kết luận

Simplified Method phù hợp cho:
- ✅ Ứng dụng đơn giản
- ✅ Development và testing
- ✅ Truy cập cơ bản

**Khuyến nghị**: Cho production, sử dụng ONAPPINSTALL event để có full CRM access và bảo mật tốt hơn. 