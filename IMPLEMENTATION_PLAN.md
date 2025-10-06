# 🏗️ IMPLEMENTATION PLAN: AI SALESPERSON - 2 VAI TRÒ

**Version:** Final (All Critical Issues Resolved)
**Status:** Ready for Implementation ✅

---

## 📌 TÓM TẮT

Hệ thống 2 vai trò:
- **SELLER:** Nhập sản phẩm → AI tư vấn → Form → Link
- **BUYER:** Click link → Auto greeting → Chat với AI Sales

---

## ⚠️ ALL CRITICAL FIXES APPLIED

✅ Product context injection (mọi request)
✅ Buyer auto greeting (first message)
✅ [PRODUCT_COMPLETE] parser (no false positives)
✅ ProductForm pre-fill (auto-parse)
✅ Feature keys (unique IDs)
✅ Streaming headers
✅ **Save greeting to DB (both streaming & non-streaming)**
✅ **Separate greeting from response in streaming**

---

## 🗄️ DATABASE SCHEMA

```sql
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT NOT NULL,
  features TEXT NOT NULL,          -- JSON array
  target_audience TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  role TEXT NOT NULL,               -- 'user' or 'model'
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);
```

---

## 🔧 BACKEND IMPLEMENTATION

### File 1: `server-js/database.js` (NEW)

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'products.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price TEXT NOT NULL,
    features TEXT NOT NULL,
    target_audience TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id TEXT NOT NULL,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id)
  );
`);

const createProduct = db.prepare(`
  INSERT INTO products (id, name, price, features, target_audience)
  VALUES (?, ?, ?, ?, ?)
`);

const getProduct = db.prepare(`
  SELECT * FROM products WHERE id = ?
`);

const saveConversation = db.prepare(`
  INSERT INTO conversations (product_id, role, message)
  VALUES (?, ?, ?)
`);

const getConversations = db.prepare(`
  SELECT role, message FROM conversations
  WHERE product_id = ?
  ORDER BY created_at ASC
`);

module.exports = {
  createProduct,
  getProduct,
  saveConversation,
  getConversations
};
```

### File 2: `server-js/instructions.js` (NEW)

```javascript
const SELLER_CONSULTANT_INSTRUCTION = `
# VAI TRÒ
AI Consultant - Thu thập thông tin sản phẩm.

# FORMAT XÁC NHẬN

Khi đủ thông tin (tên, giá, ít nhất 2 tính năng), response:

[PRODUCT_COMPLETE]
**SẢN PHẨM:** <tên đầy đủ>
**GIÁ:** <giá cụ thể>
**TÍNH NĂNG:**
- <tính năng 1>
- <tính năng 2>
[/PRODUCT_COMPLETE]

Bạn có muốn bổ sung không? Nếu OK, click "Tạo Link" nhé!

QUAN TRỌNG:
- Tags [PRODUCT_COMPLETE] [/PRODUCT_COMPLETE] bắt buộc
- Format giữa tags phải chính xác
- KHÔNG chèn chú thích vào giữa tags
- Tư vấn thêm (nếu có) đặt SAU [/PRODUCT_COMPLETE]
`;

const BUYER_SALES_INSTRUCTION = `
# VAI TRÒ
Sales Person chuyên nghiệp - 15+ năm kinh nghiệm.

# CONTEXT
Message đầu trong history chứa thông tin sản phẩm:
"Bạn đang bán sản phẩm:
**SẢN PHẨM:** ...
**GIÁ:** ...
**TÍNH NĂNG:** ..."

GHI NHỚ và sử dụng xuyên suốt conversation.

# FLOW

## Lần đầu chat (history chỉ có context):
Bắt đầu:
"Chào bạn! Tôi là [Tên] - chuyên viên tư vấn [danh mục].

Tôi thấy bạn quan tâm đến [sản phẩm]. Cho tôi hỏi, bạn đang tìm giải pháp cho vấn đề gì ạ?"

## Lần tiếp theo:
- Discovery, Presentation
- Handle objections (Đắt → ROI; Suy nghĩ → Urgency; So sánh → Differentiate)
- Closing (Assumptive, Trial, Urgency, etc.)

# NGUYÊN TẮC
✅ Open questions, 70% listen, benefits > features, storytelling, urgency
❌ Badmouth, over-promise, argue, give up

LET'S CLOSE DEALS! 🎯
`;

module.exports = {
  SELLER_CONSULTANT_INSTRUCTION,
  BUYER_SALES_INSTRUCTION
};
```

### File 3: `server-js/app.js` (UPDATED - FINAL FIX)

**Add after existing imports:**

```javascript
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const {
  SELLER_CONSULTANT_INSTRUCTION,
  BUYER_SALES_INSTRUCTION
} = require('./instructions');

const sellerModel = genAI.getGenerativeModel({
  model: "models/gemini-2.5-pro",
  systemInstruction: SELLER_CONSULTANT_INSTRUCTION
});

const buyerModel = genAI.getGenerativeModel({
  model: "models/gemini-2.5-pro",
  systemInstruction: BUYER_SALES_INSTRUCTION
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

function parseProductComplete(text) {
  const regex = /\[PRODUCT_COMPLETE\]([\s\S]*?)\[\/PRODUCT_COMPLETE\]/;
  const match = text.match(regex);
  if (!match) return null;

  const content = match[1];
  const nameMatch = content.match(/\*\*SẢN PHẨM:\*\*\s*(.+)/);
  const priceMatch = content.match(/\*\*GIÁ:\*\*\s*(.+)/);
  const featuresMatch = content.match(/\*\*TÍNH NĂNG:\*\*\s*([\s\S]+?)(?=\n\n|\[|$)/);

  if (!nameMatch || !priceMatch || !featuresMatch) return null;

  const features = featuresMatch[1]
    .split('\n')
    .map(line => line.replace(/^-\s*/, '').trim())
    .filter(line => line);

  return {
    name: nameMatch[1].trim(),
    price: priceMatch[1].trim(),
    features
  };
}

function buildProductContext(product) {
  const features = JSON.parse(product.features);
  const featuresText = features.map(f => `- ${f}`).join('\n');

  return `Bạn đang bán sản phẩm:

**SẢN PHẨM:** ${product.name}
**GIÁ:** ${product.price}
**TÍNH NĂNG:**
${featuresText}
${product.target_audience ? `\n**ĐỐI TƯỢNG:** ${product.target_audience}` : ''}`;
}

function generateBuyerGreeting(product) {
  return `Chào bạn! Tôi là chuyên viên tư vấn sản phẩm.

Tôi thấy bạn quan tâm đến ${product.name}. Cho tôi hỏi, hiện tại bạn đang tìm kiếm giải pháp cho vấn đề gì ạ?`;
}

// ============================================
// SELLER ENDPOINTS
// ============================================

app.post("/seller/chat", async (req, res) => {
  const chatHistory = req.body.history || [];
  const msg = req.body.chat;

  try {
    const chat = sellerModel.startChat({ history: chatHistory });
    const result = await chat.sendMessage(msg);
    const text = result.response.text();

    const productData = parseProductComplete(text);

    res.send({
      text,
      isComplete: productData !== null,
      productData
    });
  } catch (error) {
    console.error("Seller chat error:", error);
    res.status(500).send({ error: "Chat failed" });
  }
});

app.post("/seller/stream", async (req, res) => {
  const chatHistory = req.body.history || [];
  const msg = req.body.chat;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const chat = sellerModel.startChat({ history: chatHistory });
    const result = await chat.sendMessageStream(msg);

    for await (const chunk of result.stream) {
      res.write(chunk.text());
    }
  } catch (error) {
    console.error("Seller stream error:", error);
    res.write("\nError");
  } finally {
    res.end();
  }
});

// ============================================
// PRODUCT ENDPOINTS
// ============================================

app.post("/product/create", async (req, res) => {
  const { name, price, features, targetAudience } = req.body;

  if (!name || !price || !features || features.length === 0) {
    return res.status(400).send({ error: "Missing fields" });
  }

  const productId = uuidv4();

  try {
    db.createProduct.run(
      productId,
      name,
      price,
      JSON.stringify(features),
      targetAudience || null
    );

    res.send({
      productId,
      link: `http://localhost:5173/buyer/${productId}`
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).send({ error: "Failed to create product" });
  }
});

app.get("/product/:id", async (req, res) => {
  try {
    const product = db.getProduct.get(req.params.id);
    if (!product) {
      return res.status(404).send({ error: "Product not found" });
    }

    product.features = JSON.parse(product.features);
    res.send(product);
  } catch (error) {
    console.error("Get product error:", error);
    res.status(500).send({ error: "Failed to get product" });
  }
});

// ============================================
// BUYER ENDPOINTS (FINAL FIX)
// ============================================

app.post("/buyer/chat/:productId", async (req, res) => {
  const { productId } = req.params;
  const clientHistory = req.body.history || [];
  const msg = req.body.chat;

  const product = db.getProduct.get(productId);
  if (!product) {
    return res.status(404).send({ error: "Product not found" });
  }

  const productContext = buildProductContext(product);
  const isFirstMessage = clientHistory.length === 0;

  let enhancedHistory;
  let greeting = null;

  if (isFirstMessage) {
    greeting = generateBuyerGreeting(product);

    enhancedHistory = [
      { role: "user", parts: [{ text: productContext }] },
      { role: "model", parts: [{ text: "Understood." }] },
      { role: "model", parts: [{ text: greeting }] }
    ];
  } else {
    enhancedHistory = [
      { role: "user", parts: [{ text: productContext }] },
      { role: "model", parts: [{ text: "Understood." }] },
      ...clientHistory
    ];
  }

  try {
    const chat = buyerModel.startChat({ history: enhancedHistory });
    const result = await chat.sendMessage(msg);
    const text = result.response.text();

    // CRITICAL FIX: Save greeting + user msg + response
    try {
      if (isFirstMessage && greeting) {
        db.saveConversation.run(productId, "model", greeting);
      }
      db.saveConversation.run(productId, "user", msg);
      db.saveConversation.run(productId, "model", text);
    } catch (dbError) {
      console.error("Save conversation error:", dbError);
    }

    res.send({ text, greeting });
  } catch (error) {
    console.error("Buyer chat error:", error);
    res.status(500).send({ error: "Chat failed" });
  }
});

app.post("/buyer/stream/:productId", async (req, res) => {
  const { productId } = req.params;
  const clientHistory = req.body.history || [];
  const msg = req.body.chat;

  const product = db.getProduct.get(productId);
  if (!product) {
    res.setHeader('Content-Type', 'application/json');
    res.status(404).send({ error: "Product not found" });
    return;
  }

  const productContext = buildProductContext(product);
  const isFirstMessage = clientHistory.length === 0;

  let enhancedHistory;
  let greeting = null;

  if (isFirstMessage) {
    greeting = generateBuyerGreeting(product);
    enhancedHistory = [
      { role: "user", parts: [{ text: productContext }] },
      { role: "model", parts: [{ text: "Understood." }] },
      { role: "model", parts: [{ text: greeting }] }
    ];
  } else {
    enhancedHistory = [
      { role: "user", parts: [{ text: productContext }] },
      { role: "model", parts: [{ text: "Understood." }] },
      ...clientHistory
    ];
  }

  // CRITICAL FIX: Return JSON with greeting + streaming response
  // Strategy: Don't stream if first message, return JSON instead
  if (isFirstMessage) {
    // First message: Return JSON with greeting + response
    try {
      const chat = buyerModel.startChat({ history: enhancedHistory });
      const result = await chat.sendMessage(msg);
      const text = result.response.text();

      // Save to DB
      try {
        db.saveConversation.run(productId, "model", greeting);
        db.saveConversation.run(productId, "user", msg);
        db.saveConversation.run(productId, "model", text);
      } catch (dbError) {
        console.error("Save error:", dbError);
      }

      res.setHeader('Content-Type', 'application/json');
      res.send({ text, greeting });
    } catch (error) {
      console.error("First message error:", error);
      res.status(500).send({ error: "Chat failed" });
    }
  } else {
    // Subsequent messages: Stream as usual
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      const chat = buyerModel.startChat({ history: enhancedHistory });
      const result = await chat.sendMessageStream(msg);

      let fullResponse = "";
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        res.write(chunkText);
        fullResponse += chunkText;
      }

      // Save
      try {
        db.saveConversation.run(productId, "user", msg);
        db.saveConversation.run(productId, "model", fullResponse);
      } catch (dbError) {
        console.error("Save error:", dbError);
      }

      res.end();
    } catch (error) {
      console.error("Stream error:", error);
      res.write("\nError");
      res.end();
    }
  }
});
```

---

## 💻 FRONTEND IMPLEMENTATION

### Key Files:

#### 1. `client-react/src/components/ProductLinkGenerator.js`

```javascript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProductForm from './ProductForm';

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
      const res = await axios.post('http://localhost:9000/product/create', productData);
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
            🔗 Tạo Link
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
          <div className="link-container">
            <input type="text" value={link} readOnly className="link-input" />
            <button onClick={copyLink} className="copy-btn">
              {copied ? '✓ Copied!' : '📋 Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductLinkGenerator;
```

#### 2. `client-react/src/components/ProductForm.js`

```javascript
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
        <h2>📋 Xác nhận thông tin</h2>
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
```

#### 3. `client-react/src/pages/BuyerChat.js` - Key section:

```javascript
// In handleNonStreamingChat:
const response = await axios.post(url, chatData, headerConfig);
const modelResponse = response.data.text;
const greeting = response.data.greeting;

let updatedData;
if (greeting) {
  // First message: show greeting + response
  updatedData = [
    ...ndata,
    { role: "model", parts: [{ text: greeting }] },
    { role: "model", parts: [{ text: modelResponse }] }
  ];
} else {
  updatedData = [
    ...ndata,
    { role: "model", parts: [{ text: modelResponse }] }
  ];
}
```

```javascript
// In handleStreamingChat:
const response = await fetch(streamUrl, {
  method: "post",
  headers: headerConfig,
  body: JSON.stringify(chatData),
});

// Check if JSON (first message) or stream (subsequent)
const contentType = response.headers.get('Content-Type');

if (contentType.includes('application/json')) {
  // First message: JSON with greeting
  const data = await response.json();
  const greeting = data.greeting;
  const text = data.text;

  flushSync(() => {
    const updatedData = [
      ...ndata,
      { role: "model", parts: [{ text: greeting }] },
      { role: "model", parts: [{ text: text }] }
    ];
    setData(updatedData);
    setWaiting(false);
  });
} else {
  // Subsequent: Stream
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  showStreamdiv(true);

  let modelResponse = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    setAnswer(ans => ans + chunk);
    modelResponse += chunk;
    executeScroll();
  }

  setAnswer("");
  flushSync(() => {
    const updatedData = [
      ...ndata,
      { role: "model", parts: [{ text: modelResponse }] }
    ];
    setData(updatedData);
    setWaiting(false);
  });
  showStreamdiv(false);
}
```

---

## ✅ FINAL CHECKLIST

### Backend:
- [ ] Install: `npm install uuid better-sqlite3`
- [ ] Create `database.js`
- [ ] Create `instructions.js`
- [ ] Update `app.js` (all fixes)
- [ ] Test: `/seller/chat` → `isComplete` + `productData`
- [ ] Test: `/buyer/chat/:id` first msg → `greeting` + `text`
- [ ] Test: `/buyer/chat/:id` 2nd msg → no greeting
- [ ] Verify: DB conversations table có greeting

### Frontend:
- [ ] Install: `npm install react-router-dom`
- [ ] Create `ProductForm.js` (unique keys)
- [ ] Create `ProductLinkGenerator.js` (auto-parse)
- [ ] Create `BuyerChat.js` (handle greeting + JSON/stream)
- [ ] Create `SellerChat.js`, `LandingPage.js`
- [ ] Update `App.css`
- [ ] Test: Form pre-filled
- [ ] Test: Buyer first msg shows greeting
- [ ] Test: Buyer subsequent msgs stream correctly

### Integration:
- [ ] End-to-end: Seller → Link → Buyer
- [ ] Context persistence: 5+ buyer messages
- [ ] Database: Check `conversations` table has all messages including greeting
- [ ] Multiple tabs: Same link, different sessions

---

## 🎯 SUCCESS CRITERIA

✅ Seller: nhập → form pre-fill → link
✅ Buyer: auto greeting → context persistence
✅ DB: greeting được lưu (both streaming & non-streaming)
✅ Parser: no false positives
✅ Streaming: proper headers + response separation
✅ Form: unique keys, no warnings

---

**Time: 3.5-4 hours**
**Status: ALL ISSUES FIXED ✅**
**Ready: YES 🚀**
