document.addEventListener("DOMContentLoaded", () => {
  const videoForm = document.getElementById("videoForm");
  const chatForm = document.getElementById("chatForm");
  const chatContainer = document.getElementById("chatContainer");
  const statusDiv = document.getElementById("status");
  const themeToggle = document.getElementById("theme-toggle");

  // --- Theme Toggling ---
  const currentTheme = localStorage.getItem("theme");
  if (currentTheme === "dark") {
    document.body.classList.add("dark-mode");
  }

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    let theme = "light";
    if (document.body.classList.contains("dark-mode")) {
      theme = "dark";
    }
    localStorage.setItem("theme", theme);
  });

  // --- Form Handlers ---
  videoForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = document.getElementById("videoUrl").value;
    statusDiv.innerText = "⏳ Processing video transcript...";
    const formData = new FormData();
    formData.append("url", url);

    try {
      const res = await fetch("/process_video", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.status === "ok") {
        statusDiv.innerText = "✅ Video processed! You can now ask questions.";
        chatForm.style.display = "flex";
        chatContainer.innerHTML = '';
        addMessage("bot", "I'm ready! What would you like to know about the video?");
      } else {
        throw new Error(data.message || "Unknown error processing video.");
      }
    } catch (error) {
      statusDiv.innerText = `❌ Error: ${error.message}`;
    }
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const userInput = document.getElementById("userInput");
    const userMsg = userInput.value.trim();
    if (!userMsg) return;

    addMessage("user", userMsg);
    userInput.value = "";

    // Add a temporary bot thinking message
    const thinkingMsg = addMessage("bot", "🤔 Thinking...");

    const formData = new FormData();
    formData.append("query", userMsg);

    try {
      const res = await fetch("/chat", { method: "POST", body: formData });
      const data = await res.json();

      // ✅ CORRECTED LINE: Update the thinking message using innerHTML and marked.parse
      thinkingMsg.innerHTML = marked.parse(data.answer || "Sorry, I couldn't get a response.");
    } catch (error) {
      // Errors should also be parsed in case they contain markdown (though unlikely)
      thinkingMsg.innerHTML = marked.parse("⚠️ Error getting response. Please check the console.");
      console.error("Chat Error:", error);
    }
  });

  /**
   * Adds a message to the chat window.
   * If the sender is the bot, it parses the text as Markdown.
   * @param {string} sender - 'user' or 'bot'
   * @param {string} text - The message content
   * @returns {HTMLElement} - The message div element
   */
  function addMessage(sender, text) {
    const msgContainer = document.createElement("div");
    msgContainer.className = `msg-container ${sender}-container`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.innerText = sender === "user" ? "🧑" : "🤖";

    const msgDiv = document.createElement("div");
    msgDiv.className = `msg ${sender}`;

    if (sender === 'bot') {
      // If the message is from the bot, convert Markdown to HTML
      msgDiv.innerHTML = marked.parse(text);
    } else {
      // If the message is from the user, display it as plain text for security
      msgDiv.innerText = text;
    }

    msgContainer.appendChild(avatar);
    msgContainer.appendChild(msgDiv);
    chatContainer.appendChild(msgContainer);

    chatContainer.scrollTop = chatContainer.scrollHeight;

    return msgDiv;
  }
});