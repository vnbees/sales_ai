import React from 'react';
import { useNavigate } from 'react-router-dom';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <center>
      <div className="landing-page">
        <h1>🎭 AI Salesperson</h1>
        <p className="subtitle">Hệ thống bán hàng AI chuyên nghiệp</p>

        <div className="role-selection">
          <div
            className="role-card seller-card"
            onClick={() => navigate('/seller')}
          >
            <div className="role-icon">💼</div>
            <h2>Người Bán</h2>
            <p>Nhập thông tin sản phẩm</p>
            <p>Tạo link chia sẻ cho khách hàng</p>
            <button className="role-btn">Bắt đầu →</button>
          </div>

          <div className="role-card buyer-card disabled">
            <div className="role-icon">🛒</div>
            <h2>Người Mua</h2>
            <p>Chat với AI Sales Person</p>
            <p>Cần link từ người bán</p>
            <button className="role-btn" disabled>Cần Link</button>
          </div>
        </div>

        <div className="info-section">
          <h3>📋 Cách sử dụng:</h3>
          <ol>
            <li><strong>Người bán:</strong> Click "Người Bán" → Nhập thông tin sản phẩm → Nhận link</li>
            <li><strong>Chia sẻ:</strong> Gửi link cho khách hàng qua Zalo, Messenger, v.v.</li>
            <li><strong>Người mua:</strong> Click link → Chat với AI → Được tư vấn & chốt sale</li>
          </ol>
        </div>
      </div>
    </center>
  );
}

export default LandingPage;
