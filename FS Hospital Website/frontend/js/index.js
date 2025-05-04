import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import ScrollReveal from "scrollreveal"; // Assuming you have ScrollReveal installed

function Chatbot() {
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        ScrollReveal().reveal(".header__image img", { distance: "50px", origin: "right", duration: 1000 });
        ScrollReveal().reveal(".header__content h1", { delay: 500 });
        ScrollReveal().reveal(".header__content p", { delay: 1000 });
        ScrollReveal().reveal(".header__content form", { delay: 1500 });
        ScrollReveal().reveal(".header__content .bar", { delay: 2000 });
        ScrollReveal().reveal(".header__image__card", { duration: 1000, interval: 500, delay: 2500 });
    }, []);

    return (
        <div>
            <button onClick={() => setMenuOpen(!menuOpen)}>
                <i className={menuOpen ? "ri-close-line" : "ri-menu-line"}></i>
            </button>
            <nav className={menuOpen ? "open" : ""}>Menu Links Here</nav>
        </div>
    );
}

// Rendering the Chatbot Component
const root = ReactDOM.createRoot(document.getElementById("chatbot-root"));
root.render(<Chatbot />);


// Wait for the DOM to load before manipulating elements
document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.getElementById("menu-btn");
  const navLinks = document.getElementById("nav-links");
  const menuBtnIcon = menuBtn?.querySelector("i");

  if (menuBtn && navLinks && menuBtnIcon) {
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");

      const isOpen = navLinks.classList.contains("open");
      menuBtnIcon.setAttribute("class", isOpen ? "ri-close-line" : "ri-menu-line");
    });

    navLinks.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuBtnIcon.setAttribute("class", "ri-menu-line");
    });
  }
});

// Ensure ScrollReveal is properly initialized
if (typeof ScrollReveal !== "undefined") {
  const scrollRevealOption = {
    distance: "50px",
    origin: "bottom",
    duration: 1000,
  };

  ScrollReveal().reveal(".header__image img", {
    ...scrollRevealOption,
    origin: "right",
  });

  ScrollReveal().reveal(".header__content h1", {
    ...scrollRevealOption,
    delay: 500,
  });

  ScrollReveal().reveal(".header__content p", {
    ...scrollRevealOption,
    delay: 1000,
  });

  ScrollReveal().reveal(".header__content form", {
    ...scrollRevealOption,
    delay: 1500,
  });

  ScrollReveal().reveal(".header__content .bar", {
    ...scrollRevealOption,
    delay: 2000,
  });

  ScrollReveal().reveal(".header__image__card", {
    duration: 1000,
    interval: 500,
    delay: 2500,
  });
}
