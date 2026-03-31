// Web Crypto API utility for E2EE

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const generateKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );

  return keyPair;
};

export const exportPublicKey = async (publicKey: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey('spki', publicKey);
  const exportedAsBase64 = arrayBufferToBase64(exported);
  return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
};

export const exportPrivateKey = async (privateKey: CryptoKey) => {
  const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);
  const exportedAsBase64 = arrayBufferToBase64(exported);
  return `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64}\n-----END PRIVATE KEY-----`;
};

export const importPublicKey = async (pem: string) => {
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  
  const binaryDer = base64ToArrayBuffer(pemContents);

  return await window.crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['encrypt']
  );
};

export const importPrivateKey = async (pem: string) => {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  
  const binaryDer = base64ToArrayBuffer(pemContents);

  return await window.crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
};

export const encryptMessage = async (message: string, publicKeyPem: string) => {
  const publicKey = await importPublicKey(publicKeyPem);
  const encodedMessage = new TextEncoder().encode(message);
  
  // Generate random AES-GCM key
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );

  // Encrypt message with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedMessageBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    aesKey,
    encodedMessage
  );

  // Export AES key and encrypt with RSA public key
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    publicKey,
    exportedAesKey
  );

  const payload = {
    key: arrayBufferToBase64(encryptedAesKeyBuffer),
    iv: arrayBufferToBase64(iv),
    data: arrayBufferToBase64(encryptedMessageBuffer),
  };

  return JSON.stringify(payload);
};

export const decryptMessage = async (encryptedPayloadString: string, privateKeyPem: string) => {
  try {
    const payload = JSON.parse(encryptedPayloadString);
    const privateKey = await importPrivateKey(privateKeyPem);

    // Decode base64 strings
    const encryptedAesKeyArray = base64ToArrayBuffer(payload.key);
    const ivArray = base64ToArrayBuffer(payload.iv);
    const encryptedMessageArray = base64ToArrayBuffer(payload.data);

    // Decrypt AES key with RSA private key
    const decryptedAesKeyBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedAesKeyArray
    );

    // Import decrypted AES key
    const aesKey = await window.crypto.subtle.importKey(
      'raw',
      decryptedAesKeyBuffer,
      {
        name: 'AES-GCM',
      },
      false,
      ['decrypt']
    );

    // Decrypt message with AES key
    const decryptedMessageBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivArray,
      },
      aesKey,
      encryptedMessageArray
    );

    return new TextDecoder().decode(decryptedMessageBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return '[Decryption Failed]';
  }
};
