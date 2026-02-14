# Instagram API Guide — Practical Setup

> **TODO:** Remove this file once the Instagram posting flow is fully integrated and working end-to-end.

## What You Need

1. **Instagram Professional Account** — Switch your IG account to Business or Creator (free, in app settings)
2. **Facebook Page** — Create one and link it to the IG account (Settings → Linked Accounts)
3. **Meta Developer Account** — Sign up at [developers.facebook.com](https://developers.facebook.com)

## Meta App Setup

1. Go to **My Apps → Create App** on developers.facebook.com
2. Choose **Business** type
3. Add the **Instagram Graph API** product
4. Under **App Review → Permissions**, request:
   - `instagram_basic` — read account info
   - `instagram_content_publish` — post content
   - `pages_read_engagement` — access linked page

## Token Management

- Generate a **short-lived token** from the Graph API Explorer (valid ~1 hour)
- Exchange it for a **long-lived token** (valid ~60 days):
  ```
  GET https://graph.facebook.com/v21.0/oauth/access_token
    ?grant_type=fb_exchange_token
    &client_id={app-id}
    &client_secret={app-secret}
    &fb_exchange_token={short-lived-token}
  ```
- Store the long-lived token securely (env variable)
- Set up a refresh cron before it expires (every ~50 days)

## Publishing Flow

### Single Image Post

```
# Step 1: Create media container
POST https://graph.facebook.com/v21.0/{ig-user-id}/media
  ?image_url={public-image-url}
  &caption={caption-text}
  &access_token={token}

# Step 2: Publish
POST https://graph.facebook.com/v21.0/{ig-user-id}/media_publish
  ?creation_id={container-id-from-step-1}
  &access_token={token}
```

### Carousel

```
# Step 1: Create item containers (one per image, no caption here)
POST .../media?image_url={url1}&is_carousel_item=true
POST .../media?image_url={url2}&is_carousel_item=true

# Step 2: Create carousel container
POST .../media
  ?media_type=CAROUSEL
  &children={id1},{id2}
  &caption={caption}

# Step 3: Publish
POST .../media_publish?creation_id={carousel-container-id}
```

### Stories

```
POST .../media
  ?image_url={url}
  &media_type=STORIES

POST .../media_publish?creation_id={container-id}
```

## Rate Limits

- **Content Publishing**: 25 posts per 24-hour period per account
- **API calls**: 200 calls per user per hour (general)
- Carousel counts as 1 post (not per-image)

## What to Build in Post Manager

1. **Env variables**: `INSTAGRAM_USER_ID`, `INSTAGRAM_ACCESS_TOKEN`
2. **API route** `/api/publish` that takes a post ID, reads the post data, and:
   - Uploads selected images (they're already public fal.ai URLs)
   - Creates container(s) based on post type
   - Publishes
   - Updates post status to "posted"
3. **Token refresh** endpoint or cron job
4. **Error handling**: IG API returns clear error codes — surface them in the UI
