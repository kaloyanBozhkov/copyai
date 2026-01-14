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
│   │       ├── CommandGrimoire.tsx
│   │       ├── CategorySidebar.tsx
│   │       ├── CommandDetail.tsx
│   │       ├── CreateTemplateModal.tsx
│   │       ├── GrimoireHeader.tsx
│   │       └── types.ts
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

**Structure:**
- `GrimoireHeader` - Title bar, search, filters, create button
- `CategorySidebar` - Category tree with command list
- `CommandDetail` - Selected command info and test area
- `CreateTemplateModal` - Wizard for creating custom templates

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
| `grimoire-init` | Main → Renderer | Send initial command data |
| `grimoire-get-commands` | Renderer → Main | Request command list |
| `grimoire-add-template` | Renderer → Main | Create custom template |
| `grimoire-remove-template` | Renderer → Main | Delete custom template |
| `grimoire-update-template` | Renderer → Main | Modify custom template |
| `grimoire-execute-template` | Renderer → Main | Test template with args |
| `grimoire-template-result` | Main → Renderer | Template execution result |
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

Templates support three placeholder formats:
- `$0`, `$1` - Numbered (no braces)
- `${0}`, `${1}` - Numbered (with braces)
- `${name}`, `${param}` - Named placeholders

The modal provides:
- Live placeholder detection
- Preview with test values
- Validation before creation

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

