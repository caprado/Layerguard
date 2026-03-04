# Layerguard for VS Code

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
| `Layerguard: Show Architecture` | Open the architecture panel |
| `Layerguard: Check Project` | Run a full project check |
| `Layerguard: Refresh Diagnostics` | Refresh all diagnostics |

## Requirements

- A `layerguard.config.ts` file in your project root
- Node.js 18.0.0 or higher

If you don't have a config file yet, install the CLI and run the setup wizard:

```bash
npm install --save-dev layerguard
npx layerguard init
```

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `layerguard.enable` | `true` | Enable/disable Layerguard diagnostics |
| `layerguard.validateOnSave` | `true` | Validate architecture when files are saved |
| `layerguard.validateOnType` | `false` | Validate while typing (may impact performance) |
| `layerguard.showDecorations` | `true` | Show layer decorations in the file explorer |

## How It Works

1. The extension reads your `layerguard.config.ts` configuration
2. As you edit files, it analyzes import statements
3. Imports that violate layer boundaries are highlighted
4. Hover over violations to see which rule was broken

## Configuration

Configure your architecture in `layerguard.config.ts`:

```typescript
import { defineConfig } from 'layerguard'

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

See the [full documentation](https://github.com/caprado/layerguard) for all configuration options.

## Troubleshooting

**Diagnostics not appearing?**
- Ensure `layerguard.config.ts` exists in your workspace root
- Check that `layerguard.enable` is set to `true`
- Run `Layerguard: Refresh Diagnostics` from the Command Palette

**Performance issues?**
- Disable `layerguard.validateOnType` (enabled can cause lag on large files)
- The extension caches results, so the first check may be slower

## Links

- [Layerguard CLI & Documentation](https://github.com/caprado/layerguard)
- [Report Issues](https://github.com/caprado/layerguard/issues)
- [npm Package](https://www.npmjs.com/package/layerguard)

## License

[MIT](https://github.com/caprado/layerguard/blob/main/LICENSE)
