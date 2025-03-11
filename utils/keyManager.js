const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Key Manager for handling RSA keys for JWT signing and verification
 */
class KeyManager {
  constructor() {
    this.keyDir = path.join(__dirname, '../keys');
    this.privateKeyPath = path.join(this.keyDir, 'private.key');
    this.publicKeyPath = path.join(this.keyDir, 'public.pem');
    this.keyId = '1'; // Default key ID
  }

  /**
   * Ensure keys directory and keys exist
   */
  ensureKeysExist() {
    // Create keys directory if it doesn't exist
    if (!fs.existsSync(this.keyDir)) {
      fs.mkdirSync(this.keyDir, { recursive: true });
    }

    // Generate keys if they don't exist
    if (!fs.existsSync(this.privateKeyPath) || !fs.existsSync(this.publicKeyPath)) {
      this.generateKeys();
    }
  }

  /**
   * Generate new RSA key pair
   */
  generateKeys() {
    console.log('Generating new RSA key pair...');
    
    // Generate keys
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Save keys to files
    fs.writeFileSync(this.privateKeyPath, privateKey, { mode: 0o600 }); // Set restricted permissions
    fs.writeFileSync(this.publicKeyPath, publicKey);
    
    console.log('RSA key pair generated and saved.');
    
    return { privateKey, publicKey };
  }

  /**
   * Get private key
   */
  getPrivateKey() {
    this.ensureKeysExist();
    return fs.readFileSync(this.privateKeyPath, 'utf8');
  }

  /**
   * Get public key
   */
  getPublicKey() {
    this.ensureKeysExist();
    return fs.readFileSync(this.publicKeyPath, 'utf8');
  }

  /**
   * Get JWKS (JSON Web Key Set) representation of the public key
   */
  getJwks() {
    const publicKey = this.getPublicKey();
    
    // Parse the key components
    const key = crypto.createPublicKey(publicKey);
    const keyData = key.export({ format: 'jwk' });
    
    // Add additional properties required for JWKS
    const jwk = {
      ...keyData,
      use: 'sig',
      kid: this.keyId,
      alg: 'RS256'
    };

    return {
      keys: [jwk]
    };
  }

  /**
   * Sign payload with private key
   */
  sign(payload) {
    const privateKey = this.getPrivateKey();
    return jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      expiresIn: '1h',
      header: {
        kid: this.keyId,
        alg: 'RS256',
      }
    });
  }

  /**
   * Verify JWT with public key
   */
  verify(token, publicKey) {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256']
    });
  }
}

// Export singleton instance
module.exports = new KeyManager();
