# Archgate for VS Code

Enforce architectural layer boundaries directly in your editor. Get instant feedback when code violates your architecture rules.

## Features

### Inline Diagnostics

Violations appear as squiggles on import statements with clear error messages explaining why the import is not allowed.

### Architecture Panel

View your project's layer structure in the Explorer sidebar. See which layers the current file belongs to and what imports are allowed.

### Commands

Access from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---------|-------------|
| `Archgate: Show Architecture` | Open the architecture panel |
| `Archgate: Check Project` | Run a full project check |
| `Archgate: Refresh Diagnostics` | Refresh all diagnostics |

## Requirements

- An `archgate.config.ts` file in your project root
- Node.js 18.0.0 or higher

If you don't have a config file yet, install the CLI and run the setup wizard:

```bash
npm install --save-dev archgate
npx archgate init
```

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `archgate.enable` | `true` | Enable/disable Archgate diagnostics |
| `archgate.validateOnSave` | `true` | Validate architecture when files are saved |
| `archgate.validateOnType` | `false` | Validate while typing (may impact performance) |
| `archgate.showDecorations` | `true` | Show layer decorations in the file explorer |

## How It Works

1. The extension reads your `archgate.config.ts` configuration
2. As you edit files, it analyzes import statements
3. Imports that violate layer boundaries are highlighted
4. Hover over violations to see which rule was broken

## Configuration

Configure your architecture in `archgate.config.ts`:

```typescript
import { defineConfig } from 'archgate'

export default defineConfig({
  layers: {
    pages:      { path: 'src/pages/' },
    components: { path: 'src/components/' },
    hooks:      { path: 'src/hooks/' },
    utils:      { path: 'src/utils/' },
  },

  flow: [
    'pages -> components',
    'pages -> hooks',
    'components -> hooks',
    'hooks -> utils',
  ],
})
```

See the [full documentation](https://github.com/caprado/archgate) for all configuration options.

## Troubleshooting

**Diagnostics not appearing?**
- Ensure `archgate.config.ts` exists in your workspace root
- Check that `archgate.enable` is set to `true`
- Run `Archgate: Refresh Diagnostics` from the Command Palette

**Performance issues?**
- Disable `archgate.validateOnType` (enabled can cause lag on large files)
- The extension caches results, so the first check may be slower

## Links

- [Archgate CLI & Documentation](https://github.com/caprado/archgate)
- [Report Issues](https://github.com/caprado/archgate/issues)
- [npm Package](https://www.npmjs.com/package/archgate)

## License

[MIT](https://github.com/caprado/archgate/blob/main/LICENSE)
