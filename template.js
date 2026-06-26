const decodeUriComponent = require('decodeUriComponent');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const makeInteger = require('makeInteger');
const makeNumber = require('makeNumber');
const makeString = require('makeString');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');
const sha256Sync = require('sha256Sync');

/*==============================================================================
==============================================================================*/

const API_VERSION = '12';
const eventData = getAllEventData();

if (shouldExitEarly(data, eventData)) return;

const url = getUrl(eventData);
const twclid = getClickId(url, eventData);
setClickIdCookie(twclid);

const mappedEventData = mapEvent(data, eventData, twclid);
sendRequest(data, mappedEventData);

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
VENDOR RELATED FUNCTIONS
==============================================================================*/

function getClickId(url, eventData) {
  let clickId = getCookieValues('twclid')[0] || eventData.twclid;

  if (url) {
    const urlParsed = parseUrl(url);
    if (urlParsed && urlParsed.searchParams.twclid) {
      clickId = decodeUriComponent(urlParsed.searchParams.twclid);
    }
  }
  return clickId;
}

function setClickIdCookie(twclid) {
  if (!twclid) return;

  const cookieOptions = {
    domain: 'auto',
    path: '/',
    samesite: 'Lax',
    secure: true,
    'max-age': 7776000, // 90 days
    HttpOnly: !!data.useHttpOnlyCookie
  };

  setCookie('twclid', twclid, cookieOptions);
}

function generateRequestUrl(pixelId, authMethod) {
  if (authMethod === 'accessToken') {
    return 'https://ads-api.x.com/' + API_VERSION + '/measurement/conversions/' + enc(pixelId);
  }

  const containerIdentifier = getRequestHeader('x-gtm-identifier');
  const defaultDomain = getRequestHeader('x-gtm-default-domain');
  const containerApiKey = getRequestHeader('x-gtm-api-key');

  return (
    'https://' +
    enc(containerIdentifier) +
    '.' +
    enc(defaultDomain) +
    '/stape-api/' +
    enc(containerApiKey) +
    '/v1/twitter/auth-proxy'
  );
}

function generateRequestOptions(data, authMethod) {
  const requestOptions = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'POST'
  };

  if (authMethod === 'accessToken') {
    requestOptions.headers['X-Pixel-Token'] = data.pixelAccessToken;
  } else {
    requestOptions.headers['x-twitter-api-version'] = API_VERSION;
    requestOptions.headers['Authorization'] = 'Bearer ' + data.accessToken;
  }

  return requestOptions;
}

function sendRequest(data, mappedEventData) {
  const authMethod = data.hasOwnProperty('authMethod') ? data.authMethod : 'oAuth'; // Backward compatibility.
  const requestUrl = generateRequestUrl(data.pixelId, authMethod);
  const requestOptions = generateRequestOptions(data, authMethod);
  const requestBody = getPostBody(data, mappedEventData, authMethod);

  sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      if (!data.useOptimisticScenario) {
        const parsedBody = JSON.parse(body || '{}');
        if (
          statusCode >= 200 &&
          statusCode < 300 &&
          getType(parsedBody.data) === 'object' &&
          parsedBody.data.conversions_processed
        ) {
          return data.gtmOnSuccess();
        } else {
          return data.gtmOnFailure();
        }
      }
    },
    requestOptions,
    JSON.stringify(requestBody)
  );
}

function getPostBody(data, mappedEventData, authMethod) {
  const postBody = {
    pixel_id: data.pixelId,
    conversions: [mappedEventData]
  };

  if (authMethod === 'oAuth') {
    postBody.auth = {
      consumer_key: data.consumerKey,
      consumer_secret: data.consumerSecret,
      oauth_token: data.oauthToken,
      oauth_token_secret: data.oauthTokenSecret
    };
  }

  return postBody;
}

function mapEvent(data, eventData, twclid) {
  let mappedData = {
    event_id: data.eventId,
    identifiers: {} // It will be transformed into an array in cleanupData().
  };

  mappedData = addServerEventData(data, eventData, mappedData);
  mappedData = addEcommerceData(data, eventData, mappedData);
  mappedData = addUserData(data, eventData, mappedData, twclid);
  mappedData = overrideDataIfNeeded(data, mappedData);
  mappedData = cleanupData(mappedData);
  mappedData = hashDataIfNeeded(mappedData);

  return mappedData;
}

function overrideDataIfNeeded(data, mappedData) {
  if (data.userDataList) {
    data.userDataList.forEach((d) => {
      mappedData.identifiers[d.name] = d.value;
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
  const ids = mappedData.identifiers;
  const userData = [];

  if (ids.twclid) userData.push({ twclid: ids.twclid });
  if (ids.hashed_email) userData.push({ hashed_email: ids.hashed_email });
  if (ids.hashed_phone_number) userData.push({ hashed_phone_number: ids.hashed_phone_number });

  if (ids.ip_address && ids.user_agent) {
    userData.push({ ip_address: ids.ip_address, user_agent: ids.user_agent });
  } else if ((ids.ip_address || ids.user_agent) && userData.length) {
    if (ids.ip_address) userData[0].ip_address = ids.ip_address;
    if (ids.user_agent) userData[0].user_agent = ids.user_agent;
  }

  mappedData.identifiers = userData;

  if (mappedData.value) {
    mappedData.value = makeNumber(mappedData.value);

    if (mappedData.value.toString().indexOf('.') === -1) {
      mappedData.value = mappedData.value + '.00';
    }
  }

  if (mappedData.contents) {
    for (let contentKey in mappedData.contents) {
      if (mappedData.contents[contentKey].content_price) {
        mappedData.contents[contentKey].content_price = makeNumber(
          mappedData.contents[contentKey].content_price
        );

        if (mappedData.contents[contentKey].content_price.toString().indexOf('.') === -1) {
          mappedData.contents[contentKey].content_price =
            mappedData.contents[contentKey].content_price + '.00';
        }
      }
    }
  }

  return mappedData;
}

function addEcommerceData(data, eventData, mappedData) {
  const autoMapEnabled = data.hasOwnProperty('autoMapServerEventData')
    ? data.autoMapServerEventData
    : true;

  if (autoMapEnabled) {
    let currencyFromItems = '';
    let valueFromItems = 0;
    let numItems = 0;

    let items;
    if (getType(eventData.items) === 'array' && eventData.items.length) items = eventData.items;
    else if (
      getType(eventData.ecommerce) === 'object' &&
      getType(eventData.ecommerce.items) === 'array' &&
      eventData.ecommerce.items.length
    ) {
      items = eventData.ecommerce.items;
    }

    if (items && items[0]) {
      mappedData.custom_data = {};
      mappedData.contents = [];
      mappedData.custom_data.contents = {};
      currencyFromItems = items[0].currency;

      items.forEach((d, i) => {
        let content = {};
        const id = d.id || d.item_id;
        if (id) content.content_id = id;

        const groupId = d.group_id || d.group;
        if (groupId) content.content_group_id = groupId;

        const name = d.name || d.item_name;
        if (name) content.content_name = name;

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

    const value =
      eventData['x-ga-mp1-ev'] || eventData['x-ga-mp1-tr'] || eventData.value || valueFromItems;
    if (value) mappedData.value = value;

    const currency = eventData.currency || currencyFromItems;
    if (currency) mappedData.price_currency = currency;

    const numberItems = eventData.number_items || numItems;
    if (numberItems) mappedData.number_items = makeInteger(numberItems);
  }

  return mappedData;
}

function addUserData(data, eventData, mappedData, twclid) {
  const autoMapEnabled = data.hasOwnProperty('autoMapUserData') ? data.autoMapUserData : true;

  if (autoMapEnabled) {
    if (twclid) mappedData.identifiers.twclid = twclid;

    const hashedEmail =
      eventData.email ||
      (eventData.user_data && eventData.user_data.email_address
        ? eventData.user_data.email_address
        : undefined) ||
      (eventData.user_data && eventData.user_data.email ? eventData.user_data.email : undefined);

    if (hashedEmail) {
      mappedData.identifiers.hashed_email = hashedEmail;
    }

    const hashedPhoneNumber =
      eventData.phone ||
      (eventData.user_data && eventData.user_data.phone_number
        ? eventData.user_data.phone_number
        : undefined) ||
      (eventData.user_data && eventData.user_data.phone ? eventData.user_data.phone : undefined);

    if (hashedPhoneNumber) {
      mappedData.identifiers.hashed_phone_number = hashedPhoneNumber;
    }

    const ip = eventData.ip_override;
    if (ip) mappedData.identifiers.ip_address = ip;

    const userAgent = eventData.user_agent;
    if (userAgent) mappedData.identifiers.user_agent = userAgent;
  }

  return mappedData;
}

function addServerEventData(data, eventData, mappedData) {
  const autoMapEnabled = data.hasOwnProperty('autoMapServerEventData')
    ? data.autoMapServerEventData
    : true;

  if (autoMapEnabled) {
    const transactionId = eventData.transaction_id || eventData.event_id;
    if (transactionId) mappedData.conversion_id = transactionId;

    if (eventData.description) mappedData.description = eventData.description;

    const conversionTime =
      eventData.conversion_time || eventData.conversionTime || eventData.dateISO;
    if (conversionTime) mappedData.conversion_time = conversionTime;
    else mappedData.conversion_timestamp = getTimestampMillis();

    if (eventData.search_string) mappedData.search_string = eventData.search_string;
  }

  return mappedData;
}

/*==============================================================================
HELPERS
==============================================================================*/

function getUrl(eventData) {
  return eventData.page_location || getRequestHeader('referer') || eventData.page_referrer;
}

function shouldExitEarly(data, eventData) {
  if (!isConsentGivenOrNotRequired(data, eventData)) {
    data.gtmOnSuccess();
    return true;
  }

  const url = getUrl(eventData);
  if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
    data.gtmOnSuccess();
    return true;
  }

  return false;
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

function enc(data) {
  if (['null', 'undefined'].indexOf(getType(data)) !== -1) data = '';
  return encodeUriComponent(makeString(data));
}

function isConsentGivenOrNotRequired(data, eventData) {
  if (data.adStorageConsent !== 'required') return true;
  if (eventData.consent_state) return !!eventData.consent_state.ad_storage;
  const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
  return xGaGcs[2] === '1';
}
