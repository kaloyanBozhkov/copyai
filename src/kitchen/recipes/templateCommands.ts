import { flattenObjectDot } from "../helpers";
import {
  messageBuilder,
  msgCategory,
  type MessageComposer,
} from "../messageComposer";

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

export const messageComposersPerCategory: Record<
  msgCategory,
  Record<string, MessageComposer>
> = {
  comments: {
    frame: {
      messageRecipe: [
        "/* --------------------------------",
        "/*   $0",
        "/* -------------------------------- */",
      ],
      ...messageBuilder(),
    },
    full_frame: {
      messageRecipe: [
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
      ...messageBuilder(),
    },
  },
  prompts: {
    tag: {
      messageRecipe: ["<$0>$1<$0>"],
      ...messageBuilder(),
    },
    system_message: {
      messageRecipe: [
        `<about></about>\n\n<instructions></instructions>\n\n<examples></examples>`,
      ],
      ...messageBuilder(),
    },
    tool_recipe: {
      messageRecipe: [
        `<about></about>
        <instructions></instructions>
        <when_to_use></when_to_use>
        <when_to_skip></when_to_skip>
        <examples></examples>
        <important></important>`,
      ],
      ...messageBuilder(),
    },
  },
  code: {
    service_procedures_recipe: {
      messageRecipe: [
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
      ...messageBuilder(),
    },
  },
  setuo_project: {
    express_recipe: {
      messageRecipe: [
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
      ...messageBuilder(),
    },
  },
  ssh: {
    linkbase: {
      messageRecipe: [
        "ssh -i ~/.ssh/id_rsa_github_actions_kb_react_native_apps root@213.165.251.35",
      ],
      ...messageBuilder(),
    },
  },
} as const;

export const messageComposers = flattenObjectDot(messageComposersPerCategory);
