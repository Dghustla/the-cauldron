---
name: larry-2
description: Larry's TikTok and Instagram slideshow marketing automation. Use for the full pipeline - competitor research, AI image generation, text overlays, multi-platform posting via Upload-Post, analytics tracking, and data-driven iteration.
---

## Overview

Automates the entire pipeline: research competitors, generate images with AI, add text overlays, post simultaneously across platforms, track analytics, and iterate based on performance data. Designed for data-driven optimization rather than vanity metrics.

## Prerequisites

**Required:**
- Node.js v18+
- node-canvas (native module for text overlays)
- Upload-Post account (multi-platform posting + analytics backbone)

**Image generation** (choose one):
- OpenAI (gpt-image-1.5 recommended for photorealistic results)
- Stability AI
- Replicate
- Local images (no API needed)

**Optional:**
- RevenueCat (conversion tracking for mobile apps)

## Onboarding Flow

### Phase 0: Account Warmup
New TikTok accounts must spend 7-14 days warming up before posting AI content. Natural scrolling, selective liking, following niche accounts, watching engaged content. Fresh accounts skipping this see 80-90% lower reach.

### Phase 1: App Discovery
Conversational onboarding to understand the app: what it does, target audience, pain point solved, differentiators, App Store link, monetization model (especially RevenueCat for subscriptions).

### Phase 2: Competitor Research
Browser-based research into 3-5 competitor TikTok accounts. Analyze hooks, formats, view counts, posting frequency, and CTAs. Document gaps and opportunities.

### Phase 3: Content Format & Image Generation
Slideshows over video (2.9x more comments, 2.6x more shares per TikTok's data). Build detailed base prompts locked for consistency across all 6 slides.

**Critical:** Use OpenAI's gpt-image-1.5, never gpt-image-1. Quality difference is substantial.

### Phase 4: Upload-Post Setup
Sign up, connect TikTok and Instagram, create API key. Powers simultaneous posting to 10+ platforms and provides analytics data for the feedback loop.

### Phase 5: RevenueCat Integration
If the app uses subscriptions, connect RevenueCat V2 secret API key. Closes the intelligence loop by connecting platform impressions to actual paid conversions.

### Phase 6: Content Strategy
Define 3-5 initial hooks based on competitor research and app category. Set posting schedule (recommended: 7:30 AM, 4:30 PM, 9 PM). Document in strategy.json.

### Phase 7: Daily Analytics Cron
Schedule automated daily reports that pull Upload-Post analytics (impressions, reach, upload status) and RevenueCat conversions, then apply diagnostic framework to recommend next steps.

### Phase 8: Config & First Post
Save all settings to config.json. Generate test slideshow to refine image prompts. Iterate 2-5 rounds until images look professional and locked in.

## Core Workflow

### 1. Generate Slideshow Images
```
node scripts/generate-slides.js --config tiktok-marketing/config.json \
  --output tiktok-marketing/posts/YYYY-MM-DD-HHmm/ --prompts prompts.json
```

Generates 6 portrait images (1024x1536). Requires 3-9 minutes total (exec timeout minimum 600 seconds). All slides must share locked architectural/layout details for consistency.

### 2. Add Text Overlays
Uses node-canvas to render text with white fill and black outline. Dynamic font sizing based on text length (75px for short, 51px for long text). Text centered at 28% from top. Maximum 4-6 words per line, 3-4 lines ideal.

**Text rules:**
- Manual `\n` line breaks for control
- Reactions, not labels ("Wait this is nice??" vs "Modern style")
- No emoji (canvas limitation)
- Stay in safe zones (top 10%, bottom 20%)

### 3. Post to TikTok + Instagram
```
node scripts/post-to-platforms.js --config tiktok-marketing/config.json \
  --dir tiktok-marketing/posts/YYYY-MM-DD-HHmm/ --caption "caption" --title "title"
```

Upload-Post handles simultaneous posting via single API call. Returns request_id for tracking. **Post TikTok slideshows as drafts and add trending music afterward** — audio is critical for reach.

### 4. Track Analytics
```
node scripts/check-analytics.js --config tiktok-marketing/config.json --days 3
```

Pulls platform analytics (followers, impressions, reach) and upload history with per-post status. Upload-Post tracks by request_id automatically.

## The Feedback Loop (Core Intelligence)

Daily cron analyzes:
1. **Upload-Post data** — impressions, reach, upload success per platform
2. **RevenueCat data** — trial starts, paid subscriptions (24-72h attribution window)

### Diagnostic Framework

| Views | Conversions | Action |
|-------|-------------|--------|
| High  | High        | Scale it. Make 3 hook variations. Don't change CTA. |
| High  | Low         | Fix the CTA. Hook works, downstream path broken. Test different CTAs on final slide. |
| Low   | High        | Fix the hooks. Content converts but doesn't stop scrolls. Test different hook types, keep CTA identical. |
| Low   | Low         | Full reset. Try different format, audience angle, or hook categories entirely. |

## Hook & CTA Tracking

Track all hooks with request_id, date, platforms, conversions, and CTA used. Rotate CTAs when conversions lag:
- "Download [App] — link in bio"
- "[App] is free to try — link in bio"
- "I used [App] for this — link in bio"
- "Search [App] on the App Store"

## Cross-Posting

Upload-Post simultaneously posts to 10+ platforms. Recommended secondary:
- Instagram (beauty/lifestyle/home)
- YouTube Shorts (long-tail discovery)
- Threads (engagement)
- LinkedIn (B2B/professional)
- Pinterest (visual/home/design)

Same content, different algorithms, more reach.

## Posting Schedule

Optimal timing (adjust for timezone):
- 7:30 AM (early scrollers)
- 4:30 PM (afternoon break)
- 9:00 PM (evening wind-down)

Minimum 3x/day. Consistency matters more than sporadic virality.

## Common Mistakes

- Wrong aspect ratio (1536x1024 instead of 1024x1536)
- Text too small (use 6.5% of width, not 5%)
- Text positioned wrong (28-30% from top, not bottom)
- Inconsistent architecture across slides
- Labels instead of reactions in text
- Optimizing for views without tracking conversions
- Not rotating CTAs when performance drops
- Skipping cross-posting
- Image generation timeout (set 10-minute minimum)

## Configuration Structure

All settings stored in `tiktok-marketing/config.json`:
- App details (name, description, audience, category, App Store URL)
- Image generation (provider, API key, model)
- Upload-Post (API key, profile name, platforms)
- RevenueCat (if enabled, V2 secret key, project ID)
- Posting schedule (times and cross-post platforms)
- References to strategy and competitor research files

## Proven Results

7M+ views on viral content, 1M+ TikTok views, $670/month MRR from automated posting and optimization.
