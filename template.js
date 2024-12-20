const getAllEventData = require('getAllEventData');
const JSON = require('JSON');
const sendHttpRequest = require('sendHttpRequest');
const getContainerVersion = require('getContainerVersion');
const logToConsole = require('logToConsole');
const sha256Sync = require('sha256Sync');
const getRequestHeader = require('getRequestHeader');
const getType = require('getType');
const makeString = require('makeString');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const parseUrl = require('parseUrl');
const setCookie = require('setCookie');
const decodeUriComponent = require('decodeUriComponent');
const encodeUriComponent = require('encodeUriComponent');
const getCookieValues = require('getCookieValues');

const isLoggingEnabled = determinateIsLoggingEnabled();
const traceId = isLoggingEnabled ? getRequestHeader('trace-id') : undefined;

const eventData = getAllEventData();
const url = eventData.page_location || getRequestHeader('referer');

let twclid = getCookieValues('twclid')[0];
if (!twclid) twclid = eventData.twclid;

if (url) {
  const urlParsed = parseUrl(url);

  if (urlParsed && urlParsed.searchParams.twclid) {
    twclid = decodeUriComponent(urlParsed.searchParams.twclid);
  }
}

const containerIdentifier = getRequestHeader('x-gtm-identifier');
const defaultDomain = getRequestHeader('x-gtm-default-domain');
const containerApiKey = getRequestHeader('x-gtm-api-key');
      
let postUrl =
  'https://' +
  enc(containerIdentifier) +
  '.' +
  enc(defaultDomain) +
  '/stape-api/' +
  enc(containerApiKey) +
  '/v1/twitter/auth-proxy';
const mappedEventData = mapEvent(eventData, data);
const postBody = {
  pixel_id: data.pixelId,
  auth: {
    consumer_key: data.consumerKey,
    consumer_secret: data.consumerSecret,
    oauth_token: data.oauthToken,
    oauth_token_secret: data.oauthTokenSecret,
  },
  conversions: [mappedEventData],
};

if (isLoggingEnabled) {
  logToConsole(
    JSON.stringify({
      Name: 'Twitter',
      Type: 'Request',
      TraceId: traceId,
      EventName: mappedEventData.description
        ? mappedEventData.description
        : mappedEventData.eventId,
      RequestMethod: 'POST',
      RequestUrl: postUrl,
      RequestBody: postBody,
    })
  );
}

const coockieOptions = {
  domain: 'auto',
  path: '/',
  samesite: 'Lax',
  secure: true,
  'max-age': 7776000, // 90 days
  HttpOnly: !!data.useHttpOnlyCookie,
};

if (twclid) {
  setCookie('twclid', twclid, coockieOptions);
}
sendHttpRequest(
  postUrl,
  (statusCode, headers, body) => {
    if (isLoggingEnabled) {
      logToConsole(
        JSON.stringify({
          Name: 'Twitter',
          Type: 'Response',
          TraceId: traceId,
          EventName: mappedEventData.description
            ? mappedEventData.description
            : mappedEventData.eventId,
          ResponseStatusCode: statusCode,
          ResponseHeaders: headers,
          ResponseBody: body,
        })
      );
    }
    if (!data.useOptimisticScenario) {
      if (statusCode >= 200 && statusCode < 300) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    }
  },
  {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + data.accessToken,
    },
    method: 'POST',
  },
  JSON.stringify(postBody)
);

if (data.useOptimisticScenario) {
  data.gtmOnSuccess();
}
function mapEvent(eventData, data) {
  let mappedData = {
    event_id: data.eventId,
    identifiers: [],
  };

  if (twclid) mappedData.identifiers.push({ twclid: twclid });

  mappedData = addServerEventData(eventData, data, mappedData);
  mappedData = addUserData(eventData, mappedData);
  mappedData = addEcommerceData(eventData, mappedData);
  mappedData = overrideDataIfNeeded(data, mappedData);
  mappedData = cleanupData(mappedData);
  mappedData = hashDataIfNeeded(mappedData);

  return mappedData;
}

function isHashed(value) {
  if (!value) {
    return false;
  }

  return makeString(value).match('^[A-Fa-f0-9]{64}$') !== null;
}

function hashData(value) {
  if (!value) {
    return value;
  }

  const type = getType(value);

  if (type === 'undefined' || value === 'undefined') {
    return undefined;
  }

  if (type === 'object') {
    return value;
  }

  if (isHashed(value)) {
    return value;
  }

  value = makeString(value).trim().toLowerCase();

  return sha256Sync(value, { outputEncoding: 'hex' });
}

function hashDataIfNeeded(mappedData) {
  if (mappedData.identifiers) {
    for (let key in mappedData.identifiers) {
      if (mappedData.identifiers[key]['hashed_email']) {
        mappedData.identifiers[key]['hashed_email'] = hashData(
          mappedData.identifiers[key]['hashed_email']
        );
      }

      if (mappedData.identifiers[key]['hashed_phone_number']) {
        mappedData.identifiers[key]['hashed_phone_number'] = hashData(
          mappedData.identifiers[key]['hashed_phone_number']
        );
      }
    }
  }

  return mappedData;
}

function overrideDataIfNeeded(data, mappedData) {
  if (data.userDataList) {
    data.userDataList.forEach((d) => {
      let userDataNotSet = true;

      for (let key in mappedData.identifiers) {
        if (mappedData.identifiers[key][d.name]) {
          mappedData.identifiers[key][d.name] = d.value;
          userDataNotSet = false;
        }
      }

      if (userDataNotSet) {
        let identifier = {};
        identifier[d.name] = d.value;

        mappedData.identifiers.push(identifier);
      }
    });
  }

  if (data.serverEventDataList) {
    data.serverEventDataList.forEach((d) => {
      mappedData[d.name] = d.value;
    });
  }

  return mappedData;
}

function cleanupData(mappedData) {
  if (mappedData.identifiers) {
    let userData = [];

    for (let userDataKey in mappedData.identifiers) {
      if (mappedData.identifiers[userDataKey]['hashed_email']) {
        userData.push({
          hashed_email: mappedData.identifiers[userDataKey]['hashed_email'],
        });
      }

      if (mappedData.identifiers[userDataKey]['hashed_phone_number']) {
        userData.push({
          hashed_phone_number: mappedData.identifiers[userDataKey]['hashed_phone_number'],
        });
      }

      if (mappedData.identifiers[userDataKey]['twclid']) {
        userData.push({
          twclid: mappedData.identifiers[userDataKey]['twclid'],
        });
      }
    }

    mappedData.identifiers = userData;
  }

  if (mappedData.value) {
    mappedData.value = makeNumber(mappedData.value);

    if (mappedData.value.toString().indexOf('.') === -1) {
      mappedData.value = mappedData.value + '.00';
    }
  }

  if (mappedData.contents) {
    for (let contentKey in mappedData.contents) {
      if (mappedData.contents[contentKey].content_price) {
        mappedData.contents[contentKey].content_price = makeNumber(mappedData.contents[contentKey].content_price);

        if (mappedData.contents[contentKey].content_price.toString().indexOf('.') === -1) {
          mappedData.contents[contentKey].content_price = mappedData.contents[contentKey].content_price + '.00';
        }
      }
    }
  }

  return mappedData;
}

function addEcommerceData(eventData, mappedData) {
  let currencyFromItems = '';
  let valueFromItems = 0;
  let numItems = 0;

  if (eventData.items && eventData.items[0]) {
    mappedData.custom_data = {};
    mappedData.contents = [];
    mappedData.custom_data.contents = {};
    currencyFromItems = eventData.items[0].currency;

    eventData.items.forEach((d, i) => {
      let content = {};
      if (d.id) content.content_id = d.id;
      else if (d.item_id) content.content_id = d.item_id;

      if (d.group_id) content.content_group_id = d.group_id;
      else if (d.group) content.content_group_id = d.group;

      if (d.name) content.content_name = d.name;
      else if (d.item_name) content.content_name = d.item_name;

      if (d.type) content.content_type = d.type;

      if (d.quantity) {
        content.num_items = makeInteger(d.quantity);
        numItems += makeInteger(d.quantity);
      }

      if (d.price) {
        content.content_price = d.price;
        valueFromItems += d.quantity ? d.quantity * d.price : d.price;
      }

      mappedData.contents[i] = content;
    });
  }

  if (eventData['x-ga-mp1-ev']) mappedData.value = eventData['x-ga-mp1-ev'];
  else if (eventData['x-ga-mp1-tr'])
    mappedData.value = eventData['x-ga-mp1-tr'];
  else if (eventData.value) mappedData.value = eventData.value;
  else if (valueFromItems) mappedData.value = valueFromItems;

  if (eventData.currency) mappedData.price_currency = eventData.currency;
  else if (currencyFromItems) mappedData.price_currency = currencyFromItems;

  if (eventData.number_items)
    mappedData.number_items = makeInteger(eventData.number_items);
  else if (numItems) mappedData.number_items = makeInteger(numItems);

  return mappedData;
}

function addUserData(eventData, mappedData) {
  let hashedEmail;
  let hashedPhoneNumber;

  if (eventData.email) hashedEmail = eventData.email;
  else if (eventData.user_data && eventData.user_data.email_address)
    hashedEmail = eventData.user_data.email_address;
  else if (eventData.user_data && eventData.user_data.email)
    hashedEmail = eventData.user_data.email;

  if (hashedEmail) {
    mappedData.identifiers.push({ hashed_email: hashedEmail });
  }

  if (eventData.phone) hashedPhoneNumber = eventData.phone;
  else if (eventData.user_data && eventData.user_data.phone_number)
    hashedPhoneNumber = eventData.user_data.phone_number;
  else if (eventData.user_data && eventData.user_data.phone)
    hashedPhoneNumber = eventData.user_data.phone;

  if (hashedPhoneNumber) {
    mappedData.identifiers.push({ hashed_phone_number: hashedPhoneNumber });
  }

  return mappedData;
}

function addServerEventData(eventData, data, mappedData) {
  if (eventData.transaction_id)
    mappedData.conversion_id = eventData.transaction_id;
  else if (eventData.event_id) mappedData.conversion_id = eventData.event_id;

  if (eventData.description) mappedData.description = eventData.description;

  if (eventData.conversion_time)
    mappedData.conversion_time = eventData.conversion_time;
  else if (eventData.conversionTime)
    mappedData.conversion_time = eventData.conversionTime;
  else if (eventData.dateISO) mappedData.conversion_time = eventData.dateISO;

  return mappedData;
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function enc(data) {
  data = data || '';
  return encodeUriComponent(data);
}
