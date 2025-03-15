require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { Pool } = require("pg");

const pool = new Pool({
    user: "postgres",
    host: "localhost",
    database: "literacy_dapat",
    password: "Jctan123",
    port: 5432,
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authenticateToken = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    jwt.verify(token, "your_secret_key", (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
};

// Multer storage setup for avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Avatar Upload Route
app.post("/api/upload-avatar", authenticateToken, upload.single("avatar"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const fileUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    try {
        await pool.query(
            "UPDATE users SET avatar_url = $1 WHERE id = $2",
            [fileUrl, req.user.userId]
        );

        res.json({ avatar_url: fileUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Registration
app.post("/api/auth/register", async (req, res) => {
    const { email, password, role, fullName = "", bio = "", avatarUrl = "", phoneNumber = "", skills = "", location = "" } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const existingUser = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "Email already registered" });
        }

        await pool.query(
            `INSERT INTO users (email, password, role, full_name, bio, avatar_url, phone_number, skills, location) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [email, hashedPassword, role || "user", fullName, bio, avatarUrl, phoneNumber, skills, location]
        );

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// User Login
app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            "SELECT id, email, password, role, full_name, bio, avatar_url, phone_number, skills, location FROM users WHERE email = $1", 
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign(
            { userId: user.id, role: user.role },
            "your_secret_key",
            { expiresIn: "1h" }
        );

        res.json({ 
            token, 
            role: user.role, 
            email: user.email,
            fullName: user.full_name,
            bio: user.bio,
            avatarUrl: user.avatar_url,
            phoneNumber: user.phone_number,
            skills: user.skills,
            location: user.location
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get User Profile
app.get("/api/user/profile", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT email, full_name, bio, avatar_url, phone_number, skills, location FROM users WHERE id = $1", 
            [req.user.userId]
        );

        if (result.rows.length === 0) return res.status(404).json({ message: "Profile not found" });

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Profile
app.put("/api/user/profile", authenticateToken, upload.single("avatar"), async (req, res) => {
    const { full_name, bio, phone_number, skills, location } = req.body;
    let avatarUrl = null;

    // If there's an avatar file uploaded, create its URL
    if (req.file) {
        avatarUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
    } else {
        // If no new avatar is uploaded, keep the existing avatar_url
        avatarUrl = req.body.avatar_url || null;
    }

    try {
        await pool.query(
            `UPDATE users 
             SET full_name = $1, bio = $2, avatar_url = $3, phone_number = $4, skills = $5, location = $6 
             WHERE id = $7`,
            [full_name, bio, avatarUrl, phone_number, skills, location, req.user.userId]
        );

        res.json({ message: "Profile updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assessments API Routes

// Get all assessments
app.get("/api/assessments", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM assessments ORDER BY created_at DESC");
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a new assessment
app.post("/api/assessments", authenticateToken, async (req, res) => {
    console.log("Received data:", req.body);
    try {
        const result = await pool.query(
            `INSERT INTO assessments (student_age, student_gender, student_grade_level, student_city, student_school, student_barangay, student_region) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [
                req.body.student_age, req.body.student_gender, req.body.student_grade_level,
                req.body.student_city, req.body.student_school, req.body.student_barangay, req.body.student_region
            ]
        );
        console.log("Inserted assessment:", result.rows[0]);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error("Database Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// Delete an assessment by ID
app.post("/api/assessments/delete", async (req, res) => {
    const { ids } = req.body;
    if (!ids || ids.length === 0) {
        return res.status(400).json({ message: "No assessments selected for deletion" });
    }

    try {
        await pool.query("DELETE FRO    M assessments WHERE id = ANY($1)", [ids]);
        res.status(200).json({ message: "Assessments deleted successfully" });
    } catch (error) {
        console.error("Error deleting assessments:", error);
        res.status(500).json({ message: "Error deleting assessments" });
    }
});
app.listen(5000, () => console.log("Server running on port 5000"));

// Get a specific assessment by ID
app.get("/api/assessments/:id", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM assessments WHERE id = $1", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Assessment not found" });
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.put("/api/assessments/:id/status", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
        return res.status(400).json({ error: "Missing status field" });
    }

    try {
        const result = await pool.query(
            "UPDATE assessments SET status = $1 WHERE id = $2 RETURNING *",
            [status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Assessment not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating assessment status:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.put("/api/assessments/:id/level", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { level } = req.body;

    if (!level) {
        return res.status(400).json({ error: "Missing level field" });
    }

    try {
        const result = await pool.query(
            "UPDATE assessments SET level = $1 WHERE id = $2 RETURNING *",
            [level, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Assessment not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating assessment level:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/", (
    request, response
)=>(response.send("hatdog")))

app.listen(5000, () => console.log("Server running on port 5000"));

module.exports = app;
