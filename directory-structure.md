# Scanalyzer Directory Structure

```
scanalyzer/
├── .github/                          # GitHub-specific configuration
│   ├── workflows/                    # GitHub Actions CI/CD
│   │   ├── ci.yml                  # Main CI pipeline
│   │   ├── release.yml             # Release automation
│   │   ├── codeql.yml              # Security analysis
│   │   └── dependency-review.yml    # Dependency security checks
│   ├── ISSUE_TEMPLATE/              # Issue templates
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── security_report.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── dependabot.yml               # Automated dependency updates
│   ├── CODEOWNERS                   # Code ownership rules
│   └── FUNDING.yml                  # Sponsorship configuration
│
├── .vscode/                         # VS Code workspace settings
│   ├── settings.json               # Editor configuration
│   ├── launch.json                 # Debug configurations
│   ├── tasks.json                  # Build tasks
│   └── extensions.json             # Recommended extensions
│
├── docs/                            # Project documentation
│   ├── architecture/               # Architecture decisions
│   │   ├── ADR-001-electron-choice.md
│   │   ├── ADR-002-parser-plugins.md
│   │   └── ADR-003-storage-strategy.md
│   ├── api/                        # API documentation
│   │   ├── openapi.yaml           # OpenAPI specification
│   │   └── examples/              # Request/response examples
│   ├── user-guide/                # End-user documentation
│   │   ├── installation.md
│   │   ├── getting-started.md
│   │   ├── troubleshooting.md
│   │   └── faq.md
│   ├── developer-guide/           # Developer documentation
│   │   ├── setup.md
│   │   ├── architecture.md
│   │   ├── parser-development.md
│   │   └── testing.md
│   └── images/                    # Documentation images
│
├── electron/                       # Electron main process
│   ├── main/
│   │   ├── index.ts              # Main entry point
│   │   ├── window.ts             # Window management
│   │   ├── menu.ts               # Application menu
│   │   ├── tray.ts               # System tray integration
│   │   └── updater.ts            # Auto-updater logic
│   ├── preload/
│   │   ├── index.ts              # Preload script
│   │   ├── api.ts                # IPC API exposure
│   │   └── security.ts           # Security validations
│   ├── resources/                 # Electron resources
│   │   ├── icons/                # App icons (ico, icns, png)
│   │   ├── installer/            # Installer assets
│   │   └── certificates/         # Code signing certs (gitignored)
│   └── electron-builder.config.js # Build configuration
│
├── frontend/                      # React application
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/           # React components
│   │   │   ├── common/          # Reusable components
│   │   │   │   ├── Button/
│   │   │   │   ├── Table/
│   │   │   │   └── Modal/
│   │   │   ├── dashboard/       # Dashboard components
│   │   │   │   ├── DashboardView.tsx
│   │   │   │   ├── SummaryCards.tsx
│   │   │   │   └── TrendChart.tsx
│   │   │   ├── reports/         # Report components
│   │   │   │   ├── ReportList.tsx
│   │   │   │   ├── ReportUpload.tsx
│   │   │   │   └── ReportDetail.tsx
│   │   │   └── findings/        # Findings components
│   │   │       ├── FindingsTable.tsx
│   │   │       ├── FindingDetail.tsx
│   │   │       └── FindingsExport.tsx
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useFindings.ts
│   │   │   ├── useReports.ts
│   │   │   └── useWebSocket.ts
│   │   ├── services/            # API services
│   │   │   ├── api.ts          # API client
│   │   │   ├── auth.ts         # Auth helpers
│   │   │   └── storage.ts      # Local storage
│   │   ├── stores/              # Zustand stores
│   │   │   ├── appStore.ts
│   │   │   ├── findingsStore.ts
│   │   │   └── settingsStore.ts
│   │   ├── types/               # TypeScript types
│   │   │   ├── findings.ts
│   │   │   ├── reports.ts
│   │   │   └── api.ts
│   │   ├── utils/               # Utility functions
│   │   │   ├── formatters.ts
│   │   │   ├── validators.ts
│   │   │   └── constants.ts
│   │   ├── styles/              # Global styles
│   │   │   ├── globals.css
│   │   │   └── themes/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── tests/                    # Frontend tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── .eslintrc.js             # ESLint configuration
│   ├── .prettierrc              # Prettier configuration
│   ├── tsconfig.json            # TypeScript configuration
│   ├── vite.config.ts           # Vite configuration
│   ├── tailwind.config.js       # Tailwind CSS config
│   ├── postcss.config.js        # PostCSS configuration
│   └── package.json
│
├── backend/                      # Python FastAPI backend
│   ├── app/
│   │   ├── api/                 # API endpoints
│   │   │   ├── v1/             # API version 1
│   │   │   │   ├── __init__.py
│   │   │   │   ├── reports.py
│   │   │   │   ├── findings.py
│   │   │   │   ├── parsers.py
│   │   │   │   └── system.py
│   │   │   └── deps.py         # Dependencies
│   │   ├── core/               # Core functionality
│   │   │   ├── __init__.py
│   │   │   ├── config.py       # Configuration
│   │   │   ├── security.py     # Security utilities
│   │   │   └── exceptions.py   # Custom exceptions
│   │   ├── models/             # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── report.py
│   │   │   ├── finding.py
│   │   │   └── base.py
│   │   ├── schemas/            # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── report.py
│   │   │   ├── finding.py
│   │   │   └── common.py
│   │   ├── services/           # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── report_service.py
│   │   │   ├── finding_service.py
│   │   │   ├── storage_service.py
│   │   │   └── cleanup_service.py
│   │   ├── parsers/            # Parser plugins
│   │   │   ├── __init__.py
│   │   │   ├── base.py         # Base parser class
│   │   │   ├── registry.py     # Parser registry
│   │   │   ├── prowler/        # Prowler parsers
│   │   │   │   ├── __init__.py
│   │   │   │   ├── v2.py
│   │   │   │   └── v3.py
│   │   │   ├── checkov/        # Checkov parsers
│   │   │   │   ├── __init__.py
│   │   │   │   └── parser.py
│   │   │   ├── bandit/         # Bandit parsers
│   │   │   │   ├── __init__.py
│   │   │   │   └── parser.py
│   │   │   └── document/       # Document parsers
│   │   │       ├── __init__.py
│   │   │       ├── pdf.py
│   │   │       ├── docx.py
│   │   │       └── spreadsheet.py
│   │   ├── utils/              # Utilities
│   │   │   ├── __init__.py
│   │   │   ├── file_utils.py
│   │   │   ├── memory_guard.py
│   │   │   └── logging.py
│   │   ├── __init__.py
│   │   └── main.py             # FastAPI app
│   ├── storage/                # Local storage
│   │   ├── database/          # SQLite files (gitignored)
│   │   ├── reports/           # Uploaded reports (gitignored)
│   │   └── temp/              # Temporary files (gitignored)
│   ├── tests/                  # Backend tests
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/          # Test data
│   ├── alembic/               # Database migrations
│   │   ├── versions/
│   │   ├── alembic.ini
│   │   ├── env.py
│   │   └── script.py.mako
│   ├── scripts/               # Utility scripts
│   │   ├── create_parser.py   # Parser scaffolding
│   │   ├── test_parser.py     # Parser testing
│   │   └── cleanup_storage.py # Manual cleanup
│   ├── .env.example           # Environment variables template
│   ├── .flake8                # Flake8 configuration
│   ├── .mypy.ini              # MyPy configuration
│   ├── pyproject.toml         # Python project config
│   ├── poetry.lock            # Locked dependencies
│   └── Dockerfile             # Container for testing
│
├── shared/                     # Shared resources
│   ├── types/                 # Shared TypeScript types
│   │   ├── index.ts
│   │   ├── findings.ts
│   │   └── reports.ts
│   └── constants/             # Shared constants
│       └── index.ts
│
├── scripts/                    # Development scripts
│   ├── setup.sh              # Initial setup script
│   ├── build.sh              # Build script
│   ├── test.sh               # Test runner
│   ├── release.sh            # Release automation
│   └── clean.sh              # Cleanup script
│
├── build/                      # Build artifacts (gitignored)
│   ├── mac/
│   ├── win/
│   └── linux/
│
├── dist/                       # Distribution files (gitignored)
│
├── node_modules/              # Node dependencies (gitignored)
│
├── .env                       # Environment variables (gitignored)
├── .env.development          # Development environment
├── .env.test                 # Test environment
├── .gitignore                # Git ignore rules
├── .gitattributes           # Git attributes
├── .editorconfig            # Editor configuration
├── .nvmrc                   # Node version
├── .python-version          # Python version
├── claude.md                # Claude AI instructions
├── CHANGELOG.md             # Version history
├── CODE_OF_CONDUCT.md       # Community guidelines
├── CONTRIBUTING.md          # Contribution guidelines
├── LICENSE                  # MIT License
├── README.md               # Project overview
├── SECURITY.md             # Security policy
├── package.json            # Root package.json
├── package-lock.json       # Locked dependencies
└── renovate.json           # Renovate bot config
```

## Directory Purpose Guide

### Core Directories

#### `/electron`
Main process code for the Electron application. Handles window management, system integration, and IPC communication.

#### `/frontend`
React application that runs in the Electron renderer process. Contains all UI components, state management, and frontend logic.

#### `/backend`
Python FastAPI server that handles file parsing, data processing, and business logic. Runs as a subprocess of the Electron app.

#### `/shared`
TypeScript types and constants shared between Electron and frontend code. Ensures type safety across IPC boundaries.

### Configuration Files

#### Root Level
- **`.gitignore`**: Excludes build artifacts, node_modules, Python cache, and sensitive files
- **`.env.example`**: Template for environment variables with documentation
- **`claude.md`**: AI assistant instructions for consistent development

#### Frontend
- **`vite.config.ts`**: Build configuration optimized for Electron
- **`tailwind.config.js`**: Design system configuration
- **`tsconfig.json`**: TypeScript settings with strict mode

#### Backend
- **`pyproject.toml`**: Python project configuration using Poetry
- **`alembic.ini`**: Database migration configuration
- **`.mypy.ini`**: Type checking configuration

### Testing Structure

#### `/frontend/tests`
- `unit/`: Component-level tests with React Testing Library
- `integration/`: API integration tests with MSW
- `e2e/`: End-to-end tests with Playwright

#### `/backend/tests`
- `unit/`: Parser and service unit tests
- `integration/`: API endpoint tests
- `fixtures/`: Sample security reports for testing

### Security Considerations

#### Gitignored Directories
- `/backend/storage/`: Contains user data and reports
- `/electron/resources/certificates/`: Code signing certificates
- `/build/` and `/dist/`: Compiled applications
- All `.env` files except `.env.example`

#### Sensitive File Handling
- Database files stored in platform-specific app data directories
- Temporary files cleaned automatically
- No credentials in source control

## Best Practices Implemented

1. **Clear Separation**: Frontend, backend, and Electron code are clearly separated
2. **Type Safety**: Shared types ensure consistency across IPC boundaries
3. **Documentation**: Comprehensive docs for users and developers
4. **Testing**: Multiple testing levels for reliability
5. **Security**: Sensitive data excluded from version control
6. **Automation**: CI/CD workflows for quality assurance
7. **Standards**: Consistent code formatting and linting
8. **Versioning**: Clear version management with changelogs