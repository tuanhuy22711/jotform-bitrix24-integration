# Hướng dẫn cấu hình Simplified Method cho Bitrix24

## Tổng quan

Dựa trên tài liệu chính thức của Bitrix24, có 2 phương thức để lấy OAuth 2.0 tokens:

1. **Simplified Method** (AUTH_ID) - Cho ứng dụng trong Bitrix24 interface
2. **ONAPPINSTALL Event** - Cho ứng dụng chỉ sử dụng API

## Phương thức 1: Simplified Method (AUTH_ID)

### Cách hoạt động:
Khi ứng dụng được mở trong Bitrix24 interface, nó nhận được dữ liệu POST:

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

### Cách sử dụng:
```javascript
// URL format: https://domain.bitrix24.com/rest/AUTH_ID/method
const webhookUrl = `https://${domain}/rest/${AUTH_ID}/${method}`;
```

### Giới hạn:
- Chỉ có quyền truy cập cơ bản
- Không có full CRM access
- Phù hợp cho development/testing

## Phương thức 2: ONAPPINSTALL Event (Khuyến nghị)

### Cách hoạt động:
Khi ứng dụng được cài đặt, handler nhận POST request:

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

### Ưu điểm:
- Full CRM access
- Token refresh tự động
- Bảo mật tốt hơn
- Phù hợp cho production

## Cấu hình trong Bitrix24

### 1. Tạo ứng dụng trong Developer Portal

1. Đăng nhập: `https://dev.1c-bitrix.ru/`
2. Tạo ứng dụng mới
3. Chọn "Local Application"

### 2. Cấu hình Installation Event Callback

Trong ứng dụng, cấu hình:
- **Callback link for the installation event**: `https://your-domain.com/install`
- **Uses only API**: Chọn nếu ứng dụng không có interface

### 3. Cấu hình quyền truy cập

Đảm bảo ứng dụng có quyền truy cập CRM:
- `crm` - Full CRM access
- `user` - User information
- `app` - Application settings

## Cấu hình trong ứng dụng Node.js

### 1. Environment Variables

```env
# Bitrix24 Configuration
BITRIX24_DOMAIN=b24-7woulk.bitrix24.vn
BITRIX24_CLIENT_ID=your_client_id_here
BITRIX24_CLIENT_SECRET=your_client_secret_here
BITRIX24_REDIRECT_URI=https://your-domain.com/oauth/callback

# Installation Event Callback
BITRIX24_INSTALL_CALLBACK=https://your-domain.com/install
```

### 2. Endpoints đã được tạo

Ứng dụng đã có các endpoints sau:

- `POST /install` - Xử lý ONAPPINSTALL event
- `GET /` - Xử lý direct installation
- `POST /api/test-onappinstall` - Test ONAPPINSTALL simulation
- `GET /api/simplified-auth-test` - Test simplified auth

## Test và Debug

### 1. Test Simplified Method (AUTH_ID)

```bash
# Test direct installation
curl -X POST "https://your-domain.com/?DOMAIN=b24-7woulk.bitrix24.vn&PROTOCOL=1&LANG=vn&APP_SID=your_app_sid" \
  -d "AUTH_ID=your_auth_id&REFRESH_ID=your_refresh_id&member_id=your_member_id&status=P"

# Test simplified auth capabilities
curl -X GET http://localhost:3000/api/simplified-auth-test
```

### 2. Test ONAPPINSTALL Event

```bash
# Test ONAPPINSTALL event simulation
curl -X POST http://localhost:3000/api/test-onappinstall

# Test actual ONAPPINSTALL event
curl -X POST "https://your-domain.com/install" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "event=ONAPPINSTALL&auth[access_token]=your_access_token&auth[refresh_token]=your_refresh_token&auth[domain]=b24-7woulk.bitrix24.vn"
```

### 3. Test Webhook

```bash
# Test webhook với token hiện tại
curl -X POST http://localhost:3000/webhook/test
```

## Troubleshooting

### Lỗi "Method not found" với AUTH_ID

**Nguyên nhân**: AUTH_ID có giới hạn quyền truy cập

**Giải pháp**:
1. Sử dụng ONAPPINSTALL event để có full access
2. Hoặc sử dụng các method cơ bản: `user.current`, `app.info`

### Lỗi "Invalid token"

**Nguyên nhân**: Token đã hết hạn

**Giải pháp**:
1. Cài đặt lại ứng dụng
2. Hoặc sử dụng refresh token (nếu có)

### Lỗi "Access denied"

**Nguyên nhân**: Ứng dụng không có quyền

**Giải pháp**:
1. Kiểm tra cấu hình quyền trong Bitrix24
2. Đảm bảo ứng dụng có quyền CRM

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

Simplified Method phù hợp cho development và testing, nhưng cho production nên sử dụng ONAPPINSTALL event để có full CRM access và bảo mật tốt hơn.

Ứng dụng hiện tại đã hỗ trợ cả hai phương thức và sẽ tự động chọn phương thức phù hợp dựa trên dữ liệu nhận được. 