import { flattenObjectDot, extractPlaceholders, extractAlchemyPlaceholders, replacePlaceholders } from "../helpers";
import { CommandExecutor } from "../commandExecutor";
import { getBook, getAlchemy, executePotion } from "../grimoireSettings";

const commonIngredients = {
  schemaRules: `<schema_rules>
  Prisma Schema Rules:
- model name always singular
- array property name always plural (1 to many)
- models and field snake_case, because postgres does not like uppercase (makes everything lowecase)
- model and field mapping (aliasing), to be avoided, because there is no corresponding field in the db
- foreign keys, must be "(name of target model)_id" e.g. "user_id" and the object called like the target model e.g. "user"
- field groups, core fields at the top (id, uuid, etc) then the actual fields A-Z, then the relations/foreign keys, then indexes
- Prefer prisma (DB) enums where the type is known a priori, instead of the classic integer mapped to a code enum
- all external ids must be prefixed by "external_" e.g. "external_kyc_id"
- counts and booleans should have a default value, to avoid nulls (useful for filtering)
- many to many, call relation "to_(name of target model in plural)" e.g. "to_users" where there is a relation between "user" and "group" and the relation is called "user_to_group"
</schema_rules>
<important_schema_note>After creating the prisma schema file, paste the <schema_rules> at its top as a comment so it's always clear to readers</important_schema_note>`,
};

// Helper to create a template command from recipe lines
const template = (recipe: string[]): CommandExecutor => {
  const text = recipe.join("\n");
  const placeholders = extractPlaceholders(text);
  const alchemyPlaceholders = extractAlchemyPlaceholders(text);
  
  // Create arg definitions - numbered ones show $N, named show the name
  const argDefs = placeholders.map((p) => 
    /^\d+$/.test(p) ? `$${p}: string` : `${p}: string`
  );

  const buildFn = async (args?: string[]) => {
    // Get book values for ${book.field} replacement
    const bookValues = getBook();
    
    // Fetch alchemy values for ${alchemy.potionName} replacement (only potions used in template)
    const alchemyValues: Record<string, string> = {};
    if (alchemyPlaceholders.length > 0) {
      const allPotions = getAlchemy();
      await Promise.all(
        alchemyPlaceholders.map(async (potionName) => {
          const potion = allPotions.find((p) => p.name === potionName);
          if (potion) {
            try {
              const value = await executePotion(potion);
              alchemyValues[`alchemy.${potionName}`] = value;
            } catch (error) {
              console.error(`Failed to execute potion ${potionName}:`, error);
              alchemyValues[`alchemy.${potionName}`] = `[Error: ${error}]`;
            }
          } else {
            alchemyValues[`alchemy.${potionName}`] = `[Potion not found: ${potionName}]`;
          }
        })
      );
    }
    
    // Combine book and alchemy values
    const combinedValues = { ...bookValues, ...alchemyValues };
    
    if (!args || args.length === 0) {
      return replacePlaceholders(text, {}, combinedValues);
    }
    
    // Build a map of placeholder names to provided values
    const valuesMap: Record<string, string> = {};
    placeholders.forEach((placeholder, index) => {
      if (args[index] !== undefined) {
        valuesMap[placeholder] = args[index];
      }
    });
    
    return replacePlaceholders(text, valuesMap, combinedValues);
  };

  return [buildFn, ...argDefs];
};

// Store raw recipes for grimoire display
export const templateRecipes: Record<string, Record<string, string[]>> = {
  comments: {
    frame: [
      "/* --------------------------------",
      "/*   $0",
      "/* -------------------------------- */",
    ],
    full_frame: [
      "/* --------------------------------",
      "/*   $0",
      "/* -------------------------------- */",
      "",
      "",
      "",
      "/* --------------------------------",
      "/*   $0",
      "/* -------------------------------- */",
    ],
  },
  prompts: {
    tag: ["<$0>$1<$0>"],
    system_message: [
      `<about></about>\n\n<instructions></instructions>\n\n<examples></examples>`,
    ],
    tool_recipe: [
      `<about></about>
        <instructions></instructions>
        <when_to_use></when_to_use>
        <when_to_skip></when_to_skip>
        <examples></examples>
        <important></important>`,
    ],
  },
  code: {
    service_procedures_recipe: [
      `<instructions>
With the _____ service we want to build a few procedures that will be used to interact with the service.
</instructions>
<files_to_reference>

</files_to_reference>
<what_to_build>

</what_to_build>
<important>
- just output the code needed to build the service parts requested.
- Do not output any readme files or other documentation files.
- Do not output any test files or other test files.
- Do not output any example files or other example files.
- Do not output any sample files or other sample files.
</important>`,
    ],
  },
  setup_project: {
    express_recipe: [
      `<instructions>
You setup a new backend project with given tech. Follow best practices, use context7.
Make sure to add a middleware that blocks requests not including an X-API-KEY header that's matching the one in .env file.
</instructions>
<packages_to_use>
- express
- zod
- zustand
- @t3-oss/env-core
- dotenv
- nodemon
- uuid
- cors
- eslint (and other related packages for it to work)
{{with-prisma}}
- prisma
{{/with-prisma}}
</packages_to_use>
<folder_structure>
    |── ./src               
    │   ├── queries/        # Request handlers organized by feature
    │   ├── services/       # Business logic layer
    │   ├── router/         # Express route definitions. Use subfolders to group routes by feature
    │   └── helpers/        # Utility functions, validation etc..
    │   └── middleware/     # Middleware functions 
{{with-prisma}}
    ├── prisma/             # Database schema and migrations
{{/with-prisma}}
    └── package.json
</folder_structure>
<important>
- use "@" as alias for ./src folder
- when a file's length exceeds 160 lines consider splitting it into multiple files if there's more than 1 function inside.. Essentially, prefer modularization over long files.
- always use zod for paylaod schemas validation and type annotation
</important>
`,
      `{{with-prisma}}${commonIngredients.schemaRules}{{/with-prisma}}`,
    ],
  },
  ssh: {
    linkbase: [
      "ssh -i ~/.ssh/id_rsa_github_actions_kb_react_native_apps root@213.165.251.35",
    ],
  },
};

// Convert recipes to command executors
export const messageComposersPerCategory: Record<
  string,
  Record<string, CommandExecutor>
> = Object.fromEntries(
  Object.entries(templateRecipes).map(([category, commands]) => [
    category,
    Object.fromEntries(
      Object.entries(commands).map(([name, recipe]) => [name, template(recipe)])
    ),
  ])
);

export const messageComposers = flattenObjectDot(messageComposersPerCategory);
