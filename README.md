# DocSnap  
### Chrome Extension for Technical Documentation Workflows

Capture. Structure. Export.  
Built for engineers and documentation writers who need accurate, repeatable steps without manual overhead.

---

## Installation (Chrome Developer Mode)

Set up the extension locally in under a minute:

1. Extract the project folder to your system  
2. Open Chrome and navigate to `chrome://extensions`  
3. Enable **Developer Mode** (top right toggle)  
4. Select **Load unpacked**  
5. Choose the `docusnap-extension` directory  
6. Confirm the DocSnap icon appears in the toolbar  

---

## Usage Workflow

### Launch

- Click the DocSnap icon  
- The side panel loads with configuration options  

---

### Configure Capture

- Select documentation type  
- Choose capture mode:
  - **Auto** → captures interactions automatically  
  - **Manual** → controlled step capture  

---

### Record

1. Click **Start Recording**  
2. Grant permission when Chrome prompts  
3. Continue working in the browser  

**System Behaviour:**
- Interactions with buttons and links are captured  
- A recording badge appears at the bottom right  
- Steps populate in real time inside the panel  
- AI generates contextual descriptions per step  

---

### Review and Edit

- Stop recording when complete  
- Refine descriptions  
- Annotate screenshots  
- Insert code blocks where required  

---

### Export

- Export documentation as:
  - HTML  
  - Markdown  

---

## Operational Constraints

- Supports all standard HTTP and HTTPS pages  
- Restricted on:
  - `chrome://` URLs  
  - Chrome Web Store pages  

---

## Dependencies

- Internet connection required for AI-generated descriptions  
- Uses external API integration (Anthropic) for step interpretation  

---

## Positioning

DocSnap reduces documentation friction by converting real user actions into structured, editable output.  
No reconstruction. No missed steps. No manual rewriting.
