document.addEventListener("DOMContentLoaded", function () {
    // Chatbot Component
    function Chatbot() {
        const [messages, setMessages] = React.useState([
            { sender: "bot", text: "Hi! How can I assist you today?" },
        ]);
        const [input, setInput] = React.useState("");

        const handleSend = () => {
            if (!input.trim()) return;
            const userMsg = { sender: "user", text: input };
            const botMsg = { sender: "bot", text: "Thanks for your message!" };
            setMessages([...messages, userMsg, botMsg]);
            setInput("");
        };
                // Add this inside Chatbot component
        const fileInputRef = React.useRef(null);

        const handleFileUpload = async (file) => {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            const botMsg = { sender: "bot", text: data.message };
            setMessages((prev) => [...prev, botMsg]);
        };


        return React.createElement(
            "div",
            { className: "chatbot-container" },
            messages.map(function (msg, i) {
                return React.createElement(
                    "div",
                    { key: i, className: msg.sender === "user" ? "user-message" : "bot-message" },
                    msg.text
                );
            }),
            React.createElement("input", {
                value: input,
                onChange: function (e) {
                    setInput(e.target.value);
                },
                onKeyDown: function (e) {
                    if (e.key === "Enter") {
                        handleSend();
                    }
                },
            }),
            React.createElement(
                "button",
                { onClick: handleSend },
                "Send"
            )
        );
    }

    // Render the Chatbot component inside the div with id 'chatbot-root'
    const rootElement = document.getElementById("chatbot-root");

    // Ensure the element exists before trying to render the React component
    if (rootElement) {
        ReactDOM.createRoot(rootElement).render(React.createElement(Chatbot));
    } else {
        console.error("Chatbot root element not found.");
    }
});
