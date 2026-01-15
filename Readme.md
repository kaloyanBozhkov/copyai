### About

In Ko Phagnan right now, it's 5.16AM and I just wrapped up a 4h code sesh.
Smoked a nice THC pre-rolled joint with 50% weed and 50% leaf - first time!

Got inspired to create this shortcut tool while working on RAG & AI System Messages for a another personal project. Objective was to be able to copy from a list of templates, then expanded into also running code by shortcut command.

### GUI

![alt text](https://github.com/kaloyanBozhkov/copyai/blob/master/example.png?raw=true)

### Instructions

Set this project to run on boot, with npm start. postinstall should set this up for you on mac.

Then simply:
CMD+D opens a 1 liner that enables you to run commands that copy a template to clipboard.

In dev:
CMD+D+Shift

### Use Cases

**Quick text generation:**
- Hit CMD+D, type `email.signature`, get your full signature instantly
- Use `${book.name}` and `${book.company}` for personalized templates

**Dynamic content:**
- Create a daily standup template with `${alchemy.weather}` and `${alchemy.date}`
- Fetch live data from APIs directly in your templates

**Code snippets:**
- Predefined templates for comments, functions, classes
- Custom templates for your own coding patterns

**System automation:**
- Control smart home devices (lights, TV, etc.)
- Run node commands (UUID generation, etc.)

**AI prompts:**
- Store and quickly access AI system messages
- Combine static info with dynamic API data

### Features

- **Quick Command Input** (CMD+D): Search with autocomplete, tab completion, instant execution
- **Command Grimoire** (GUI): Full command browser with WoW quest log aesthetic
  - Browse all "Spells" (executables) and "Scrolls" (templates)
  - Create/edit/delete custom templates with visual editor
  - Test templates with live preview
- **The Book**: Static dictionary for personal info (name, email, signature, etc.)
  - Reference as `${book.field}` in templates
- **Alchemy Lab**: Dynamic API-fetched values in templates
  - Configure HTTP requests as "potions" (GET/POST, headers, body)
  - Reference as `${alchemy.potion}` in templates
  - Templates await all API calls before execution
- **Smart Autocomplete**: As you type `${book.` or `${alchemy.`, get instant suggestions
- **Categories**: Organize commands by category/subcategory (e.g., `home.living-room.lights_on`)
- **Custom Templates**: User-created templates stored in `~/.copyai-custom-templates.json`
- **Settings**: API keys (OpenAI, OpenRouter) stored securely in `~/.copyai-grimoire-settings.json`

### why npm and not pnpm for electron app?
... https://github.com/electron/forge/pull/3209


### Prod logs?
~/copyai/debug.log