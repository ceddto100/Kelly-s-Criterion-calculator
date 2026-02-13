# Play Store Assets

This directory contains source SVG files for generating Google Play Store assets.

## Required Assets

### App Icon (512x512px)
- Source: `app-icon-512.svg`
- Convert to PNG: Use any SVG-to-PNG converter at 512x512px
- Also needed: 1024x1024px version for adaptive icon

### Feature Graphic (1024x500px)
- Source: `feature-graphic-1024x500.svg`
- Convert to PNG at 1024x500px

### Screenshots (minimum 2 required)
- Take screenshots from the running app on an Android emulator
- Phone: 1080x1920 or 1440x2560 (16:9 portrait)
- Tablet (optional): 1200x1920 (7" tablet) or 1600x2560 (10" tablet)
- Recommended screenshots:
  1. Kelly Criterion Calculator (main screen)
  2. Probability Estimator
  3. AI Matchup Analysis
  4. Bet History / Tracking
  5. Team Statistics
  6. Account / Settings

### How to Generate PNG Assets

Using ImageMagick (if installed):
```bash
# App icon
convert -background none app-icon-512.svg -resize 512x512 app-icon-512.png

# Feature graphic
convert -background none feature-graphic-1024x500.svg -resize 1024x500 feature-graphic-1024x500.png
```

Using a browser:
1. Open the SVG in Chrome/Firefox
2. Right-click → "Save image as" or use screenshot
3. Resize to required dimensions

### How to Take Screenshots

```bash
# Run the app on an emulator
cd frontend
npm run build && npx cap sync android
npx cap open android

# In Android Studio, launch on a Pixel 7 emulator
# Use the screenshot button in the emulator toolbar
```

## Asset Checklist

- [ ] App icon 512x512 PNG (high-res)
- [ ] Feature graphic 1024x500 PNG
- [ ] Minimum 2 phone screenshots (16:9)
- [ ] Optional: Tablet screenshots
- [ ] Optional: Promotional video (YouTube link)
