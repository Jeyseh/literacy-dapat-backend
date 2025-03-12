require("dotenv").config();
const { Pool, Client } = require("pg");
const bcrypt = require("bcryptjs");

const dbConfig = {
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    password: process.env.DB_PASSWORD || "Jctan123",
    port: process.env.DB_PORT || 5432,
};

// Step 1: Create the database if it doesn't exist
const createDatabase = async () => {
    const client = new Client({
        ...dbConfig,
        database: "postgres", // Connect to the default database first
    });

    try {
        await client.connect();
        const dbName = "literacy_dapat";

        // Check if the database exists
        const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
        if (res.rowCount === 0) {
            await client.query(`CREATE DATABASE ${dbName}`);
            console.log(`Database '${dbName}' created successfully ✅`);
        } else {
            console.log(`Database '${dbName}' already exists ✅`);
        }
    } catch (error) {
        console.error("Error creating database:", error);
    } finally {
        await client.end();
    }
};

// Step 2: Create the users table if it doesn't exist
const pool = new Pool({
    ...dbConfig,
    database: "literacy_dapat",
});

const createUsersTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role VARCHAR(50) NOT NULL,
                full_name VARCHAR(255),
                bio TEXT,
                avatar_url TEXT,
                phone_number VARCHAR(20),
                skills TEXT,
                location VARCHAR(255)
            )
        `);
        console.log("Users table checked/created ✅");
    } catch (error) {
        console.error("Error creating users table:", error);
    }
};

// Step 3: Insert dummy users
const seedUsers = async () => {
    const users = [
        { 
            email: "aaronmichaelichua@gmail.com", 
            password: "IamUser", 
            role: "user",
            full_name: "Aaron Chua",
            bio: "Passionate about literacy and education.",
            avatar_url: "https://example.com/avatar1.jpg",
            phone_number: "1234567890",
            skills: "Teaching, Writing",
            location: "Manila, Philippines"
        },
        { 
            email: "literacyadmin@gmail.com", 
            password: "IamAdmin", 
            role: "admin",
            full_name: "Admin User",
            bio: "Managing literacy programs worldwide.",
            avatar_url: "https://example.com/avatar2.jpg",
            phone_number: "0987654321",
            skills: "Administration, Project Management",
            location: "New York, USA"
        }
    ];

    for (let user of users) {
        const hashedPassword = await bcrypt.hash(user.password, 10);
        await pool.query(
            `INSERT INTO users 
            (email, password, role, full_name, bio, avatar_url, phone_number, skills, location) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
            ON CONFLICT (email) DO NOTHING`,
            [user.email, hashedPassword, user.role, user.full_name, user.bio, user.avatar_url, user.phone_number, user.skills, user.location]
        );
    }

    console.log("Dummy users inserted ✅");
};

// Run all steps
const setupDatabase = async () => {
    await createDatabase(); // Create the database if needed
    await createUsersTable(); // Create the users table if needed
    await seedUsers(); // Insert dummy users
    pool.end(); // Close the connection
};

// Execute the script
setupDatabase().catch((err) => console.error(err));
