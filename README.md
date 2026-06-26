# X (Twitter) Conversion API Tag for Google Tag Manager Server-Side

The **X (Twitter) Conversion API Tag** for Google Tag Manager Server-Side allows you to send conversion events from your server container directly to X (Twitter) servers. This server-to-server integration offers a more robust and secure way to track conversions and user data.

## Features

- **Server-to-Server Events**: Sends conversion data directly from the GTM Server Container to X (Twitter)'s Conversion API.
- **Access Token Authentication**: Simple, recommended authentication using a single Access Token generated from your X Ads Manager.
- **OAuth Authentication**: Legacy OAuth 1.0a authentication is still supported but will be removed in December 2026. Migrate to Access Token.
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
| **Authentication Method** | Choose between **Access Token** (recommended) or **OAuth** (legacy, removed December 2026). |
| **Access Token** | *(Access Token method)* The token generated from your X Ads Manager. Go to Events Manager → Install Pixel → Manual → Conversions API → Generate access token. |
| **Pixel ID** | The Pixel ID for your ad account. |
| **Event ID** | The ID of a specific event. It matches a pre-configured event contained within this ad account. |
| **Consumer Key** | *(OAuth method)* Your Twitter App Consumer API Key. |
| **Consumer Secret** | *(OAuth method)* Your Twitter App Consumer API Secret. |
| **OAuth Token** | *(OAuth method)* Your Twitter App Authentication Token. |
| **OAuth Token Secret** | *(OAuth method)* Your Twitter App Authentication Token Secret. |
| **Use HttpOnly cookies** | Forbids JavaScript from accessing the cookie if enabled. |
| **Use Optimistic Scenario** | The tag will call `gtmOnSuccess()` without waiting for a response from the API. This will speed up sGTM response time however your tag will always return the status fired successfully even in case it is not. |

> ⚠️ **OAuth authentication will be removed in December 2026.** If you are currently using OAuth, migrate to the Access Token method.

### Server Event Data Parameters

| Parameter | Description |
| :--- | :--- |
| **Server Event Data Override** | Manually override or add server event data parameters. Available properties: `Conversion Time`, `Number Items`, `Currency`, `Value`, `Conversion ID`, `Description`, `Contents`, `Search String`. |

See [this documentation](https://docs.x.com/x-ads-api/measurement/web-conversions) for more details on what data parameters you can override.

### User Identifiers Parameters

| Parameter | Description |
| :--- | :--- |
| **User Data** | Manually add user identifiers. Supported types: `Email`, `Phone`, `Click ID (twclid)`, `IP Address`, and `User Agent`. |

**Important pairing rules for IP Address and User Agent:**
- At least one identifier must always be sent.
- **IP Address** must be paired with Email, Phone, Click ID (twclid), or User Agent.
- **User Agent** must be paired with Email, Phone, Click ID (twclid), or IP Address.
- If neither a valid companion is present, IP Address and User Agent will be silently dropped from the request.

See [this documentation](https://docs.x.com/x-ads-api/measurement/web-conversions) for more details on what user data parameters you can add to the call. If the documentation requires the parameter to be hashed, you **must** hash it with SHA256, or the tag will do this automatically before sending the event to Twitter.

## Useful Resources

- [How to Use the X (Twitter) Conversion API Tag for sGTM](https://stape.io/blog/twitter-conversion-api-tag-for-sgtm)

## Open Source

The **X (Twitter) Conversion API Tag** for GTM Server-Side is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.

### GTM Gallery Status
🟢 [Listed](https://tagmanager.google.com/gallery/#/owners/stape-io/templates/twitter-tag)
