const express = require('express');
const router = express.Router();
const path = require('path');

var fs = require('fs');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var async = require('async');
var _ = require('lodash');
var json2csv = require('json2csv');

// var gmail = google.gmail('v1');

var ids = ["From", "To", "Subject", "Date", "Reply-To", "Sender"];
var objKeys = ["from", "to", "subject", "date", "replyTo", "sender"];
var findResult = false;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/gmail-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
  process.env.USERPROFILE) + '/.credentials/';
var TOKEN_PATH = TOKEN_DIR + 'gmail-nodejs-quickstart.json';

// Load client secrets from a local file.
fs.readFile(path.resolve(__dirname, 'client_secret.json'), function processClientSecrets(err, content) {
  if (err) {
    console.log('Error loading client secret file: ' + err);
    return;
  }
  // Authorize a client with the loaded credentials, then call the
  // Gmail API.
  authorize(JSON.parse(content), listMessages);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var auth = new googleAuth();
  var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, function (err, token) {
    if (err) {
      getNewToken(oauth2Client, callback);
    } else {
      oauth2Client.credentials = JSON.parse(token);
      callback(oauth2Client);
    }
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback) {
  var authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url: ', authUrl);
  var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', function (code) {
    rl.close();
    oauth2Client.getToken(code, function (err, token) {
      if (err) {
        console.log('Error while trying to retrieve access token', err);
        return;
      }
      oauth2Client.credentials = token;
      storeToken(token);
      callback(oauth2Client);
    });
  });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
  try {
    fs.mkdirSync(TOKEN_DIR);
  } catch (err) {
    if (err.code != 'EEXIST') {
      throw err;
    }
  }
  fs.writeFile(TOKEN_PATH, JSON.stringify(token));
  console.log('Token stored to ' + TOKEN_PATH);
}

function listMessages(auth) {
  if (nextPageToken) {
    request = gmail.users.messages.list({
      'userId': 'me',
      'pageToken': nextPageToken
    });
    getPageOfMessages(request, result);
  } else {
    callback(result);
    console.log(result);
  }
  let headersAll = [];
  var gmail = google.gmail('v1');
  if (nextPageToken) {
    gmail.users.messages.list({
      auth: auth,
      userId: 'me',
      pageToken: nextPageToken
    }, function (err, response) {
      if (err) {
        console.log('The API returned an error: ' + err);
        return;
      }
      console.log('- response messages==>>', response);
      //var id = response.messages[1].id;
      async.each(response.messages, function (message, cb) {
        console.log('- each messages==>>', message);
        getMessage(auth, message.id, function (err, resp) {
          if (err) {
            console.log("an email failed to process", err);
            cb(err);
          } else {
            console.log("one emails processed==>>", resp);
            headersAll.push(resp);
            cb(null);
          }
        })
      }, function (err, resp) {
        if (err) {
          console.log("an email failed to process", err);
        } else {
          console.log("all emails processed==>>", headersAll);
          try {
            var result = json2csv({ data: headersAll, fields: objKeys });
            fs.writeFile(`file-${new Date().getTime()}.csv`, result, function(err) {
              if (err) throw err;
              console.log('file saved');
            });
            console.log(result);
          } catch (err) {
            console.error(err);
          }
        }
      });
    });
  }
}

function getMessage(auth, id, cb) {
  var gmail = google.gmail('v1');
  gmail.users.messages.get({
    auth: auth,
    userId: 'me',
    id: id
  }, function (err, response) {
    if (err) {
      console.log('The API returned an error: ' + err);
      cb(err);
    }
    var headers = response.payload.headers;
    var outHeaders = retreiveHeaders(headers);
    cb(null, outHeaders);
  });
}

function retreiveHeaders(headers) {
  var headersData = _(headers)
    .keyBy('name')
    .at(ids)
    .value();
  
  var returnObj = {};
  _.map(headersData, (item, index) => {
    let nItem = Object.assign({}, item);
    let name = (nItem.name !== undefined) ? JSON.parse(JSON.stringify(nItem.name).toLowerCase()) : objKeys[index];
    let value = nItem.value;

    if (name.indexOf('-') !== -1) {
      name = name.replace('-', '');
    }
    if (value !== undefined && value.indexOf('<') !== -1) {
      nameValue = value.substring(0, value.indexOf('<')).trim();
      value = value.substring(value.indexOf('<') + 1, value.indexOf('>'));
      console.log("namevalue", nameValue);
      returnObj[name+"Name"] = nameValue;
    }
    returnObj[objKeys[index]] = value;
    return;
  });
  return returnObj;
}

// middleware that is specific to this router
router.use(function timeLog(req, res, next) {
  console.log('Time: ', Date.now());
  next();
});

// auth route
router.get('/', function (req, res) {
  res.send('Birds home page');
});

module.exports = router;
