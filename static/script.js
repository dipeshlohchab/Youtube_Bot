document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const videoForm = document.getElementById("videoForm");
  const chatForm = document.getElementById("chatForm");
  const chatContainer = document.getElementById("chatContainer");
  const statusDiv = document.getElementById("status");
  const themeToggle = document.getElementById("theme-toggle");
  const videoInput = document.getElementById("videoUrl");
  const userInput = document.getElementById("userInput");
  const trainButton = videoForm.querySelector(".train-button");
  const sendButton = chatForm.querySelector(".send-button");

  // Initialize theme
  initializeTheme();

  // Event Listeners
  themeToggle.addEventListener("click", toggleTheme);
  videoForm.addEventListener("submit", handleVideoSubmit);
  chatForm.addEventListener("submit", handleChatSubmit);

  // Auto-resize chat input
  userInput.addEventListener("input", autoResizeInput);

  // Initialize Theme
  function initializeTheme() {
    const savedTheme = localStorage.getItem("youtube-chatbot-theme");
    if (savedTheme === "dark" || (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.body.classList.add("dark-mode");
    }
  }

  // Toggle Theme
  function toggleTheme() {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("youtube-chatbot-theme", isDark ? "dark" : "light");
  }

  // Handle Video Form Submission
  async function handleVideoSubmit(e) {
    e.preventDefault();

    const url = videoInput.value.trim();
    if (!url) return;

    // Validate YouTube URL
    if (!isValidYouTubeUrl(url)) {
      showStatus("❌ Please enter a valid YouTube URL", "error");
      return;
    }

    // Show loading state
    setVideoFormLoading(true);
    showStatus("⏳ Processing video transcript...", "loading");

    // Clear chat
    clearChat();

    try {
      const formData = new FormData();
      formData.append("url", url);

      const response = await fetch("/process_video", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.status === "ok") {
        showStatus("✅ Video processed! You can now ask questions.", "success");
        enableChat();
        addBotMessage("I'm ready! What would you like to know about the video?");
        focusChatInput();
      } else {
        throw new Error(data.message || "Failed to process video");
      }
    } catch (error) {
      console.error("Video processing error:", error);
      showStatus(`❌ Error: ${error.message}`, "error");
      disableChat();
    } finally {
      setVideoFormLoading(false);
    }
  }

  // Handle Chat Form Submission
  async function handleChatSubmit(e) {
    e.preventDefault();

    const message = userInput.value.trim();
    if (!message) return;

    // Add user message
    addUserMessage(message);
    userInput.value = "";
    resetInputHeight();

    // Show thinking message
    const thinkingMessage = addThinkingMessage();

    // Disable input while processing
    setChatFormLoading(true);

    try {
      const formData = new FormData();
      formData.append("query", message);

      const response = await fetch("/chat", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      // Remove thinking message
      removeMessage(thinkingMessage);

      if (response.ok) {
        addBotMessage(data.answer || "Sorry, I couldn't generate a response.");
      } else {
        throw new Error(data.message || "Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);

      // Remove thinking message
      removeMessage(thinkingMessage);

      // Add error message
      addBotMessage("⚠️ Sorry, I encountered an error. Please try again.");
    } finally {
      setChatFormLoading(false);
      focusChatInput();
    }
  }

  // Utility Functions
  function isValidYouTubeUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/)|youtu\.be\/)/;
    return youtubeRegex.test(url);
  }

  function showStatus(message, type = "") {
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
  }

  function setVideoFormLoading(loading) {
    const buttonText = trainButton.querySelector(".button-text");
    const spinner = trainButton.querySelector(".loading-spinner");

    trainButton.disabled = loading;
    videoInput.disabled = loading;

    if (loading) {
      buttonText.style.display = "none";
      spinner.style.display = "flex";
    } else {
      buttonText.style.display = "block";
      spinner.style.display = "none";
    }
  }

  function setChatFormLoading(loading) {
    userInput.disabled = loading;
    sendButton.disabled = loading;

    if (loading) {
      sendButton.style.opacity = "0.5";
    } else {
      sendButton.style.opacity = "1";
    }
  }

  function clearChat() {
    chatContainer.innerHTML = "";
  }

  function enableChat() {
    chatForm.style.display = "block";
  }

  function disableChat() {
    chatForm.style.display = "none";
  }

  function focusChatInput() {
    setTimeout(() => {
      userInput.focus();
    }, 100);
  }

  function autoResizeInput() {
    // Reset height to auto to get the correct scrollHeight
    userInput.style.height = "auto";

    // Set height based on scrollHeight, with min and max limits
    const minHeight = 44; // Minimum height
    const maxHeight = 120; // Maximum height (about 3 lines)
    const scrollHeight = userInput.scrollHeight;

    if (scrollHeight > minHeight && scrollHeight <= maxHeight) {
      userInput.style.height = scrollHeight + "px";
    } else if (scrollHeight > maxHeight) {
      userInput.style.height = maxHeight + "px";
      userInput.style.overflowY = "auto";
    } else {
      userInput.style.height = minHeight + "px";
      userInput.style.overflowY = "hidden";
    }
  }

  function resetInputHeight() {
    userInput.style.height = "auto";
    userInput.style.overflowY = "hidden";
  }

  function scrollToBottom() {
    setTimeout(() => {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
  }

  // Message Creation Functions
  function createMessageContainer(type) {
    const container = document.createElement("div");
    container.className = `message-container ${type}-message`;

    const avatar = document.createElement("div");
    avatar.className = `avatar ${type}-avatar`;
    avatar.textContent = type === "user" ? "👤" : "🤖";

    const content = document.createElement("div");
    content.className = "message-content";

    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${type}-bubble`;

    content.appendChild(bubble);
    container.appendChild(avatar);
    container.appendChild(content);

    return { container, bubble };
  }

  function addUserMessage(message) {
    const { container, bubble } = createMessageContainer("user");
    bubble.textContent = message;

    chatContainer.appendChild(container);
    scrollToBottom();

    return container;
  }

  function addBotMessage(message) {
    const { container, bubble } = createMessageContainer("bot");

    // Parse markdown for bot messages
    if (typeof marked !== "undefined") {
      bubble.innerHTML = marked.parse(message);
    } else {
      bubble.textContent = message;
    }

    chatContainer.appendChild(container);
    scrollToBottom();

    return container;
  }

  function addThinkingMessage() {
    const { container, bubble } = createMessageContainer("bot");
    bubble.className += " thinking-message";

    bubble.innerHTML = `
      <span>🤔 Thinking</span>
      <div class="thinking-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;

    chatContainer.appendChild(container);
    scrollToBottom();

    return container;
  }

  function removeMessage(messageElement) {
    if (messageElement && messageElement.parentNode) {
      messageElement.style.animation = "messageSlideOut 0.2s ease-out";
      setTimeout(() => {
        messageElement.remove();
      }, 200);
    }
  }

  // Enhanced keyboard shortcuts
  userInput.addEventListener("keydown", (e) => {
    // Send message on Enter (but not Shift+Enter)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }

    // Clear input on Escape
    if (e.key === "Escape") {
      userInput.value = "";
      resetInputHeight();
    }
  });

  // Handle video input shortcuts
  videoInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      videoForm.dispatchEvent(new Event("submit"));
    }
  });

  // Add paste handler for video input
  videoInput.addEventListener("paste", (e) => {
    setTimeout(() => {
      const url = videoInput.value.trim();
      if (url && isValidYouTubeUrl(url)) {
        showStatus("✓ Valid YouTube URL detected", "success");
      }
    }, 10);
  });

  // Add real-time URL validation
  videoInput.addEventListener("input", (e) => {
    const url = e.target.value.trim();
    if (url) {
      if (isValidYouTubeUrl(url)) {
        showStatus("✓ Valid YouTube URL", "success");
        videoInput.style.borderColor = "#00b847";
      } else {
        showStatus("⚠️ Please enter a valid YouTube URL", "error");
        videoInput.style.borderColor = "#FF0000";
      }
    } else {
      showStatus("");
      videoInput.style.borderColor = "";
    }
  });

  // Add animation styles
  const style = document.createElement("style");
  style.textContent = `
    @keyframes messageSlideOut {
      from {
        opacity: 1;
        transform: translateY(0);
      }
      to {
        opacity: 0;
        transform: translateY(-10px);
      }
    }
    
    .chat-input {
      resize: none;
      transition: height 0.1s ease;
    }
    
    .message-container {
      opacity: 0;
      animation: messageSlideIn 0.3s ease-out forwards;
    }
    
    @keyframes messageSlideIn {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `;
  document.head.appendChild(style);

  // Initialize chat input height
  autoResizeInput();

  // Focus video input on load
  setTimeout(() => {
    videoInput.focus();
  }, 500);
});