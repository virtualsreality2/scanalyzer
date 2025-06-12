#!/bin/bash
set -e

# Release Management Script for Scanalyzer
# Handles version bumping, changelog generation, and release coordination

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAIN_BRANCH="main"
DEVELOP_BRANCH="develop"
CHANGELOG_FILE="CHANGELOG.md"
VERSION_FILES=(
    "package.json"
    "electron/package.json"
    "frontend/package.json"
    "backend/app/__init__.py"
)

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

log_step() {
    echo -e "\n${BLUE}==>${NC} $1\n"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites"
    
    # Check if on correct branch
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" != "$MAIN_BRANCH" && "$CURRENT_BRANCH" != "$DEVELOP_BRANCH" ]]; then
        log_error "Must be on $MAIN_BRANCH or $DEVELOP_BRANCH branch (currently on $CURRENT_BRANCH)"
    fi
    
    # Check for uncommitted changes
    if [[ -n $(git status -s) ]]; then
        log_error "Uncommitted changes detected. Please commit or stash changes."
    fi
    
    # Pull latest changes
    log_info "Pulling latest changes..."
    git pull origin $CURRENT_BRANCH
    
    # Check if all tests pass
    log_info "Running tests..."
    
    # Backend tests
    log_info "Running backend tests..."
    (cd backend && python -m pytest tests/unit -q) || log_error "Backend tests failed"
    
    # Frontend tests
    log_info "Running frontend tests..."
    (cd frontend && npm run test -- --run) || log_error "Frontend tests failed"
    
    # Check dependencies
    log_info "Checking for outdated dependencies..."
    npm outdated || true
    
    # Security audit
    log_info "Running security audit..."
    npm audit --audit-level=high || log_warn "Security vulnerabilities found"
    
    # Check if required tools are installed
    command -v jq >/dev/null 2>&1 || log_error "jq is required but not installed"
    command -v conventional-changelog >/dev/null 2>&1 || npm install -g conventional-changelog-cli
    command -v semver >/dev/null 2>&1 || npm install -g semver
}

# Get current version
get_current_version() {
    CURRENT_VERSION=$(node -p "require('./package.json').version")
    echo "$CURRENT_VERSION"
}

# Determine next version
determine_next_version() {
    local RELEASE_TYPE=$1
    local CURRENT_VERSION=$(get_current_version)
    
    case $RELEASE_TYPE in
        "major"|"minor"|"patch")
            NEXT_VERSION=$(npx semver -i "$RELEASE_TYPE" "$CURRENT_VERSION")
            ;;
        "premajor"|"preminor"|"prepatch"|"prerelease")
            NEXT_VERSION=$(npx semver -i "$RELEASE_TYPE" "$CURRENT_VERSION" --preid=beta)
            ;;
        *)
            log_error "Invalid release type: $RELEASE_TYPE"
            ;;
    esac
    
    echo "$NEXT_VERSION"
}

# Update version in all files
update_versions() {
    local NEW_VERSION=$1
    
    log_step "Updating version to $NEW_VERSION"
    
    # Update package.json files
    for file in "${VERSION_FILES[@]}"; do
        if [[ -f "$file" ]]; then
            if [[ "$file" == *.json ]]; then
                # Update JSON files
                log_info "Updating $file"
                tmp=$(mktemp)
                jq --arg version "$NEW_VERSION" '.version = $version' "$file" > "$tmp" && mv "$tmp" "$file"
            elif [[ "$file" == *.py ]]; then
                # Update Python files
                log_info "Updating $file"
                sed -i.bak "s/__version__ = .*/__version__ = \"$NEW_VERSION\"/" "$file" && rm "$file.bak"
            fi
        fi
    done
}

# Generate changelog
generate_changelog() {
    local VERSION=$1
    
    log_step "Generating changelog for version $VERSION"
    
    # Generate changelog using conventional commits
    conventional-changelog -p angular -i "$CHANGELOG_FILE" -s
    
    # Generate release notes
    conventional-changelog -p angular -o RELEASE_NOTES.md -r 1
    
    log_info "Changelog generated"
}

# Create git tag
create_tag() {
    local VERSION=$1
    local TAG_NAME="v$VERSION"
    
    log_step "Creating tag $TAG_NAME"
    
    # Commit version changes
    git add .
    git commit -m "chore(release): $VERSION [skip ci]

- Update version numbers
- Generate changelog
"
    
    # Create annotated tag
    git tag -a "$TAG_NAME" -m "Release version $VERSION

See CHANGELOG.md for details"
    
    log_info "Tag $TAG_NAME created"
}

# Build release artifacts
build_release() {
    local VERSION=$1
    
    log_step "Building release artifacts"
    
    # Clean previous builds
    log_info "Cleaning previous builds..."
    rm -rf electron/dist/
    rm -rf frontend/dist/
    rm -rf backend/dist/
    
    # Build backend
    log_info "Building backend..."
    (cd backend && python -m build)
    
    # Build frontend
    log_info "Building frontend..."
    (cd frontend && npm run build)
    
    # Build Electron apps (local build only)
    if [[ "${BUILD_ELECTRON:-false}" == "true" ]]; then
        log_info "Building Electron apps..."
        (cd electron && npm run build && npm run dist)
    else
        log_info "Skipping Electron build (will be built by CI)"
    fi
    
    log_info "Release artifacts built"
}

# Main release process
main() {
    echo "==================================="
    echo "     Scanalyzer Release Manager    "
    echo "==================================="
    
    # Parse arguments
    RELEASE_TYPE=${1:-patch}
    DRY_RUN=${2:-false}
    
    # Validate release type
    case $RELEASE_TYPE in
        major|minor|patch|premajor|preminor|prepatch|prerelease)
            ;;
        *)
            echo "Usage: $0 [major|minor|patch|premajor|preminor|prepatch|prerelease] [dry-run]"
            exit 1
            ;;
    esac
    
    # Check prerequisites
    check_prerequisites
    
    # Get versions
    CURRENT_VERSION=$(get_current_version)
    NEXT_VERSION=$(determine_next_version "$RELEASE_TYPE")
    
    echo ""
    echo "📦 Current version: $CURRENT_VERSION"
    echo "🚀 Next version:    $NEXT_VERSION"
    echo "📝 Release type:    $RELEASE_TYPE"
    echo ""
    
    # Confirm release
    if [[ "$DRY_RUN" != "true" ]]; then
        read -p "Proceed with release? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warn "Release cancelled"
            exit 0
        fi
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "DRY RUN - No changes will be made"
        exit 0
    fi
    
    # Update versions
    update_versions "$NEXT_VERSION"
    
    # Generate changelog
    generate_changelog "$NEXT_VERSION"
    
    # Build release
    build_release "$NEXT_VERSION"
    
    # Create tag
    create_tag "$NEXT_VERSION"
    
    echo ""
    log_info "✅ Release $NEXT_VERSION prepared successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Review the changes: git show"
    echo "2. Review the changelog: cat CHANGELOG.md"
    echo "3. Push to repository: git push && git push --tags"
    echo "4. GitHub Actions will automatically:"
    echo "   - Run all tests"
    echo "   - Build for all platforms"
    echo "   - Create GitHub release"
    echo "   - Upload artifacts"
    echo ""
    echo "🔗 Monitor the release at:"
    echo "   https://github.com/$GITHUB_REPOSITORY/actions"
    echo ""
}

# Run main function
main "$@"