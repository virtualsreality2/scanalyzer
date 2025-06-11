# Pydantic V2 Migration Guide

This guide documents the changes made to upgrade from Pydantic v1 to v2 in the Scanalyzer backend.

## Key Changes Made

### 1. Import Changes

**Before (v1):**
```python
from pydantic import BaseSettings, Field, validator
```

**After (v2):**
```python
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
```

### 2. Settings Class Configuration

**Before (v1):**
```python
class Settings(BaseSettings):
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True
```

**After (v2):**
```python
class Settings(BaseSettings):
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore"
    }
```

### 3. Field Validators

**Before (v1):**
```python
@validator("field_name", pre=True)
def validate_field(cls, v):
    return v
```

**After (v2):**
```python
@field_validator("field_name", mode="before")
@classmethod
def validate_field(cls, v):
    return v
```

### 4. Field Parameters

**Before (v1):**
```python
field: str = Field(regex="^pattern$")
```

**After (v2):**
```python
field: str = Field(pattern="^pattern$")
```

## Common Issues and Solutions

### Issue 1: BaseSettings Import Error
**Error:** `ImportError: cannot import name 'BaseSettings' from 'pydantic'`
**Solution:** Install `pydantic-settings` and import from there:
```bash
pip install pydantic-settings
```

### Issue 2: Validator Decorator Not Found
**Error:** `NameError: name 'validator' is not defined`
**Solution:** Replace `@validator` with `@field_validator` and add `@classmethod`

### Issue 3: Regex Parameter Removed
**Error:** `pydantic.errors.PydanticUserError: 'regex' is removed. use 'pattern' instead`
**Solution:** Replace all `regex=` with `pattern=` in Field definitions

## Additional Notes

- Pydantic v2 is significantly faster than v1
- The new `model_config` dictionary replaces the nested `Config` class
- Field validators now require explicit `@classmethod` decorator
- The `mode` parameter in `field_validator` replaces the `pre` parameter

## References

- [Official Pydantic V2 Migration Guide](https://docs.pydantic.dev/latest/migration/)
- [Pydantic Settings Documentation](https://docs.pydantic.dev/latest/concepts/pydantic_settings/)