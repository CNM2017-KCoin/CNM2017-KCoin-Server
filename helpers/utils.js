const crypto = require('crypto');
const _ = require('lodash');
const bitInt = require('big-integer');
const ursa = require('ursa');

const HASH_ALGORITHM = 'sha256';

// module.exports = exports = () => {
  // SHA256 hash
  // let hash = function (data) {
  //   let hash = crypto.createHash(HASH_ALGORITHM);
  //   hash.update(data);
  //   return hash.digest();
  // };

  // Convert hex to big int
  // let hexToBigInt = function (hex) {
  //   return bitInt(hex, 16);
  // };

  // let generateKey = function () {
  //   // Same as openssl genrsa -out key-name.pem <modulusBits>
  //   return ursa.generatePrivateKey(1024, 65537);
  // };

  exports.verify = function (message, publicKeyHex, signatureHex) {
    // Create public key form hex
    let publicKey = ursa.createPublicKey(Buffer.from(publicKeyHex, 'hex'));
    // Create verifier
    let verifier = ursa.createVerifier(HASH_ALGORITHM);
    // Push message to verifier
    verifier.update(message);
    // Check with public key and signature
    return verifier.verify(publicKey, signatureHex, 'hex');
  };

  exports.sign = function (message, privateKeyHex) {
    // Create private key form hex
    let privateKey = ursa.createPrivateKey(Buffer.from(privateKeyHex, 'hex'));
    // Create signer
    let signer = ursa.createSigner(HASH_ALGORITHM);
    // Push message to verifier
    signer.update(message);
    // Sign
    return signer.sign(privateKey, 'hex');
  };

  exports.generateAddress = function () {
    let privateKey = ursa.generatePrivateKey(1024, 65537);
    let publicKey = privateKey.toPublicPem();

    let hash = crypto.createHash(HASH_ALGORITHM);
    hash.update(publicKey);
    let publicKeyHash = (hash.digest()).toString('hex');

    return {
      privateKey: privateKey.toPrivatePem('hex'),
      publicKey: publicKey.toString('hex'),
      // Address is hash of public key
      address: publicKeyHash
    };
  };

//   return { hash, hexToBigInt, generateAddress, verify, sign };
// };