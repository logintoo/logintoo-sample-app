'use strict';

// Authorization Server parameters.
const client_id = '';
const redirect_uri = '';
const authServer = '';
const authApiVersion = '';

// The application API endpoint that returns data to requests with valid Access Token.
const appApiUri = '';

const language = 'en';    // OPTIONAL. Two-character code, e.g. 'fr'
const locale = 'en-CA';   // OPTIONAL. Locale name, e.g. 'fr-CA'

const tokenEndpointUri = 'https://' + 'api.' + authServer + '/' + authApiVersion + '/token';

$(async function() {
  // Initialize UI elements.
  initUI();

  // Check if this is a redirected response from the Authorization Endpoint.
  const redirected = isRedirectedResponse();

  // Try to get stored Access and Refresh Tokens.
  let tokens = getStoredTokens();

  if (redirected) {
    // Get new Access and Refresh Tokens from the Authorization Server and save them.
    tokens = await getTokens(redirected);
  }
  
  if (!tokens.accessToken && tokens.refreshToken) {
    // Refresh Access token, rotate Refresh Token.
    tokens = await getTokens(tokens);
  }
  
  const accessToken = (tokens && tokens.accessToken) ? tokens.accessToken : null;

  if (accessToken) {
    // Get content from the application API and display the JWT content.
    const resSampleApp = await getSampleApi(accessToken);
    if (resSampleApp) {
      showLoggedIn(resSampleApp);
    }
  }
  else {
    // Show the Log In button.
    showLoggedOut();
  }
});

// Initialize UI elements.
function initUI() {
  // Initializes elements of MaterializeCSS.
  M.AutoInit();
  
  // Display stored toasts if any.
  displayToasts();

  // Log in button event.
  $('#signin-btn').off('click').click(function() {authRequest();});

  // Log out button event.
  $('#signout-btn').off('click').click(function() {logOut();});
}

// Check if this is a redirected response from the Authorization Endpoint.
function isRedirectedResponse() {
  let code;
  let state;
  let language;
  let locale;

  try {
    const params = new URLSearchParams(window.location.search);
    
    code = params.get('code');
    state = params.get('state');
    language = params.get('language');
    locale = params.get('locale');
  }
  catch(error) {
    badBrowser(error);
    throw new Error('Could not get URL search parameters');
  }

  if (code === null) return false;
  if (state === null) return false;
  
  // Check the State value.
  const savedState = sessionStorage.getItem(client_id + '-state');
  
  if (state != savedState) {
    waitingToast('Wrong State parameter. Please try again.');

    cleanUp();

    // Reload the page.
    location.reload();
  }
  
  console.log('Redirected response from the Auth Server detected.')

  return {
    code: code,
    state: state,
    language: language,
    locale: locale
  };
}

// Try to get stored Access and Refresh Tokens.
function getStoredTokens() {
  // Try to get the tokens and expiration dates from the Local Storage.
  let accessToken = localStorage.getItem(client_id + '-access_token');
  const accessTokenExp = localStorage.getItem(client_id + '-access_token_exp');
  let refreshToken = localStorage.getItem(client_id + '-refresh_token');
  const refreshTokenExp = localStorage.getItem(client_id + '-refresh_token_exp');
  
  const nowSeconds = Math.floor(Date.now() / 1000);
  const float = 30; // seconds

  // Check if the access token has not expired with some margin of time.
  if (!accessToken || !accessTokenExp || (accessTokenExp - nowSeconds) < float) {
    localStorage.removeItem(client_id + '-access_token');
    localStorage.removeItem(client_id + '-access_token_exp');
    
    accessToken = false;

    console.log('No valid Access token found in the Local Storage.')
  }
  // Check the refresh token as well.
  if (!refreshToken || !refreshTokenExp || (refreshTokenExp - nowSeconds) < float) {
    localStorage.removeItem(client_id + '-refresh_token');
    localStorage.removeItem(client_id + '-refresh_token_exp');
    
    refreshToken = false;

    console.log('No valid Refresh token found in the Local Storage.')
  }

  return {
    accessToken: accessToken,
    refreshToken: refreshToken
  };
}

// Get/refresh tokens.
async function getTokens(args) {
  // Show preloader.
  $('#spinner-container').show();
  $('#logged-in').show();

  const {code, refresh_token} = args;
  const code_verifier = sessionStorage.getItem(client_id + '-code_verifier');
  
  let data;
  let method;

  if (code && !refresh_token) {
    // This is a request to create a new pair of tokens.
    console.log('Trying to get new Access and Refresh tokens.');

    data = {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirect_uri,
      client_id: client_id,
      code_verifier: code_verifier
    };

    method = 'POST';
  }

  if (refresh_token && !code) {
    // This is a refresh token request.
    console.log('Trying to refresh Access token and rotate Refresh token.');

    data = {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    };

    method = 'PATCH'
  }

  // Send request to the Token Endpoint.
  let responseToken;
  try {
    const params = {
      method: method,
      url: tokenEndpointUri,
      data: data
    }
    responseToken = await getAPIdata(params);
  }
  catch(error) {
    printError('Could not get API data');
    return;
  }
  
  const body = await responseToken.json();
  
  if (!responseToken.ok) {
    await apiFailed(responseToken.status, body);
    return {
      accessToken: null,
      refreshToken: null
    }
  }

  if (code) {
    cleanUp();
  }
  
  // Extract and save tokens.
  const accessToken = body.access_token;
  localStorage.setItem(client_id + '-access_token', accessToken);
  localStorage.setItem(client_id + '-access_token_exp', body.exp);

  const refreshToken = body.refresh_token;
  localStorage.setItem(client_id + '-refresh_token', refreshToken);
  localStorage.setItem(client_id + '-refresh_token_exp', body.rt_exp);

  $('#access-token-log').show();

  console.log('Tokens saved in the Local Storage.')

  return {
    accessToken: accessToken,
    refreshToken: refreshToken
  };
}

// Remove parameters from the address line and history.
function cleanUp() {
  history.replaceState(null, '', redirect_uri);
      
  sessionStorage.removeItem(client_id + '-state');
  sessionStorage.removeItem(client_id + '-code_verifier');
}

// Get content from the application API and display the JWT content.
async function getSampleApi(accessToken) {
  // Show preloader.
  $('#spinner-container').show();
  $('#logged-in').show();

  console.log('Trying to get content from the Sample App API.');

  let responseSampleApp;
  try {
    const params = {
      method: "GET",
      url: appApiUri,
      token: accessToken
    }
    responseSampleApp = await getAPIdata(params);
  }
  catch(error) {
    printError('Could not get API data');
    return;
  }
  
  const body = await responseSampleApp.json();

  if (!responseSampleApp.ok) {
    await apiFailed(responseSampleApp.status, body);
    return;
  }
  
  return body;
}

// Show content to a logged in user.
function showLoggedIn(resSampleApp) {
  console.log('LOGGED IN');

  if (resSampleApp.statusCode < 200 || resSampleApp.statusCode > 299) {
    $('#error-details').html('Status Code: <b>' + resSampleApp.statusCode + '</b><br>Error: <b>' + resSampleApp.statusText + '</b>');
    $('#logged-in').hide();

    $('#signin-btn-container').show();
    $('#error-4xx').show();
  }
  else {
    let userData = '';
    userData += resSampleApp.email ? '<div class="truncate">Email: <b>' + resSampleApp.email + '</b></div>' : '';
    userData += resSampleApp.email_normalized ? '<div class="truncate">Normalized Email: <b>' + resSampleApp.email_normalized + '</b></div>' : '';
    userData += resSampleApp.email_verified ? '<div>Email Verified: <b>' + resSampleApp.email_verified + '</b></div>' : '';
    userData += resSampleApp.hd ? '<div>Home Domain: <b>' + resSampleApp.hd + '</b></div>' : '';
    userData += resSampleApp.language ? '<div>Language: <b>' + resSampleApp.language + '</b></div>' : '';
    userData += resSampleApp.locale ? '<div>Locale: <b>' + resSampleApp.locale + '</b></div>' : '';
    userData += resSampleApp.iss ? '<div class="truncate">iss: <b>' + resSampleApp.iss + '</b></div>' : '';
    userData += resSampleApp.sub ? '<div class="truncate">sub: <b>' + resSampleApp.sub + '</b></div>' : '';
    userData += resSampleApp.aud ? '<div class="truncate">aud: <b>' + resSampleApp.aud + '</b></div>' : '';
    userData += resSampleApp.exp ? '<div>exp: <b>' + resSampleApp.exp + '</b> (' + new Date(resSampleApp.exp * 1000).toLocaleString() + ')</div>' : '';
    userData += resSampleApp.iat ? '<div>iat: <b>' + resSampleApp.iat + '</b> (' + new Date(resSampleApp.iat * 1000).toLocaleString() + ')</div>' : '';
    userData += resSampleApp.nbf ? '<div>nbf: <b>' + resSampleApp.nbf + '</b> (' + new Date(resSampleApp.nbf * 1000).toLocaleString() + ')</div>' : '';
    userData += resSampleApp.jti ? '<div class="truncate">jti: <b>' + resSampleApp.jti + '</b></div>' : '';

    $('#sample-api-response').html(userData);              

    $('#sample-api-container').show();
    $('#spinner-container').hide();
    $('#signout-btn-container').show();
  }
}

// Show the Log In button.
function showLoggedOut() {
  console.log('LOGGED OUT');

  $('#logged-in').hide();
  $('#sample-api-response').empty();

  $('#signout-btn-container').hide();
  $('#signin-btn-container').show();
}

// Log the user out.
function logOut() {
  showLoggedOut();

  const refreshToken = localStorage.getItem(client_id + '-refresh_token');
 
  localStorage.removeItem(client_id + '-access_token');
  localStorage.removeItem(client_id + '-access_token_exp');
  localStorage.removeItem(client_id + '-refresh_token');
  localStorage.removeItem(client_id + '-refresh_token_exp');
  
  if (!refreshToken) return;
  
  // Delete the auth record on the server.
  console.log('Delete the auth record on the server.');
  try {
    getAPIdata({
      method: 'DELETE',
      url: tokenEndpointUri,
      data: {refresh_token: refreshToken}
    });
  }
  catch(error) {
    console.log('Error while deleting auth record', error);
  }

  console.log('FINISH');
}

// Get cryptographically strong random 43-octet URL safe string.
function generateRandom() {
  try {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);

    return arrayToString(arr);
  }
  catch(error) {
    badBrowser(error);
    throw new Error('Could not generate random value.');
  }
}

// Have the string hashed by SHA-256 and base64url-encoded.
async function hashAndEncode(verifier) {
  try {
    // Encode as utf-8.
    const verifierUint8 = Uint8Array.from(verifier, x => x.charCodeAt(0));
    
    // Make hash as a hex string.
    const hashBuffer = await crypto.subtle.digest('SHA-256', verifierUint8);
    const arr = new Uint8Array(hashBuffer);
    
    return arrayToString(arr);
  }
  catch(error) {
    badBrowser(error);
    throw new Error('Could not get a hash of the string.');
  }
}

// Convert Uint8Array to URL safe string.
function arrayToString(arr) {
  let output = '';

  for (let i = 0, len = arr.length; i < len; i++) {
    output += String.fromCharCode(arr[i]);
  }
  
  // Base64url encode.
  output = window.btoa(output);
  
  // Remove padding character (=) and replace 62nd (+) and 63rd (/) chars of Base64 encoding.
  output = output.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  
  return output;
}

// Generate code verifier, code challenge, and the state parameter.
function getSecrets() {
  // Generate code verifier and challenge.
  let code_verifier = sessionStorage.getItem(client_id + '-code_verifier');
  if (!code_verifier) {
    code_verifier = generateRandom();
    sessionStorage.setItem(client_id + '-code_verifier', code_verifier);
  }
  
  // Generate state parameter.
  let state = sessionStorage.getItem(client_id + '-state');
  if (!state) {
    state = generateRandom();
    sessionStorage.setItem(client_id + '-state', state);
  }

  return {
    code_verifier: code_verifier,
    state: state
  }
}

// Send request to the Authorization Endpoint.
async function authRequest() {
  const auth_uri = 'https://' + authServer + '/' + authApiVersion + '/';

  try {
    $('#signin-btn').addClass('disabled');

    const {code_verifier, state} = getSecrets();
    const code_challenge = await hashAndEncode(code_verifier);

    const redirectUri = new URL(redirect_uri);

    // Build the Authorization Request URL.
    const url = new URL(auth_uri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', client_id);
    url.searchParams.set('redirect_uri', redirectUri.toString());
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', code_challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    
    // Optional parameters.
    if (typeof language !== 'undefined' && language) {
      url.searchParams.set('language', language);
    }
    if (typeof locale !== 'undefined' && locale) {
      url.searchParams.set('locale', locale);
    }

    // Redirect to the authorization page.
    window.location.assign(url.toString());
  }
  catch(error) {
    badBrowser(error);
    throw new Error('Could not send a request to the Authorization server.');
  }
}

// Perform API requests.
function getAPIdata(params) {
  const {method, url, data, token} = params;
  try {
    let options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    if (token) {
      options.headers.Authorization = 'Bearer ' + token;
    }
    
    if (method != 'GET' && method != 'HEAD' && data) {
      options.body = JSON.stringify(data);
    }

    return fetch(url, options);
  }
  catch(error) {
    badBrowser(error);
  }
}

// Display an error message if the browser doesn't support features required.
function badBrowser(error) {
  console.error('Bad Browser:', error);

  $('#signin-btn-container').hide();
  $('#sample-api-response').empty();
  $('#logged-in').hide();
  $('#signout-btn-container').hide();

  $('#bad-browser').show();
}

// Store a message to be shown as a toast after the page reload.
function waitingToast(message) {
  if (message) {
    var wt = JSON.parse(sessionStorage.getItem(client_id + '-waitingToasts'));
    if (Array.isArray(wt)) {
      wt.push(String(message))
    }
    else {
      wt = [String(message)];
    }

    sessionStorage.setItem(client_id + '-waitingToasts', JSON.stringify(wt));
  }
}

// Display stored toasts.
function displayToasts() {
  const wt = JSON.parse(sessionStorage.getItem(client_id + '-waitingToasts'));
  if (Array.isArray(wt)) {
    for (let i = 0, len = wt.length; i < len; i++) {
      printError(wt[i], 6000);
    }
  }
  sessionStorage.removeItem(client_id + '-waitingToasts');
}

// In case the API request failed.
async function apiFailed(status, body) {
  console.error('API Failed:', body);

  if (isNaN(status)) {
    printError('API Error', 60000);
  }

  if (status >= 400 && status <= 499) {
    if (body.error_description) {
      printError(body.error_description, 60000);
    }
    else if (body.statusText) {
      printError(body.statusText, 60000);
    }
    logOut();
  }

  if (status >= 500 && status <= 599) {
    printError('Internal Server Error', 60000);
    logOut();
  }
}

// Send unobtrusive alerts to the user through toasts.
function printError(err, duration) {
  console.error('Error:', err);

  let errMessage = '';
  if (typeof err === 'string') {
    errMessage = err;
  }
  if (typeof err === 'object') {
    errMessage = err.message;
  }
  if (!errMessage) {
    errMessage = 'Something went wrong';
  }

  M.toast({
    html: errMessage,
    displayLength: duration
  });
}
