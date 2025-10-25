import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProductForm from './ProductForm';
import { API_URL } from '../config';

function ProductLinkGenerator({ conversationHistory }) {
  const [showForm, setShowForm] = useState(false);
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  useEffect(() => {
    if (conversationHistory?.length > 0) {
      const lastMsg = conversationHistory[conversationHistory.length - 1];
      if (lastMsg.role === 'model') {
        const text = lastMsg.parts[0].text;
        const regex = /\[PRODUCT_COMPLETE\]([\s\S]*?)\[\/PRODUCT_COMPLETE\]/;
        const match = text.match(regex);

        if (match) {
          const content = match[1];
          const nameMatch = content.match(/\*\*SẢN PHẨM:\*\*\s*(.+)/);
          const priceMatch = content.match(/\*\*GIÁ:\*\*\s*(.+)/);
          const featuresMatch = content.match(/\*\*TÍNH NĂNG:\*\*\s*([\s\S]+?)(?=\n\n|\[|$)/);

          if (nameMatch && priceMatch && featuresMatch) {
            const features = featuresMatch[1]
              .split('\n')
              .map(line => line.replace(/^-\s*/, '').trim())
              .filter(line => line);

            setParsedData({
              name: nameMatch[1].trim(),
              price: priceMatch[1].trim(),
              features
            });
          }
        }
      }
    }
  }, [conversationHistory]);

  const handleFormSubmit = async (productData) => {
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/product/create`, productData);
      setLink(res.data.link);
      setShowForm(false);
    } catch (error) {
      alert("Lỗi tạo link!");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="link-generator">
      {!link ? (
        <>
          <button
            className="generate-link-btn"
            onClick={() => setShowForm(true)}
            disabled={loading}
          >
            🔗 Tạo Link Chia Sẻ
          </button>

          {showForm && (
            <ProductForm
              initialData={parsedData}
              onSubmit={handleFormSubmit}
              onCancel={() => setShowForm(false)}
            />
          )}
        </>
      ) : (
        <div className="link-display">
          <h3>✅ Link sẵn sàng!</h3>
          <p>Chia sẻ link này với khách hàng:</p>
          <div className="link-container">
            <input type="text" value={link} readOnly className="link-input" />
            <button onClick={copyLink} className="copy-btn">
              {copied ? '✓ Đã copy!' : '📋 Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductLinkGenerator;
