# 🏗️ **KIẾN TRÚC MỚI - Jotform Bitrix24 Integration**

## 📋 **TỔNG QUAN**

Kiến trúc mới được thiết kế theo mô hình **Dependency Injection** tương tự như NestJS, với các service được tách biệt rõ ràng và dễ test. Tất cả được viết bằng **JavaScript** thuần.

## 🏛️ **KIẾN TRÚC TỔNG THỂ**

```
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                          │
├─────────────────────────────────────────────────────────────┤
│  Routes (Controllers)                                      │
│  ├── /oauth/*     - OAuth2 authentication                  │
│  ├── /webhook/*   - Jotform webhook handling               │
│  ├── /api/*       - REST API endpoints                     │
│  └── /health      - Health checks                          │
├─────────────────────────────────────────────────────────────┤
│  Service Container (Dependency Injection)                  │
│  ├── ConfigService      - Environment configuration         │
│  ├── HttpService        - HTTP client wrapper              │
│  ├── DatabaseService    - Token storage                    │
│  └── Bitrix24NewService - Bitrix24 API integration        │
├─────────────────────────────────────────────────────────────┤
│  Data Layer                                               │
│  ├── data/tokens.json   - Token storage (file-based)      │
│  └── logs/              - Application logs                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔧 **CÁC SERVICE CHÍNH**

### **1. ConfigService**
```javascript
class ConfigService {
  get(key, defaultValue)
  getServerConfig()
  getBitrix24Config()
  getJotformConfig()
  validateConfig()
}
```

**Chức năng:**
- Quản lý environment variables
- Validation configuration
- Type-safe configuration access
- Default values cho development

### **2. HttpService**
```javascript
class HttpService {
  get(url, config)
  post(url, data, config)
  put(url, data, config)
  delete(url, config)
  patch(url, data, config)
}
```

**Chức năng:**
- HTTP client wrapper với Axios
- Request/Response interceptors
- Logging tự động
- Error handling

### **3. DatabaseService**
```javascript
class DatabaseService {
  async saveToken(tokenData)
  async getCurrentToken()
  async updateToken(id, updates)
  async deleteToken(id)
  async clearAllTokens()
}
```

**Chức năng:**
- Token storage (hiện tại dùng file, có thể thay bằng database)
- CRUD operations cho tokens
- Token expiration checking
- Backup và restore

### **4. Bitrix24NewService**
```javascript
class Bitrix24NewService {
  async processInstallation(authData)
  async exchangeCodeForToken(code, state)
  async getTokenStatus()
  async refreshTokenIfNeeded(force)
  async callBitrixAPI(method, params)
  async createLead(contactData)
}
```

**Chức năng:**
- OAuth2 authentication flow
- Token management (refresh, validation)
- Bitrix24 API calls
- Lead creation
- Error handling và retry logic

---

## 🔄 **LUỒNG HOẠT ĐỘNG MỚI**

### **1. Khởi tạo Service Container**
```javascript
// Service container tự động khởi tạo các service theo thứ tự dependency
const container = ServiceContainer.getInstance();

// Lấy service instances
const bitrix24Service = container.getBitrix24Service();
const configService = container.getConfigService();
```

### **2. OAuth2 Flow**
```javascript
// 1. User truy cập /oauth/authorize
// 2. Server tạo authorization URL
// 3. User approve trên Bitrix24
// 4. Bitrix24 callback với authorization code
// 5. Server exchange code lấy tokens
// 6. Lưu tokens vào database
// 7. Ready to use!
```

### **3. Webhook Processing**
```javascript
// 1. Nhận webhook từ Jotform
// 2. Parse và validate dữ liệu
// 3. Gọi Bitrix24NewService.createLead()
// 4. Service tự động handle token refresh nếu cần
// 5. Trả về kết quả
```

---

## 📁 **CẤU TRÚC FILE**

```
src/
├── dto/
│   └── bitrix-auth.dto.js          # Data Transfer Objects
├── services/
│   ├── config.service.js            # Configuration management
│   ├── http.service.js              # HTTP client wrapper
│   ├── database.service.js          # Token storage
│   ├── bitrix24-new.service.js     # Bitrix24 integration
│   └── service-container.js         # Dependency injection container
├── routes/                          # Express routes (giữ nguyên)
├── middleware/                      # Express middleware (giữ nguyên)
├── utils/                          # Utility functions (giữ nguyên)
├── config/                         # Configuration files (giữ nguyên)
└── index.js                        # Application entry point
```

---

## 🚀 **CÁCH SỬ DỤNG**

### **1. Cài đặt dependencies**
```bash
# Sử dụng package-ts.json (đã được cập nhật cho JavaScript)
cp package-ts.json package.json
npm install
```

### **2. Khởi động development**
```bash
# Development
npm run dev

# Start production
npm start
```

### **3. Sử dụng service trong routes**
```javascript
// src/routes/oauth.js
const { ServiceContainer } = require('../services/service-container');

router.get('/status', async (req, res) => {
  try {
    const container = ServiceContainer.getInstance();
    const bitrix24Service = container.getBitrix24Service();
    
    const status = await bitrix24Service.getTokenStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🔍 **SO SÁNH KIẾN TRÚC CŨ VÀ MỚI**

| Aspect | Kiến trúc cũ | Kiến trúc mới |
|--------|--------------|---------------|
| **Architecture** | Monolithic | Service-oriented |
| **Dependencies** | Direct imports | Dependency injection |
| **Testing** | Hard to test | Easy to mock |
| **Maintenance** | Tightly coupled | Loosely coupled |
| **Scalability** | Limited | Better separation |
| **Language** | JavaScript | JavaScript (ES6+) |
| **Error Handling** | Basic | Comprehensive |
| **Logging** | Basic | Structured |

---

## 🧪 **TESTING**

### **1. Unit Testing**
```javascript
// Mỗi service có thể test độc lập
describe('Bitrix24NewService', () => {
  let service;
  let mockConfigService;
  let mockHttpService;
  let mockDatabaseService;

  beforeEach(() => {
    // Mock dependencies
    service = new Bitrix24NewService(
      mockConfigService,
      mockHttpService,
      mockDatabaseService
    );
  });

  it('should create lead successfully', async () => {
    // Test implementation
  });
});
```

### **2. Integration Testing**
```javascript
// Test service container
describe('ServiceContainer', () => {
  it('should initialize all services', () => {
    const container = ServiceContainer.getInstance();
    expect(container.has('Bitrix24NewService')).toBe(true);
  });
});
```

---

## 🔮 **ROADMAP TƯƠNG LAI**

### **Phase 1: Migration (Hoàn thành)**
- ✅ Service architecture
- ✅ Dependency injection
- ✅ JavaScript implementation
- ✅ Token management

### **Phase 2: Enhancement**
- [ ] Database integration (PostgreSQL/MySQL)
- [ ] Redis caching
- [ ] Queue system (Bull/BullMQ)
- [ ] Metrics và monitoring

### **Phase 3: Production Ready**
- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] CI/CD pipeline
- [ ] Performance optimization

---

## 📚 **TÀI LIỆU THAM KHẢO**

- [NestJS Documentation](https://docs.nestjs.com/)
- [JavaScript ES6+ Features](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
- [Dependency Injection Patterns](https://martinfowler.com/articles/injection.html)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

## 🤝 **ĐÓNG GÓP**

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

---

## 📄 **LICENSE**

MIT License - xem file LICENSE để biết thêm chi tiết.
