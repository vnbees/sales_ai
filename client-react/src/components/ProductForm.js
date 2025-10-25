import React, { useState, useEffect } from 'react';

function ProductForm({ initialData, onSubmit, onCancel }) {
  const genId = () => `f_${Date.now()}_${Math.random()}`;

  const [formData, setFormData] = useState({
    name: '',
    price: '',
    features: [
      { id: genId(), value: '' },
      { id: genId(), value: '' }
    ],
    targetAudience: ''
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        price: initialData.price || '',
        features: initialData.features
          ? initialData.features.map(f => ({ id: genId(), value: f }))
          : [{ id: genId(), value: '' }, { id: genId(), value: '' }],
        targetAudience: initialData.targetAudience || ''
      });
    }
  }, [initialData]);

  const handleFeatureChange = (id, value) => {
    setFormData({
      ...formData,
      features: formData.features.map(f => f.id === id ? { ...f, value } : f)
    });
  };

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, { id: genId(), value: '' }]
    });
  };

  const removeFeature = (id) => {
    if (formData.features.length > 1) {
      setFormData({
        ...formData,
        features: formData.features.filter(f => f.id !== id)
      });
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = "Tên sản phẩm bắt buộc";
    if (!formData.price.trim()) errs.price = "Giá bắt buộc";

    const validFeatures = formData.features.filter(f => f.value.trim());
    if (validFeatures.length < 2) errs.features = "Cần ít nhất 2 tính năng";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        name: formData.name.trim(),
        price: formData.price.trim(),
        features: formData.features.map(f => f.value.trim()).filter(f => f),
        targetAudience: formData.targetAudience.trim() || null
      });
    }
  };

  return (
    <div className="product-form-overlay">
      <div className="product-form-modal">
        <h2>📋 Xác nhận thông tin sản phẩm</h2>
        <p className="form-subtitle">AI đã thu thập. Kiểm tra và chỉnh sửa:</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Tên sản phẩm *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="VD: Tai nghe Sony WH-1000XM5"
            />
            {errors.name && <span className="error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label>Giá *</label>
            <input
              type="text"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="VD: 8.000.000đ"
            />
            {errors.price && <span className="error">{errors.price}</span>}
          </div>

          <div className="form-group">
            <label>Tính năng * (≥2)</label>
            {formData.features.map((f, idx) => (
              <div key={f.id} className="feature-input-group">
                <input
                  type="text"
                  value={f.value}
                  onChange={(e) => handleFeatureChange(f.id, e.target.value)}
                  placeholder={`Tính năng ${idx + 1}`}
                />
                {formData.features.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeFeature(f.id)}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-feature-btn" onClick={addFeature}>
              + Thêm
            </button>
            {errors.features && <span className="error">{errors.features}</span>}
          </div>

          <div className="form-group">
            <label>Đối tượng (tuỳ chọn)</label>
            <input
              type="text"
              value={formData.targetAudience}
              onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
              placeholder="VD: Dân văn phòng, sinh viên..."
            />
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onCancel}>Huỷ</button>
            <button type="submit" className="submit-btn">✓ Tạo Link</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ProductForm;
