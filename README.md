# pre-commit hooks

This repository provides [Biome](https://biomejs.dev) hooks for [pre-commit](https://pre-commit.com/).

The following section assumes that you [installed pre-commit](https://pre-commit.com/index.html#install) and run `pre-commit install` in your repository.

## Using biome's pre-commit hooks

Biome provides four hooks:

| hook `id` | description |
| --------- | ----------- |
| `biome-ci`      | Check formatting, check if imports are organized, and lints |
| `biome-check`   | Format, organize imports, lint, and apply safe fixes to the committed files |
| `biome-format`  | Format the committed files |
| `biome-lint`    | Lint and apply safe fixes to the committed files |

For example, if you want to use the `biome-check` hook,
add the following pre-commit configuration to the root of your project in a file named `.pre-commit-config.yaml`:

```yaml
repos:
-   repo: https://github.com/biomejs/pre-commit
    rev: ""  # Use the sha / tag you want to point at
    hooks:
    -   id: biome-check
        additional_dependencies: ["@biomejs/biome@1.4.1"]
```

Note that you must specify which version of Biome to use thanks to the `additional_dependencies` option.

## Using biome with a local pre-commit hook

If Biome is already installed as a `npm` package in your local repository,
then it can be a burden to update both `package.json` and `.pre-commit-config.yaml` when you update Biome.
Instead of using the provided Biome hooks, you can specify your own [local hook](https://pre-commit.com/index.html#repository-local-hooks).

For example, if you use `npm`, you can write the following hook in `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: local-biome-check
        name: biome check
        entry: npx biome check --apply --files-ignore-unknown=true --no-errors-on-unmatched
        language: system
        types: [text]
        files: "\\.(jsx?|tsx?|c(js|ts)|m(js|ts)|d\\.(ts|cts|mts)|jsonc?|css)$"
```

The pre-commit option `files` is optional,
because Biome is able to ignore unknown files (using the option `--files-ignore-unknown=true`).
