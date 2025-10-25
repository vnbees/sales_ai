import React, { useState } from 'react';

function ProductInfoCard({ product }) {
  const [collapsed, setCollapsed] = useState(false);

  if (!product) return null;

  return (
    <div className={`product-info-card ${collapsed ? 'collapsed' : ''}`}>
      <div className="product-header" onClick={() => setCollapsed(!collapsed)}>
        <h3>📦 {product.name}</h3>
        <button className="collapse-btn">
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="product-details">
          <div className="product-price">
            <strong>Giá:</strong> {product.price}
          </div>

          <div className="product-features">
            <strong>Tính năng:</strong>
            <ul>
              {product.features.map((feature, idx) => (
                <li key={idx}>{feature}</li>
              ))}
            </ul>
          </div>

          {product.target_audience && (
            <div className="product-target">
              <strong>Đối tượng:</strong> {product.target_audience}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ProductInfoCard;
