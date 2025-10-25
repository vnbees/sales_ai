/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/** Load environment variables from .env file */
require('dotenv').config();

/** Package to enable CORS to handle requests from all domains. */
const cors = require('cors')

/** Framework for building RESTful APIs. */
const express = require('express');

/** Package to use the Gemini API. */
const { GoogleGenerativeAI } = require('@google/generative-ai');

/** UUID for generating unique product IDs */
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

/** Database module */
const db = require('./database');

/** System instructions for seller and buyer */
const {
  SELLER_CONSULTANT_INSTRUCTION,
  BUYER_SALES_INSTRUCTION
} = require('./instructions');

/**
 * To start a new application using Express, put and apply Express into the
 * app variable. */
const app = express ();
app.use(express.json());

/** Apply the CORS middleware. */
app.use(cors())

/** Enable and listen to port 9000. */
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log('Server Listening on PORT:', PORT);
});

/** Access the API key and initialize the Gemini SDK. */
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

/**
 * Initialize models with respective system instructions
 */
const sellerModel = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  systemInstruction: SELLER_CONSULTANT_INSTRUCTION
});

const buyerModel = genAI.getGenerativeModel({
  model: "gemini-2.5-pro",
  systemInstruction: BUYER_SALES_INSTRUCTION
});

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse [PRODUCT_COMPLETE] block to extract product info
 */
function parseProductComplete(text) {
  const regex = /\[PRODUCT_COMPLETE\]([\s\S]*?)\[\/PRODUCT_COMPLETE\]/;
  const match = text.match(regex);

  if (!match) return null;

  const content = match[1];

  // Extract fields
  const nameMatch = content.match(/\*\*SẢN PHẨM:\*\*\s*(.+)/);
  const priceMatch = content.match(/\*\*GIÁ:\*\*\s*(.+)/);
  const featuresMatch = content.match(/\*\*TÍNH NĂNG:\*\*\s*([\s\S]+?)(?=\n\n|\[|$)/);

  if (!nameMatch || !priceMatch || !featuresMatch) return null;

  // Parse features
  const featuresText = featuresMatch[1];
  const features = featuresText
    .split('\n')
    .map(line => line.replace(/^-\s*/, '').trim())
    .filter(line => line.length > 0);

  return {
    name: nameMatch[1].trim(),
    price: priceMatch[1].trim(),
    features
  };
}

/**
 * Build product context message for buyer
 */
function buildProductContext(product) {
  const features = JSON.parse(product.features);
  const featuresText = features.map(f => `- ${f}`).join('\n');

  return `Bạn đang bán sản phẩm sau:

**SẢN PHẨM:** ${product.name}
**GIÁ:** ${product.price}
**TÍNH NĂNG:**
${featuresText}
${product.target_audience ? `\n**ĐỐI TƯỢNG:** ${product.target_audience}` : ''}`;
}

/**
 * Generate opening greeting for buyer (first message only)
 */
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

    // Parse product complete block
    const productData = parseProductComplete(text);
    const isComplete = productData !== null;

    res.send({
      text,
      isComplete,
      productData  // Send extracted data to frontend
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
      const chunkText = chunk.text();
      res.write(chunkText);
    }
  } catch (error) {
    console.error("Seller streaming error:", error);
    res.write("\nError occurred");
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
    return res.status(400).send({
      error: "Missing required fields: name, price, features"
    });
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

    // Determine frontend URL based on environment
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${frontendUrl}/buyer/${productId}`;
    res.send({ productId, link });
  } catch (error) {
    console.error("Failed to create product:", error);
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
    console.error("Failed to get product:", error);
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

  // Get product
  const product = db.getProduct.get(productId);
  if (!product) {
    return res.status(404).send({ error: "Product not found" });
  }

  // Build product context
  const productContext = buildProductContext(product);

  // Check if this is the first user message
  const isFirstMessage = clientHistory.length === 0;

  let enhancedHistory;
  let greeting = null;

  if (isFirstMessage) {
    // SPECIAL: First message - add context + auto greeting
    greeting = generateBuyerGreeting(product);

    enhancedHistory = [
      // 1. Product context
      {
        role: "user",
        parts: [{ text: productContext }]
      },
      {
        role: "model",
        parts: [{ text: "Đã hiểu rõ thông tin sản phẩm." }]
      },
      // 2. Auto greeting (model initiates conversation)
      {
        role: "model",
        parts: [{ text: greeting }]
      }
    ];
  } else {
    // Subsequent messages - prepend context to existing history
    enhancedHistory = [
      {
        role: "user",
        parts: [{ text: productContext }]
      },
      {
        role: "model",
        parts: [{ text: "Understood." }]
      },
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
      console.error("Failed to save conversation:", dbError);
    }

    // Return response + greeting if first message
    res.send({
      text,
      greeting: isFirstMessage ? greeting : null
    });
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

  // CRITICAL FIX: Return JSON with greeting + response for first message
  if (isFirstMessage) {
    // First message: Return JSON with greeting
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

// ============================================
// LEGACY ENDPOINTS (Keep for backward compatibility)
// ============================================

app.post("/chat", async (req, res) => {
  const chatHistory = req.body.history || [];
  const msg = req.body.chat;

  const chat = sellerModel.startChat({
      history: chatHistory
  });

  const result = await chat.sendMessage(msg);
  const response = await result.response;
  const text = response.text();

  res.send({"text":text});
});

app.post("/stream", async (req, res) => {
  const chatHistory = req.body.history || [];
  const msg = req.body.chat;

  const chat = sellerModel.startChat({
    history: chatHistory
  });

  const result = await chat.sendMessageStream(msg);
  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    res.write(chunkText);
  }
  res.end();
});

// List available models on startup
async function listModels() {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GOOGLE_API_KEY}`);
    const data = await response.json();
    console.log('Available models:', data.models?.map(m => m.name));
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

listModels();
