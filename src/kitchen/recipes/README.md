# Command Recipes Architecture

This directory contains the command definitions for CopyAI. Commands are divided into two main types: **Executables (Execs)** and **Templates**.

## Core Concept: CommandExecutor

All commands share a common type signature defined in `../commandExecutor.ts`:

```typescript
type Args = string[];
type CommandExecutor = [
  (builderArgs?: Args) => string | void | null | Promise<string | void | null>,
  ...Args  // Argument definitions for autocomplete
];
```

A `CommandExecutor` is a tuple where:
- **First element**: The execution function that receives arguments and returns a result
- **Remaining elements**: Argument definition strings shown in autocomplete (e.g., `"$0: string"`, `"brightness: number"`)

---

## Executables (`execs.ts`)

Executables are commands that **perform actions** - they interact with external services, APIs, or the system.

### Characteristics

| Feature | Description |
|---------|-------------|
| **Purpose** | Execute code, call APIs, control devices |
| **Return Value** | Can return `string` (copied to clipboard), `void` (no output), `null` (failure), or `Promise` |
| **Side Effects** | Yes - network calls, device control, file operations |
| **Examples** | Turn on lights, control TV, send AI requests |

### Structure

Commands are organized in a nested category structure:

```typescript
export const execsPerCategory = {
  category: {
    command: [executorFn, "arg1: type", "arg2: type"],
    
    subcategory: {
      subcommand: [executorFn, "arg: type"],
    },
  },
};
```

### Example: Simple Command

```typescript
uuid: [() => uuidv4()],  // No args, returns a UUID string
```

### Example: Command with Arguments

```typescript
translate: [
  async (args?: string[]) => {
    const [targetLang, text] = args || [];
    if (!targetLang || !text) return null;
    return await getLLMResponse(/* ... */);
  },
  "targetLang: string",
  "text: string",
],
```

### Example: Nested Commands (2-level hierarchy)

```typescript
home: {
  // Direct commands under 'home'
  lights_off: [async () => setAllLightsState(false)],
  
  // Subcategory 'living-room' under 'home'
  "living-room": {
    on: [async () => setRoomLightsState("living room", true)],
    off: [async () => setRoomLightsState("living room", false)],
    to: [
      async (args?: string[]) => { /* brightness/color logic */ },
      "brightness?: number (0-100), color?: string",
    ],
  },
  
  // Subcategory 'tv' under 'home'
  tv: {
    on: [async () => turnOnTV()],
    off: [async () => turnOffTV()],
    volume: [async (args) => setTVVolume(parseInt(args?.[0] || "10")), "level: number"],
  },
},
```

This creates commands accessible as:
- `home.lights_off`
- `home.living-room.on`
- `home.tv.volume`

### Return Value Handling

| Return Type | Behavior |
|-------------|----------|
| `string` | Text is copied to clipboard |
| `void` | Command completes silently |
| `null` | Signals failure, shows error state |
| `Promise<...>` | Async execution, same rules apply to resolved value |

---

## Templates (`templateCommands.ts`)

Templates are commands that **generate text** with placeholder substitution. They don't execute code - they just compose strings.

### Characteristics

| Feature | Description |
|---------|-------------|
| **Purpose** | Generate text snippets, code templates, prompts |
| **Return Value** | Always returns a string |
| **Side Effects** | None - pure text generation |
| **Placeholders** | Support `$0`, `${0}`, and `${named}` syntax |

### Structure

Templates are defined as arrays of strings (recipe lines):

```typescript
export const templateRecipes = {
  category: {
    template_name: [
      "line 1 with $0 placeholder",
      "line 2 with ${named} placeholder",
    ],
  },
};
```

### Placeholder Syntax

| Format | Example | Description |
|--------|---------|-------------|
| `$N` | `$0`, `$1` | Numbered placeholder (no braces) |
| `${N}` | `${0}`, `${1}` | Numbered placeholder (with braces) |
| `${name}` | `${title}`, `${user}` | Named placeholder (user input) |
| `${book.field}` | `${book.name}`, `${book.email}` | Auto-filled from The Book (static values) |
| `${alchemy.potion}` | `${alchemy.weather}`, `${alchemy.date}` | Dynamic values from external APIs |

### Book Placeholders (Static Auto-fill)

The `${book.field}` syntax allows templates to reference user-defined **static** values. These are **not** prompted as arguments - they are automatically filled in at execution time.

**Use cases:**
- Personal information: `${book.name}`, `${book.email}`, `${book.company}`
- Signatures: `${book.signature}`
- Common phrases: `${book.greeting}`, `${book.closing}`

Book fields are configured in **Grimoire → Book button** (top toolbar).

### Alchemy Placeholders (Dynamic API-fetched)

The `${alchemy.potion}` syntax allows templates to fetch **dynamic** values from external APIs. Each potion executes an HTTP request (GET/POST) and the response is injected into the template.

**Use cases:**
- Current data: `${alchemy.weather}`, `${alchemy.date}`, `${alchemy.time}`
- API responses: `${alchemy.github_stars}`, `${alchemy.stock_price}`
- Dynamic content: `${alchemy.quote_of_day}`, `${alchemy.crypto_btc}`

**Execution behavior:**
- All potions in a template are executed **in parallel**
- Template waits for all potions to resolve before filling placeholders
- Errors are handled gracefully with `[Error: ...]` placeholders

Alchemy potions are configured in **Grimoire → Alchemy button** (top toolbar). Each potion defines:
- **Name**: Used in `${alchemy.name}` syntax
- **Method**: GET or POST
- **URL**: API endpoint
- **Headers**: Optional JSON headers (e.g., `{"Authorization": "Bearer token"}`)
- **Body**: Optional JSON body for POST requests

### Example: Simple Template

```typescript
comments: {
  frame: [
    "/* --------------------------------",
    "/*   $0",
    "/* -------------------------------- */",
  ],
},
```

Usage: `frame My Title` → 
```
/* --------------------------------
/*   My Title
/* -------------------------------- */
```

### Example: Template with Named Placeholders

```typescript
greetings: {
  welcome: [
    "Hello ${name}!",
    "Welcome to ${company}.",
  ],
},
```

Usage: `welcome John, Acme Corp` →
```
Hello John!
Welcome to Acme Corp.
```

### Example: Template with Book Fields

```typescript
email: {
  signature: [
    "Best regards,",
    "${book.name}",
    "${book.title} at ${book.company}",
    "${book.email}",
  ],
},
```

Output (with Book configured):
```
Best regards,
John Doe
Senior Developer at Acme Corp
john@acme.com
```

### Example: Template with Alchemy Potions

```typescript
weather_report: {
  daily: [
    "Good morning!",
    "Today's weather: ${alchemy.weather}",
    "Current time: ${alchemy.time}",
    "Have a great ${0}!",
  ],
},
```

Usage: `daily Tuesday` → *(fetches APIs, then outputs)*
```
Good morning!
Today's weather: Sunny, 72°F
Current time: 09:30 AM
Have a great Tuesday!
```

### Template Conversion

Templates are automatically converted to `CommandExecutor` format via the `template()` helper:

```typescript
const template = (recipe: string[]): CommandExecutor => {
  const placeholders = extractPlaceholders(text);
  const argDefs = placeholders.map(p => /* format */);
  const buildFn = (args) => replacePlaceholders(text, args);
  return [buildFn, ...argDefs];
};
```

---

## Custom Templates

Users can create their own templates at runtime. These are stored in `~/.copyai-custom-templates.json` and managed by `../customTemplates.ts`.

### Storage Format

```json
{
  "templates": [
    {
      "id": "custom_1234567890_abc123",
      "name": "my_snippet",
      "category": "code",
      "messageRecipe": ["// ${description}", "function ${name}() {}"],
      "createdAt": 1234567890
    }
  ]
}
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `getCustomTemplates()` | Retrieve all custom templates |
| `addCustomTemplate(template)` | Add a new custom template |
| `removeCustomTemplate(id)` | Delete a custom template |
| `updateCustomTemplate(id, updates)` | Modify an existing template |
| `getCustomTemplatesAsComposers()` | Convert to `CommandExecutor` format |

---

## Command Resolution

Commands are resolved by `cmdKitchen.ts` in the following order:

1. **Full key match**: `home.tv.on`
2. **Without category**: `tv.on` (if `home.tv.on` exists)
3. **Command only**: `on` (last segment)

This allows shortcuts while maintaining organization.

---

## Adding New Commands

### Adding an Executable

1. Find or create the appropriate category in `execs.ts`
2. Add your command as a tuple:

```typescript
my_category: {
  my_command: [
    async (args?: string[]) => {
      const [param1, param2] = args || [];
      // Your logic here
      return "result text"; // or null for failure
    },
    "param1: string",
    "param2?: string (optional description)",
  ],
},
```

### Adding a Template

1. Add your recipe to `templateRecipes` in `templateCommands.ts`:

```typescript
my_category: {
  my_template: [
    "First line with $0",
    "Second line with ${named_param}",
  ],
},
```

---

## Key Differences Summary

| Aspect | Executables | Templates |
|--------|-------------|-----------|
| File | `execs.ts` | `templateCommands.ts` |
| Purpose | Perform actions | Generate text |
| Side effects | Yes | No |
| Async support | Yes (`Promise`) | No |
| Can fail | Yes (`null` return) | No |
| Placeholder syntax | Manual arg parsing | Automatic `$N` / `${name}` |
| User-creatable | No | Yes (custom templates) |

