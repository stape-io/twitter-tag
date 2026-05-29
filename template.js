const decodeUriComponent = require('decodeUriComponent');
const encodeUriComponent = require('encodeUriComponent');
const getAllEventData = require('getAllEventData');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
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

const eventData = getAllEventData();

if (!isConsentGivenOrNotRequired(data, eventData)) {
  return data.gtmOnSuccess();
}

const twclid = getClickId();
setClickIdCookie(twclid);

const mappedEventData = mapEvent(data, eventData, twclid);
const postBody = {
  pixel_id: data.pixelId,
  auth: {
    consumer_key: data.consumerKey,
    consumer_secret: data.consumerSecret,
    oauth_token: data.oauthToken,
    oauth_token_secret: data.oauthTokenSecret
  },
  conversions: [mappedEventData]
};
const postUrl = generateRequestUrl();
sendHttpRequest(
  postUrl,
  (statusCode, headers, body) => {
    if (!data.useOptimisticScenario) {
      const parsedBody = JSON.parse(body || '{}');
      if (
        statusCode >= 200 &&
        statusCode < 300 &&
        getType(parsedBody.data) === 'object' &&
        parsedBody.data.conversions_processed
      ) {
        data.gtmOnSuccess();
      } else {
        data.gtmOnFailure();
      }
    }
  },
  {
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + data.accessToken
    },
    method: 'POST'
  },
  JSON.stringify(postBody)
);

if (data.useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function getClickId() {
  let twclid = getCookieValues('twclid')[0] || eventData.twclid;

  const url = eventData.page_location || getRequestHeader('referer');
  if (url) {
    const urlParsed = parseUrl(url);
    if (urlParsed && urlParsed.searchParams.twclid) {
      twclid = decodeUriComponent(urlParsed.searchParams.twclid);
    }
  }

  return twclid;
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

function generateRequestUrl() {
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

function mapEvent(data, eventData, twclid) {
  let mappedData = {
    event_id: data.eventId,
    identifiers: []
  };

  mappedData = addServerEventData(data, eventData, mappedData);
  mappedData = addEcommerceData(data, eventData, mappedData);
  mappedData = addUserData(data, eventData, mappedData, twclid);
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
          hashed_email: mappedData.identifiers[userDataKey]['hashed_email']
        });
      }

      if (mappedData.identifiers[userDataKey]['hashed_phone_number']) {
        userData.push({
          hashed_phone_number: mappedData.identifiers[userDataKey]['hashed_phone_number']
        });
      }

      if (mappedData.identifiers[userDataKey]['twclid']) {
        userData.push({
          twclid: mappedData.identifiers[userDataKey]['twclid']
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
    if (twclid) mappedData.identifiers.push({ twclid: twclid });

    const hashedEmail =
      eventData.email ||
      (eventData.user_data && eventData.user_data.email_address
        ? eventData.user_data.email_address
        : undefined) ||
      (eventData.user_data && eventData.user_data.email ? eventData.user_data.email : undefined);

    if (hashedEmail) {
      mappedData.identifiers.push({ hashed_email: hashedEmail });
    }

    const hashedPhoneNumber =
      eventData.phone ||
      (eventData.user_data && eventData.user_data.phone_number
        ? eventData.user_data.phone_number
        : undefined) ||
      (eventData.user_data && eventData.user_data.phone ? eventData.user_data.phone : undefined);

    if (hashedPhoneNumber) {
      mappedData.identifiers.push({ hashed_phone_number: hashedPhoneNumber });
    }
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

    if (eventData.search_string) mappedData.search_string = eventData.search_string;
  }

  return mappedData;
}

/*==============================================================================
  Helpers
==============================================================================*/

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
