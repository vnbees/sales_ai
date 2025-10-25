# Hướng dẫn Deploy lên Render.com

## 🚀 Các bước Deploy

### Bước 1: Push Code lên GitHub

```bash
# Add tất cả files
git add .

# Commit
git commit -m "Ready for deployment"

# Push code
git push origin main
```

---

### Bước 2: Deploy trên Render (Dùng Blueprint)

1. Truy cập [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → Chọn **"Blueprint"**
3. Kết nối GitHub repository của bạn
4. Render sẽ tự động phát hiện file `render.yaml`
5. Click **"Apply"**

Render sẽ tự động tạo 2 services:
- ✅ **Backend** (Web Service - Node.js)
- ✅ **Frontend** (Static Site - React)

---

### Bước 3: Cấu hình Environment Variables

#### Backend Service:
1. Vào **Backend Service** (chat-app-backend) → Tab **"Environment"**
2. Thêm biến môi trường:
   ```
   GOOGLE_API_KEY=<paste_your_google_api_key_here>
   NODE_ENV=production
   ```
3. Biến `FRONTEND_URL` sẽ được tự động set sau khi frontend deploy xong (Bước 4)

#### Frontend Service:
- Biến `VITE_API_URL` đã được tự động cấu hình qua `render.yaml`
- Không cần cấu hình gì thêm

---

### Bước 4: Cập nhật Frontend URL trong Backend

**Sau khi cả 2 services deploy xong:**

1. Copy URL frontend (ví dụ: `https://chat-app-frontend-xxxx.onrender.com`)
2. Vào **Backend Service** → Tab **"Environment"**
3. Thêm/cập nhật biến:
   ```
   FRONTEND_URL=https://chat-app-frontend-xxxx.onrender.com
   ```
4. Click **"Save Changes"** → Backend sẽ tự động redeploy

---

### Bước 5: Kiểm tra và Sử dụng

**URLs của bạn:**
- 🌐 Frontend: `https://chat-app-frontend-xxxx.onrender.com`
- ⚙️ Backend: `https://chat-app-backend-xxxx.onrender.com`

Mở trình duyệt và truy cập URL frontend để test!

---

## ⚠️ Lưu ý quan trọng

### Free Tier Limitations
- Service sẽ **"ngủ" sau 15 phút** không hoạt động
- Khi có request mới, mất ~30-50 giây để khởi động lại
- Nâng cấp lên $7/tháng để service chạy 24/7

### SQLite Database
- Data có thể mất khi redeploy
- Production thực tế nên dùng PostgreSQL

---

## 🔄 Deploy lại khi có code mới

```bash
git add .
git commit -m "Update features"
git push origin main
# Render tự động deploy lại
```

---

## 🐛 Troubleshooting

### Backend không start
- Kiểm tra logs: **Backend Service** → Tab **"Logs"**
- Đảm bảo `GOOGLE_API_KEY` đã được set

### Frontend không gọi được Backend
- Kiểm tra `VITE_API_URL` trong Frontend Environment
- Mở Browser Console để xem error

---

**Hoàn thành! Ứng dụng đã được deploy thành công! 🎉**
