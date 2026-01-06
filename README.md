# Twitter Conversion API Tag for Google Tag Manager Server-Side

The **Twitter Conversion API Tag** for Google Tag Manager Server-Side allows you to send conversion events from your server container directly to Twitter/X servers. This server-to-server integration offers a more robust and secure way to track conversions and user data.

Because of Twitter's requirement for authentication, ⚠️ **this tag only works if your sGTM container is hosted by Stape**. We have a separate module that handles Twitter authentication.

## Features

- **Server-to-Server Events**: Sends conversion data directly from the GTM Server Container to Twitter's Conversion API.
- **Authenticated Requests**: Uses OAuth 1.0a authentication with Consumer Key and OAuth Token.
- **Flexible Data Mapping**: Allows overriding server event data and adding specific user data.
- **Automatic Data Hashing**: Automatically hashes user data like email and phone numbers using SHA-256 if they are not already hashed.
- **Cookie Management**: Supports HttpOnly cookies for security.

## Installation

1.  **Import to GTM Server Container**:
    - In your GTM Server Container, navigate to the **Templates** section.
    - Click **Search Gallery** under the **Tag Templates** section.
    - Search for the [Twitter Conversion API](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/twitter-tag) tag and click **Import**.
2.  **Create a New Tag**:
    - Go to **Tags** and click **New**.
    - Select the newly imported **"Twitter Conversion API"** tag.

## Tag Configuration

### Base Configuration

| Parameter | Description |
| :--- | :--- |
| **Consumer Key** | Set to your Twitter App Consumer API Key. See [here](https://developer.twitter.com/en/docs/twitter-ads-api/measurement/web-conversions/conversion-api) for more information. |
| **Consumer Secret** | Set to your Twitter App Consumer API Secret. |
| **OAuth Token** | Set to your Twitter App Authentication Token. |
| **OAuth Token Secret** | Set to your Twitter App Authentication Token Secret. |
| **Pixel ID** | The Universal Website Tag (UWT) ID for an ad account. This represents that base36 encoded value for an ad account’s UWT id. |
| **Event ID** | The base-36 ID of a specific event. It matches a pre-configured event contained within this ad account. This is called ID in the corresponding Single Event Website Tag in Ads Manager and Ads API. |
| **Use HttpOnly cookies** | Forbids JavaScript from accessing the cookie if enabled. |
| **Use Optimistic Scenario** | The tag will call `gtmOnSuccess()` without waiting for a response from the API. This will speed up sGTM response time however your tag will always return the status fired successfully even in case it is not. |

### Server Event Data Parameters

| Parameter | Description |
| :--- | :--- |
| **Server Event Data Override** | Manually override or add server event data parameters. Available properties: `Conversion Time`, `Number Items`, `Currency`, `Value`, `Conversion ID`, `Description`, `Contents`, `Search String`. |

See [this documentation](https://developer.twitter.com/en/docs/twitter-ads-api/measurement/web-conversions/conversions) for more details on what data parameters you can override.

### User Identifiers Parameters

| Parameter | Description |
| :--- | :--- |
| **User Data** | Manually add user identifiers. Supported types include `Email`, `twclid`, and `Phone`. |

See [this documentation](https://developer.twitter.com/en/docs/twitter-ads-api/measurement/web-conversions/conversions) for more details on what user data parameters you can add to the call. If the documentation requires the parameter to be hashed, you **must** hash it with SHA256, or the tag will do this automatically before sending the event to Twitter.

### Logs Settings

| Parameter | Description |
| :--- | :--- |
| **Log Type** | Controls logging to the GTM console. Options are `Do not log`, `Log to console during debug and preview`, or `Always log to console`. |

## Useful Resources

- [How to Use the Twitter Conversion API Tag for sGTM](https://stape.io/blog/twitter-conversion-api-tag-for-sgtm)


## Open Source

The **Twitter Conversion API Tag** for GTM Server-Side is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.
