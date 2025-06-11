# CLAUDE.md - Security Report Analysis Platform

## 🎯 Project Overview

You are Claude Code, an expert software engineer building Scanalyzer, a desktop security report analysis platform. The project structure, README.md, and CLAUDE.md already exist in the repository. Your role is to implement the application following the established architecture and guidelines.

Key project facts:
- Desktop app using Electron + React (frontend) and Python FastAPI (backend)
- Supports parsing security reports from Prowler, Checkov, and Bandit
- Handles JSON, XML, PDF, DOCX, CSV, and XLSX file formats
- Single-user application for Windows and macOS
- Local storage with 3-month retention policy
- NO placeholder code - every line must be functional

Before any task:
1. Read the existing CLAUDE.md for project guidelines
2. Check the directory structure markdown for file organization
3. Review README.md for project overview and setup instructions
4. Always read files before modifying them
5. Run linters after code changes
6. Handle all errors explicitly with user-friendly messages

When encountering errors:
1. Show the exact error message and location
2. Analyze potential causes
3. Ask: "I encountered [error]. Should I: a) Try [solution 1], b) Try [solution 2], c) Investigate further with [diagnostic]?"
4. Implement the chosen solution with detailed logging

Remember: Stream files >10MB, use async operations everywhere, validate all inputs, and maintain continuous repository awareness.

Desktop application for analyzing security reports from Prowler, Checkov, and Bandit. Processes JSON, XML, PDF, DOCX, CSV, and XLSX files. Built with Electron + React (frontend) and Python FastAPI (backend). Single-user, local storage, 3-month retention.

## 🚫 Critical Rules

1. **NO PLACEHOLDER CODE** - Every line must be functional
2. **NO MEMORY OVERLOAD** - Stream everything > 10MB
3. **NO SYNC OPERATIONS** - Async everywhere
4. **NO ASSUMPTIONS** - Read files before modifying
5. **NO SILENT FAILURES** - Log and handle every error

## 🏗️ Architecture

```
┌─────────────────────┐
│   Electron Main     │ <-- Window management, IPC
├─────────────────────┤
│   React Renderer    │ <-- UI, state management
├─────────────────────┤
│   IPC Bridge        │ <-- Type-safe communication
├─────────────────────┤
│   Python Backend    │ <-- FastAPI, parsers
├─────────────────────┤
│   Local Storage     │ <-- SQLite + filesystem
└─────────────────────┘
```

## 📁 Project Structure

```
security-analyzer/
├── electron/
│   ├── main.ts          # Main process
│   ├── preload.ts       # IPC bridge
│   └── security.ts      # Security policies
├── frontend/
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── services/    # API clients
│   │   └── stores/      # Zustand stores
│   └── electron.vite.config.ts
├── backend/
│   ├── app/
│   │   ├── api/         # FastAPI routes
│   │   ├── parsers/     # Plugin system
│   │   ├── models/      # SQLAlchemy
│   │   └── services/    # Business logic
│   └── pyproject.toml
└── shared/
    └── types/           # Shared TypeScript types
```

## 💻 Development Standards

### TypeScript (Electron/React)
```typescript
// ALWAYS: Type-safe IPC
export interface IpcAPI {
  upload: (path: string) => Promise<UploadResult>;
  parse: (id: string) => Promise<ParseResult>;
  onProgress: (callback: (progress: Progress) => void) => void;
}

// ALWAYS: Validate IPC inputs
const safeUpload = async (filePath: string): Promise<UploadResult> => {
  if (!await fs.pathExists(filePath)) {
    throw new IpcError('FILE_NOT_FOUND', `File not found: ${filePath}`);
  }
  
  const stats = await fs.stat(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new IpcError('FILE_TOO_LARGE', `Max size: ${MAX_FILE_SIZE}`);
  }
  
  return await ipcRenderer.invoke('upload', filePath);
};

// ALWAYS: Handle all states
const FileUpload: React.FC = () => {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  
  // Never leave user guessing
  return match(state)
    .with('idle', () => <DropZone onDrop={handleDrop} />)
    .with('uploading', () => <ProgressBar value={progress} />)
    .with('parsing', () => <ParsingIndicator />)
    .with('success', () => <SuccessMessage />)
    .with('error', () => <ErrorDisplay error={error} retry={retry} />)
    .exhaustive();
};
```

### Python (Backend)
```python
# ALWAYS: Stream large files
async def parse_large_file(file_path: Path) -> AsyncIterator[Finding]:
    """Stream parse with memory protection."""
    async with aiofiles.open(file_path, 'rb') as f:
        parser = ParserFactory.create(file_path)
        buffer = bytearray(1024 * 1024)  # 1MB buffer
        
        while True:
            bytes_read = await f.readinto(buffer)
            if not bytes_read:
                break
                
            async for finding in parser.process_chunk(buffer[:bytes_read]):
                yield finding
                
            # Force garbage collection every 100MB
            if f.tell() % (100 * 1024 * 1024) == 0:
                gc.collect()

# ALWAYS: Implement circuit breakers
class ParserCircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failures = 0
        self.threshold = failure_threshold
        self.timeout = timeout
        self.last_failure = None
        
    async def call(self, func, *args, **kwargs):
        if self.is_open():
            raise CircuitOpenError("Parser circuit breaker is open")
            
        try:
            result = await func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise
```

### Electron Security
```typescript
// main.ts - ALWAYS implement these security measures
app.whenReady().then(() => {
  // Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self' http://localhost:8000"
        ].join('; ')
      }
    });
  });

  // Prevent new window creation
  app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event) => {
      event.preventDefault();
    });
  });
});

// preload.ts - Minimal, secure API exposure
contextBridge.exposeInMainWorld('api', {
  upload: (path: string) => ipcRenderer.invoke('upload', path),
  onProgress: (cb: (p: Progress) => void) => {
    ipcRenderer.on('progress', (_, progress) => cb(progress));
  }
});
```

## 🧩 Parser Plugin System

### Base Parser Contract
```python
from abc import ABC, abstractmethod
from typing import AsyncIterator, BinaryIO

class BaseParser(ABC):
    """All parsers must implement this interface."""
    
    @abstractmethod
    async def can_parse(self, file_path: Path) -> bool:
        """Quick check if this parser handles the file."""
        pass
    
    @abstractmethod
    async def parse_stream(self, stream: BinaryIO) -> AsyncIterator[Finding]:
        """Parse file stream yielding findings."""
        pass
    
    @abstractmethod
    def get_metadata(self) -> ParserMetadata:
        """Return parser capabilities and version."""
        pass

# Parser registration
PARSER_REGISTRY: Dict[str, Type[BaseParser]] = {}

def register_parser(name: str):
    """Decorator to register parsers."""
    def decorator(cls: Type[BaseParser]):
        PARSER_REGISTRY[name] = cls
        return cls
    return decorator

@register_parser("prowler_v3")
class ProwlerV3Parser(BaseParser):
    """Prowler v3.x JSON parser implementation."""
    pass
```

### Parser Factory
```python
class ParserFactory:
    @staticmethod
    async def create(file_path: Path) -> BaseParser:
        """Detect and create appropriate parser."""
        # Try parsers in priority order
        for parser_class in PARSER_REGISTRY.values():
            parser = parser_class()
            if await parser.can_parse(file_path):
                logger.info(f"Selected parser: {parser.__class__.__name__}")
                return parser
        
        # Fallback to document parsers
        ext = file_path.suffix.lower()
        if ext == '.pdf':
            return PDFGenericParser()
        elif ext in ['.xlsx', '.xls']:
            return ExcelGenericParser()
        elif ext == '.docx':
            return DocxGenericParser()
        
        raise UnsupportedFormatError(f"No parser for: {file_path}")
```

## 🚀 Performance Optimization

### Memory Management
```python
# Backend: Memory-aware processing
class MemoryGuard:
    def __init__(self, limit_mb: int = 500):
        self.limit_bytes = limit_mb * 1024 * 1024
        self.process = psutil.Process()
        
    async def __aenter__(self):
        self.initial = self.process.memory_info().rss
        return self
        
    async def __aexit__(self, *args):
        current = self.process.memory_info().rss
        if current > self.initial + self.limit_bytes:
            gc.collect()
            logger.warning(f"Memory spike: {(current-self.initial)/1024/1024:.1f}MB")

# Frontend: Virtual scrolling for large lists
const VirtualFindingsTable = () => {
  const rowVirtualizer = useVirtualizer({
    count: findings.length,
    getScrollElement: () => scrollElement.current,
    estimateSize: () => 48,
    overscan: 10
  });
  
  return (
    <div ref={scrollElement} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px` }}>
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          <FindingRow
            key={virtualRow.key}
            finding={findings[virtualRow.index]}
            style={{
              position: 'absolute',
              top: virtualRow.start,
              height: virtualRow.size
            }}
          />
        ))}
      </div>
    </div>
  );
};
```

### Caching Strategy
```typescript
// Frontend: React Query with smart caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        if (error instanceof NetworkError) return failureCount < 3;
        return false;
      }
    }
  }
});

// Backend: Redis-like in-memory cache
class CacheService:
    def __init__(self, max_size_mb: int = 100):
        self.cache = TTLCache(maxsize=max_size_mb * 1024, ttl=300)
        
    async def get_or_compute(self, key: str, compute_fn):
        if key in self.cache:
            return self.cache[key]
        
        result = await compute_fn()
        self.cache[key] = result
        return result
```

## 🔍 Debugging & Error Handling

### Error Tracking
```typescript
// Global error boundary with reporting
class ErrorBoundary extends React.Component<Props, State> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error:', error, errorInfo);
    
    // Send to main process for logging
    window.api.logError({
      type: 'REACT_ERROR',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString()
    });
    
    // Show user-friendly error
    this.setState({
      hasError: true,
      error: {
        title: 'Something went wrong',
        message: 'The application encountered an error. Please restart.',
        details: IS_DEV ? error.stack : undefined
      }
    });
  }
}
```

### Debug Mode
```typescript
// Electron: Developer tools
if (isDevelopment) {
  // Auto-open DevTools
  mainWindow.webContents.openDevTools();
  
  // Add React DevTools
  await installExtension(REACT_DEVELOPER_TOOLS);
  
  // Enable source maps
  app.commandLine.appendSwitch('js-flags', '--expose-gc');
  
  // Add debug menu
  Menu.setApplicationMenu(createDebugMenu());
}

// Backend: Debug endpoints
if settings.DEBUG:
    @app.get("/debug/memory")
    async def memory_stats():
        return {
            "process_memory_mb": psutil.Process().memory_info().rss / 1024 / 1024,
            "python_objects": len(gc.get_objects()),
            "parser_cache_size": len(parser_cache),
            "active_sessions": len(active_sessions)
        }
```

## 🚢 Build & Distribution

### Platform-specific builds
```javascript
// electron-builder.config.js
module.exports = {
  appId: 'com.security.analyzer',
  productName: 'Security Analyzer',
  directories: {
    output: 'dist'
  },
  files: [
    'dist-electron',
    'dist'
  ],
  mac: {
    category: 'public.app-category.developer-tools',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: {
      teamId: process.env.APPLE_TEAM_ID
    }
  },
  win: {
    target: 'nsis',
    certificateFile: process.env.WIN_CERT_FILE,
    certificatePassword: process.env.WIN_CERT_PASSWORD
  },
  nsis: {
    oneClick: false,
    perMachine: true,
    allowToChangeInstallationDirectory: true
  }
};
```

## 📊 Performance Monitoring

### Key Metrics
```typescript
// Track critical operations
const metrics = {
  startup: async () => {
    const start = performance.now();
    await app.whenReady();
    const duration = performance.now() - start;
    logger.info(`Startup time: ${duration}ms`);
  },
  
  fileProcessing: async (fileSize: number, duration: number) => {
    const mbPerSecond = (fileSize / 1024 / 1024) / (duration / 1000);
    logger.info(`Processing speed: ${mbPerSecond.toFixed(2)} MB/s`);
  },
  
  memoryUsage: () => {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }
};
```

## 🆘 Emergency Procedures

### When Parser Crashes
1. Log full error with context
2. Move file to quarantine
3. Notify user with options
4. Continue with next file
5. Add to known issues

### When Memory Exceeds Limit
1. Cancel current operation
2. Force garbage collection
3. Clear caches
4. Show memory warning
5. Suggest app restart

### When Backend Unresponsive
1. Check process health
2. Attempt restart (max 3)
3. Show offline mode
4. Queue operations
5. Log diagnostic info

## ✅ Quality Checklist

Before EVERY commit:
- [ ] No TypeScript `any` types
- [ ] All errors handled explicitly  
- [ ] Memory usage profiled
- [ ] IPC calls validated
- [ ] File operations async
- [ ] Tests passing
- [ ] No console.log in production

## 🎯 Quick Reference

### Common Patterns
```typescript
// File selection
const files = await dialog.showOpenDialog({
  properties: ['openFile', 'multiSelections'],
  filters: [
    { name: 'Security Reports', extensions: ['json', 'xml', 'pdf', 'docx', 'csv', 'xlsx'] },
    { name: 'All Files', extensions: ['*'] }
  ]
});

// Progress tracking
let progress = 0;
const updateProgress = (percent: number) => {
  progress = percent;
  mainWindow.webContents.send('progress', { percent });
  mainWindow.setProgressBar(percent / 100);
};

// Error display
const showError = (error: AppError) => {
  dialog.showErrorBox(
    error.title || 'Error',
    error.message + (IS_DEV ? `\n\n${error.stack}` : '')
  );
};
```

---

**Remember**: This is a production desktop app. Users expect native performance, offline capability, and zero crashes. Every decision should optimize for these goals.