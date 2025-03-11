require('dotenv').config({ path: '../.env' });
const centralBankService = require('../services/centralBankService');

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m"
};

async function testCentralBank() {
  console.log(`${colors.cyan}Testing connection to central bank...${colors.reset}`);
  console.log(`${colors.cyan}Central Bank URL: ${process.env.CENTRAL_BANK_URL || 'https://henno.cfd/central-bank'}${colors.reset}`);
  console.log(`${colors.cyan}API Key: ${process.env.API_KEY ? '*'.repeat(8) + process.env.API_KEY.slice(-4) : 'Not set'}${colors.reset}`);
  
  try {
    console.log(`${colors.yellow}Fetching all banks...${colors.reset}`);
    const banks = await centralBankService.getAllBanks(true);
    
    console.log(`${colors.green}Success! Found ${banks.length} banks:${colors.reset}`);
    banks.forEach(bank => {
      console.log(`${colors.blue}Bank: ${bank.name} (${bank.bankPrefix})${colors.reset}`);
      console.log(`  ID: ${bank.id}`);
      console.log(`  Transaction URL: ${bank.transactionUrl}`);
      console.log(`  JWKS URL: ${bank.jwksUrl}`);
      console.log(`  Owners: ${bank.owners}`);
      console.log('---');
    });
    
    if (process.env.BANK_PREFIX) {
      console.log(`${colors.yellow}Looking up our own bank (${process.env.BANK_PREFIX})...${colors.reset}`);
      const ourBank = await centralBankService.getBankDetails(process.env.BANK_PREFIX, true);
      
      if (ourBank) {
        console.log(`${colors.green}Found our bank:${colors.reset}`);
        console.log(`  Name: ${ourBank.name}`);
        console.log(`  Prefix: ${ourBank.bankPrefix}`);
      } else {
        console.log(`${colors.red}Our bank is NOT registered with the central bank!${colors.reset}`);
        console.log(`${colors.yellow}Run the registerBank.js script to register.${colors.reset}`);
      }
    }
  } catch (error) {
    console.error(`${colors.red}Error testing central bank:${colors.reset}`, error);
    console.error(`${colors.yellow}Suggestions:${colors.reset}`);
    console.error(`1. Check if your CENTRAL_BANK_URL is correctly set in .env`);
    console.error(`2. Verify your API_KEY is correct`);
    console.error(`3. Make sure the central bank server is running and accessible`);
  }
}

testCentralBank().catch(console.error);
