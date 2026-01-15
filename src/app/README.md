# CopyAI Frontend Application

This directory contains the React-based UI for CopyAI, an Electron desktop application for quick command execution and text generation.

## Overview

The app provides two main interfaces:
1. **Command Input** - A minimal overlay for quick command entry
2. **Command Grimoire** - A full-featured command browser and template manager

Both interfaces communicate with the Electron main process via IPC (Inter-Process Communication).

---

## Architecture

```
src/app/
├── src/
│   ├── App.tsx                 # Main app component with route switching
│   ├── index.tsx               # React entry point
│   ├── index.html              # HTML template
│   │
│   ├── components/
│   │   ├── CommandInput.tsx    # Quick command entry overlay
│   │   ├── Thinking.tsx        # Loading/processing indicator
│   │   └── grimoire/           # Command browser components
│   │       ├── CommandGrimoire.tsx          # Main grimoire container
│   │       ├── CategorySidebar.tsx          # Command category tree
│   │       ├── CommandDetail.tsx            # Command info & test area
│   │       ├── CreateTemplateModal.tsx      # Template creation wizard
│   │       ├── GrimoireHeader.tsx           # Header with search & filters
│   │       ├── SettingsPanel.tsx            # API keys settings
│   │       ├── BookModal.tsx                # Static field dictionary
│   │       ├── BookFieldsModal.tsx          # Book field picker
│   │       ├── AlchemyModal.tsx             # Dynamic API potions manager
│   │       ├── AlchemyFieldsModal.tsx       # Alchemy potion picker
│   │       └── types.ts                     # Shared type definitions
│   │
│   ├── hooks/
│   │   ├── useInit.ts              # App initialization
│   │   ├── useElectronListener.ts  # IPC event listeners
│   │   └── useElectronAction.ts    # IPC action dispatchers
│   │
│   ├── store/
│   │   ├── useAppStore.ts      # Command input state
│   │   └── useRouteStore.ts    # Route/view state
│   │
│   ├── styles/
│   │   ├── main.css            # Global styles
│   │   └── grimoire.css        # Grimoire-specific styles
│   │
│   └── utils/
│       └── electron.ts         # Electron IPC utilities
│
├── webpack.config.js           # Build configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies
```

---

## Routes / Views

The app uses a simple route store to switch between views:

```typescript
type Route = "command-input" | "processing-command" | "grimoire";
```

| Route | Component | Purpose |
|-------|-----------|---------|
| `command-input` | `CommandInput` | Quick command entry with autocomplete |
| `processing-command` | `Thinking` | Loading indicator during command execution |
| `grimoire` | `CommandGrimoire` | Full command browser and template manager |

Route is determined by:
1. URL query parameter (`?route=grimoire`)
2. Route store state (set via IPC events)

---

## Component Details

### CommandInput

A minimal, overlay-style text input for entering commands quickly.

**Features:**
- Autocomplete suggestions from main process
- Tab completion for command names
- Enter to execute, Escape to cancel
- Multi-line support (expands for pasted content)
- Shows argument hints in orange below command name

**Key IPC Events:**
| Event | Direction | Purpose |
|-------|-----------|---------|
| `autocomplete-request` | Renderer → Main | Request autocomplete for input |
| `autocomplete-result` | Main → Renderer | Receive autocomplete suggestion |
| `input-value` | Renderer → Main | Submit command or cancel |

**State (via `useAppStore`):**
- `searchValue` - Current input text
- `autocompleteValue` - Suggested command name
- `argsValue` - Full suggestion with args hint

### Thinking

A simple animated loading indicator shown during command processing.

### CommandGrimoire

A full-screen command browser styled like a WoW quest log.

**Features:**
- Browse all commands organized by category
- Separate sections for Executables ("Spells") and Templates ("Scrolls")
- View command details, parameters, and documentation
- Test templates with live preview
- Create, edit, and delete custom templates
- **The Book** - Manage static field dictionary for templates
- **Alchemy Lab** - Configure dynamic API-fetched values

**Structure:**
- `GrimoireHeader` - Title bar, search, filters, create button, Book/Alchemy/Settings buttons
- `CategorySidebar` - Category tree with command list
- `CommandDetail` - Selected command info and test area
- `CreateTemplateModal` - Wizard for creating custom templates with autocomplete for book/alchemy fields
- `SettingsPanel` - API keys configuration
- `BookModal` - Manage The Book (static dictionary fields)
- `AlchemyModal` - Manage Alchemy potions (dynamic API values)

**The Book (Static Values):**
- Define reusable static values like name, email, company, signature
- Reference in templates as `${book.fieldname}`
- Autocomplete support in template editor
- No API calls - instant substitution

**Alchemy Lab (Dynamic Values):**
- Configure HTTP requests (GET/POST) as "potions"
- Reference in templates as `${alchemy.potionname}`
- Autocomplete support in template editor
- Executes API calls when template is used
- All potions execute in parallel
- Last fetched value cached and displayed

---

## State Management

### useRouteStore

Manages the current view/route:

```typescript
interface RouteState {
  route: Route;
  setRoute: (route: Route) => void;
}
```

### useAppStore

Manages command input state:

```typescript
interface AppState {
  searchValue: string;        // Current input
  autocompleteValue: string;  // Autocomplete suggestion
  argsValue: string;          // Full hint with args
  isDevMode: boolean;         // Dev mode indicator
  tabsCount: number;          // Tab press counter
  // ... setters
}
```

---

## IPC Communication

### Renderer → Main (Actions)

```typescript
// From useElectronActions hook
mouseEnter()           // Notify hover for window click-through
mouseLeave()           // Notify leave for window click-through
autocompleteRequest()  // Request autocomplete for input
inputValue(value)      // Submit command or cancel (null)
```

### Main → Renderer (Events)

```typescript
// Listened via useElectronListener hook
"autocomplete-result"  // Autocomplete suggestion
"init"                 // Initialize with config
"grimoire-init"        // Initialize grimoire with command data
"grimoire-commands-data"  // Updated command data
```

### Grimoire-Specific IPC

| Event | Direction | Purpose |
|-------|-----------|---------|
| `grimoire-mounted` | Renderer → Main | Signal grimoire is ready |
| `grimoire-init` | Main → Renderer | Send initial command data & settings |
| `grimoire-commands-data` | Main → Renderer | Updated command list |
| `grimoire-settings-data` | Main → Renderer | Updated settings (API keys, book, alchemy) |
| `grimoire-get-commands` | Renderer → Main | Request command list |
| `grimoire-add-template` | Renderer → Main | Create custom template |
| `grimoire-remove-template` | Renderer → Main | Delete custom template |
| `grimoire-update-template` | Renderer → Main | Modify custom template |
| `grimoire-execute-template` | Renderer → Main | Test template with args (awaits alchemy) |
| `grimoire-template-result` | Main → Renderer | Template execution result |
| `grimoire-set-api-key` | Renderer → Main | Save API key |
| `grimoire-set-book-field` | Renderer → Main | Add/update book field |
| `grimoire-remove-book-field` | Renderer → Main | Delete book field |
| `grimoire-add-potion` | Renderer → Main | Create alchemy potion |
| `grimoire-update-potion` | Renderer → Main | Modify alchemy potion |
| `grimoire-remove-potion` | Renderer → Main | Delete alchemy potion |
| `grimoire-execute-potion` | Renderer → Main | Test potion (execute API call) |
| `grimoire-potion-result` | Main → Renderer | Potion execution result |
| `grimoire-close` | Renderer → Main | Close grimoire window |
| `grimoire-minimize` | Renderer → Main | Minimize grimoire window |

---

## Styling

### Design Philosophy

- **Command Input**: Minimal, unobtrusive overlay that doesn't block underlying content
  - Uses `pointer-events: none` on body to allow click-through
  - Only the input itself receives pointer events

- **Grimoire**: Full WoW quest log aesthetic
  - Dark fantasy theme with parchment textures
  - Custom scrollbars, decorative borders
  - Categorized as "Spells" (execs) and "Scrolls" (templates)

### Key CSS Classes

```css
/* Command Input */
.pointer-events-none  /* Click-through container */
.pointer-events-auto  /* Interactive elements */

/* Grimoire */
.grimoire-container   /* Main wrapper with pointer-events: auto */
.grimoire-sidebar     /* Left category panel */
.grimoire-detail      /* Right detail panel */
.grimoire-modal       /* Create template wizard */
```

---

## Building

```bash
# Install dependencies
cd src/app
npm install

# Development build
npm run dev

# Production build
npm run build
```

Output goes to `src/app/dist/` which is loaded by Electron.

---

## Data Flow

### Command Input Flow

```
User types → handleInput()
     ↓
autocompleteRequest() → IPC → Main Process
     ↓
Main Process resolves autocomplete
     ↓
IPC → autocomplete-result → useElectronListener
     ↓
Update autocompleteValue, argsValue
     ↓
User presses Enter → inputValue() → IPC → Main Process
     ↓
Main Process executes command (cmdKitchen)
```

### Grimoire Data Flow

```
Window opens → ?route=grimoire detected
     ↓
grimoire-mounted → IPC → Main Process
     ↓
Main Process builds command data (getCommandsData)
     ↓
IPC → grimoire-init → CommandGrimoire
     ↓
User selects command → Local state update
     ↓
(For templates) User fills args → grimoire-execute-template
     ↓
Main Process renders template → grimoire-template-result
     ↓
Display result, allow copy
```

---

## Custom Template Creation

The `CreateTemplateModal` provides a 3-step wizard:

1. **Name** - Enter a snake_case command name
2. **Category** - Select existing or create new category
3. **Content** - Write template lines with placeholders

### Placeholder Support

Templates support five placeholder formats:
- `$0`, `$1` - Numbered (no braces)
- `${0}`, `${1}` - Numbered (with braces)
- `${name}`, `${param}` - Named placeholders
- `${book.field}` - Static values from The Book
- `${alchemy.potion}` - Dynamic values from Alchemy Lab

### Smart Autocomplete

As you type, the editor provides intelligent autocomplete:

1. **Type `${book.`** → Shows all book fields with their values
2. **Type `${alchemy.`** → Shows all alchemy potions with their URLs
3. **Arrow keys** to navigate suggestions
4. **Enter** to insert the selected field

### Quick Insert Buttons

- **Add From Book** - Browse and insert book fields via modal
- **Add From Potion** - Browse and insert alchemy potions via modal

Both buttons split 50/50 below the "Add Line" button.

The modal provides:
- Live placeholder detection (numbered, named, book, alchemy)
- Shows which book fields and potions are used
- Preview with test values (alchemy values fetched on test)
- Validation before creation

---

## Grimoire Settings Management

Settings are persisted in `~/.copyai-grimoire-settings.json` and include:

### API Keys (`SettingsPanel`)
- OpenAI API Key
- OpenRouter API Key
- Secure input fields with show/hide toggle
- Instant save on button click

### The Book (`BookModal`)
- Key-value dictionary of static fields
- Search/filter functionality
- Add/edit/delete fields
- Shows `${book.field}` syntax for each entry
- Used in templates for personal info, signatures, etc.

### Alchemy Lab (`AlchemyModal`)
Each potion configuration includes:
- **Name**: Snake_case identifier (e.g., `weather`, `stock_btc`)
- **Method**: GET or POST
- **URL**: API endpoint
- **Headers**: JSON object (e.g., `{"Authorization": "Bearer ..."}`)
- **Body**: JSON string for POST requests (optional)
- **Last Value**: Cached result from last execution
- **Last Fetched**: Timestamp of last execution

**Features:**
- Create/edit/delete potions
- Test potion execution (calls API and caches result)
- Visual feedback during API calls
- Search/filter potions
- Shows `${alchemy.potion}` syntax for each entry

**Storage Format:**
```json
{
  "apiKeys": {
    "OPENAI_API_KEY": "sk-...",
    "OPENROUTER_API_KEY": "sk-or-..."
  },
  "book": {
    "name": "John Doe",
    "email": "john@example.com",
    "company": "Acme Corp"
  },
  "alchemy": [
    {
      "id": "potion_1234567890",
      "name": "weather",
      "method": "GET",
      "url": "https://api.weather.com/current",
      "headers": {"Authorization": "Bearer token"},
      "lastValue": "Sunny, 72°F",
      "lastFetched": 1234567890000
    }
  ]
}
```

---

## Technology Stack

| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Zustand | State management |
| Tailwind CSS | Utility styling |
| Webpack | Bundling |
| Electron IPC | Main process communication |
| Lucide React | Icons |

