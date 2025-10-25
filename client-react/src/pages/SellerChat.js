import React, { useState, useRef } from 'react';
import axios from 'axios';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import ConversationDisplayArea from '../components/ConversationDisplayArea';
import Header from '../components/Header';
import MessageInput from '../components/MessageInput';
import ProductLinkGenerator from '../components/ProductLinkGenerator';
import { API_URL } from '../config';

function SellerChat() {
  const navigate = useNavigate();
  const inputRef = useRef();
  const host = API_URL;
  const url = host + "/seller/chat";
  const streamUrl = host + "/seller/stream";

  const [data, setData] = useState([]);
  const [answer, setAnswer] = useState("");
  const [streamdiv, showStreamdiv] = useState(false);
  const [toggled, setToggled] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [productComplete, setProductComplete] = useState(false);

  const is_stream = toggled;

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
        inputRef.current.placeholder = "Waiting for AI Consultant..."
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
      var modelResponse = ""
      var isComplete = false;

      try {
        const response = await axios.post(url, chatData, headerConfig);
        modelResponse = response.data.text;
        isComplete = response.data.isComplete;
      } catch (error) {
        modelResponse = "Error occurred";
      } finally {
        const updatedData = [...ndata,
          {"role": "model", "parts":[{"text": modelResponse}]}]

        flushSync(() => {
          setData(updatedData);
          inputRef.current.placeholder = "Enter product information..."
          setWaiting(false)
          if (isComplete) {
            setProductComplete(true);
          }
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
      inputRef.current.placeholder = "Waiting for AI Consultant..."
      setWaiting(true)
    });

    executeScroll();

    let headerConfig = {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
    }

    const fetchStreamData = async() => {
      var modelResponse = "";
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

        const reader = response.body.getReader();
        const txtdecoder = new TextDecoder();
        const loop = true;
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

        const isComplete = modelResponse.includes('[PRODUCT_COMPLETE]');
        if (isComplete) {
          setProductComplete(true);
        }
      } catch (err) {
        modelResponse = "Error occurred";
      } finally {
        setAnswer("")
        const updatedData = [...ndata,
          {"role": "model", "parts":[{"text": modelResponse}]}]

        flushSync(() => {
          setData(updatedData);
          inputRef.current.placeholder = "Enter product information..."
          setWaiting(false)
        });
        showStreamdiv(false);
        executeScroll();
      }
    };
    fetchStreamData();
  };

  return (
    <center>
      <div className="chat-app">
        <Header
          toggled={toggled}
          setToggled={setToggled}
        />
        <div style={{textAlign: 'center', padding: '10px', background: '#f0f0f0'}}>
          <button onClick={() => navigate('/')} style={{padding: '8px 15px'}}>
            ← Quay về trang chủ
          </button>
        </div>
        <ConversationDisplayArea data={data} streamdiv={streamdiv} answer={answer} />

        {productComplete && (
          <ProductLinkGenerator conversationHistory={data} />
        )}

        <MessageInput inputRef={inputRef} waiting={waiting} handleClick={handleClick} />
      </div>
    </center>
  );
}

export default SellerChat;
