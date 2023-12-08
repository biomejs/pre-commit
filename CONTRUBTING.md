# 🚀 Contributing

We can use help in a bunch of areas and any help is greatly appreciated!

## Locally test the hook

You can locally test the hook in a project by using an absolute path to the repository of the hook.

```yaml
repos:
-   repo: /absolute/path/to/the/hook/repository
    rev: ""  # Leave this empty to use the last commit
    hooks:
    -   id: check
        additional_dependencies: ["@biomejs/biome@latest"]
```

Note that your changes in the hook repository must be committed in order to test them.
