# Scanalyzer Documentation

This directory contains the comprehensive documentation for Scanalyzer, a security findings analysis platform.

## Documentation Structure

```
docs/
├── index.md                    # Landing page
├── user-guide/                 # End-user documentation
│   ├── getting-started.md      # Installation and setup
│   ├── features/              # Feature documentation
│   │   ├── dashboard.md
│   │   ├── uploading-reports.md
│   │   ├── analyzing-findings.md
│   │   ├── filtering.md
│   │   └── exporting-data.md
│   ├── advanced/              # Advanced features
│   ├── integrations/          # Tool integrations
│   └── troubleshooting/       # Common issues and solutions
├── developer-guide/           # Developer documentation
│   ├── architecture.md
│   ├── setup.md
│   └── contributing.md
├── api-reference/             # API documentation
├── video-scripts/             # Scripts for video tutorials
└── images/                    # Screenshots and diagrams
    └── screenshots/           # Auto-generated screenshots
```

## Building Documentation

### Prerequisites

- Node.js 18+
- Python 3.8+
- MkDocs and plugins

### Quick Start

```bash
# Install dependencies
npm install
pip install mkdocs mkdocs-material

# Build documentation
./scripts/build-docs.sh

# Preview locally
mkdocs serve

# Generate screenshots (requires running app)
./scripts/build-docs.sh --screenshots

# Deploy to GitHub Pages
./scripts/build-docs.sh --deploy
```

## Writing Documentation

### Style Guide

1. **Tone**: Professional but approachable
2. **Person**: Second person ("you") for instructions
3. **Tense**: Present tense for current state, future for outcomes
4. **Voice**: Active voice preferred

### Markdown Extensions

We use MkDocs Material which supports:

- **Admonitions**: `!!! note`, `!!! warning`, `!!! tip`
- **Code blocks**: With syntax highlighting
- **Tabs**: For OS-specific instructions
- **Icons**: Material Design icons
- **Diagrams**: Mermaid support

### Example Patterns

#### OS-Specific Instructions

```markdown
=== "Windows"
    ```powershell
    # Windows command
    ```

=== "macOS"
    ```bash
    # macOS command
    ```

=== "Linux"
    ```bash
    # Linux command
    ```
```

#### Admonitions

```markdown
!!! tip "Pro Tip"
    Use keyboard shortcuts for faster navigation.

!!! warning "Important"
    Always backup your data before major updates.
```

#### Feature Documentation Template

```markdown
# Feature Name

Brief description of what the feature does.

## Overview

More detailed explanation with use cases.

## How to Use

Step-by-step instructions:

1. First step
2. Second step
3. Third step

## Options and Settings

| Option | Description | Default |
|--------|-------------|---------|
| Option 1 | What it does | Value |

## Tips and Best Practices

- Tip 1
- Tip 2

## Common Issues

See [Troubleshooting](../troubleshooting/common-issues.md#feature-name)
```

## Screenshot Generation

Screenshots are automatically generated using Playwright:

```bash
# Generate all screenshots
ts-node scripts/generate-screenshots.ts

# Generate specific screenshot
ts-node scripts/generate-screenshots.ts --only dashboard-overview
```

### Adding New Screenshots

Edit `scripts/generate-screenshots.ts`:

```typescript
const SCREENSHOT_CONFIGS: ScreenshotConfig[] = [
  {
    name: 'my-new-screenshot',
    url: '/page-url',
    selector: '[data-testid="element"]',
    annotations: [
      {
        type: 'highlight',
        x: 100, y: 100,
        width: 200, height: 50
      }
    ]
  }
];
```

## Documentation Validation

Run validation before committing:

```bash
# Validate all documentation
ts-node scripts/validate-docs.ts

# Check for:
# - Broken internal links
# - Missing images
# - Long lines
# - Missing alt text
# - TODO/FIXME comments
# - Required sections
```

## Video Tutorials

Video scripts are in `video-scripts/`. Each script includes:

- Duration and level
- Scene descriptions
- Narration text
- Actions to perform
- Production notes

## API Documentation

### TypeScript/Frontend

Generated using TypeDoc:

```bash
npx typedoc --out docs/api-reference/typescript frontend/src
```

### Python/Backend

Generated using Sphinx:

```bash
cd backend
sphinx-apidoc -o ../docs/api-reference/python app
```

## Deployment

Documentation is deployed to GitHub Pages:

```bash
# Manual deployment
mkdocs gh-deploy

# Or use build script
./scripts/build-docs.sh --deploy
```

Access at: https://scanalyzer.github.io/scanalyzer/

## Contributing

1. **Before writing**: Check existing docs for style
2. **While writing**: Follow templates and patterns
3. **After writing**: Run validation
4. **Before submitting**: Test locally with `mkdocs serve`

## Help and Support

- Documentation issues: Create GitHub issue with `docs` label
- Questions: Post in discussions
- Improvements: Submit PR with changes

## License

Documentation is licensed under CC BY 4.0. See LICENSE-DOCS.