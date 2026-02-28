const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// 1. Read DATABASE_URL from .env.local
let dbUrl = '';
try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.*)/);
    if (match && match[1]) {
        dbUrl = match[1].trim();
        // Remove quotes if present
        if (dbUrl.startsWith('"') && dbUrl.endsWith('"')) {
            dbUrl = dbUrl.slice(1, -1);
        }
    }
} catch (err) {
    console.error("Error reading .env.local:", err);
    process.exit(1);
}

if (!dbUrl) {
    console.error("DATABASE_URL not found in .env.local");
    process.exit(1);
}

// 2. Run Migration 07
const migrationFile = path.join(__dirname, '..', 'migrations', '07_add_traffic_light_column.sql');
const sql = fs.readFileSync(migrationFile, 'utf8');

const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Required for Supabase sometimes
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to database.");
        
        console.log("Running migration 07...");
        await client.query(sql);
        console.log("Migration 07 applied successfully.");

    } catch (err) {
        console.error("Error applying migration:", err);
        // Don't exit with error code if column already exists (code 42701)
        if (err.code === '42701') { 
             console.log("Column already exists, skipping.");
        }
    } finally {
        await client.end();
    }
}

run();
