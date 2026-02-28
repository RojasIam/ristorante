const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Read keys
let supabaseUrl = '';
let serviceKey = '';

try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
    if (urlMatch && urlMatch[1]) supabaseUrl = urlMatch[1].trim();

    const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/);
    if (keyMatch && keyMatch[1]) serviceKey = keyMatch[1].trim();
    
    if (supabaseUrl.startsWith('"')) supabaseUrl = supabaseUrl.slice(1, -1);
    if (serviceKey.startsWith('"')) serviceKey = serviceKey.slice(1, -1);
} catch (err) {
    console.error("Error reading .env:", err);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const email = 'admin@garsystem.com';
    const password = 'password123';

    console.log(`Searching for user: ${email}`);
    
    // List users (pagination defaults to page 1, which is fine)
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
        console.error("Error listing users:", error.message);
        return;
    }

    const existingUser = users.find(u => u.email === email);

    if (existingUser) {
        console.log(`User found (ID: ${existingUser.id}). Updating password...`);
        const { data, error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password: password }
        );

        if (updateError) {
            console.error("Failed to update password:", updateError.message);
        } else {
            console.log("Password updated successfully.");
        }
    } else {
        console.log("User not found. Creating...");
        const { data, error: createError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { role: 'admin' }
        });

        if (createError) {
            console.error("Failed to create user:", createError.message);
        } else {
            console.log("User created successfully:", data.user.id);
        }
    }
}

main();
