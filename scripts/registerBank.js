require('dotenv').config({ path: '../.env' });
const fetch = require('node-fetch');

async function registerBank() {
  try {
    const apiUrl = process.env.CENTRAL_BANK_URL || 'https://henno.cfd/central-bank';
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      console.error('Error: API_KEY not found in environment variables');
      process.exit(1);
    }

    // Bank registration data based on central bank's expected format
    const registrationData = {
      name: process.env.BANK_NAME || 'Eero Bank',
      owners: "Eero Vallistu",
      jwksUrl: "https://bank.eerovallistu.site/jwks.json",
      transactionUrl: "https://bank.eerovallistu.site/transactions/b2b"
    };

    console.log('Registering bank with the following details:');
    console.log(JSON.stringify(registrationData, null, 2));
    
    // Send registration request to central bank
    const response = await fetch(`${apiUrl}/banks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(registrationData)
    });

    // Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Registration failed with status ${response.status}: ${errorText}`);
      process.exit(1);
    }

    // Expected response format will include apiKey, bankPrefix, etc.
    const result = await response.json();
    console.log('Registration successful!');
    console.log('Bank details:');
    console.log(JSON.stringify(result, null, 2));

    // Save registration data to file
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(
      path.join(__dirname, '../bankreg.txt'),
      JSON.stringify(result, null, 2)
    );
    console.log('Registration data saved to bankreg.txt');

    // Update .env file with bank prefix and API key if needed
    if (result.bankPrefix || result.apiKey) {
      console.log(`Updating .env file with registration details`);
      const envPath = path.join(__dirname, '../.env');
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      if (result.bankPrefix) {
        envContent = envContent.replace(/BANK_PREFIX=.*/g, `BANK_PREFIX=${result.bankPrefix}`);
      }
      
      if (result.apiKey) {
        envContent = envContent.replace(/API_KEY=.*/g, `API_KEY=${result.apiKey}`);
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log('Environment variables updated');
    }

  } catch (error) {
    console.error('Error registering bank:', error);
    process.exit(1);
  }
}

// Run the registration
registerBank();
