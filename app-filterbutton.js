// ======== CONFIG ========

const AIRTABLE_BASE = "appIR5VPGJzHN9U9a"; // base ID
const TABLE_NAME = "Discounts"; // table name
const USER_TABLE = "Users"; //user table
const TOKEN = "patId6xLH6x0hv8hV.47242219be5e1e440c32407a55882f7a82009be491905c3eba3d284c0819915c"; // personal access token

const API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(TABLE_NAME)}`;
const USER_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${encodeURIComponent(USER_TABLE)}`;

let ORIGINAL_DATA = [];   // stores the full Airtable dataset for filters

// ======== FUNCTIONS ========

// Show a temporary loading message
function showLoading() {
    const container = document.getElementById("discount-list");
    container.innerHTML = "<p class='placeholder'>Loading discounts...</p>";
}

// Show an error message if something goes wrong
function showError(message) {
    const container = document.getElementById("discount-list");
    container.innerHTML = `<p class='placeholder error'>⚠️ ${message}</p>`;
    if(window.showToast){
        window.showToast("error", "Failed to load", message);
    }
}

// Display all discount cards on the page
function displayDiscounts(records) {
    const container = document.getElementById("discount-list");
    container.innerHTML = ""; // clear any old content

    if (records.length === 0) {
        container.innerHTML = "<p class='placeholder'>No discounts found.</p>";
        return;
    }

    records.forEach(record => {
        const d = record.fields;

        const title = d.Title || "Untitled Discount";
        const description = d.Description || "No description provided.";
        const url = d.URL ? `<a href="${d.URL}" target="_blank">View Offer</a>` : "";
        const category = d.Category || "General";
        const tags = d.Tags ? d.Tags.split(",").map(t => `<span class="tag">${t.trim()}</span>`).join(" ") : "";
        const studentOnly = d["Student Only"] ? "Student Only" : "Available to Everyone";
        const status = d["Current Status"] || "Unknown";
        const expiresAt = d["Expires At"] || "N/A";
        const daysLeft = d["Days Until Expiration"] !== undefined ? `${d["Days Until Expiration"]} days left` : "";

        const card = document.createElement("div");
        card.className = `discount-card ${status.toLowerCase()}`;

        card.innerHTML = `
      <h3>${title}</h3>
      <p class="description">${description}</p>
      <p class="meta">
        <strong>Category:</strong> ${category}<br>
        ${studentOnly ? `<strong>${studentOnly}</strong><br>` : ""}
        ${expiresAt !== "N/A" ? `<strong>Expires:</strong> ${expiresAt} (${daysLeft})<br>` : ""}
        <strong>Status:</strong> <span class="status ${status.toLowerCase()}">${status}</span>
      </p>
      <div class="tags">${tags}</div>
      <p class="offer-link">${url}</p>
    `;
        container.appendChild(card);
    });

    // === detail popup logic ===
    try {
        const cards = Array.from(container.querySelectorAll(".discount-card"));
        if (window.attachDetailHandlers && cards.length) {
            window.attachDetailHandlers(cards, records);
        }
    } catch (e) {}

    //  reattach filter buttons after refresh
    wireFilters();
}

// Load data from Airtable
async function loadDiscounts() {
    showLoading();

    try {
        const res = await fetch(API_URL, {
            headers: { Authorization: `Bearer ${TOKEN}` }
        });

        if (!res.ok) throw new Error(`HTTP error ${res.status}`);

        const data = await res.json();

        const validRecords = data.records.filter(
            r =>
                r.fields.Title &&
                r.fields.Title.trim() !== "" &&
                r.fields.Approved === true &&
                r.fields["Current Status"] !== "Expired"
        );

        ORIGINAL_DATA = validRecords; //  save for filters

        displayDiscounts(validRecords);
    } catch (error) {
        console.error("Error fetching data:", error);
        showError("Failed to load discounts. Please try again later.");
    }
}

//show the success message
function showSuccess(message){
    const msg = document.getElementById("success-message");
    if(msg){
        msg.textContent = message;
        msg.style.display = "block";
        setTimeout(()=>{
            msg.style.display = "none";
        }, 4000);
    }
}

//add a new discount to Airtable
async function addDiscount(title, description, url, category, tags, studentOnly, expiresAt){
    try{
        const currentUser = getCurrentUser();
        const fields = {
            Title: title,
            Description: description,
            URL: url,
            Category: category,
            Tags: tags,
            "Student Only": studentOnly,
            "Expires At": expiresAt,
            "Added By": currentUser
        };

        const response = await fetch(API_URL,{
            method: "POST",
            headers:{
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({fields})
        });
        const responseText = await response.text();

        if(!response.ok){
            throw new Error(`Airtable error ${response.status}: ${responseText}`);
        }

        return JSON.parse(responseText);

    }catch(error){
        console.error("Error in addDiscount:", error);
        throw error;
    }
}

document.addEventListener("DOMContentLoaded", function(){
    const modal = document.getElementById("form-modal");
    const showButton = document.getElementById("show-form-btn");
    const closeButton = document.querySelector(".close-modal");

    if(showButton){
        showButton.addEventListener("click", function(){
            modal.style.display = "block";
        });
    }
    if(closeButton){
        closeButton.addEventListener("click", function(){
            modal.style.display = "none";
        });
    }

    window.addEventListener("click", function(event){
        if(event.target === modal){
            modal.style.display = "none";
        }
    });

    const form = document.getElementById("add-form");

    if(form){
        form.addEventListener("submit", async (e)=>{
            e.preventDefault();

            const title = document.getElementById("title").value.trim();
            const description = document.getElementById("description").value.trim();
            const url = document.getElementById("url").value.trim();
            const category = document.getElementById("category").value;
            const tags = document.getElementById("tags").value.trim();
            const studentOnly = document.getElementById("student-only").checked;
            const expiresAt = document.getElementById("expires-at").value;

            if(!title || !description || !url || !category || !tags || !expiresAt){
                alert("Please fill in all fields");
                return;
            }

            const submitButton = form.querySelector('button[type="submit"]');
            if(submitButton){
                submitButton.disabled = true;
                submitButton.textContent = "Submitting";
            }

            try{
                await addDiscount(title, description, url, category, tags, studentOnly, expiresAt);

                showSuccess("Discount submitted successfully");
                form.reset();

                setTimeout(()=>{
                    modal.style.display = "none";
                }, 2000);

            }catch(error){
                alert("Failed to submit discount: " + error.message);
            }finally{
                if(submitButton){
                    submitButton.disabled = false;
                    submitButton.textContent = "Submit Discount";
                }
            }
        });
    }

    // auth logic
    updateAuthUI();

    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const showRegisterButton = document.getElementById("show-register");
    const showLoginButton = document.getElementById("show-login");
    const logoutButton = document.getElementById("logout-btn");

    if(showRegisterButton){
        showRegisterButton.addEventListener("click", function(){
            document.getElementById("login-box").style.display = "none";
            document.getElementById("register-box").style.display = "block";
        });
    }

    if(showLoginButton){
        showLoginButton.addEventListener("click", function(){
            document.getElementById("register-box").style.display = "none";
            document.getElementById("login-box").style.display = "block";
        });
    }

    if(loginForm){
        loginForm.addEventListener("submit", async(event)=>{
            event.preventDefault();
            const username = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value.trim();

            if(!username || !password){
                alert("Please fill in all fields");
                return;
            }

            try{
                await loginUser(username, password);
                setCurrentUser(username);
                alert("Login successful");
                updateAuthUI();
                loginForm.reset();
            }catch(error){
                alert(error.message);
            }
        });
    }

    if(registerForm){
        registerForm.addEventListener("submit", async(event)=>{
            event.preventDefault();
            const username = document.getElementById("register-username").value.trim();
            const password = document.getElementById("register-password").value.trim();

            if(!username || !password){
                alert("Please fill in all fields");
                return;
            }

            try{
                await registerUser(username, password);
                alert("Registration successful! Please login.");
                document.getElementById("register-box").style.display = "none";
                document.getElementById("login-box").style.display = "block";
                registerForm.reset();
            }catch(error){
                alert(error.message);
            }
        });
    }

    if(logoutButton){
        logoutButton.addEventListener("click", function(){
            clearCurrentUser();
            alert("Logged out successfully");
            updateAuthUI();
        });
    }
});

//session functions
function setCurrentUser(username){
    localStorage.setItem("currentUser", username);
}
function getCurrentUser(){
    return localStorage.getItem("currentUser");
}
function clearCurrentUser(){
    localStorage.removeItem("currentUser");
}
function isLoggedIn(){
    return getCurrentUser() !== null;
}

//user login functions
async function registerUser(username, password){
    try{
        const checkUser = await fetch(`${USER_API_URL}?filterByFormula={Username}='${username}'`, {headers: {Authorization: `Bearer ${TOKEN}`}});
        if(!checkUser.ok){
            throw new Error("Failed to check existing users");
        }

        const checkData = await checkUser.json();
        if(checkData.records.length > 0){
            throw new Error("Username already exists");
        }

        const fields = {
            Username: username,
            Password: password
        };

        const response = await fetch(USER_API_URL,{
            method: "POST",
            headers:{
                Authorization: `Bearer ${TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({fields})
        });

        if(!response.ok){
            throw new Error("Failed to register");
        }

        return await response.json();

    }catch(error){
        throw error;
    }
}

async function loginUser(username, password){
    try{
        const checkUser = await fetch(`${USER_API_URL}?filterByFormula={Username}='${username}'`, {headers: {Authorization: `Bearer ${TOKEN}`}});
        const data = await checkUser.json();

        if(data.records.length === 0){
            throw new Error("Username not found");
        }

        if(data.records[0].fields.Password !== password){
            throw new Error("Wrong password");
        }

        return data.records[0];

    }catch(error){
        throw error;
    }
}

//update UI
function updateAuthUI(){
    const authSection = document.getElementById("auth-section");
    const submitButton = document.getElementById("show-form-btn");
    const logoutButton = document.getElementById("logout-btn");

    if(isLoggedIn()){
        authSection.style.display = "none";
        if(submitButton) submitButton.style.display = "inline-block";
        if(logoutButton){
            logoutButton.style.display = "inline-block";
            logoutButton.textContent = `Logout (${getCurrentUser()})`;
        }
    }else{
        authSection.style.display = "block";
        if(submitButton) submitButton.style.display = "none";
        if(logoutButton) logoutButton.style.display = "none";
    }
}

//
// FILTER BUTTON LOGIC — ONLY NEW FEATURE ADDED
//
function wireFilters() {
    const filterBar = document.querySelector(".filter-bar");
    if (!filterBar) return;

    const buttons = filterBar.querySelectorAll(".filter-btn");

    buttons.forEach(btn => {
        btn.onclick = () => {
            const category = btn.dataset.category;

            // highlight active button
            buttons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // apply filter
            if (category === "All") {
                displayDiscounts(ORIGINAL_DATA);
            } else {
                const filtered = ORIGINAL_DATA.filter(r => r.fields.Category === category);
                displayDiscounts(filtered);
            }
        };
    });
}

// ======== INIT ========
loadDiscounts();
