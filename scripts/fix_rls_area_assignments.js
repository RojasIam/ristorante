const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
    let dbUrl = '';
    try {
        const envPath = path.join(__dirname, '..', '.env.local');
        const envContent = fs.readFileSync(envPath, 'utf8');
        const match = envContent.match(/DATABASE_URL=(.*)/);
        if (match && match[1]) {
            dbUrl = match[1].trim().replace(/^"|"$/g, '');
        }
    } catch (err) {
        console.error("Error reading .env.local:", err);
        process.exit(1);
    }

    if (!dbUrl) {
        console.error("DATABASE_URL not found in .env.local");
        process.exit(1);
    }

    const migrationFile = path.join(__dirname, '..', 'migrations', '08_fix_rls_area_assignments.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log("Connected to database.");
        await client.query(sql);
        console.log("Migration 08 applied successfully. RLS fixed for area_assignments.");
    } catch (err) {
        console.error("Error applying migration:", err);
    } finally {
        await client.end();
    }
}

run();
