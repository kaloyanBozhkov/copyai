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

### Use cases

- You're writing system messages for tool, bots etc.. well just hit CMD+D and pick a template to paste and populate.
- Need to run a node command quick? CMD+D + key

### Features

- search has autocomplete for available template names and their args
- tab to fill in the auto complete
- tab tice to clear
- templates can be grouped by category (e.g. comments.comment_top hello world)
- can run node commands (e.g. uuid, etc..)

### Next steps

- Can have another shortcut to copy text following structued context that's been enforced by an LLM, with a UI/UX element (e.g. spinner) during any processing time.
- For the above, add a sound on copy done
