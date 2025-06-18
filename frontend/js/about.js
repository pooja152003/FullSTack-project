const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");

menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("open");
});

// ScrollReveal animation (optional)
ScrollReveal().reveal(".about-content", {
  duration: 1000,
  origin: "bottom",
  distance: "50px",
});
