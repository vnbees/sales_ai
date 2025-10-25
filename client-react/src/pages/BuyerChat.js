import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { flushSync } from 'react-dom';
import ConversationDisplayArea from '../components/ConversationDisplayArea';
import Header from '../components/Header';
import MessageInput from '../components/MessageInput';
import ProductInfoCard from '../components/ProductInfoCard';
import { API_URL } from '../config';

function BuyerChat() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const inputRef = useRef();

  const host = API_URL;
  const url = `${host}/buyer/chat/${productId}`;
  const streamUrl = `${host}/buyer/stream/${productId}`;

  const [product, setProduct] = useState(null);
  const [data, setData] = useState([]);
  const [answer, setAnswer] = useState("");
  const [streamdiv, showStreamdiv] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const is_stream = toggled;

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const response = await axios.get(`${host}/product/${productId}`);
        setProduct(response.data);
        setLoading(false);
      } catch (err) {
        setError('Sản phẩm không tồn tại hoặc link không hợp lệ');
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  function executeScroll() {
    const element = document.getElementById('checkpoint');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  function validationCheck(str) {
    return str === null || str.match(/^\s*$/) !== null;
  }

  const handleClick = () => {
    if (validationCheck(inputRef.current.value)) {
      console.log("Empty or invalid entry");
    } else {
      if (!is_stream) {
        handleNonStreamingChat();
      } else {
        handleStreamingChat();
      }
    }
  };

  const handleNonStreamingChat = async () => {
    const chatData = {
      chat: inputRef.current.value,
      history: data
    };

    const ndata = [...data,
      {"role": "user", "parts":[{"text": inputRef.current.value}]}]

    flushSync(() => {
        setData(ndata);
        inputRef.current.value = ""
        inputRef.current.placeholder = "Waiting for salesperson..."
        setWaiting(true)
    });

    executeScroll();

    let headerConfig = {
      headers: {
          'Content-Type': 'application/json;charset=UTF-8',
          "Access-Control-Allow-Origin": "*",
      }
    };

    const fetchData = async() => {
      var modelResponse = "";
      try {
        const response = await axios.post(url, chatData, headerConfig);
        modelResponse = response.data.text;
        const greeting = response.data.greeting;

        let updatedData;
        if (greeting) {
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

        flushSync(() => {
          setData(updatedData);
          inputRef.current.placeholder = "Enter a message."
          setWaiting(false)
        });
        executeScroll();
      } catch (error) {
        modelResponse = "Error occurred";
        const updatedData = [...ndata, {"role": "model", "parts":[{"text": modelResponse}]}];
        flushSync(() => {
          setData(updatedData);
          inputRef.current.placeholder = "Enter a message."
          setWaiting(false)
        });
        executeScroll();
      }
    };

    fetchData();
  };

  const handleStreamingChat = async () => {
    const chatData = {
      chat: inputRef.current.value,
      history: data
    };

    const ndata = [...data,
      {"role": "user", "parts":[{"text": inputRef.current.value}]}]

    flushSync(() => {
      setData(ndata);
      inputRef.current.value = ""
      inputRef.current.placeholder = "Waiting for salesperson..."
      setWaiting(true)
    });

    executeScroll();

    let headerConfig = {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
    }

    const fetchStreamData = async() => {
      try {
        setAnswer("");
        const response = await fetch(streamUrl, {
          method: "post",
          headers: headerConfig,
          body: JSON.stringify(chatData),
        });

        if (!response.ok || !response.body) {
          throw response.statusText;
        }

        const contentType = response.headers.get('Content-Type');

        if (contentType && contentType.includes('application/json')) {
          const jsonData = await response.json();
          const greeting = jsonData.greeting;
          const text = jsonData.text;

          flushSync(() => {
            const updatedData = [
              ...ndata,
              { role: "model", parts: [{ text: greeting }] },
              { role: "model", parts: [{ text: text }] }
            ];
            setData(updatedData);
            inputRef.current.placeholder = "Enter a message."
            setWaiting(false)
          });
          executeScroll();
        } else {
          const reader = response.body.getReader();
          const txtdecoder = new TextDecoder();
          const loop = true;
          var modelResponse = "";
          showStreamdiv(true);

          while (loop) {
            const { value, done } = await reader.read();
            if (done) {
              break;
            }
            const decodedTxt = txtdecoder.decode(value, { stream: true });
            setAnswer((answer) => answer + decodedTxt);
            modelResponse = modelResponse + decodedTxt;
            executeScroll();
          }

          setAnswer("")
          const updatedData = [...ndata,
            {"role": "model", "parts":[{"text": modelResponse}]}]

          flushSync(() => {
            setData(updatedData);
            inputRef.current.placeholder = "Enter a message."
            setWaiting(false)
          });
          showStreamdiv(false);
          executeScroll();
        }
      } catch (err) {
        const modelResponse = "Error occurred";
        const updatedData = [...ndata, {"role": "model", "parts":[{"text": modelResponse}]}];
        flushSync(() => {
          setData(updatedData);
          inputRef.current.placeholder = "Enter a message."
          setWaiting(false)
        });
        showStreamdiv(false);
        executeScroll();
      }
    };
    fetchStreamData();
  };

  if (loading) {
    return (
      <center>
        <div className="loading-screen">
          <h2>⏳ Đang tải thông tin sản phẩm...</h2>
        </div>
      </center>
    );
  }

  if (error) {
    return (
      <center>
        <div className="error-screen">
          <h2>❌ {error}</h2>
          <button onClick={() => navigate('/')}>← Quay về trang chủ</button>
        </div>
      </center>
    );
  }

  return (
    <center>
      <div className="chat-app buyer-chat">
        <Header
          toggled={toggled}
          setToggled={setToggled}
        />

        <ProductInfoCard product={product} />

        <ConversationDisplayArea data={data} streamdiv={streamdiv} answer={answer} />
        <MessageInput inputRef={inputRef} waiting={waiting} handleClick={handleClick} />
      </div>
    </center>
  );
}

export default BuyerChat;
