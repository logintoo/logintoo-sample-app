'use strict';

// API Gateway must validate the Authorization header with a regex like this one: ^(?i)Bearer(?-i)\s.+

const tokenIssuer = process.env.TOKEN_ISS;
const tokenAud = process.env.TOKEN_AUD;

const AWS = require('aws-sdk');
const kms = new AWS.KMS({region: process.env.AWS_REGION});

exports.handler = async (event) => {
  var headerAuthToken = event.authorizationToken;
  
  return new Promise(async (resolve, reject) => {
    try {
      const headerParts = headerAuthToken.split(' ');
      const token = headerParts[1];
      
      // Verify token and get token data.
      const res = await verifyToken(token);
      
      if (res.error) {
        // Access denied. Reject with 403 Forbidden.
        resolve(generatePolicy('nobody', 'Deny', event.methodArn, {
          // Keep this in sync with the Gateway Response template.
          statusCode: 403,
          statusText: res.error
        }));
      }
      else {
        // Allow access.
        resolve(generatePolicy(res.payload.sub, 'Allow', event.methodArn, res.payload));
      }
    }
    catch(error) {
      console.log(error);
      // Reject with 401 Unauthorized.
      throw 'Unauthorized';
    }
  });
};

async function verifyToken(token) {
  const tokenParts = token.split('.');
  if (tokenParts.length != 3) {
    console.log('Wrong token format. Token: ' + token);
    return {error: 'BAD_TOKEN'};
  }

  let jwtHeader;
  let jwtPayload;
  try {
    jwtHeader = JSON.parse(base64UrlDecode(tokenParts[0]).toString('ascii'));
    jwtPayload = JSON.parse(base64UrlDecode(tokenParts[1]).toString('ascii'));
  }
  catch(error) {
    console.log('Wrong header or payload format. Token: ' + token);
    return {error: 'BAD_TOKEN'};
  }

  const signedMessage = tokenParts[0] + '.' + tokenParts[1];
  const jwtSignature = base64UrlDecode(tokenParts[2]);
  const alg = 'RSASSA_PKCS1_V1_5_SHA_256';
  
  // Reject if the token has expired or the time specified in the 'nbf' (not before) claim has not come.
  const now = Math.floor(Date.now() / 1000); // Current time in seconds.
  if (!jwtPayload.exp || now > jwtPayload.exp) {
    console.log('Token expired. Email: ' + jwtPayload.email + '. Now: ' + now + '. Exp: ' + jwtPayload.exp);
    return {error: 'EXPIRED_TOKEN'};
  }
  if (jwtPayload.nbf && now < jwtPayload.nbf) {
    console.log('NBF time has not come. Email: ' + jwtPayload.email + '. Now: ' + now + '. Nbf: ' + jwtPayload.nbf);
    return {error: 'NBF_TOKEN'};
  }
  if (!jwtPayload.iat || now < jwtPayload.iat) {
    console.log('IAT must be before the current time. Email: ' + jwtPayload.email + '. Now: ' + now + '. Iat: ' + jwtPayload.iat);
    return {error: 'IAT_TOKEN'};
  }
  
  // Reject if issuer or audience don't match.
  if (jwtPayload.iss != tokenIssuer) {
    console.log('Bad ISS. Email: ' + jwtPayload.email + '. Iss: ' + jwtPayload.iss);
    return {error: 'BAD_ISS_TOKEN'};
  }
  if (jwtPayload.aud != tokenAud) {
    console.log('Bad AUD. Email: ' + jwtPayload.email + '. Aud: ' + jwtPayload.aud);
    return {error: 'BAD_AUD_TOKEN'};
  }

  // Reject if algorithm is not 'RS256'.
  if (jwtHeader.alg != 'RS256') {
    console.log('Algorithm is not RS256. Email: ' + jwtPayload.email);
    return {error: 'BAD_ALG_TOKEN'};
  }
  // Reject if the key ID is not specified.
  if (!jwtHeader.kid) {
    console.log('Key ID is not specified. Email: ' + jwtPayload.email);
    return {error: 'NO_KID_TOKEN'};
  }

  const params = {
    KeyId: jwtHeader.kid,
    Message: signedMessage,
    Signature: jwtSignature,
    SigningAlgorithm: alg,
    MessageType: 'RAW'
  };

  try {
    await kms.verify(params).promise();
    
    return {error: null, payload: jwtPayload};
  }
  catch(error) {
    console.log(error);
    return {error: 'INVALID_SIGNATURE'};
  }
}

function base64UrlDecode(str) {
  const strBase64 = (str + '==='.slice((str.length + 3) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  return Buffer.from(strBase64, 'base64');
}

function generatePolicy(sub, effect, resource, policyContext) {
  const authResponse = {};
  authResponse.principalId = sub;
  
  const policyDocument = {};
  policyDocument.Version = '2012-10-17'; 

  policyDocument.Statement = [];
  policyDocument.Statement[0] = {
    Action: 'execute-api:Invoke', 
    Effect: effect,
    Resource: resource
  };

  authResponse.policyDocument = policyDocument;
  
  if (policyContext) {
    authResponse.context = policyContext;
  }

  return authResponse;
}
