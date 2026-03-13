# README for agents

This is the tools repo. All tools will be hosted in path `/tools` in github pages.

## Rules

### When you create a new tool

- create a folder using the tool's name in kebab-case
- create a README in that folder explaining what the tool is
- add a new hyperlink to the `index.html` so people can find it in the directory

### General

- js only
- no build step
- use [cdnjs](https://cdnjs.com/) or [jsDelivr](https://www.jsdelivr.com/) if you want to include a package. use minimal dependencies if possible though.
  - [Pyodide](https://pyodide.org/) is a distribution of Python that’s compiled to WebAssembly and designed to run directly in browsers. It also includes [micropip](https://github.com/pyodide/micropip) — a mechanism that can load extra pure-Python packages from PyPI via CORS. This allows you to use Python packages too.
- persist small states using url params
- persist large states using localStorage
