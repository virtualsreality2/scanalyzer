# -*- mode: python ; coding: utf-8 -*-
import sys
from pathlib import Path

# Get the backend directory
backend_dir = Path(__file__).parent
root_dir = backend_dir.parent

# Analysis
a = Analysis(
    ['app/main.py'],
    pathex=[str(backend_dir)],
    binaries=[],
    datas=[
        ('app/parsers', 'app/parsers'),
        ('alembic', 'alembic'),
        ('alembic.ini', '.'),
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'app.parsers.bandit.bandit_parser',
        'app.parsers.checkov.checkov_parser',
        'app.parsers.prowler.prowler_v2_parser',
        'app.parsers.prowler.prowler_v3_parser',
        'app.parsers.document.pdf',
        'app.parsers.document.docx',
        'app.parsers.document.spreadsheet',
        'sqlalchemy.sql.default_comparator',
        'alembic',
        'psycopg2',
        'asyncpg',
        'aiosqlite',
        'pypdf',
        'python-docx',
        'openpyxl',
        'xlrd',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'test', 'tests'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=None,
    noarchive=False,
)

# PYZ
pyz = PYZ(a.pure, a.zipped_data, cipher=None)

# EXE
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='scanalyzer-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(root_dir / 'electron/resources/icons/icon.ico') if sys.platform == 'win32' else None,
)