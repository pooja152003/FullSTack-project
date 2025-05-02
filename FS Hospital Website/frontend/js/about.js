let currentSlide = 0;
const slides = document.querySelectorAll(".slide");

function changeSlide() {
  // Remove the active class from the current slide
  slides[currentSlide].classList.remove("active");

  // Move to the next slide, wrapping around when reaching the last slide
  currentSlide = (currentSlide + 1) % slides.length;

  // Add the active class to the next slide
  slides[currentSlide].classList.add("active");
}

// Change slide every 4 seconds
setInterval(changeSlide, 4000);
