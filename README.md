# DocuSnap Chrome Extension

## Install in Chrome (Developer Mode)

1. Unzip this folder somewhere on your computer
2. Open Chrome and go to: `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `docusnap-extension` folder
6. The DocuSnap icon appears in your Chrome toolbar

## How to Use

1. Click the DocuSnap icon in your toolbar
2. The side panel opens — choose your documentation type
3. Select **Auto** or **Manual** capture mode
4. Click **Start Recording**
5. Chrome asks permission to inject the recorder — allow it
6. Work normally in the browser tab — every click on a button or link is auto-captured (Auto mode)
7. A small "DocuSnap Recording" badge appears at the bottom-right of the page
8. Steps appear in the side panel in real time with AI descriptions
9. Click **Stop** when done → edit descriptions, annotate screenshots, add code blocks
10. Click **Export** to download an HTML or Markdown guide

## Notes

- Works on any HTTP/HTTPS page
- Does NOT work on chrome:// pages or the Chrome Web Store (browser restriction)
- Requires internet access for AI descriptions (calls Anthropic API)
