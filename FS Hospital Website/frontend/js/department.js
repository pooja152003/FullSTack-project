const departments = [
    {
        name: "Cardiology",
        description: "Specializes in heart and cardiovascular system disorders.",
        icon: "https://img.icons8.com/color/96/heart-with-pulse.png"
    },
    {
        name: "Neurology",
        description: "Deals with disorders of the brain, spinal cord, and nerves.",
        icon: "https://img.icons8.com/color/96/brain.png"
    },
    {
        name: "Orthopedics",
        description: "Treats bones, joints, ligaments, tendons, and muscles.",
        icon: "https://img.icons8.com/color/96/bone.png"
    },
    {
        name: "Pediatrics",
        description: "Provides medical care to infants, children, and teens.",
        icon: "https://img.icons8.com/color/96/baby.png"
    },
    {
        name: "Dermatology",
        description: "Focuses on skin, hair, and nail conditions.",
        icon: "https://img.icons8.com/color/96/skin.png"
    },
    {
        name: "Radiology",
        description: "Uses imaging to diagnose and treat diseases.",
        icon: "https://img.icons8.com/color/96/x-ray.png"
    },
    {
        name: "ENT",
        description: "Ear, nose, and throat treatment and surgery.",
        icon: "https://img.icons8.com/color/96/ear.png"
    },
    {
        name: "Gastroenterology",
        description: "Focuses on digestive system and its disorders.",
        icon: "https://img.icons8.com/color/96/stomach.png"
    },
    {
        name: "Urology",
        description: "Deals with urinary tract and male reproductive organs.",
        icon: "https://img.icons8.com/color/96/kidney.png"
    }
];

const grid = document.getElementById('departmentsGrid');

departments.forEach(dept => {
    const card = document.createElement('div');
    card.className = 'department-card';
    card.innerHTML = `
        <img src="${dept.icon}" alt="${dept.name}" class="department-icon">
        <div class="department-title">${dept.name}</div>
        <div class="department-description">${dept.description}</div>
    `;
    grid.appendChild(card);
});
